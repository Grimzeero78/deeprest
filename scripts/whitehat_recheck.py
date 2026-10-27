#!/usr/bin/env python3
"""Re-run the 6 findings that failed the first audit round, with corrected test logic."""
import json, random, string, requests

BASE = "https://deeprest-app.dev078.workers.dev"
SUF = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
NAME_A = "WH Audit A"
A = {"username": f"wha2_{SUF}", "name": NAME_A, "password": "Xk9#mQ2$vLp8", "confirmPassword": "Xk9#mQ2$vLp8"}
B = {"username": f"whb2_{SUF}", "name": "WH Audit B", "password": "Zp4!nR7@wKd2", "confirmPassword": "Zp4!nR7@wKd2"}

fails = []
def check(name, ok, detail=""):
    print(f"{'PASS' if ok else 'FAIL'} | {name}" + (f" | {detail}" if detail else ""))
    if not ok: fails.append(name)

ra = requests.post(f"{BASE}/api/auth/register", json=A, timeout=20)
rb = requests.post(f"{BASE}/api/auth/register", json=B, timeout=20)
TA = ra.json()["token"]; IDA = ra.json()["user"]["id"]; IDB = rb.json()["user"]["id"]
real_login_name = A["name"]  # login derives from NAME, not the username field

# --- 1. cookie flags on real successful login ---
r = requests.post(f"{BASE}/api/auth/login", json={"name": real_login_name, "password": A["password"]}, timeout=20)
sc = r.headers.get("set-cookie", "")
check("login 200 + Set-Cookie present", r.status_code == 200 and "deeprest_session=" in sc, f"status={r.status_code}")
check("cookie HttpOnly", "HttpOnly" in sc)
check("cookie SameSite", "samesite" in sc.lower())
check("cookie Secure", "Secure" in sc)

# --- 2. login brute force: 12 wrong-password attempts (limit 10/min per IP) ---
codes = [requests.post(f"{BASE}/api/auth/login", json={"name": real_login_name, "password": "definitely-wrong"}, timeout=20).status_code for _ in range(12)]
check("login brute force throttled (429 appears)", 429 in codes, f"codes={codes}")

# --- 3. name sanitization: HTML metacharacters stripped ---
s = requests.Session(); s.headers["Authorization"] = f"Bearer {TA}"
r = s.patch(f"{BASE}/api/profile", json={"name": "<img src=x onerror=alert(1)>"}, timeout=20)
body = json.dumps(r.json())
check("name HTML chars stripped", r.status_code == 200 and "<" not in body and "onerror" not in body, body[:120])
# rename also moved the username -> login as the new name works
new_name = r.json()["user"]["name"]
r2 = requests.post(f"{BASE}/api/auth/login", json={"name": new_name, "password": A["password"]}, timeout=20)
check("rename updates login identity (login with new name)", r2.status_code == 200, f"new={new_name!r} status={r2.status_code}")
# clash check: B tries to take A's name
r3 = requests.post(f"{BASE}/api/auth/register", json={"username": f"whc2_{SUF}", "name": new_name, "password": "Zp4!nR7@wKd2", "confirmPassword": "Zp4!nR7@wKd2"}, timeout=20)
check("duplicate login name rejected at register", r3.status_code == 400, f"status={r3.status_code}")

# --- 4. oversized message: truncates to cap (stored <= 2000) ---
r = s.post(f"{BASE}/api/social/conversations", json={"kind": "dm", "userId": IDB}, timeout=20)
convo = r.json()["conversationId"]
r = s.post(f"{BASE}/api/social/conversations/{convo}", json={"body": "A" * 3000}, timeout=20)
r2 = s.get(f"{BASE}/api/social/conversations/{convo}/messages", timeout=20)
msgs = [m for m in r2.json()["messages"] if m["senderId"] == IDA and m["body"].startswith("AAA")]
stored_len = max((len(m["body"]) for m in msgs), default=0)
check("oversized message capped at 2000", r.status_code in (200, 201) and stored_len <= 2000, f"stored={stored_len}")

print("\nFAILS:", fails if fails else "none")
print(f"CLEANUP users: wha2_{SUF} ({IDA}), whb2_{SUF} ({IDB})")
with open("/tmp/wh2_cleanup.json", "w") as f:
    json.dump({"users": [IDA, IDB], "convo": convo}, f)
