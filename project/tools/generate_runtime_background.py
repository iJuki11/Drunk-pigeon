"""Build a smaller lossless background for the game from the editor export.

Requires Pillow: python3 -m pip install Pillow
Run from the project root: python3 tools/generate_runtime_background.py
The original editor JSON stays untouched.
"""

from __future__ import annotations

import base64
import io
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/backgrounds/background.parallax.json"
TARGET = ROOT / "assets/backgrounds/background.runtime.json"
SKIP = {"sky", "sun", "clouds", "cfb105b7-44de-4982-a88c-84f13653309b"}


def main() -> None:
    project = json.loads(SOURCE.read_text(encoding="utf-8"))
    scene = project["scene"]
    scene["layers"] = [layer for layer in scene["layers"] if layer["id"] not in SKIP]
    assets = {asset["id"]: asset for asset in project["assets"]}
    kept_assets = {}
    removed_objects = 0
    original_pixels = 0
    runtime_pixels = 0

    for layer in scene["layers"]:
        kept_objects = []
        for obj in layer["objects"]:
            asset = assets[obj["assetId"]]
            if asset["id"] not in kept_assets:
                raw = base64.b64decode(asset["data"].split(",", 1)[1])
                image = Image.open(io.BytesIO(raw))
                image.load()
                if "A" not in image.getbands():
                    bbox = (0, 0, image.width, image.height)
                else:
                    bbox = image.getchannel("A").getbbox()
                original_pixels += image.width * image.height
                if bbox is None:
                    kept_assets[asset["id"]] = None
                else:
                    cropped = image.crop(bbox)
                    stream = io.BytesIO()
                    cropped.save(stream, format="PNG", optimize=True)
                    copy = {key: value for key, value in asset.items() if key != "data"}
                    copy["width"], copy["height"] = cropped.size
                    copy["data"] = "data:image/png;base64," + base64.b64encode(stream.getvalue()).decode("ascii")
                    kept_assets[asset["id"]] = (copy, bbox, image.size)
                    runtime_pixels += cropped.width * cropped.height

            trimmed = kept_assets[asset["id"]]
            if trimmed is None:
                removed_objects += 1
                continue
            _, (left, top, right, bottom), (width, height) = trimmed
            copy = dict(obj)
            scale_x = obj["width"] / width
            scale_y = obj["height"] / height
            copy["x"] = obj["x"] + left * scale_x
            copy["y"] = obj["y"] + top * scale_y
            copy["width"] = (right - left) * scale_x
            copy["height"] = (bottom - top) * scale_y
            kept_objects.append(copy)
        layer["objects"] = kept_objects

    project["assets"] = [entry[0] for entry in kept_assets.values() if entry]
    TARGET.write_text(json.dumps(project, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {TARGET.relative_to(ROOT)}")
    print(f"Image pixels: {original_pixels:,} -> {runtime_pixels:,} ({runtime_pixels / original_pixels:.1%})")
    print(f"Removed transparent objects: {removed_objects}")
    print(f"JSON bytes: {SOURCE.stat().st_size:,} -> {TARGET.stat().st_size:,}")


if __name__ == "__main__":
    main()
