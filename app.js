// Firebase Configuration - ЗАМЕНИ НА СВОИ ДАННЫЕ
const firebaseConfig = {
    apiKey: "AIzaSyA8UMjDquPOSEvcdJnxmVwOLx-yN7PX50s",
  authDomain: "arbchat-e3314.firebaseapp.com",
  projectId: "arbchat-e3314",
  storageBucket: "arbchat-e3314.firebasestorage.app",
  messagingSenderId: "257751213924",
  appId: "1:257751213924:web:0e70d5b8c2e9c093997c71",
  measurementId: "G-0YC7TKWJSQ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// DOM Elements
const authScreen = document.getElementById('authScreen');
const chatScreen = document.getElementById('chatScreen');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authError = document.getElementById('authError');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const chatsList = document.getElementById('chatsList');
const noChatSelected = document.getElementById('noChatSelected');
const activeChat = document.getElementById('activeChat');
const messagesContainer = document.getElementById('messagesContainer');
const messages = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const chatMenuBtn = document.getElementById('chatMenuBtn');
const chatMenuModal = document.getElementById('chatMenuModal');
const backBtn = document.getElementById('backBtn');
const notificationSound = document.getElementById('notificationSound');

// State
let currentUser = null;
let currentUserData = null;
let currentChatId = null;
let currentChatPartner = null;
let messagesListener = null;
let typingTimeout = null;

// Emojis
const emojis = ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','🤏','👈','👉','👆','👇','☝️','✋','🤚','🖐','🖖','👋','🤙','💪','🦾','🙏','🔥','⭐','🌟','✨','💫','🎉','🎊','🎁','🎈'];

// Auth State Observer
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        showChatScreen();
        updateOnlineStatus(true);
        loadChats();
        setupPresence();
    } else {
        currentUser = null;
        currentUserData = null;
        showAuthScreen();
    }
});

// Show/Hide Screens
function showAuthScreen() {
    authScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
}

function showChatScreen() {
    authScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    initializeUI();
}

// Initialize UI
function initializeUI() {
    // Set user info
    document.getElementById('userName').textContent = currentUserData?.displayName || currentUser.email.split('@')[0];
    
    // Initialize emoji picker
    initEmojiPicker();
    
    // Initialize tabs
    initTabs();
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// Load user data
async function loadUserData() {
    const snapshot = await db.ref('users/' + currentUser.uid).once('value');
    currentUserData = snapshot.val() || {};
    
    if (!currentUserData.displayName) {
        currentUserData.displayName = currentUser.email.split('@')[0];
        await saveUserData();
    }
}

// Save user data
async function saveUserData() {
    await db.ref('users/' + currentUser.uid).update({
        email: currentUser.email,
        uid: currentUser.uid,
        displayName: currentUserData.displayName || currentUser.email.split('@')[0],
        status: currentUserData.status || 'Привет! Я использую ArbChat',
        lastSeen: firebase.database.ServerValue.TIMESTAMP,
        online: true
    });
}

// Setup presence system
function setupPresence() {
    const userStatusRef = db.ref('users/' + currentUser.uid);
    const connectedRef = db.ref('.info/connected');
    
    connectedRef.on('value', (snapshot) => {
        if (snapshot.val() === true) {
            userStatusRef.onDisconnect().update({
                online: false,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            
            userStatusRef.update({
                online: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
        }
    });
}

// Update online status
function updateOnlineStatus(online) {
    if (currentUser) {
        db.ref('users/' + currentUser.uid).update({
            online: online,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    }
}

// Login
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        showError('Заполните все поля');
        return;
    }
    
    try {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        showError(getErrorMessage(error.code));
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Войти';
    }
});

// Register
registerBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        showError('Заполните все поля');
        return;
    }
    
    if (password.length < 6) {
        showError('Пароль минимум 6 символов');
        return;
    }
    
    try {
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Регистрация...';
        await auth.createUserWithEmailAndPassword(email, password);
    } catch (error) {
        showError(getErrorMessage(error.code));
    } finally {
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Регистрация';
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    updateOnlineStatus(false);
    await auth.signOut();
});

// Show error
function showError(message) {
    authError.textContent = message;
    setTimeout(() => authError.textContent = '', 5000);
}

// Error messages
function getErrorMessage(code) {
    const messages = {
        'auth/email-already-in-use': 'Email уже используется',
        'auth/invalid-email': 'Неверный email',
        'auth/user-not-found': 'Пользователь не найден',
        'auth/wrong-password': 'Неверный пароль',
        'auth/weak-password': 'Слабый пароль',
        'auth/invalid-credential': 'Неверные данные'
    };
    return messages[code] || 'Ошибка авторизации';
}

// Enter key handlers
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});


// Search users
let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim().toLowerCase();
    
    if (!query) {
        searchResults.classList.add('hidden');
        searchResults.innerHTML = '';
        return;
    }
    
    searchTimeout = setTimeout(() => searchUsers(query), 300);
});

async function searchUsers(query) {
    searchResults.classList.remove('hidden');
    searchResults.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Поиск...</p></div>';
    
    const snapshot = await db.ref('users').once('value');
    const users = snapshot.val() || {};
    
    let results = [];
    Object.values(users).forEach(user => {
        if (user.uid !== currentUser.uid) {
            const name = (user.displayName || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            if (name.includes(query) || email.includes(query)) {
                results.push(user);
            }
        }
    });
    
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="empty-state"><i class="fas fa-user-slash"></i><p>Не найдено</p></div>';
        return;
    }
    
    searchResults.innerHTML = '';
    results.forEach(user => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="info">
                <div class="name">${escapeHtml(user.displayName || user.email.split('@')[0])}</div>
                <div class="email">${escapeHtml(user.email)}</div>
            </div>
        `;
        div.addEventListener('click', () => startChat(user));
        searchResults.appendChild(div);
    });
}

// Start chat
function startChat(partner) {
    searchResults.classList.add('hidden');
    searchResults.innerHTML = '';
    searchInput.value = '';
    
    const chatId = [currentUser.uid, partner.uid].sort().join('_');
    
    // Save chat for both users
    const chatData = {
        oderId: partner.uid,
        partnerEmail: partner.email,
        partnerName: partner.displayName || partner.email.split('@')[0],
        lastMessage: '',
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        unread: 0
    };
    
    db.ref(`userChats/${currentUser.uid}/${chatId}`).update(chatData);
    
    db.ref(`userChats/${partner.uid}/${chatId}`).update({
        oderId: currentUser.uid,
        partnerEmail: currentUser.email,
        partnerName: currentUserData.displayName || currentUser.email.split('@')[0],
        lastMessage: '',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    openChat(chatId, partner);
}

// Open chat
function openChat(chatId, partner) {
    currentChatId = chatId;
    currentChatPartner = partner;
    
    // Update UI
    noChatSelected.classList.add('hidden');
    activeChat.classList.remove('hidden');
    
    // Set chat header
    document.getElementById('chatUserName').textContent = partner.partnerName || partner.displayName || partner.email?.split('@')[0] || 'Пользователь';
    
    // Listen for partner status
    const partnerId = partner.oderId || partner.uid;
    db.ref('users/' + partnerId).on('value', (snapshot) => {
        const userData = snapshot.val();
        if (userData) {
            const statusEl = document.getElementById('chatUserStatus');
            if (userData.online) {
                statusEl.textContent = 'в сети';
                statusEl.classList.add('online');
            } else {
                statusEl.textContent = formatLastSeen(userData.lastSeen);
                statusEl.classList.remove('online');
            }
        }
    });
    
    // Remove previous listener
    if (messagesListener) {
        db.ref(`messages/${currentChatId}`).off('value', messagesListener);
    }
    
    // Mark as read
    db.ref(`userChats/${currentUser.uid}/${chatId}/unread`).set(0);
    
    // Listen for messages
    messagesListener = db.ref(`messages/${chatId}`).orderByChild('timestamp').on('value', (snapshot) => {
        renderMessages(snapshot.val());
    });
    
    // Update active state
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.toggle('active', item.dataset.chatId === chatId);
    });
    
    // Mobile: show chat area
    document.querySelector('.sidebar').classList.add('chat-open');
    document.querySelector('.chat-area').classList.add('active');
    
    // Focus input
    messageInput.focus();
}

// Render messages
function renderMessages(messagesData) {
    messages.innerHTML = '';
    
    if (!messagesData) {
        messages.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><p>Нет сообщений</p><span>Напишите первое сообщение!</span></div>';
        return;
    }
    
    let lastDate = null;
    
    Object.entries(messagesData).forEach(([key, msg]) => {
        // Date divider
        const msgDate = new Date(msg.timestamp).toDateString();
        if (msgDate !== lastDate) {
            const divider = document.createElement('div');
            divider.className = 'date-divider';
            divider.innerHTML = `<span>${formatDate(msg.timestamp)}</span>`;
            messages.appendChild(divider);
            lastDate = msgDate;
        }
        
        const div = document.createElement('div');
        div.className = `message ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`;
        
        div.innerHTML = `
            <div class="message-text">${escapeHtml(msg.text)}</div>
            <div class="message-footer">
                <span class="message-time">${formatTime(msg.timestamp)}</span>
                ${msg.senderId === currentUser.uid ? `<span class="message-status ${msg.read ? 'read' : ''}"><i class="fas fa-check${msg.read ? '-double' : ''}"></i></span>` : ''}
            </div>
        `;
        
        messages.appendChild(div);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send message
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentChatId) return;
    
    const messageRef = db.ref(`messages/${currentChatId}`).push();
    messageRef.set({
        text: text,
        senderId: currentUser.uid,
        senderName: currentUserData.displayName || currentUser.email.split('@')[0],
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        read: false
    });
    
    // Update chat preview
    const partnerId = currentChatPartner.oderId || currentChatPartner.uid;
    
    db.ref(`userChats/${currentUser.uid}/${currentChatId}`).update({
        lastMessage: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    db.ref(`userChats/${partnerId}/${currentChatId}`).update({
        lastMessage: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        unread: firebase.database.ServerValue.increment(1)
    });
    
    messageInput.value = '';
    messageInput.focus();
}

// Load chats
function loadChats() {
    db.ref(`userChats/${currentUser.uid}`).orderByChild('timestamp').on('value', (snapshot) => {
        const chats = snapshot.val();
        
        if (!chats) {
            chatsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comment-dots"></i>
                    <p>Нет чатов</p>
                    <span>Найдите пользователя чтобы начать</span>
                </div>
            `;
            return;
        }
        
        chatsList.innerHTML = '';
        const chatsArray = Object.entries(chats).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
        
        chatsArray.forEach(([chatId, chat]) => {
            const div = document.createElement('div');
            div.className = 'chat-item';
            div.dataset.chatId = chatId;
            
            if (currentChatId === chatId) {
                div.classList.add('active');
            }
            
            const unreadBadge = chat.unread > 0 ? `<span class="unread-badge">${chat.unread}</span>` : '';
            
            div.innerHTML = `
                <div class="avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="chat-info">
                    <div class="chat-name">
                        <span>${escapeHtml(chat.partnerName || chat.partnerEmail?.split('@')[0] || 'Пользователь')}</span>
                        <span class="chat-time">${chat.timestamp ? formatTime(chat.timestamp) : ''}</span>
                    </div>
                    <div class="chat-preview">
                        ${escapeHtml(chat.lastMessage || 'Нет сообщений')}
                        ${unreadBadge}
                    </div>
                </div>
            `;
            
            div.addEventListener('click', () => openChat(chatId, chat));
            chatsList.appendChild(div);
        });
    });
}


// Tabs
function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabName = tab.dataset.tab;
            if (tabName === 'chats') {
                chatsList.classList.remove('hidden');
                document.getElementById('contactsList').classList.add('hidden');
            } else {
                chatsList.classList.add('hidden');
                document.getElementById('contactsList').classList.remove('hidden');
                loadContacts();
            }
        });
    });
}

// Load contacts
async function loadContacts() {
    const contactsList = document.getElementById('contactsList');
    contactsList.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';
    
    const snapshot = await db.ref('users').once('value');
    const users = snapshot.val() || {};
    
    contactsList.innerHTML = '';
    
    Object.values(users).forEach(user => {
        if (user.uid !== currentUser.uid) {
            const div = document.createElement('div');
            div.className = 'chat-item';
            div.innerHTML = `
                <div class="avatar">
                    <i class="fas fa-user"></i>
                    ${user.online ? '<span class="online-dot"></span>' : ''}
                </div>
                <div class="chat-info">
                    <div class="chat-name">
                        <span>${escapeHtml(user.displayName || user.email.split('@')[0])}</span>
                    </div>
                    <div class="chat-preview">${user.online ? 'в сети' : formatLastSeen(user.lastSeen)}</div>
                </div>
            `;
            div.addEventListener('click', () => startChat(user));
            contactsList.appendChild(div);
        }
    });
    
    if (contactsList.children.length === 0) {
        contactsList.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Нет контактов</p></div>';
    }
}

// Emoji picker
function initEmojiPicker() {
    emojiPicker.innerHTML = '';
    emojis.forEach(emoji => {
        const btn = document.createElement('button');
        btn.textContent = emoji;
        btn.addEventListener('click', () => {
            messageInput.value += emoji;
            messageInput.focus();
        });
        emojiPicker.appendChild(btn);
    });
}

emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.classList.add('hidden');
    }
});

// Settings modal
settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    loadSettings();
});

document.querySelectorAll('.close-modal, .modal-overlay').forEach(el => {
    el.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
        chatMenuModal.classList.add('hidden');
    });
});

function loadSettings() {
    document.getElementById('displayNameInput').value = currentUserData.displayName || '';
    document.getElementById('statusInput').value = currentUserData.status || '';
}

// Save profile
document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const displayName = document.getElementById('displayNameInput').value.trim();
    const status = document.getElementById('statusInput').value.trim();
    
    currentUserData.displayName = displayName || currentUser.email.split('@')[0];
    currentUserData.status = status;
    
    await saveUserData();
    
    document.getElementById('userName').textContent = currentUserData.displayName;
    settingsModal.classList.add('hidden');
    
    // Show success
    alert('Профиль сохранён!');
});

// Chat menu
chatMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = chatMenuBtn.getBoundingClientRect();
    chatMenuModal.style.top = rect.bottom + 10 + 'px';
    chatMenuModal.style.right = (window.innerWidth - rect.right) + 'px';
    chatMenuModal.classList.toggle('hidden');
});

document.addEventListener('click', () => {
    chatMenuModal.classList.add('hidden');
});

// Clear chat
document.getElementById('clearChatBtn').addEventListener('click', async () => {
    if (!currentChatId) return;
    if (confirm('Очистить историю сообщений?')) {
        await db.ref(`messages/${currentChatId}`).remove();
        chatMenuModal.classList.add('hidden');
    }
});

// Delete chat
document.getElementById('deleteChatBtn').addEventListener('click', async () => {
    if (!currentChatId) return;
    if (confirm('Удалить чат?')) {
        await db.ref(`userChats/${currentUser.uid}/${currentChatId}`).remove();
        await db.ref(`messages/${currentChatId}`).remove();
        
        currentChatId = null;
        currentChatPartner = null;
        
        noChatSelected.classList.remove('hidden');
        activeChat.classList.add('hidden');
        chatMenuModal.classList.add('hidden');
    }
});

// Back button (mobile)
backBtn.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.remove('chat-open');
    document.querySelector('.chat-area').classList.remove('active');
    currentChatId = null;
});

// Sound toggle
document.getElementById('soundToggle').addEventListener('change', (e) => {
    localStorage.setItem('soundEnabled', e.target.checked);
});

// Notification toggle
document.getElementById('notifToggle').addEventListener('change', async (e) => {
    if (e.target.checked && 'Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            e.target.checked = false;
        }
    }
    localStorage.setItem('notifEnabled', e.target.checked);
});

// Helper functions
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Вчера';
    } else {
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    }
}

function formatLastSeen(timestamp) {
    if (!timestamp) return 'был(а) давно';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'был(а) только что';
    if (diff < 3600000) return `был(а) ${Math.floor(diff / 60000)} мин. назад`;
    if (diff < 86400000) return `был(а) ${Math.floor(diff / 3600000)} ч. назад`;
    return `был(а) ${date.toLocaleDateString('ru-RU')}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Window events
window.addEventListener('beforeunload', () => {
    updateOnlineStatus(false);
});

window.addEventListener('focus', () => {
    if (currentUser) updateOnlineStatus(true);
});

window.addEventListener('blur', () => {
    // Keep online for a bit after blur
});

// Load saved settings
document.addEventListener('DOMContentLoaded', () => {
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    const notifEnabled = localStorage.getItem('notifEnabled') === 'true';
    
    document.getElementById('soundToggle').checked = soundEnabled;
    document.getElementById('notifToggle').checked = notifEnabled;
});

