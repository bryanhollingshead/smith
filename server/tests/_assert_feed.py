#!/usr/bin/env python3
"""Assert a given post id appears in the feed JSON on stdin with >=1 like and >=1 comment."""
import json, sys, os

pid = int(os.environ["POST_ID"])
data = json.load(sys.stdin)
posts = data["posts"]
matches = [p for p in posts if p["id"] == pid]
if not matches:
    seen = [p["id"] for p in posts]
    sys.exit(f"post {pid} not in feed; saw ids={seen}")
m = matches[0]
assert m["stats"]["likes"]    >= 1, f"likes={m['stats']}"
assert m["stats"]["comments"] >= 1, f"comments={m['stats']}"
