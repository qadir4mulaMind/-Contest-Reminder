const API = "http://localhost:8000";
let currentTab = "today";
let allContests = [];
let countdownInterval = null;

async function loadContests() {
    try {
        document.getElementById("status").textContent = "Loading...";
        const res = await fetch(`${API}/api/contests`);
        const data = await res.json();
        allContests = data.contests;
        document.getElementById("status").textContent =
            `Updated: ${new Date(data.updated).toLocaleTimeString()} • ${data.count} contests`;
        render();
        startCountdown();
    } catch (e) {
        document.getElementById("status").textContent = "❌ Backend not reachable";
        console.error(e);
    }
}

function formatDuration(ms) {
    if (ms < 0) return "0s";
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function getStatusText(c) {
    const now = new Date();
    const start = new Date(c.start);
    const durationMatch = (c.duration || "").match(/(\d+)h\s*(\d+)m/);
    let end = new Date(start);
    if (durationMatch) {
        end = new Date(start.getTime() + (parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2])) * 60000);
    } else {
        end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    }

    if (now >= start && now <= end) {
        return { text: `🔴 LIVE • ${formatDuration(now - start)} elapsed`, cls: "live" };
    } else if (now < start) {
        return { text: `⏳ Starts in ${formatDuration(start - now)}`, cls: "upcoming" };
    } else {
        return { text: `✅ Ended`, cls: "ended" };
    }
}

function render() {
    const list = document.getElementById("contest-list");
    const today = new Date().toISOString().split("T")[0];
    let filtered = [];

    if (currentTab === "today") {
        filtered = allContests.filter(c => c.date === today);
    } else if (currentTab === "live") {
        filtered = allContests.filter(c => {
            const now = new Date();
            const start = new Date(c.start);
            const durationMatch = (c.duration || "").match(/(\d+)h\s*(\d+)m/);
            let end = new Date(start);
            if (durationMatch) {
                end = new Date(start.getTime() + (parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2])) * 60000);
            }
            return now >= start && now <= end;
        });
    } else {
        filtered = allContests.filter(c => c.status === "upcoming").slice(0, 30);
    }

    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty">No contests here 😴</div>`;
        return;
    }

    list.innerHTML = filtered.map(c => {
        const statusInfo = getStatusText(c);
        return `
        <div class="card ${statusInfo.cls}" data-start="${c.start}" data-duration="${c.duration}">
            <div class="card-header">
                <span class="site ${c.site}">${c.site}</span>
                <span class="time">${c.start_time}</span>
            </div>
            <div class="name">${c.name}</div>
            <div class="meta">
                <span class="countdown">${statusInfo.text}</span>
                <span>⏱ ${c.duration}</span>
                <span>📅 ${c.date}</span>
            </div>
            ${c.url ? `<a href="${c.url}" target="_blank">Open Contest →</a>` : ""}
        </div>
    `}).join("");
}

function updateCountdowns() {
    document.querySelectorAll(".card").forEach(card => {
        const startStr = card.dataset.start;
        const duration = card.dataset.duration;
        const countdownEl = card.querySelector(".countdown");
        if (!countdownEl || !startStr) return;

        const now = new Date();
        const start = new Date(startStr);

        const durationMatch = (duration || "").match(/(\d+)h\s*(\d+)m/);
        let end = new Date(start);
        if (durationMatch) {
            end = new Date(start.getTime() + (parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2])) * 60000);
        } else {
            end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
        }

        if (now >= start && now <= end) {
            card.classList.remove("upcoming");
            card.classList.add("live");
            countdownEl.textContent = `🔴 LIVE • ${formatDuration(now - start)} elapsed`;
        } else if (now < start) {
            countdownEl.textContent = `⏳ Starts in ${formatDuration(start - now)}`;
        } else {
            card.classList.remove("upcoming", "live");
            card.classList.add("ended");
            countdownEl.textContent = `✅ Ended`;
        }
    });
}

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateCountdowns, 1000);
}

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentTab = tab.dataset.tab;
        render();
    });
});

setInterval(loadContests, 5 * 60 * 1000);
loadContests();

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").then(() => {
        console.log("Service Worker registered");
    }).catch(err => console.log("SW error:", err));
}