from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contest_fetcher import get_contests
from datetime import datetime, timezone, timedelta

app = FastAPI(title="Contest Reminder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

IST = timezone(timedelta(hours=5, minutes=30))


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