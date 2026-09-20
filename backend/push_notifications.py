import os
import json
from pywebpush import webpush, WebPushException
from dotenv import load_dotenv

load_dotenv()

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "").replace("\\n", "\n")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:test@example.com")

subscriptions = {}


def save_subscription(sub_data):
    endpoint = sub_data.get("endpoint")
    keys = sub_data.get("keys")
    if not endpoint or not keys:
        return False
    subscriptions[endpoint] = sub_data
    print(f"[push] Saved subscription. Total: {len(subscriptions)}")
    return True


def remove_subscription(endpoint):
    if endpoint in subscriptions:
        del subscriptions[endpoint]


def send_push_to_all(title, body, url="/"):
    if not VAPID_PRIVATE_KEY:
        print("[push] VAPID keys not configured")
        return 0

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "icon": "/icon-192.png",
    })

    sent = 0
    dead = []

    for endpoint, sub in list(subscriptions.items()):
        try:
            webpush(
                subscription_info=sub,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
            sent += 1
        except WebPushException as e:
            print(f"[push] Failed: {e}")
            if "410" in str(e) or "404" in str(e):
                dead.append(endpoint)

    for ep in dead:
        remove_subscription(ep)

    print(f"[push] Sent: {sent}, Dead removed: {len(dead)}")
    return sent