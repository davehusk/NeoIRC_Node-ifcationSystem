const channel = document.getElementById("channel-name")?.value || 'general';
const ws = new WebSocket(`ws://${window.location.host}/ws?channel=${encodeURIComponent(channel)}`);

const form = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const toUserInput = document.getElementById("to-user");

const chatStream = document.getElementById("chat-stream");
const privateStream = document.getElementById("private-stream");
const announcementStream = document.getElementById("notifications-stream");

ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    const entry = document.createElement("div");

    // Timestamp rendering
    const timestamp = `<span class="timestamp">[${data.timestamp}]</span>`;

    if (data.isAnnouncement) {
        entry.classList.add("announcement");
        entry.innerHTML = `<strong>📢 ${data.sender}</strong> ${timestamp}<br>${data.content}`;
        announcementStream?.appendChild(entry);
        if (!announcementStream.classList.contains('active')) pulseTab("notifications-stream");
    } else if (data.to) {
        const privatePrefix = `<em>[Private to ${data.to}]</em><br>`;
        entry.innerHTML = `${privatePrefix}<strong>${data.sender}</strong> ${timestamp}<br>${data.content}`;
        privateStream?.appendChild(entry);
        if (!privateStream.classList.contains('active')) pulseTab("private-stream");
    } else {
        entry.innerHTML = `<strong>${data.sender}</strong> ${timestamp}<br>${data.content}`;
        chatStream?.appendChild(entry);
        if (!chatStream.classList.contains('active')) pulseTab("chat-stream");
    }

    scrollActive();
});

function scrollActive() {
    const active = document.querySelector(".chat-stream.active");
    if (active) active.scrollTop = active.scrollHeight;
}

function pulseTab(targetId) {
    const btn = document.querySelector(`.tab-btn[data-target="${targetId}"]`);
    if (!btn) return;
    btn.classList.add("pulse");
    setTimeout(() => btn.classList.remove("pulse"), 1500);
}

// Send message
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();
        if (!message) return;

        const to = toUserInput?.value.trim();
        await fetch("/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, to, channel })
        });
        form.reset();
    });
}

// Click username to auto-target private
document.querySelectorAll(".user-entry")?.forEach(entry => {
    entry.addEventListener("click", () => {
        const username = entry.getAttribute("data-username");
        toUserInput.value = username;
        messageInput.focus();
    });
});
