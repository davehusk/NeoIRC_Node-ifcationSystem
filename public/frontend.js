let currentChannel = document.getElementById("channel-name")?.value || 'general';
let ws;

const form = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const toUserInput = document.getElementById("to-user");

const chatStream = document.getElementById("chat-stream");
const userList = document.getElementById("user-list");

function scrollToBottom() {
  const activeStream = document.querySelector(".chat-stream");
  if (activeStream) activeStream.scrollTop = activeStream.scrollHeight;
}

function appendMessage(streamId, html, key) {
  const stream = document.getElementById(streamId);
  if (!stream || stream.querySelector(`[data-id="${key}"]`)) return;
  const div = document.createElement("div");
  div.innerHTML = html;
  div.dataset.id = key;
  stream.appendChild(div);
  scrollToBottom();
}

function handleWebSocketMessage(event) {
  const data = JSON.parse(event.data);
  if (data.type === 'presence' && userList) {
    userList.innerHTML = '';
    data.users.forEach(user => {
      const li = document.createElement("li");
      li.className = "user-entry";
      li.dataset.username = user.username;
      li.innerHTML = `
        <a href="/profile/${user.username}" class="mention-name">@${user.username}</a>
        <span class="online">●</span>
        <small>#${user.channel}</small>
      `;
      userList.appendChild(li);
    });

    document.querySelectorAll('.mention-name').forEach(el => {
      el.addEventListener("click", () => {
        if (toUserInput) {
          toUserInput.value = el.textContent.replace('@', '');
          messageInput.focus();
        }
      });
    });

    return;
  }

  const timestampKey = data.timestamp.replace(/\W/g, '');
  const key = `${data.sender}-${timestampKey}`;
  const isOwn = data.sender === window.currentUser;
  const userClass = `user-${data.sender.toLowerCase()}`;
  const ownClass = isOwn ? 'own-msg' : '';
  const botClass = data.sender === 'Neo' ? 'neo-msg' : '';
  const timestampTitle = `title="${data.timestamp}"`;

  const avatarIcon = data.sender === 'Neo' ? '🤖' : '👤';
  const html = `
    <div class="chat-msg ${userClass} ${ownClass} ${botClass}" data-id="${key}">
      <div class="msg-avatar">${avatarIcon}</div>
      <div class="msg-content">
        <span class="mention-name" ${timestampTitle}>${data.sender}</span>
        <span class="timestamp" ${timestampTitle}>${data.timestamp}</span><br>
        <span>${data.content}</span>
      </div>
    </div>
  `;

  appendMessage("chat-stream", html, key);
}

function connectWebSocket(channel) {
  ws = new WebSocket(`ws://${window.location.host}/ws?channel=${encodeURIComponent(channel)}`);
  ws.addEventListener("open", () => console.log("🔌 Connected to", channel));
  ws.addEventListener("message", handleWebSocketMessage);
}

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();
        if (!message) return;
      
        const to = toUserInput?.value.trim();
      
        await fetch("/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, to, channel: currentChannel })
        });
      
        messageInput.value = "";
      });

  messageInput.addEventListener("keydown", e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });
}

document.querySelectorAll('.mention-name').forEach(name => {
  name.addEventListener("click", () => {
    toUserInput.value = name.textContent.replace('@', '');
    messageInput.focus();
  });
});

connectWebSocket(currentChannel);
