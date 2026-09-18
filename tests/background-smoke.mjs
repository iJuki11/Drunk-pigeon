import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { inflateSync } from "node:zlib";

const ParallaxRuntime = createRequire(import.meta.url)("../assets/backgrounds/renderer.js");
const project = JSON.parse(fs.readFileSync(new URL("../assets/backgrounds/background.parallax.json", import.meta.url), "utf8"));
const images = new Map(project.assets.map((asset) => [asset.id, asset]));
let drawImageCalls = 0;
const scaleCalls = [];
const context = {
  globalAlpha: 1,
  save() {},
  restore() {},
  scale(...values) { scaleCalls.push(values); },
  beginPath() {},
  rect() {},
  clip() {},
  clearRect() {},
  translate() {},
  drawImage() { drawImageCalls += 1; },
};

for (const cameraX of [0, 1234, 4500, 18000]) {
  ParallaxRuntime.render(context, project.scene, images, cameraX, {
    width: 1280,
    height: 720,
    viewportWidth: project.scene.canvas.width,
  });
}

assert.ok(drawImageCalls > 0, "render() should issue drawImage calls");
assert.ok(scaleCalls.length > 0, "render() should scale the scene");
const rendererScales = scaleCalls.filter(([scaleX, scaleY]) => scaleX !== 1 && scaleY !== 1);
assert.ok(rendererScales.length === 4, "each render() call should set one scene scale");
assert.ok(rendererScales.every(([scaleX, scaleY]) => scaleX === scaleY), "render() must use uniform scaling");

const pngRows = new Map();
function alphaRow(asset, y) {
  const key = `${asset.id}:${y}`;
  if (pngRows.has(key)) return pngRows.get(key);
  const bytes = Buffer.from(asset.data.slice(asset.data.indexOf(",") + 1), "base64");
  let width;
  let height;
  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, "coverage assets must use 8-bit PNGs");
      assert.equal(data[9], 6, "coverage assets must use RGBA PNGs");
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  assert.ok(y >= 0 && y < height, `coverage row ${y} must be inside ${asset.id}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)];
    const source = raw.subarray(row * (stride + 1) + 1, row * (stride + 1) + 1 + stride);
    const destination = pixels.subarray(row * stride, (row + 1) * stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? destination[x - 4] : 0;
      const above = row ? pixels[(row - 1) * stride + x] : 0;
      const upperLeft = row && x >= 4 ? pixels[(row - 1) * stride + x - 4] : 0;
      let value = source[x];
      if (filter === 1) value = (value + left) & 255;
      else if (filter === 2) value = (value + above) & 255;
      else if (filter === 3) value = (value + Math.floor((left + above) / 2)) & 255;
      else if (filter === 4) {
        const p = left + above - upperLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - above);
        const pc = Math.abs(p - upperLeft);
        value = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? above : upperLeft)) & 255;
      }
      destination[x] = value;
    }
  }
  const row = new Uint8Array(width);
  for (let x = 0; x < width; x += 1) row[x] = pixels[y * stride + x * 4 + 3];
  pngRows.set(key, row);
  return row;
}

const coverageLayers = [
  "sky",
  "cfb105b7-44de-4982-a88c-84f13653309b",
  "house",
  "trees",
  "cafe",
  "hedge",
  "82c54401-398e-4a44-92df-d15f4860c269",
  "70818334-8b80-4ba9-860c-eb223415bda3",
  "42111777-a740-486f-8194-a14ab98980f6",
  "road",
];
function coverageAt(cameraX, y = 585, layers = coverageLayers, designOffset) {
  const width = project.scene.canvas.width;
  const covered = new Uint8Array(width);
  const recordingContext = {
    globalAlpha: 1,
    x: 0,
    y: 0,
    state: [],
    save() { this.state.push([this.x, this.y]); },
    restore() { [this.x, this.y] = this.state.pop(); },
    scale() {},
    beginPath() {},
    rect() {},
    clip() {},
    clearRect() {},
    translate(x, translateY) { this.x += x; this.y += translateY; },
    x: 0,
    y: 0,
    drawImage(asset, _sx, _sy, drawWidth, drawHeight) {
      const row = alphaRow(asset, Math.round(y - this.y));
      const left = Math.round(this.x);
      for (let sourceX = 0; sourceX < row.length; sourceX += 1) {
        if (row[sourceX] > 0) {
          const destinationX = left + Math.floor(sourceX * drawWidth / row.length);
          if (destinationX >= 0 && destinationX < width) covered[destinationX] = 1;
        }
      }
    },
  };
  for (const layer of layers) {
    ParallaxRuntime.render(recordingContext, project.scene, images, cameraX, {
      width,
      height: project.scene.canvas.height,
      viewportWidth: width,
      onlyLayer: layer,
      ...(designOffset === undefined ? {} : { designOffset }),
    });
  }
  return covered;
}
function gaps(covered) {
  const missing = [];
  for (let x = 0; x < covered.length; x += 1) if (!covered[x]) missing.push(x);
  return missing;
}
function longestGap(covered) {
  let longest = 0;
  let current = 0;
  for (const pixel of covered) {
    current = pixel ? 0 : current + 1;
    longest = Math.max(longest, current);
  }
  return longest;
}
function phaseSignature(cameraX) {
  const calls = [];
  const phaseContext = {
    globalAlpha: 1,
    save() {}, restore() {}, scale() {}, beginPath() {}, rect() {}, clip() {}, clearRect() {}, translate() {},
    drawImage(asset, _sx, _sy, width, height) { calls.push(`${asset.id}:${width}x${height}`); },
  };
  ParallaxRuntime.render(phaseContext, project.scene, images, cameraX, { width: 1280, height: 720, viewportWidth: project.scene.canvas.width });
  return [...new Set(calls.filter((call) => call.endsWith(":4096x724")).map((call) => call.split(":", 1)[0]))].sort().join("|");
}

for (const cameraX of [1000, 5500, 91000, 13500]) {
  const missing = gaps(coverageAt(cameraX));
  assert.equal(missing.length, 0, `visible row Y=585 must be covered at cameraX=${cameraX}`);
}
const foregroundLayers = ["cafe", "hedge", "82c54401-398e-4a44-92df-d15f4860c269", "70818334-8b80-4ba9-860c-eb223415bda3", "42111777-a740-486f-8194-a14ab98980f6"];
const initialGap = longestGap(coverageAt(0, 585, foregroundLayers));
const growingGap = longestGap(coverageAt(13500, 585, foregroundLayers));
const alignedGap = longestGap(coverageAt(13500, 585, foregroundLayers, 0));
assert.ok(growingGap <= initialGap, "foreground coverage must not grow a gap at cameraX=13500");
assert.ok(alignedGap <= initialGap, "same-phase parallax alignment must remove the growing gap");
assert.equal(phaseSignature(1000), phaseSignature(5500), "same cameraX mod 4500 must render the same phase");
assert.equal(phaseSignature(1000), phaseSignature(91000), "phase must remain deterministic over many passes");
assert.equal(1000 % 4500, 1000, "phase must be measured against the 4500px scene loop");
console.log(`background smoke: ok (${drawImageCalls} drawImage calls, uniform scale, covered Y=585, phases and multi-pass gaps checked)`);
