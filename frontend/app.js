// ==========================================
// 1. NOTIFICATION SETUP
// ==========================================
const publicVapidKey = 'BL3jfd7IAJvcpsLJQJA0yg9ACT13mfqd6ljPET0sJEEyNb4ffVVtXVZqp1y3RsvPb9N1SeC1f_jZaP37gn0UfXU';

async function enableNotifications() {
    if (!('serviceWorker' in navigator)) {
        alert("Your browser does not support notification.");
        return;
    }

    try {
        const register = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        });

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            alert("Notification permission denied. Please allow from browser settings.");
            return;
        }

        const subscription = await register.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });

        await fetch('/.netlify/functions/save-subscription', {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: { 'Content-Type': 'application/json' }
        });

        document.getElementById('notify-btn').classList.add('active');
        document.getElementById('notify-btn').innerText = '🔔';
        updateStatus("✅ Notifications enabled!");
        localStorage.setItem('notificationsEnabled', 'true');

    } catch (error) {
        console.error('Error:', error);
        updateStatus("❌ Notification setup failed.");
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// ==========================================
// 2. STATE
// ==========================================
let allContests = [];
let currentTab = 'today';

const notifyBtn = document.getElementById('notify-btn');
notifyBtn.addEventListener('click', enableNotifications);

// Agar pehle se enable hai toh button active dikhao
if (localStorage.getItem('notificationsEnabled') === 'true') {
    notifyBtn.classList.add('active');
}

// ==========================================
// 3. TABS
// ==========================================
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        renderContests();
    });
});

// ==========================================
// 4. FETCH CONTESTS (Codeforces + AtCoder)
// ==========================================
async function fetchContests() {
    updateStatus("Fetching contests...");
    const now = Math.floor(Date.now() / 1000);
    let contests = [];

    // --- Codeforces ---
    try {
        const cfRes = await fetch('https://codeforces.com/api/contest.list?gym=false');
        const cfData = await cfRes.json();
        const cfContests = cfData.result
            .filter(c => c.phase === 'BEFORE' || c.phase === 'CODING')
            .map(c => ({
                name: c.name,
                platform: 'codeforces',
                startTime: c.startTimeSeconds,
                duration: c.durationSeconds,
                url: `https://codeforces.com/contest/${c.id}`,
                phase: c.phase,
                endTime: c.startTimeSeconds + c.durationSeconds
            }));
        contests = contests.concat(cfContests);
    } catch (e) {
        console.error('Codeforces fetch error:', e);
    }

    // --- AtCoder (via Kenkoooo API) ---
    try {
        const atRes = await fetch('https://kenkoooo.com/atcoder/resources/contests.json');
        const atData = await atRes.json();
        const atContests = atData
            .filter(c => c.start_epoch_second + c.duration_second > now)
            .map(c => ({
                name: c.title,
                platform: 'atcoder',
                startTime: c.start_epoch_second,
                duration: c.duration_second,
                url: `https://atcoder.jp/contests/${c.id}`,
                phase: c.start_epoch_second > now ? 'BEFORE' : 'CODING',
                endTime: c.start_epoch_second + c.duration_second
            }));
        contests = contests.concat(atContests);
    } catch (e) {
        console.error('AtCoder fetch error:', e);
    }

    // Sort by start time
    contests.sort((a, b) => a.startTime - b.startTime);
    allContests = contests;

    updateStatus(`Updated: ${new Date().toLocaleTimeString()} • ${contests.length} contests`);
    renderContests();
}

// ==========================================
// 5. RENDER CONTESTS
// ==========================================
function renderContests() {
    const listEl = document.getElementById('contest-list');
    const now = Math.floor(Date.now() / 1000);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayEndSec = Math.floor(todayEnd.getTime() / 1000);

    let filtered = [];

    if (currentTab === 'today') {
        filtered = allContests.filter(c => c.startTime >= now && c.startTime <= todayEndSec);
    } else if (currentTab === 'upcoming') {
        filtered = allContests.filter(c => c.startTime > todayEndSec);
    } else if (currentTab === 'live') {
        filtered = allContests.filter(c => c.startTime <= now && c.endTime > now);
    }

    if (filtered.length === 0) {
        listEl.innerHTML = `<div class="empty-state">No ${currentTab} contests. 🎉</div>`;
        return;
    }

    listEl.innerHTML = filtered.map(c => {
        const isLive = c.startTime <= now && c.endTime > now;
        const startDate = new Date(c.startTime * 1000);
        const timeStr = isLive 
            ? '🔴 LIVE NOW' 
            : startDate.toLocaleString('en-IN', { 
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
              });
        const hours = Math.floor(c.duration / 3600);
        const mins = Math.floor((c.duration % 3600) / 60);

        return `
            <div class="contest-card ${isLive ? 'live' : ''}">
                <span class="platform ${c.platform}">${c.platform}</span>
                <h3>${c.name}</h3>
                <div class="meta">
                    <span>🕒 ${timeStr}</span>
                    <span>⏳ ${hours}h ${mins}m</span>
                </div>
                <a href="${c.url}" target="_blank">Open Contest →</a>
            </div>
        `;
    }).join('');
}

function updateStatus(msg) {
    document.getElementById('status').innerText = msg;
}

// ==========================================
// 6. INIT
// ==========================================
fetchContests();
// Har 5 minute mein refresh
setInterval(fetchContests, 5 * 60 * 1000);