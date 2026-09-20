const API = "https://contest-reminder-api-t38o.onrender.com";
let currentTab = "today";
let allContests = [];
let countdownInterval = null;
let swRegistration = null;

async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    try {
        swRegistration = await navigator.serviceWorker.register("./sw.js");
        console.log("SW registered");
        return swRegistration;
    } catch (e) {
        console.error("SW error:", e);
        return null;
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function subscribeToPush() {
    if (!swRegistration) {
        swRegistration = await registerServiceWorker();
    }
    if (!swRegistration) return false;

    try {
        const res = await fetch(`${API}/api/vapid-public-key`);
        const { publicKey } = await res.json();

        if (!publicKey) {
            console.error("No VAPID public key from backend");
            return false;
        }

        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const saveRes = await fetch(`${API}/api/subscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscription),
        });
        const saveData = await saveRes.json();
        console.log("Subscription saved:", saveData);

        return true;
    } catch (e) {
        console.error("Push subscription failed:", e);
        return false;
    }
}

function updateNotifyButton() {
    const btn = document.getElementById("notify-btn");
    if (!btn) return;
    if (Notification.permission === "granted") {
        btn.classList.add("on");
        btn.textContent = "🔔";
        btn.title = "Notifications ON (server-side)";
    } else if (Notification.permission === "denied") {
        btn.classList.remove("on");
        btn.textContent = "🔕";
        btn.title = "Notifications blocked";
    } else {
        btn.classList.remove("on");
        btn.textContent = "🔔";
        btn.title = "Click to enable notifications";
    }
}

async function enableNotifications() {
    if (!("Notification" in window)) {
        alert("Your browser doesn't support notifications");
        return;
    }

    const perm = await Notification.requestPermission();
    updateNotifyButton();

    if (perm !== "granted") {
        alert("Notifications blocked. Please allow from browser settings.");
        return;
    }

    const ok = await subscribeToPush();
    if (ok) {
        new Notification("✅ Notifications enabled!", {
            body: "You'll get alerts 1 hour and 15 min before contests, even when app is closed.",
            icon: "./icon-192.png",
        });
    } else {
        alert("Permission granted but push subscription failed. Check console.");
    }
}

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

function getEndTime(c) {
    const start = new Date(c.start);
    const m = (c.duration || "").match(/(\d+)h\s*(\d+)m/);
    if (m) return new Date(start.getTime() + (parseInt(m[1]) * 60 + parseInt(m[2])) * 60000);
    return new Date(start.getTime() + 2 * 60 * 60 * 1000);
}

function getStatusText(c) {
    const now = new Date();
    const start = new Date(c.start);
    const end = getEndTime(c);

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
            return now >= new Date(c.start) && now <= getEndTime(c);
        });
    } else {
        filtered = allContests.filter(c => c.status === "upcoming").slice(0, 30);
    }

    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty">No contests here 😴</div>`;
        return;
    }

    list.innerHTML = filtered.map(c => {
        const s = getStatusText(c);
        return `
        <div class="card ${s.cls}" data-start="${c.start}" data-duration="${c.duration}">
            <div class="card-header">
                <span class="site ${c.site}">${c.site}</span>
                <span class="time">${c.start_time}</span>
            </div>
            <div class="name">${c.name}</div>
            <div class="meta">
                <span class="countdown">${s.text}</span>
                <span>⏱ ${c.duration}</span>
                <span>📅 ${c.date}</span>
            </div>
            ${c.url ? `<a href="${c.url}" target="_blank">Open Contest →</a>` : ""}
        </div>
        `;
    }).join("");
}

function updateCountdowns() {
    document.querySelectorAll(".card").forEach(card => {
        const startStr = card.dataset.start;
        const duration = card.dataset.duration;
        const el = card.querySelector(".countdown");
        if (!el || !startStr) return;

        const now = new Date();
        const start = new Date(startStr);
        const m = (duration || "").match(/(\d+)h\s*(\d+)m/);
        let end = new Date(start);
        if (m) end = new Date(start.getTime() + (parseInt(m[1]) * 60 + parseInt(m[2])) * 60000);
        else end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

        if (now >= start && now <= end) {
            card.classList.remove("upcoming");
            card.classList.add("live");
            el.textContent = `🔴 LIVE • ${formatDuration(now - start)} elapsed`;
        } else if (now < start) {
            el.textContent = `⏳ Starts in ${formatDuration(start - now)}`;
        } else {
            card.classList.remove("upcoming", "live");
            card.classList.add("ended");
            el.textContent = `✅ Ended`;
        }
    });
}

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateCountdowns, 1000);
}

document.addEventListener("DOMContentLoaded", async () => {
    await registerServiceWorker();
    updateNotifyButton();

    const btn = document.getElementById("notify-btn");
    if (btn) btn.addEventListener("click", enableNotifications);
});

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