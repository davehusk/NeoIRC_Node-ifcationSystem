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

  // === Presence Update ===
  if (data.type === 'presence' && userList) {
    userList.innerHTML = '';
    data.users.forEach(user => {
      const li = document.createElement("li");
      li.className = "user-entry";
      li.dataset.username = user.username;

      // Removed unused variable 'isNeo'
      const isBanned = user.isBanned;
      const role = user.role;

      let roleBadge = '';
      if (role === 'admin') roleBadge = '<span class="role-admin">[admin]</span>';
      else if (role === 'voiced') roleBadge = '<span class="role-voiced">[voiced]</span>';

      const statusIcon = isBanned ? '⛔' : '●';
      const statusClass = isBanned ? 'offline' : 'online';

      li.innerHTML = `
        <a href="/profile/${user.username}" class="mention-name">${isBanned ? '<del>@' + user.username + '</del>' : '@' + user.username}</a>
        ${roleBadge}
        <span class="${statusClass}">${statusIcon}</span>
        <small>#${user.channel}</small>
      `;
      userList.appendChild(li);
    });

    document.querySelectorAll('.mention-name').forEach(el => {
      el.addEventListener("click", () => {
        if (toUserInput) {
          toUserInput.value = el.textContent.replace('@', '').replace('~', '');
          messageInput.focus();
        }
      });
    });

    return;
  }

  // === Chat Message Render ===
  const timestampKey = data.timestamp.replace(/\W/g, '');
  const key = `${data.sender}-${timestampKey}`;
  const isOwn = data.sender === window.currentUser;
  const isNeo = data.sender === 'Neo';

  const userClass = `user-${data.sender.toLowerCase()}`;
  const ownClass = isOwn ? 'own-msg' : '';
  const botClass = isNeo ? 'neo-msg' : '';

  let roleClass = '';
  if (data.role === 'admin') roleClass = 'role-admin';
  else if (data.role === 'voiced') roleClass = 'role-voiced';

  const avatarIcon = isNeo ? '🤖' : '👤';
  const timestampTitle = `title="${data.timestamp}"`;

  const html = `
    <div class="chat-msg ${userClass} ${ownClass} ${botClass} ${roleClass}" data-id="${key}">
      <div class="msg-avatar">${avatarIcon}</div>
      <div class="msg-content">
        <span class="mention-name" ${timestampTitle}>@${data.sender}</span>
        <span class="timestamp" ${timestampTitle}>${data.timestamp}</span><br>
        ${data.to ? `<em>[Private to ${data.to}]</em><br>` : ''}
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

// === Message Form ===
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;

    const to = toUserInput?.value.trim();
    const res = await fetch("/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, to, channel: currentChannel })
    });

    if (!res.ok) {
      const text = await res.text();
      alert(text || "Message failed");
      return;
    }

    messageInput.value = "";
  });

  messageInput.addEventListener("keydown", e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });
}

// === Mention Quick-Insert ===
document.querySelectorAll('.mention-name').forEach(name => {
  name.addEventListener("click", () => {
    toUserInput.value = name.textContent.replace('@', '');
    messageInput.focus();
  });
});

connectWebSocket(currentChannel);
