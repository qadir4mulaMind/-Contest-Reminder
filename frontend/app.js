const API = "http://localhost:8000";
let currentTab = "today";
let allContests = [];

async function loadContests() {
    try {
        document.getElementById("status").textContent = "Loading...";
        const res = await fetch(`${API}/api/contests`);
        const data = await res.json();
        allContests = data.contests;
        document.getElementById("status").textContent =
            `Updated: ${new Date(data.updated).toLocaleTimeString()} • ${data.count} contests`;
        render();
    } catch (e) {
        document.getElementById("status").textContent = "❌ Backend not reachable";
        console.error(e);
    }
}

function render() {
    const list = document.getElementById("contest-list");
    const today = new Date().toISOString().split("T")[0];
    let filtered = [];

    if (currentTab === "today") {
        filtered = allContests.filter(c => c.date === today);
    } else if (currentTab === "live") {
        filtered = allContests.filter(c => c.status === "live");
    } else {
        filtered = allContests.filter(c => c.status === "upcoming").slice(0, 30);
    }

    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty">No contests here 😴</div>`;
        return;
    }

    list.innerHTML = filtered.map(c => `
        <div class="card ${c.status}">
            <div class="card-header">
                <span class="site ${c.site}">${c.site}</span>
                <span class="time">${c.start_time}</span>
            </div>
            <div class="name">${c.name}</div>
            <div class="meta">
                <span>⏱ ${c.duration}</span>
                <span>📅 ${c.date}</span>
            </div>
            ${c.url ? `<a href="${c.url}" target="_blank">Open Contest →</a>` : ""}
        </div>
    `).join("");
}

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentTab = tab.dataset.tab;
        render();
    });
});

// Auto-refresh every 5 minutes
setInterval(loadContests, 5 * 60 * 1000);
loadContests();

// Register service worker for PWA
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").then(() => {
        console.log("Service Worker registered");
    }).catch(err => console.log("SW error:", err));
}