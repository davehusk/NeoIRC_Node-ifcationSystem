const ws = new WebSocket(`ws://${window.location.host}/ws`);
const chatBox = document.getElementById("chat-box");
const form = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const toUserInput = document.getElementById("to-user");

ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    const entry = document.createElement("div");
    const tag = data.to ? `<em>Private to ${data.to}</em>` : "";
    entry.innerHTML = `<strong>${data.sender}</strong> [${data.timestamp}] ${tag}: ${data.content}`;
    chatBox.append(entry);
    chatBox.scrollTop = chatBox.scrollHeight;
});

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const message = messageInput.value;
        const to = toUserInput.value.trim();
        await fetch("/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, to })
        });
        form.reset();
    });
}

document.querySelectorAll(".user-entry").forEach(entry => {
    entry.addEventListener("click", () => {
        const username = entry.getAttribute("data-username");
        toUserInput.value = username;
        messageInput.focus();
    });
});
