# Local Jev preview

This preview serves the existing game locally and injects a small Jev pilot only when the URL includes `?jev=1`. The API key is read by Python from the workspace root `.env` (`TYPESAFE_API_KEY`) or the server process environment. It is never sent to the browser or included in server request logs.

From the repository workspace root, start it with:

```sh
python3 igra/project/preview/server.py
```

Then open [http://127.0.0.1:8765/?jev=1](http://127.0.0.1:8765/?jev=1). The preview auto-starts and replays the game. The overlay shows Jev's Choice and its probability distribution, confidence, request latency, or an error. The simulation runs at 0.4× speed in preview so remote decisions can keep up. The bot asks about every 700 ms while playing; each answer can queue at most one flap. It pauses after 60 API decisions; use the visible button to resume. API calls may consume account usage.

This is for local experimentation. The server binds only to `127.0.0.1`; the standard game can be viewed at `http://127.0.0.1:8765/` without the preview injection. Change the port with `JEV_PREVIEW_PORT` if needed. Requires Python 3 and a valid `TYPESAFE_API_KEY` in the workspace `.env`.

The narrow Choice uses numeric player position/velocity, ground and ceiling lines, and up to six nearest moving bird/airplane positions. It is an experimental controller; service latency means it will not react like a frame-by-frame physics controller.
