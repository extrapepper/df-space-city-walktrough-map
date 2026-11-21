import http.server
import functools
import os
from pathlib import Path
import webbrowser

root = Path(__file__).resolve().parent / "dist"
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
try:
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    url = f"http://127.0.0.1:{server.server_port}/"
    print(url, flush=True)
    if os.environ.get("ATLAS_NO_BROWSER") != "1":
        webbrowser.open(url)
    server.serve_forever()
except KeyboardInterrupt:
    pass
