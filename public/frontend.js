const ws = new WebSocket(`ws://${window.location.host}/ws`);
const chatBox = document.getElementById("chat-box");
const form = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const toUserInput = document.getElementById("to-user");
const channelInput = document.getElementById("channel-name");

ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    const entry = document.createElement("div");

    if (data.isAnnouncement) {
        entry.classList.add("announcement");
        entry.innerHTML = `<strong>📢 ${data.sender}</strong>: ${data.content} <span class="timestamp">${data.timestamp}</span>`;
    } else {
        let prefix = data.to ? `<em>[Private to ${data.to}]</em> ` : '';
        entry.innerHTML = `${prefix}<strong>${data.sender}</strong> [${data.timestamp}]: ${data.content}`;
    }

    chatBox.append(entry);
    chatBox.scrollTop = chatBox.scrollHeight;
});

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const message = messageInput.value;
        const to = toUserInput?.value.trim();
        const channel = channelInput?.value || 'general';
        await fetch("/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, to, channel })
        });
        form.reset();
    });
}

document.querySelectorAll(".user-entry")?.forEach(entry => {
    entry.addEventListener("click", () => {
        const username = entry.getAttribute("data-username");
        toUserInput.value = username;
        messageInput.focus();
    });
});