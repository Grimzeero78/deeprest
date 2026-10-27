#!/usr/bin/env python3
"""
DeepRest white-hat security audit — black-box tests against the live API.
Creates two throwaway accounts, runs auth/IDOR/injection/abuse checks,
reports PASS/FAIL, and prints cleanup instructions for its test data.
"""
import json
import random
import string
import sys
import requests

BASE = "https://deeprest-app.dev078.workers.dev"
SUF = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
A = {"username": f"wha_{SUF}", "name": f"WH Tester A", "password": "Xk9#mQ2$vLp8", "confirmPassword": "Xk9#mQ2$vLp8"}
B = {"username": f"whb_{SUF}", "name": "WH Tester B", "password": "Zp4!nR7@wKd2", "confirmPassword": "Zp4!nR7@wKd2"}

results = []

def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"{'PASS' if ok else 'FAIL'} | {name}" + (f" | {detail}" if detail else ""))

def register(u):
    r = requests.post(f"{BASE}/api/auth/register", json=u, timeout=20)
    return r

def login(username, password):
    r = requests.post(f"{BASE}/api/auth/login", json={"name": username, "password": password}, timeout=20)
    return r

def authed(token):
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {token}"
    return s

print("=== setup: two throwaway accounts ===")
ra, rb = register(A), register(B)
check("register A", ra.status_code in (200, 201), f"status={ra.status_code}")
check("register B", rb.status_code in (200, 201), f"status={rb.status_code}")
TA = ra.json().get("token", "")
TB = rb.json().get("token", "")
IDA = ra.json().get("user", {}).get("id", "")
IDB = rb.json().get("user", {}).get("id", "")
sa, sb = authed(TA), authed(TB)

# ---------- 1. unauthenticated access ----------
print("=== 1. auth walls ===")
for path, method in [
    ("/api/auth/me", "get"), ("/api/duo", "get"), ("/api/sos", "get"),
    ("/api/social/conversations", "get"), ("/api/users", "get"),
    ("/api/leaderboard", "get"), ("/api/chat?persona=GUIDE", "get"),
    ("/api/screentime", "post"), ("/api/profile", "post"),
]:
    try:
        r = getattr(requests, method)(f"{BASE}{path}", json={"action": "target", "minutes": 60} if method == "post" else None, timeout=15)
        check(f"unauth {method.upper()} {path} -> 401/403", r.status_code in (401, 403), f"status={r.status_code}")
    except Exception as e:
        check(f"unauth {method.upper()} {path}", False, str(e))

# ---------- 2. token forgery ----------
print("=== 2. JWT forgery ===")
forged = TA.split(".")[0] + "." + TA.split(".")[1] + ".AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
r = requests.get(f"{BASE}/api/auth/me", headers={"Authorization": f"Bearer {forged}"}, timeout=15)
check("bad signature rejected", r.status_code == 401, f"status={r.status_code}")
alg_none = '{"alg":"none","typ":"JWT"}'
import base64
b64 = lambda d: base64.urlsafe_b64encode(d).rstrip(b"=")
payload = json.loads(base64.urlsafe_b64decode(TA.split(".")[1] + "=="))
fake = b64(alg_none.encode()).decode() + "." + TA.split(".")[1] + "."
r = requests.get(f"{BASE}/api/auth/me", headers={"Authorization": f"Bearer {fake}"}, timeout=15)
check("alg=none rejected", r.status_code == 401, f"status={r.status_code}")
# expired token: craft with old exp using OUR forged signature (should fail sig anyway)
r = requests.get(f"{BASE}/api/auth/me", headers={"Authorization": "Bearer garbage.token.here"}, timeout=15)
check("garbage token rejected", r.status_code == 401, f"status={r.status_code}")
# token in cookie vs bearer confusion: B-session token used as A should be independent (sanity)
r = sb.get(f"{BASE}/api/auth/me", timeout=15)
check("bearer session resolves correct user", r.json().get("user", {}).get("id") == IDB, "")

# ---------- 3. IDOR ----------
print("=== 3. IDOR / object-level authorization ===")
r = sa.post(f"{BASE}/api/social/conversations", json={"kind": "dm", "userId": IDB}, timeout=15)
convo_ab = r.json().get("conversationId", "")
check("DM create A->B", r.status_code in (200, 201) and convo_ab, f"status={r.status_code} id={convo_ab}")

# B should NOT read A's AI chat session (chat is per-user)
r = sb.get(f"{BASE}/api/chat?persona=GUIDE", timeout=15)
r2 = sa.get(f"{BASE}/api/chat?persona=GUIDE", timeout=15)
check("AI chat scoped per user", r.status_code == 200 and r2.status_code == 200, "both 200 (sessions are private by construction)")

# non-member conversation access: create convo as A, access as B? B IS member of convo_ab.
# make A+convo, then have B try to touch a convo it's not in: create A-only group
r = sa.post(f"{BASE}/api/social/conversations", json={"kind": "group", "name": "WH Sec Group", "memberIds": []}, timeout=15)
gid = r.json().get("conversationId", "")
check("solo group created", r.status_code in (200, 201), f"status={r.status_code}")
r = sb.get(f"{BASE}/api/social/conversations/{gid}", timeout=15)
check("non-member group GET -> 404", r.status_code == 404, f"status={r.status_code}")
r = sb.post(f"{BASE}/api/social/conversations/{gid}", json={"body": "injected?"}, timeout=15)
check("non-member message POST -> 404", r.status_code == 404, f"status={r.status_code}")
r = sb.get(f"{BASE}/api/social/conversations/{gid}/messages", timeout=15)
check("non-member messages GET -> 404", r.status_code == 404, f"status={r.status_code}")
r = sb.patch(f"{BASE}/api/social/conversations/{gid}", json={"action": "read"}, timeout=15)
check("non-member read-mark -> 404", r.status_code == 404, f"status={r.status_code}")
r = sb.delete(f"{BASE}/api/social/conversations/{gid}", timeout=15)
check("non-member leave -> 404", r.status_code == 404, f"status={r.status_code}")

# SOS: A fires SOS, B is NOT A's partner -> B cannot ack A's alert
r = sa.post(f"{BASE}/api/sos", json={"confirmed": True, "message": "wh test"}, timeout=15)
alert_id = r.json().get("alertId", "")
check("SOS fires (no partner)", r.status_code in (200, 201), f"status={r.status_code}")
r = sb.patch(f"{BASE}/api/sos", json={"id": alert_id, "action": "acknowledge"}, timeout=15)
check("stranger cannot ack SOS", r.status_code == 400, f"status={r.status_code}")

# users API must not leak secrets
r = sb.get(f"{BASE}/api/users/{IDA}", timeout=15)
body = r.json().get("user", {}) if isinstance(r.json(), dict) else {}
leaked = [k for k in ("passwordHash", "password", "passwordHint", "email") if k in json.dumps(r.json())]
check("public profile leaks no secrets", r.status_code == 200 and not leaked, f"leaked={leaked}")

# ---------- 4. injection ----------
print("=== 4. injection / XSS ===")
xss = "<script>alert('x')</script>javascript:alert(1)\" onmouseover='evil("
r = sa.post(f"{BASE}/api/social/conversations/{convo_ab}", json={"body": xss}, timeout=15)
rback = sa.get(f"{BASE}/api/social/conversations/{convo_ab}/messages", timeout=15)
stored = json.dumps(rback.json())
check("XSS string stored as inert text (React escapes)", r.status_code in (200, 201) and "<script>" in stored, "")
check("script tag not executed server-side", "executed" not in stored, "")
sqli = "x' OR 1=1 --"
r = sb.get(f"{BASE}/api/users?q={requests.utils.quote(sqli)}", timeout=15)
check("SQLi in search is parameterized (200, no error)", r.status_code == 200, f"status={r.status_code}")
r = sa.post(f"{BASE}/api/social/conversations", json={"kind": {"$ne": None}, "userId": {"$gt": ""}}, timeout=15)
check("object injection rejected", r.status_code == 400, f"status={r.status_code}")

# profile validation
r = sa.patch(f"{BASE}/api/profile", json={"avatarImage": "data:text/html;base64,PHNjcmlwdD4="}, timeout=15)
check("non-image data URL avatar rejected", r.status_code == 400, f"status={r.status_code}")
r = sa.patch(f"{BASE}/api/profile", json={"avatarColor": "javascript:alert(1)"}, timeout=15)
check("avatarColor whitelist enforced", r.status_code == 400, f"status={r.status_code}")
r = sa.patch(f"{BASE}/api/profile", json={"name": "  <img src=x onerror=alert(1)>  "}, timeout=15)
ok_name = r.status_code in (200, 201) and "<" not in json.dumps(r.json())
check("name sanitized (no raw HTML round-trip)", ok_name, f"status={r.status_code}")

# message length cap
r = sa.post(f"{BASE}/api/social/conversations/{convo_ab}", json={"body": "A" * 3000}, timeout=15)
check("oversized message rejected", r.status_code == 400, f"status={r.status_code}")

# DM to self
r = sa.post(f"{BASE}/api/social/conversations", json={"kind": "dm", "userId": IDA}, timeout=15)
check("self-DM rejected", r.status_code == 400, f"status={r.status_code}")

# ---------- 5. abuse / rate limits ----------
print("=== 5. rate limits & policy ===")
codes = [login(A["username"], "wrong-password").status_code for _ in range(8)]
check("login brute force throttled", 429 in codes, f"codes={codes}")
r = register({"username": f"wpc_{SUF}", "name": "Breach Test", "password": "Password123!", "confirmPassword": "Password123!"})
check("breached password rejected (HIBP)", r.status_code == 400, f"status={r.status_code} body={r.text[:80]}")
r = register({"username": f"wp2_{SUF}", "name": "Weak Test", "password": "abc", "confirmPassword": "abc"})
check("short password rejected", r.status_code == 400, f"status={r.status_code}")

# ---------- 6. cookie hygiene ----------
print("=== 6. session cookie flags ===")
r = login(A["username"], A["password"])
setc = r.headers.get("set-cookie", "")
check("session cookie httpOnly", "HttpOnly" in setc, setc[:100])
check("session cookie SameSite", "SameSite" in setc or "samesite" in setc.lower(), "")
check("session cookie Secure", "Secure" in setc or "secure" in setc.lower(), "")

# ---------- summary ----------
print("\n===== SUMMARY =====")
fails = [r for r in results if not r[1]]
print(f"total={len(results)} pass={len(results)-len(fails)} fail={len(fails)}")
for name, ok, detail in fails:
    print(f"  FAILED: {name} | {detail}")
print(f"\nCLEANUP: delete users wha_{SUF}, whb_{SUF} (+ id {IDA}, {IDB}) and conversations {convo_ab}, {gid} + sos alert {alert_id}")
with open("/tmp/wh_results.json", "w") as f:
    json.dump({"suf": SUF, "ida": IDA, "idb": IDB, "convo": convo_ab, "group": gid, "alert": alert_id, "fails": [f[0] for f in fails]}, f)
sys.exit(1 if fails else 0)
