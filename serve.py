"""Local development server for the LeadForge static site.

Python's built-in `http.server` speaks HTTP/1.0 and closes the socket after
every single response. Browsers (and embedded preview panes) can surface that
abrupt close as `net::ERR_ABORTED`. This server fixes that by:

  * speaking HTTP/1.1 with keep-alive,
  * handling requests on threads so parallel asset loads never queue,
  * disabling caching so edits show up on refresh,
  * serving the repository root (where index.html lives).

Usage:

    py serve.py            # then open http://127.0.0.1:8765/
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8765
ROOT = Path(__file__).resolve().parent


class DevHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s %s\n" % (self.address_string(), fmt % args))


def main():
    handler = partial(DevHandler, directory=str(ROOT))
    with ThreadingHTTPServer((HOST, PORT), handler) as httpd:
        print("LeadForge dev server -> http://%s:%d/  (Ctrl+C to stop)" % (HOST, PORT))
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
