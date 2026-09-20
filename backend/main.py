from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager
import asyncio
from datetime import datetime, timezone, timedelta

from contest_fetcher import get_contests
from push_notifications import (
    save_subscription,
    remove_subscription,
    send_push_to_all,
    VAPID_PUBLIC_KEY,
)

IST = timezone(timedelta(hours=5, minutes=30))

NOTIFY_1H_MS = 60 * 60 * 1000
NOTIFY_15M_MS = 15 * 60 * 1000
NOTIFY_BUFFER_MS = 5 * 60 * 1000
notified = set()


async def check_and_send_reminders():
    try:
        contests = get_contests()
    except Exception as e:
        print(f"[scheduler] fetch error: {e}")
        return

    now_ms = datetime.now(IST).timestamp() * 1000

    for c in contests:
        try:
            start_ms = datetime.fromisoformat(c["start"]).timestamp() * 1000
        except Exception:
            continue

        time_until = start_ms - now_ms
        if time_until < 0:
            continue

        id_1h = f"{c['site']}|{c['name']}|1h"
        id_15m = f"{c['site']}|{c['name']}|15m"

        if (NOTIFY_1H_MS - NOTIFY_BUFFER_MS) <= time_until <= (NOTIFY_1H_MS + NOTIFY_BUFFER_MS):
            if id_1h not in notified:
                send_push_to_all(
                    title=f"⏰ 1 hour to go: {c['site']}",
                    body=f"{c['name']}\nStarts at {c['start_time']} IST",
                    url=c.get("url", "/"),
                )
                notified.add(id_1h)

        if (NOTIFY_15M_MS - NOTIFY_BUFFER_MS) <= time_until <= (NOTIFY_15M_MS + NOTIFY_BUFFER_MS):
            if id_15m not in notified:
                send_push_to_all(
                    title=f"🚨 15 minutes: {c['site']}",
                    body=f"{c['name']}\nGet ready! Starts at {c['start_time']} IST",
                    url=c.get("url", "/"),
                )
                notified.add(id_15m)

    if len(notified) > 1000:
        notified.clear()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async def loop():
        await asyncio.sleep(30)
        while True:
            await check_and_send_reminders()
            await asyncio.sleep(5 * 60)

    task = asyncio.create_task(loop())
    print("[scheduler] started")
    yield
    task.cancel()


app = FastAPI(title="Contest Reminder API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict
    expirationTime: Optional[float] = None


@app.get("/")
def root():
    return {"status": "ok", "message": "Contest Reminder API running"}


@app.get("/api/contests")
def contests():
    data = get_contests()
    return {
        "contests": data,
        "updated": datetime.now(IST).isoformat(),
        "count": len(data),
    }


@app.get("/api/today")
def today():
    data = get_contests()
    today_date = str(datetime.now(IST).date())
    return [c for c in data if c["date"] == today_date]


@app.get("/api/vapid-public-key")
def vapid_public_key():
    return {"publicKey": VAPID_PUBLIC_KEY}


@app.post("/api/subscribe")
async def subscribe(sub: PushSubscription):
    ok = save_subscription(sub.dict())
    return {"ok": ok}


@app.post("/api/unsubscribe")
async def unsubscribe(request: Request):
    body = await request.json()
    endpoint = body.get("endpoint")
    if endpoint:
        remove_subscription(endpoint)
    return {"ok": True}


@app.post("/api/test-push")
async def test_push():
    send_push_to_all(
        title="🧪 Test Notification",
        body="Backend push working hai! Ab automatic aayega.",
    )
    return {"ok": True}