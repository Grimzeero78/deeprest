#!/usr/bin/env python3
"""DeepRest production E2E — verifies every feature the user asked for."""
import json, time, urllib.request, urllib.error, urllib.parse, hashlib

BASE = "https://deeprest-app.dev078.workers.dev"
results = []

UA = "Mozilla/5.0 (DeepRest-E2E-Check)"

def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", UA)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=60) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}

def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS" if ok else "FAIL"), "-", name, ("| " + str(detail)[:110] if detail else ""))

# ---------- 1. favicon ----------
req = urllib.request.Request(BASE + "/favicon.ico")
req.add_header("User-Agent", UA)
with urllib.request.urlopen(req, timeout=30) as r:
    ico = r.read()
check("favicon.ico served", r.status == 200 and ico[:3] == b"\x00\x00\x01" and len(ico) > 1000, f"status={r.status} bytes={len(ico)} magic_ok={ico[:3]==b'\\x00\\x00\\x01'}")

html = urllib.request.urlopen(urllib.request.Request(BASE + "/", headers={"User-Agent": UA}), timeout=30).read().decode()
check("HTML links cache-busted moon favicon", "/favicon.ico?v=2" in html and "/icon.svg?v=2" in html, "cache-bust links present")
check("no z.ai reference in HTML", "z.ai" not in html.lower())

# ---------- 2. breached password blocked at register ----------
s, d = call("POST", "/api/auth/register", {"name": "Breach Tester E2E", "password": "Password123", "confirmPassword": "Password123"})
check("breached password (Password123) blocked", s == 400 and "breach" in json.dumps(d).lower(), f"status={s} err={d.get('error','')[:80]}")

# ---------- 3. register two safe users ----------
ts = str(int(time.time()))
nameA, nameB = f"Tester A{ts[-5:]}", f"Tester B{ts[-5:]}"
s, d = call("POST", "/api/auth/register", {"name": nameA, "password": f"StrongPass{ts[-6:]}!x", "confirmPassword": f"StrongPass{ts[-6:]}!x"})
check("register user A", s == 200 and d.get("token"), f"status={s}")
tokA, idA = d.get("token"), d.get("user", {}).get("id")
s, d = call("POST", "/api/auth/register", {"name": nameB, "password": f"OtherPass{ts[-6:]}!x", "confirmPassword": f"OtherPass{ts[-6:]}!x"})
check("register user B", s == 200 and d.get("token"), f"status={s}")
tokB, idB = d.get("token"), d.get("user", {}).get("id")

# ---------- 4. me + profile ----------
s, d = call("GET", "/api/auth/me", token=tokA)
check("/me works", s == 200 and d.get("user", {}).get("name") == nameA, f"status={s}")

s, d = call("PATCH", "/api/profile", {"bio": "Resting in God's peace", "avatarEmoji": "TM"},
            token=tokA)
if s == 404 or s == 405:  # method fallback — try PUT
    s, d = call("PUT", "/api/profile", {"bio": "Resting in God's peace", "avatarEmoji": "TM"}, token=tokA)
check("profile update (bio+emoji)", s == 200 and d.get("user", {}).get("bio") == "Resting in God's peace", f"status={s} {str(d)[:80]}")

s, d = call("GET", f"/api/users?q={urllib.parse.quote(nameA[:8])}", token=tokB)
found = any(u.get("id") == idA for u in d.get("users", []))
check("directory search finds A (with rank field)", s == 200 and found and "rank" in json.dumps(d), f"status={s}")

# ---------- 5. DM ----------
s, d = call("POST", "/api/social/conversations", {"kind": "dm", "userId": idB}, token=tokA)
check("create DM A->B", s == 201 and d.get("conversationId"), f"status={s}")
dm_id = d.get("conversationId")

s, d = call("POST", f"/api/social/conversations/{dm_id}", {"body": "Hey B, stay strong tonight!"}, token=tokA)
check("send DM message", s in (200, 201), f"status={s}")

s, d = call("GET", f"/api/social/conversations/{dm_id}/messages", token=tokB)
msgs = d.get("messages", [])
check("B reads DM", s == 200 and any("stay strong" in m.get("body", "") for m in msgs), f"status={s} count={len(msgs)}")

s, d = call("GET", "/api/social/conversations", token=tokB)
lst = d.get("conversations", [])
check("B's chat list shows DM with unread badge", s == 200 and len(lst) == 1 and lst[0].get("unreadCount", 0) >= 1 and lst[0].get("peer", {}).get("name") == nameA, f"status={s} unread={lst[0].get('unreadCount') if lst else 'n/a'}")

# ---------- 6. group ----------
s, d = call("POST", "/api/social/conversations", {"kind": "group", "name": "Rest Warriors", "emoji": "TP", "memberIds": [idB]}, token=tokA)
check("create group with B", s == 201 and d.get("conversationId"), f"status={s}")
grp = d.get("conversationId")

s, d = call("POST", f"/api/social/conversations/{grp}", {"body": "Welcome to the group!"}, token=tokA)
s2, d2 = call("POST", f"/api/social/conversations/{grp}", {"body": "Glad to be here."}, token=tokB)
check("both post in group", s in (200, 201) and s2 in (200, 201), f"A={s} B={s2}")

s, d = call("GET", f"/api/social/conversations/{grp}/messages", token=tokA)
check("group history visible to A", s == 200 and len(d.get("messages", [])) >= 3, f"count={len(d.get('messages', []))}")  # system msg + 2

# ---------- 7. Shepherd AI — no verse references ----------
s, d = call("POST", "/api/chat", {"persona": "SHEPHERD", "message": "I keep falling back into TikTok at night. Please encourage me from the Bible."}, token=tokA)
reply = d.get("message", {}).get("content", "")
check("Shepherd AI replied", s == 200 and len(reply) > 50, f"status={s} len={len(reply)}")

import re
books = r"(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalm|Psalms|Proverbs|Ecclesiastes|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Mica|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)"
verse_cited = re.search(books, reply, re.IGNORECASE) or re.search(r"\d+:\d+", reply)
check("Shepherd does NOT cite book/verse", verse_cited is None, f"match={verse_cited.group(0) if verse_cited else None}")
attr = re.search(r"(God says|Jesus says|Jesus teaches|Scripture says|It is written|The Lord promises|His Word|The Word)", reply, re.IGNORECASE)
check("Shepherd attributes via 'God says/Jesus says' style", attr is not None, f"found={attr.group(0) if attr else None}")
print("   Shepherd reply:", reply[:220].replace("\n", " "))

# ---------- 8. clear chat ----------
s, d = call("DELETE", "/api/chat?persona=SHEPHERD", token=tokA)
s2, d2 = call("GET", "/api/chat?persona=SHEPHERD", token=tokA)
check("clear AI chat works", s == 200 and s2 == 200 and len(d2.get("messages", [])) == 0, f"del={s} cleared={d.get('cleared')} after={len(d2.get('messages', []))}")

# ---------- 9. leaderboard with ranks ----------
s, d = call("GET", "/api/leaderboard", token=tokA)
leaders = d.get("leaders", [])
has_ranks = all("rank" in json.dumps(u) for u in leaders) and "position" in json.dumps(d)
check("leaderboard shows all users with ranks + my position", s == 200 and len(leaders) >= 2 and has_ranks and d.get("me", {}).get("position", 0) >= 1, f"leaders={len(leaders)} myPos={d.get('me',{}).get('position')}")

# ---------- summary ----------
fails = [r for r in results if not r[1]]
print(f"\n===== {len(results) - len(fails)}/{len(results)} PASSED =====")
if fails:
    print("FAILED:")
    for n, _, det in fails:
        print(" -", n, "|", det)
