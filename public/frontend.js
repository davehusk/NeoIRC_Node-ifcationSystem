const webSocket = new WebSocket("ws://localhost:3000/ws");
const notificationElement = document.getElementById("notifications-container");

webSocket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    onNewNotificationReceieved(data.username, data.timestamp, data.message);
});

function onNewNotificationReceieved(username, timestamp, message) {
    const entry = document.createElement("div");
    entry.classList.add("notification-entry");
    entry.innerHTML = `<strong>${username}</strong> at ${timestamp}: ${message}`;
    notificationElement.prepend(entry);
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("notification-form");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const message = form.message.value;
            await fetch("/send", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });
            form.reset();
        });
    }
});
