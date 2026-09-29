"""Local test server for Content Base.

Same as `python3 -m http.server`, but tells the browser not to keep old copies,
so a normal refresh always shows the latest changes.

    python3 tools/dev-server.py        # then open http://localhost:8000
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Content Base test server: http://localhost:{port}  (press Ctrl+C to stop)")
    http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
