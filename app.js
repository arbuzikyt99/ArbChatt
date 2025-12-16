// Firebase Configuration
// ВАЖНО: Замени эти данные на свои из Firebase Console
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
const currentUserSpan = document.getElementById('currentUser');
const searchUserInput = document.getElementById('searchUser');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const chatsList = document.getElementById('chatsList');
const noChatSelected = document.getElementById('noChatSelected');
const chatContent = document.getElementById('chatContent');
const chatPartnerName = document.getElementById('chatPartnerName');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

let currentUser = null;
let currentChatId = null;
let currentChatPartner = null;
let messagesListener = null;

// Auth State Observer
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        showChatScreen();
        saveUserToDatabase(user);
        loadChats();
    } else {
        currentUser = null;
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
    currentUserSpan.textContent = currentUser.email;
}

// Save user to database
function saveUserToDatabase(user) {
    const userRef = db.ref('users/' + user.uid);
    userRef.set({
        email: user.email,
        uid: user.uid,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
}

// Login
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        authError.textContent = 'Заполните все поля';
        return;
    }
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        authError.textContent = '';
    } catch (error) {
        authError.textContent = getErrorMessage(error.code);
    }
});

// Register
registerBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        authError.textContent = 'Заполните все поля';
        return;
    }
    
    if (password.length < 6) {
        authError.textContent = 'Пароль минимум 6 символов';
        return;
    }
    
    try {
        await auth.createUserWithEmailAndPassword(email, password);
        authError.textContent = '';
    } catch (error) {
        authError.textContent = getErrorMessage(error.code);
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

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

// Search users
searchBtn.addEventListener('click', searchUsers);
searchUserInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchUsers();
});

async function searchUsers() {
    const query = searchUserInput.value.trim().toLowerCase();
    if (!query) return;
    
    searchResults.innerHTML = '<p class="empty-text">Поиск...</p>';
    
    const snapshot = await db.ref('users').once('value');
    const users = snapshot.val() || {};
    
    let results = [];
    Object.values(users).forEach(user => {
        if (user.uid !== currentUser.uid && 
            user.email.toLowerCase().includes(query)) {
            results.push(user);
        }
    });
    
    if (results.length === 0) {
        searchResults.innerHTML = '<p class="empty-text">Не найдено</p>';
        return;
    }
    
    searchResults.innerHTML = '';
    results.forEach(user => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = user.email;
        div.addEventListener('click', () => startChat(user));
        searchResults.appendChild(div);
    });
}


// Start or open chat
function startChat(partner) {
    searchResults.innerHTML = '';
    searchUserInput.value = '';
    
    // Create chat ID (sorted UIDs to ensure same ID for both users)
    const chatId = [currentUser.uid, partner.uid].sort().join('_');
    
    // Save chat reference for both users
    db.ref(`userChats/${currentUser.uid}/${chatId}`).set({
        partnerId: partner.uid,
        partnerEmail: partner.email,
        lastMessage: '',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    db.ref(`userChats/${partner.uid}/${chatId}`).set({
        partnerId: currentUser.uid,
        partnerEmail: currentUser.email,
        lastMessage: '',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    openChat(chatId, partner);
}

// Open existing chat
function openChat(chatId, partner) {
    currentChatId = chatId;
    currentChatPartner = partner;
    
    noChatSelected.classList.add('hidden');
    chatContent.classList.remove('hidden');
    chatPartnerName.textContent = partner.email || partner.partnerEmail;
    
    // Remove previous listener
    if (messagesListener) {
        db.ref(`messages/${currentChatId}`).off('value', messagesListener);
    }
    
    // Listen for messages
    messagesListener = db.ref(`messages/${chatId}`).orderByChild('timestamp').on('value', (snapshot) => {
        messagesDiv.innerHTML = '';
        const messages = snapshot.val();
        
        if (messages) {
            Object.values(messages).forEach(msg => {
                displayMessage(msg);
            });
        }
        
        // Scroll to bottom
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
    
    // Update active chat in list
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.chatId === chatId) {
            item.classList.add('active');
        }
    });
}

// Display message
function displayMessage(msg) {
    const div = document.createElement('div');
    div.className = `message ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`;
    
    const text = document.createElement('div');
    text.textContent = msg.text;
    
    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(msg.timestamp);
    
    div.appendChild(text);
    div.appendChild(time);
    messagesDiv.appendChild(div);
}

// Format timestamp
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// Send message
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentChatId) return;
    
    const messageRef = db.ref(`messages/${currentChatId}`).push();
    messageRef.set({
        text: text,
        senderId: currentUser.uid,
        senderEmail: currentUser.email,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Update last message in chat list
    db.ref(`userChats/${currentUser.uid}/${currentChatId}/lastMessage`).set(text);
    db.ref(`userChats/${currentUser.uid}/${currentChatId}/timestamp`).set(firebase.database.ServerValue.TIMESTAMP);
    
    if (currentChatPartner) {
        const partnerId = currentChatPartner.uid || currentChatPartner.partnerId;
        db.ref(`userChats/${partnerId}/${currentChatId}/lastMessage`).set(text);
        db.ref(`userChats/${partnerId}/${currentChatId}/timestamp`).set(firebase.database.ServerValue.TIMESTAMP);
    }
    
    messageInput.value = '';
}

// Load user's chats
function loadChats() {
    db.ref(`userChats/${currentUser.uid}`).orderByChild('timestamp').on('value', (snapshot) => {
        const chats = snapshot.val();
        
        if (!chats) {
            chatsList.innerHTML = '<p class="empty-text">Начните новый чат</p>';
            return;
        }
        
        chatsList.innerHTML = '';
        const chatsArray = Object.entries(chats).reverse();
        
        chatsArray.forEach(([chatId, chat]) => {
            const div = document.createElement('div');
            div.className = 'chat-item';
            div.dataset.chatId = chatId;
            
            if (currentChatId === chatId) {
                div.classList.add('active');
            }
            
            div.innerHTML = `
                <div style="font-weight: 500;">${chat.partnerEmail}</div>
                <div style="font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${chat.lastMessage || 'Нет сообщений'}
                </div>
            `;
            
            div.addEventListener('click', () => {
                openChat(chatId, chat);
            });
            
            chatsList.appendChild(div);
        });
    });
}

// Enter key for login
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});
