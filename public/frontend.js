const channel = document.getElementById("channel-name")?.value || 'general';
const ws = new WebSocket(`ws://${window.location.host}/ws?channel=${encodeURIComponent(channel)}`);

const form = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const toUserInput = document.getElementById("to-user");

const chatStream = document.getElementById("chat-stream");
const privateStream = document.getElementById("private-stream");
const userList = document.getElementById("user-list");

function scrollActive() {
    const active = document.querySelector(".chat-stream.active");
    if (active) active.scrollTop = active.scrollHeight;
}

function pulseTab(streamId) {
    const btn = document.querySelector(`.tab-btn[data-target="${streamId}"]`);
    if (btn && !document.getElementById(streamId).classList.contains("active")) {
        btn.classList.add("pulse");
    }
}

function clearPulse(streamId) {
    const btn = document.querySelector(`.tab-btn[data-target="${streamId}"]`);
    if (btn) btn.classList.remove("pulse");
}

function appendMessage(streamId, html, key) {
    const stream = document.getElementById(streamId);
    if (!stream || stream.querySelector(`[data-id="${key}"]`)) return;
    const div = document.createElement("div");
    div.innerHTML = html;
    div.dataset.id = key;
    stream.appendChild(div);
    scrollActive();
    pulseTab(streamId);
}

ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'presence' && userList) {
        userList.innerHTML = '';
        data.users.forEach(user => {
            const li = document.createElement("li");
            li.className = "user-entry";
            li.dataset.username = user.username;
            li.innerHTML = `
                ${user.username || 'User'} 
                <span class="online">●</span> 
                <a class="user-channel-link" href="/dashboard?channel=${user.channel}">
                    <small>#${user.channel}</small>
                </a>
            `;
            userList.appendChild(li);
        });

        document.querySelectorAll('.user-entry')?.forEach(entry => {
            entry.addEventListener("click", () => {
                const username = entry.getAttribute("data-username");
                if (toUserInput) {
                    toUserInput.value = username;
                    messageInput.focus();
                }
            });
        });

        return;
    }

    const timestampKey = data.timestamp.replace(/\W/g, '');
    const key = `${data.isAnnouncement ? 'announcement' : data.to ? 'private' : 'chat'}-${timestampKey}-${data.sender}`;

    const content = data.isAnnouncement
        ? `<div class="announcement pulse"><strong>📢 ${data.sender}</strong><br>${data.content}<span class="timestamp">${data.timestamp}</span></div>`
        : data.to
        ? `<div><em>[Private to ${data.to}]</em><br><strong>${data.sender}</strong><span class="timestamp">${data.timestamp}</span><br>${data.content}</div>`
        : `<div><strong>${data.sender}</strong><span class="timestamp">${data.timestamp}</span><br>${data.content}</div>`;

    const target = data.isAnnouncement || !data.to ? "chat-stream" : "private-stream";
    appendMessage(target, content, key);
});

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

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.chat-stream').forEach(s => s.classList.remove("active"));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove("pulse"));
        const id = btn.dataset.target;
        document.getElementById(id)?.classList.add("active");
        clearPulse(id);
    });
});
document.querySelectorAll('.user-entry')?.forEach(entry => {
    entry.addEventListener("click", () => {
        const username = entry.getAttribute("data-username");
        if (toUserInput) {
            toUserInput.value = username;
            messageInput.focus();
        }
    });
});
document.querySelectorAll('.user-channel-link')?.forEach(link => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        const channel = link.getAttribute("href").split('=')[1];
        if (channel) {
            window.location.href = `/dashboard?channel=${decodeURIComponent(channel)}`;
        }
    });
});
document.querySelectorAll('.channel-link')?.forEach(link => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        const channel = link.getAttribute("href").split('=')[1];
        if (channel) {
            window.location.href = `/dashboard?channel=${decodeURIComponent(channel)}`;
        }
    });
});
document.getElementById("clear-chat-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const channel = document.getElementById("clear-channel")?.value;

    if (!channel) {
        alert("Channel is missing");
        return;
    }

    const res = await fetch("/messages/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel })
    });

    if (res.ok) {
        document.getElementById("chat-stream").innerHTML = '';
        document.getElementById("private-stream").innerHTML = '';
    } else {
        alert("Failed to clear messages");
    }
});
