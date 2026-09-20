import requests
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))
BASE_URL = "https://contest-hive.vercel.app/api"

# Platform slug -> Display name
PLATFORMS = {
    "codeforces": "CodeForces",
    "codechef": "CodeChef",
    "atcoder": "AtCoder",
    "leetcode": "LeetCode",
    "hackerearth": "HackerEarth",
    "hackerrank": "HackerRank",
    "toph": "Toph",
}

_cache = {"data": None, "time": 0}


def _parse_time(s):
    """Try parsing multiple time formats."""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(IST)
    except Exception:
        return None


def get_contests():
    now_ts = datetime.now().timestamp()
    if _cache["data"] and (now_ts - _cache["time"]) < 600:
        return _cache["data"]

    result = []
    now = datetime.now(IST)

    for slug, display_name in PLATFORMS.items():
        try:
            r = requests.get(f"{BASE_URL}/{slug}", timeout=15)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"[fetcher] {slug} error: {e}")
            continue

        # Response sometimes is a list, sometimes dict with 'contests'
        if isinstance(data, dict):
            contests = data.get("contests") or data.get("data") or []
        else:
            contests = data

        for c in contests:
            try:
                start = _parse_time(c.get("startTime") or c.get("start_time"))
                end = _parse_time(c.get("endTime") or c.get("end_time"))
                if not start:
                    continue

                duration = "N/A"
                if end:
                    diff = end - start
                    h = int(diff.total_seconds() // 3600)
                    m = int((diff.total_seconds() % 3600) // 60)
                    duration = f"{h}h {m}m"

                if end and start <= now <= end:
                    status = "live"
                elif start > now:
                    status = "upcoming"
                else:
                    status = "ended"

                result.append({
                    "site": display_name,
                    "name": c.get("name") or c.get("title") or "Untitled",
                    "start": start.isoformat(),
                    "start_time": start.strftime("%I:%M %p"),
                    "date": str(start.date()),
                    "duration": duration,
                    "url": c.get("url") or c.get("link") or "",
                    "status": status,
                })
            except (ValueError, KeyError) as e:
                print(f"[fetcher] parse error: {e}")
                continue

    result.sort(key=lambda x: x["start"])
    _cache["data"] = result
    _cache["time"] = now_ts
    print(f"[fetcher] Total contests fetched: {len(result)}")
    return result