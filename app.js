// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyA8UMjDquPOSEvcdJnxmVwOLx-yN7PX50s",
    authDomain: "arbchat-e3314.firebaseapp.com",
    databaseURL: "https://arbchat-e3314-default-rtdb.firebaseio.com",
    projectId: "arbchat-e3314",
    storageBucket: "arbchat-e3314.firebasestorage.app",
    messagingSenderId: "257751213924",
    appId: "1:257751213924:web:0e70d5b8c2e9c093997c71"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// State
let currentUser = null;
let currentUserData = null;
let currentChatId = null;
let currentChatData = null;
let messagesListener = null;
let selectedMembers = [];

// Emojis
const emojis = ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😋','😛','😜','🤪','🤗','🤔','🤐','😏','😒','🙄','😬','😌','😔','😪','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','😱','😨','😰','😥','😢','😭','😤','😡','🤬','😈','💀','💩','🤡','👻','👽','🤖','😺','😸','😹','😻','❤️','🧡','💛','💚','💙','💜','🖤','💔','💕','💖','💗','💘','👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','👈','👉','👆','👇','✋','🤚','🖐','👋','🤙','💪','🙏','🔥','⭐','✨','🎉','🎊','🎁'];

// DOM Elements
const $ = id => document.getElementById(id);

// Auth State
auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user;
        await loadUserData();
        
        if (!currentUserData?.username) {
            showScreen('usernameScreen');
            // Bind username save button
            $('saveUsernameBtn').onclick = saveUsername;
        } else {
            showScreen('chatScreen');
            initApp();
        }
    } else {
        currentUser = null;
        currentUserData = null;
        showScreen('authScreen');
        // Bind auth buttons
        $('loginBtn').onclick = login;
        $('registerBtn').onclick = register;
        $('password').onkeypress = e => e.key === 'Enter' && login();
    }
});

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    $(screenId)?.classList.remove('hidden');
}

// Load user data
async function loadUserData() {
    const snap = await db.ref('users/' + currentUser.uid).once('value');
    currentUserData = snap.val() || {};
}

// Save user data
async function saveUserData(data) {
    await db.ref('users/' + currentUser.uid).update({
        ...data,
        uid: currentUser.uid,
        email: currentUser.email,
        lastSeen: firebase.database.ServerValue.TIMESTAMP,
        online: true
    });
    currentUserData = { ...currentUserData, ...data };
}

// Initialize App
function initApp() {
    updateUserUI();
    setupPresence();
    loadChats();
    initEmojiPicker();
    setupEventListeners();
}

function updateUserUI() {
    const name = currentUserData.displayName || currentUser.email.split('@')[0];
    const username = '@' + currentUserData.username;
    
    $('userName').textContent = name;
    $('userUsername').textContent = username;
    $('menuUserName').textContent = name;
    $('menuUserUsername').textContent = username;
}

// Presence
function setupPresence() {
    const userRef = db.ref('users/' + currentUser.uid);
    const connRef = db.ref('.info/connected');
    
    connRef.on('value', snap => {
        if (snap.val()) {
            userRef.onDisconnect().update({
                online: false,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            userRef.update({ online: true });
        }
    });
}

// Event Listeners
function setupEventListeners() {
    // Auth
    $('loginBtn').onclick = login;
    $('registerBtn').onclick = register;
    $('password').onkeypress = e => e.key === 'Enter' && login();
    
    // Username setup
    $('saveUsernameBtn').onclick = saveUsername;
    
    // Menu
    $('menuBtn').onclick = () => $('mainMenuModal').classList.toggle('hidden');
    $('logoutBtn').onclick = logout;
    $('logoutSidebarBtn').onclick = logout;
    $('settingsMenuBtn').onclick = () => { closeAllModals(); openModal('settingsModal'); loadSettings(); };
    $('newGroupBtn').onclick = () => { closeAllModals(); openModal('createGroupModal'); loadUsersForGroup(); };
    $('newChannelBtn').onclick = () => { closeAllModals(); openModal('createChannelModal'); };
    $('contactsBtn').onclick = () => { closeAllModals(); switchTab('contacts'); };
    $('savedBtn').onclick = () => { closeAllModals(); openSavedMessages(); };
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => switchTab(btn.dataset.tab);
    });
    
    // New chat
    $('newChatBtn').onclick = () => openModal('newChatModal');
    
    // Search
    $('searchInput').oninput = debounce(e => searchChats(e.target.value), 300);
    $('newChatSearch').oninput = debounce(e => searchUsers(e.target.value, 'newChatResults'), 300);
    $('groupMembersSearch').oninput = debounce(e => searchUsers(e.target.value, 'groupMembersResults', true), 300);
    
    // Create group/channel
    $('createGroupBtn').onclick = createGroup;
    $('createChannelBtn').onclick = createChannel;
    
    // Messages
    $('sendBtn').onclick = sendMessage;
    $('messageInput').onkeypress = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
    $('messageInput').oninput = autoResizeTextarea;
    
    // Emoji
    $('emojiBtn').onclick = e => { e.stopPropagation(); $('emojiPicker').classList.toggle('hidden'); };
    
    // Chat menu
    $('chatMenuBtn').onclick = e => { e.stopPropagation(); toggleChatMenu(e); };
    $('clearChatBtn').onclick = clearChat;
    $('deleteChatBtn').onclick = deleteChat;
    $('viewProfileBtn').onclick = viewProfile;
    
    // Chat header click
    $('chatHeaderInfo').onclick = viewProfile;
    
    // Back button
    $('backBtn').onclick = closeChat;
    
    // Settings
    $('saveProfileBtn').onclick = saveProfile;
    
    // Close modals
    document.querySelectorAll('.close-modal, .modal-overlay').forEach(el => {
        el.onclick = closeAllModals;
    });
    
    // Close dropdowns on click outside
    document.onclick = () => {
        $('chatMenuModal').classList.add('hidden');
        $('emojiPicker').classList.add('hidden');
        $('mainMenuModal').classList.add('hidden');
    };
}

// Auth functions
async function login() {
    const email = $('email').value.trim();
    const password = $('password').value;
    
    if (!email || !password) return showAuthError('Заполните все поля');
    
    try {
        $('loginBtn').disabled = true;
        $('loginBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        await auth.signInWithEmailAndPassword(email, password);
    } catch (e) {
        showAuthError(getAuthError(e.code));
    } finally {
        $('loginBtn').disabled = false;
        $('loginBtn').innerHTML = '<i class="fas fa-sign-in-alt"></i> Войти';
    }
}

async function register() {
    const email = $('email').value.trim();
    const password = $('password').value;
    
    if (!email || !password) return showAuthError('Заполните все поля');
    if (password.length < 6) return showAuthError('Пароль минимум 6 символов');
    
    try {
        $('registerBtn').disabled = true;
        $('registerBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        await auth.createUserWithEmailAndPassword(email, password);
    } catch (e) {
        showAuthError(getAuthError(e.code));
    } finally {
        $('registerBtn').disabled = false;
        $('registerBtn').innerHTML = '<i class="fas fa-user-plus"></i> Регистрация';
    }
}

async function logout() {
    await db.ref('users/' + currentUser.uid).update({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
    await auth.signOut();
}

function showAuthError(msg) {
    $('authError').textContent = msg;
    setTimeout(() => $('authError').textContent = '', 4000);
}

function getAuthError(code) {
    const errors = {
        'auth/email-already-in-use': 'Email уже используется',
        'auth/invalid-email': 'Неверный формат email',
        'auth/user-not-found': 'Аккаунт не найден. Зарегистрируйтесь',
        'auth/wrong-password': 'Неверный пароль',
        'auth/invalid-credential': 'Неверный email или пароль',
        'auth/too-many-requests': 'Слишком много попыток. Подождите',
        'auth/network-request-failed': 'Ошибка сети. Проверьте интернет',
        'auth/user-disabled': 'Аккаунт заблокирован'
    };
    return errors[code] || 'Ошибка: ' + code;
}

// Username
async function saveUsername() {
    const username = $('usernameInput').value.trim().toLowerCase();
    const btn = $('saveUsernameBtn');
    const hint = $('usernameHint');
    
    if (!/^[a-z0-9_]{5,20}$/.test(username)) {
        hint.textContent = 'Только буквы, цифры и _ (5-20 символов)';
        hint.style.color = 'var(--danger)';
        return;
    }
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверка...';
        
        // Check if username exists
        const snap = await db.ref('usernames/' + username).once('value');
        if (snap.exists()) {
            hint.textContent = 'Этот username уже занят';
            hint.style.color = 'var(--danger)';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Сохранить';
            return;
        }
        
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
        
        // Save username
        await db.ref('usernames/' + username).set(currentUser.uid);
        await saveUserData({
            username: username,
            displayName: currentUser.email.split('@')[0]
        });
        
        showScreen('chatScreen');
        initApp();
    } catch (error) {
        console.error('Error saving username:', error);
        hint.textContent = 'Ошибка сохранения: ' + error.message;
        hint.style.color = 'var(--danger)';
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Сохранить';
    }
}


// Search
async function searchChats(query) {
    if (!query) {
        loadChats();
        return;
    }
    
    query = query.toLowerCase();
    const isUsername = query.startsWith('@');
    if (isUsername) query = query.slice(1);
    
    // Search users
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};
    
    const userResults = Object.values(users).filter(u => {
        if (u.uid === currentUser.uid) return false;
        const name = (u.displayName || '').toLowerCase();
        const uname = (u.username || '').toLowerCase();
        return isUsername ? uname.includes(query) : (name.includes(query) || uname.includes(query));
    });
    
    // Search public channels
    const chatsSnap = await db.ref('chats').once('value');
    const chats = chatsSnap.val() || {};
    
    const channelResults = Object.entries(chats).filter(([id, chat]) => {
        if (chat.type !== 'channel' || !chat.isPublic) return false;
        const name = (chat.name || '').toLowerCase();
        const link = (chat.link || '').toLowerCase();
        return name.includes(query) || link.includes(query);
    }).map(([id, chat]) => ({ ...chat, chatId: id, isChannel: true }));
    
    renderSearchResults(userResults, channelResults);
}

async function renderSearchResults(userResults, channelResults = []) {
    const list = $('chatsList');
    
    if (!userResults.length && !channelResults.length) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>Не найдено</p></div>';
        return;
    }
    
    list.innerHTML = '';
    
    // Render channels first
    for (const channel of channelResults) {
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.innerHTML = `
            <div class="avatar channel"><i class="fas fa-bullhorn"></i></div>
            <div class="chat-info">
                <div class="chat-name"><span>${esc(channel.name)}</span></div>
                <div class="chat-preview">${channel.subscribersCount || 0} подписчиков</div>
            </div>
            <button class="add-contact-btn" onclick="event.stopPropagation(); joinChannel('${channel.chatId}')" title="Подписаться">
                <i class="fas fa-plus"></i>
            </button>
        `;
        div.onclick = () => joinChannel(channel.chatId);
        list.appendChild(div);
    }
    
    // Render users
    for (const user of userResults) {
        const isInContacts = await isContact(user.uid);
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.innerHTML = `
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="chat-info">
                <div class="chat-name"><span>${esc(user.displayName || user.username)}</span></div>
                <div class="chat-preview">@${esc(user.username)}</div>
            </div>
            <button class="add-contact-btn ${isInContacts ? 'added' : ''}" data-user='${JSON.stringify({uid: user.uid, username: user.username, displayName: user.displayName})}' onclick="event.stopPropagation(); ${isInContacts ? '' : `addContact(this.dataset.user)`}" title="${isInContacts ? 'В контактах' : 'Добавить в контакты'}">
                <i class="fas fa-${isInContacts ? 'check' : 'user-plus'}"></i>
            </button>
        `;
        div.onclick = () => startPrivateChat(user);
        list.appendChild(div);
    }
}

async function searchUsers(query, containerId, forGroup = false) {
    const container = $(containerId);
    if (!query) { container.innerHTML = ''; return; }
    
    query = query.toLowerCase().replace('@', '');
    
    const snap = await db.ref('users').once('value');
    const users = snap.val() || {};
    
    const results = Object.values(users).filter(u => {
        if (u.uid === currentUser.uid) return false;
        if (forGroup && selectedMembers.find(m => m.uid === u.uid)) return false;
        const name = (u.displayName || '').toLowerCase();
        const uname = (u.username || '').toLowerCase();
        return name.includes(query) || uname.includes(query);
    });
    
    container.innerHTML = '';
    results.slice(0, 10).forEach(user => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="info">
                <div class="name">${esc(user.displayName || user.username)}</div>
                <div class="username">@${esc(user.username)}</div>
            </div>
        `;
        div.onclick = () => {
            if (forGroup) {
                addMember(user);
                container.innerHTML = '';
                $('groupMembersSearch').value = '';
            } else {
                closeAllModals();
                startPrivateChat(user);
            }
        };
        container.appendChild(div);
    });
}

// Members for group
function addMember(user) {
    if (selectedMembers.find(m => m.uid === user.uid)) return;
    selectedMembers.push(user);
    renderSelectedMembers();
}

function removeMember(uid) {
    selectedMembers = selectedMembers.filter(m => m.uid !== uid);
    renderSelectedMembers();
}

function renderSelectedMembers() {
    const container = $('selectedMembers');
    container.innerHTML = '';
    selectedMembers.forEach(m => {
        const span = document.createElement('span');
        span.className = 'selected-member';
        span.innerHTML = `${esc(m.displayName || m.username)} <span class="remove" onclick="removeMember('${m.uid}')">&times;</span>`;
        container.appendChild(span);
    });
}

// Load chats
function loadChats() {
    db.ref('userChats/' + currentUser.uid).orderByChild('timestamp').on('value', snap => {
        const chats = snap.val();
        const list = $('chatsList');
        
        if (!chats) {
            list.innerHTML = '<div class="empty-state"><i class="fas fa-comment-dots"></i><p>Нет чатов</p><span>Найдите пользователя чтобы начать</span></div>';
            return;
        }
        
        list.innerHTML = '';
        const sorted = Object.entries(chats).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
        
        sorted.forEach(([chatId, chat]) => {
            const div = document.createElement('div');
            div.className = 'chat-item' + (currentChatId === chatId ? ' active' : '');
            div.dataset.chatId = chatId;
            
            const avatarClass = chat.type === 'group' ? 'group' : chat.type === 'channel' ? 'channel' : chat.type === 'saved' ? 'saved' : '';
            const icon = chat.type === 'group' ? 'users' : chat.type === 'channel' ? 'bullhorn' : chat.type === 'saved' ? 'bookmark' : 'user';
            const unread = chat.unread > 0 ? `<span class="unread-badge">${chat.unread}</span>` : '';
            
            div.innerHTML = `
                <div class="avatar ${avatarClass}"><i class="fas fa-${icon}"></i></div>
                <div class="chat-info">
                    <div class="chat-name">
                        <span>${esc(chat.name || 'Чат')}</span>
                        <span class="chat-time">${formatTime(chat.timestamp)}</span>
                    </div>
                    <div class="chat-preview">${esc(chat.lastMessage || 'Нет сообщений')}${unread}</div>
                </div>
            `;
            div.onclick = () => openChat(chatId, chat);
            list.appendChild(div);
        });
    });
}

// Start private chat
async function startPrivateChat(partner) {
    const chatId = [currentUser.uid, partner.uid].sort().join('_');
    
    const chatData = {
        type: 'private',
        oderId: partner.uid,
        name: partner.displayName || partner.username,
        username: partner.username,
        lastMessage: '',
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        unread: 0
    };
    
    await db.ref(`userChats/${currentUser.uid}/${chatId}`).update(chatData);
    await db.ref(`userChats/${partner.uid}/${chatId}`).update({
        type: 'private',
        oderId: currentUser.uid,
        name: currentUserData.displayName || currentUserData.username,
        username: currentUserData.username,
        lastMessage: '',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    openChat(chatId, { ...chatData, oderId: partner.uid });
}

// Create group
async function createGroup() {
    const name = $('groupNameInput').value.trim();
    const desc = $('groupDescInput').value.trim();
    
    if (!name) return showToast('Введите название группы');
    if (selectedMembers.length === 0) return showToast('Добавьте участников');
    
    const groupId = db.ref('chats').push().key;
    const members = { [currentUser.uid]: { role: 'admin', joinedAt: Date.now() } };
    selectedMembers.forEach(m => members[m.uid] = { role: 'member', joinedAt: Date.now() });
    
    await db.ref('chats/' + groupId).set({
        type: 'group',
        name: name,
        description: desc,
        createdBy: currentUser.uid,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        members: members
    });
    
    // Add to all members' chats
    const chatRef = {
        type: 'group',
        name: name,
        lastMessage: '',
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        unread: 0
    };
    
    await db.ref(`userChats/${currentUser.uid}/${groupId}`).set(chatRef);
    for (const m of selectedMembers) {
        await db.ref(`userChats/${m.uid}/${groupId}`).set(chatRef);
    }
    
    selectedMembers = [];
    $('groupNameInput').value = '';
    $('groupDescInput').value = '';
    $('selectedMembers').innerHTML = '';
    closeAllModals();
    showToast('Группа создана!');
}

// Join channel
async function joinChannel(channelId) {
    const chatSnap = await db.ref('chats/' + channelId).once('value');
    const channel = chatSnap.val();
    if (!channel) return showToast('Канал не найден');
    
    // Check if already subscribed
    const memberSnap = await db.ref(`chats/${channelId}/members/${currentUser.uid}`).once('value');
    if (memberSnap.exists()) {
        // Already subscribed, just open
        openChat(channelId, { type: 'channel', name: channel.name });
        return;
    }
    
    // Subscribe
    await db.ref(`chats/${channelId}/members/${currentUser.uid}`).set({
        role: 'subscriber',
        joinedAt: firebase.database.ServerValue.TIMESTAMP
    });
    
    await db.ref(`chats/${channelId}/subscribersCount`).set(firebase.database.ServerValue.increment(1));
    
    await db.ref(`userChats/${currentUser.uid}/${channelId}`).set({
        type: 'channel',
        name: channel.name,
        lastMessage: '',
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        unread: 0
    });
    
    showToast('Вы подписались на канал!');
    loadChats();
    openChat(channelId, { type: 'channel', name: channel.name });
}

window.joinChannel = joinChannel;

// Leave chat (group/channel)
async function leaveChat(chatId, type) {
    const confirmMsg = type === 'channel' ? 'Отписаться от канала?' : 'Покинуть группу?';
    if (!confirm(confirmMsg)) return;
    
    // Remove from members
    await db.ref(`chats/${chatId}/members/${currentUser.uid}`).remove();
    
    // Update subscribers count for channels
    if (type === 'channel') {
        await db.ref(`chats/${chatId}/subscribersCount`).set(firebase.database.ServerValue.increment(-1));
    }
    
    // Remove from user's chats
    await db.ref(`userChats/${currentUser.uid}/${chatId}`).remove();
    
    closeAllModals();
    closeChat();
    $('noChatSelected').classList.remove('hidden');
    $('activeChat').classList.add('hidden');
    
    showToast(type === 'channel' ? 'Вы отписались от канала' : 'Вы покинули группу');
    loadChats();
}

window.leaveChat = leaveChat;

// Saved Messages (Избранное)
async function openSavedMessages() {
    const savedChatId = 'saved_' + currentUser.uid;
    
    // Create saved messages chat if not exists
    const chatRef = await db.ref(`userChats/${currentUser.uid}/${savedChatId}`).once('value');
    if (!chatRef.exists()) {
        await db.ref(`userChats/${currentUser.uid}/${savedChatId}`).set({
            type: 'saved',
            name: 'Избранное',
            lastMessage: '',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            unread: 0
        });
    }
    
    openChat(savedChatId, { type: 'saved', name: 'Избранное' });
}

// Create channel
async function createChannel() {
    const name = $('channelNameInput').value.trim();
    const desc = $('channelDescInput').value.trim();
    const isPublic = document.querySelector('input[name="channelType"]:checked').value === 'public';
    const link = $('channelLinkInput').value.trim().toLowerCase();
    
    if (!name) return showToast('Введите название канала');
    
    if (isPublic && link) {
        const exists = await db.ref('channelLinks/' + link).once('value');
        if (exists.exists()) return showToast('Эта ссылка уже занята');
    }
    
    const channelId = db.ref('chats').push().key;
    
    await db.ref('chats/' + channelId).set({
        type: 'channel',
        name: name,
        description: desc,
        isPublic: isPublic,
        link: isPublic ? link : null,
        createdBy: currentUser.uid,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        members: { [currentUser.uid]: { role: 'admin', joinedAt: Date.now() } },
        subscribersCount: 1
    });
    
    if (isPublic && link) {
        await db.ref('channelLinks/' + link).set(channelId);
    }
    
    await db.ref(`userChats/${currentUser.uid}/${channelId}`).set({
        type: 'channel',
        name: name,
        lastMessage: '',
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        unread: 0
    });
    
    $('channelNameInput').value = '';
    $('channelDescInput').value = '';
    $('channelLinkInput').value = '';
    closeAllModals();
    showToast('Канал создан!');
}


// Open chat
function openChat(chatId, chat) {
    currentChatId = chatId;
    currentChatData = chat;
    
    $('noChatSelected').classList.add('hidden');
    $('activeChat').classList.remove('hidden');
    
    // Set header
    $('chatUserName').textContent = chat.name || 'Чат';
    
    const icon = chat.type === 'group' ? 'users' : chat.type === 'channel' ? 'bullhorn' : chat.type === 'saved' ? 'bookmark' : 'user';
    $('chatAvatar').innerHTML = `<i class="fas fa-${icon}"></i>`;
    if (chat.type === 'group') $('chatAvatar').style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
    else if (chat.type === 'channel') $('chatAvatar').style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    else if (chat.type === 'saved') $('chatAvatar').style.background = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';
    else $('chatAvatar').style.background = '';
    
    // Status
    if (chat.type === 'saved') {
        $('chatUserStatus').textContent = 'Ваши сохранённые сообщения';
        $('chatUserStatus').className = 'status';
    } else if (chat.type === 'private' && chat.oderId) {
        db.ref('users/' + chat.oderId).on('value', snap => {
            const u = snap.val();
            if (u) {
                $('chatUserStatus').textContent = u.online ? 'в сети' : formatLastSeen(u.lastSeen);
                $('chatUserStatus').className = 'status' + (u.online ? ' online' : '');
            }
        });
    } else if (chat.type === 'group') {
        db.ref('chats/' + chatId + '/members').once('value', snap => {
            const count = Object.keys(snap.val() || {}).length;
            $('chatUserStatus').textContent = `${count} участник${getPlural(count, '', 'а', 'ов')}`;
            $('chatUserStatus').className = 'status';
        });
    } else if (chat.type === 'channel') {
        db.ref('chats/' + chatId + '/subscribersCount').once('value', snap => {
            const count = snap.val() || 0;
            $('chatUserStatus').textContent = `${count} подписчик${getPlural(count, '', 'а', 'ов')}`;
            $('chatUserStatus').className = 'status';
        });
    }
    
    // Mark as read
    db.ref(`userChats/${currentUser.uid}/${chatId}/unread`).set(0);
    
    // Load messages
    if (messagesListener) db.ref('messages/' + currentChatId).off('value', messagesListener);
    messagesListener = db.ref('messages/' + chatId).orderByChild('timestamp').limitToLast(100).on('value', snap => {
        renderMessages(snap.val());
    });
    
    // Update active state
    document.querySelectorAll('.chat-item').forEach(el => {
        el.classList.toggle('active', el.dataset.chatId === chatId);
    });
    
    // Mobile
    document.querySelector('.sidebar').classList.add('chat-open');
    document.querySelector('.chat-area').classList.add('active');
    
    $('messageInput').focus();
}

function closeChat() {
    document.querySelector('.sidebar').classList.remove('chat-open');
    document.querySelector('.chat-area').classList.remove('active');
    currentChatId = null;
    currentChatData = null;
}

// Render messages
function renderMessages(data) {
    const container = $('messages');
    container.innerHTML = '';
    
    if (!data) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><p>Нет сообщений</p><span>Напишите первое!</span></div>';
        return;
    }
    
    let lastDate = null;
    
    Object.values(data).forEach(msg => {
        const msgDate = new Date(msg.timestamp).toDateString();
        if (msgDate !== lastDate) {
            const divider = document.createElement('div');
            divider.className = 'date-divider';
            divider.innerHTML = `<span>${formatDate(msg.timestamp)}</span>`;
            container.appendChild(divider);
            lastDate = msgDate;
        }
        
        const isMine = msg.senderId === currentUser.uid;
        const div = document.createElement('div');
        div.className = 'message ' + (isMine ? 'sent' : 'received');
        
        let senderHtml = '';
        if (!isMine && (currentChatData?.type === 'group' || currentChatData?.type === 'channel')) {
            senderHtml = `<div class="message-sender">${esc(msg.senderName || 'Пользователь')}</div>`;
        }
        
        div.innerHTML = `
            ${senderHtml}
            <div class="message-text">${esc(msg.text)}</div>
            <div class="message-footer">
                <span class="message-time">${formatTime(msg.timestamp)}</span>
                ${isMine ? `<span class="message-status ${msg.read ? 'read' : ''}"><i class="fas fa-check${msg.read ? '-double' : ''}"></i></span>` : ''}
            </div>
        `;
        container.appendChild(div);
    });
    
    $('messagesContainer').scrollTop = $('messagesContainer').scrollHeight;
}

// Send message
function sendMessage() {
    const text = $('messageInput').value.trim();
    if (!text || !currentChatId) return;
    
    const msgRef = db.ref('messages/' + currentChatId).push();
    msgRef.set({
        text: text,
        senderId: currentUser.uid,
        senderName: currentUserData.displayName || currentUserData.username,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        read: false
    });
    
    // Update chat preview
    db.ref(`userChats/${currentUser.uid}/${currentChatId}`).update({
        lastMessage: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Update for partner/members
    if (currentChatData?.type === 'saved') {
        // Saved messages - no need to notify anyone
    } else if (currentChatData?.type === 'private' && currentChatData.oderId) {
        db.ref(`userChats/${currentChatData.oderId}/${currentChatId}`).update({
            lastMessage: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            unread: firebase.database.ServerValue.increment(1)
        });
    } else if (currentChatData?.type === 'group' || currentChatData?.type === 'channel') {
        db.ref('chats/' + currentChatId + '/members').once('value', snap => {
            const members = snap.val() || {};
            Object.keys(members).forEach(uid => {
                if (uid !== currentUser.uid) {
                    db.ref(`userChats/${uid}/${currentChatId}`).update({
                        lastMessage: text,
                        timestamp: firebase.database.ServerValue.TIMESTAMP,
                        unread: firebase.database.ServerValue.increment(1)
                    });
                }
            });
        });
    }
    
    $('messageInput').value = '';
    $('messageInput').style.height = 'auto';
}

// Chat actions
function toggleChatMenu(e) {
    const menu = $('chatMenuModal');
    const rect = e.target.closest('.icon-btn').getBoundingClientRect();
    menu.style.top = rect.bottom + 8 + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    menu.classList.toggle('hidden');
}

async function clearChat() {
    if (!currentChatId || !confirm('Очистить историю?')) return;
    await db.ref('messages/' + currentChatId).remove();
    $('chatMenuModal').classList.add('hidden');
    showToast('Чат очищен');
}

async function deleteChat() {
    if (!currentChatId || !confirm('Удалить чат?')) return;
    await db.ref(`userChats/${currentUser.uid}/${currentChatId}`).remove();
    $('chatMenuModal').classList.add('hidden');
    closeChat();
    $('noChatSelected').classList.remove('hidden');
    $('activeChat').classList.add('hidden');
    showToast('Чат удалён');
}

async function viewProfile() {
    if (!currentChatData) return;
    
    if (currentChatData.type === 'private') {
        const snap = await db.ref('users/' + currentChatData.oderId).once('value');
        const user = snap.val();
        if (!user) return;
        
        $('profileName').textContent = user.displayName || user.username;
        $('profileUsername').textContent = '@' + user.username;
        $('profileBio').textContent = user.bio || '';
        $('profileStatus').textContent = user.online ? 'в сети' : formatLastSeen(user.lastSeen);
        $('profileStatus').className = 'status' + (user.online ? ' online' : '');
        
        $('sendMessageBtn').onclick = () => closeAllModals();
        $('sendMessageBtn').innerHTML = '<i class="fas fa-comment"></i> Написать';
        
        openModal('userProfileModal');
    } else if (currentChatData.type === 'group' || currentChatData.type === 'channel') {
        const snap = await db.ref('chats/' + currentChatId).once('value');
        const chat = snap.val();
        if (!chat) return;
        
        $('profileName').textContent = chat.name;
        $('profileUsername').textContent = chat.type === 'channel' && chat.link ? '@' + chat.link : '';
        $('profileBio').textContent = chat.description || '';
        
        const membersCount = chat.type === 'channel' ? (chat.subscribersCount || 0) : Object.keys(chat.members || {}).length;
        const label = chat.type === 'channel' ? 'подписчик' : 'участник';
        $('profileStatus').textContent = `${membersCount} ${label}${getPlural(membersCount, '', 'а', 'ов')}`;
        $('profileStatus').className = 'status';
        
        // Change avatar icon
        const avatarEl = document.querySelector('#userProfileModal .profile-avatar');
        avatarEl.innerHTML = `<i class="fas fa-${chat.type === 'channel' ? 'bullhorn' : 'users'}"></i>`;
        avatarEl.style.background = chat.type === 'channel' 
            ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
            : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
        
        $('sendMessageBtn').innerHTML = '<i class="fas fa-sign-out-alt"></i> Покинуть';
        $('sendMessageBtn').onclick = () => leaveChat(currentChatId, chat.type);
        
        openModal('userProfileModal');
    }
}

// Settings
function loadSettings() {
    $('displayNameInput').value = currentUserData.displayName || '';
    $('editUsernameInput').value = currentUserData.username || '';
    $('bioInput').value = currentUserData.bio || '';
}

async function saveProfile() {
    const name = $('displayNameInput').value.trim();
    const newUsername = $('editUsernameInput').value.trim().toLowerCase();
    const bio = $('bioInput').value.trim();
    
    if (newUsername && newUsername !== currentUserData.username) {
        if (!/^[a-z0-9_]{5,20}$/.test(newUsername)) {
            return showToast('Username: 5-20 символов, буквы, цифры, _');
        }
        const exists = await db.ref('usernames/' + newUsername).once('value');
        if (exists.exists()) return showToast('Username занят');
        
        await db.ref('usernames/' + currentUserData.username).remove();
        await db.ref('usernames/' + newUsername).set(currentUser.uid);
    }
    
    await saveUserData({
        displayName: name || currentUserData.username,
        username: newUsername || currentUserData.username,
        bio: bio
    });
    
    updateUserUI();
    closeAllModals();
    showToast('Сохранено!');
}

// Emoji
function initEmojiPicker() {
    const picker = $('emojiPicker');
    picker.innerHTML = '';
    emojis.forEach(e => {
        const btn = document.createElement('button');
        btn.textContent = e;
        btn.onclick = () => {
            $('messageInput').value += e;
            $('messageInput').focus();
        };
        picker.appendChild(btn);
    });
}

// Helpers
function openModal(id) { $(id).classList.remove('hidden'); }
function closeAllModals() {
    document.querySelectorAll('.modal, .sidebar-menu').forEach(m => m.classList.add('hidden'));
    selectedMembers = [];
    $('selectedMembers').innerHTML = '';
}

function showToast(msg) {
    const toast = $('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    
    if (d.toDateString() === now.toDateString()) return 'Сегодня';
    if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
    return d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
}

function formatLastSeen(ts) {
    if (!ts) return 'был(а) давно';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'был(а) только что';
    if (diff < 3600000) return `был(а) ${Math.floor(diff / 60000)} мин. назад`;
    if (diff < 86400000) return `был(а) ${Math.floor(diff / 3600000)} ч. назад`;
    return 'был(а) ' + new Date(ts).toLocaleDateString('ru');
}

function getPlural(n, one, few, many) {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
}

function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function debounce(fn, ms) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), ms);
    };
}

function autoResizeTextarea() {
    const el = $('messageInput');
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// Tabs
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.dataset.tab === tabName);
    });
    
    if (tabName === 'contacts') {
        loadContacts();
    } else {
        loadChats();
    }
}

// Contacts
async function loadContacts() {
    const snap = await db.ref('contacts/' + currentUser.uid).once('value');
    const contacts = snap.val();
    const list = $('contactsList');
    
    if (!contacts) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-user-plus"></i><p>Нет контактов</p><span>Найдите пользователя через поиск и добавьте в контакты</span></div>';
        return;
    }
    
    list.innerHTML = '';
    
    for (const [uid, contact] of Object.entries(contacts)) {
        const userSnap = await db.ref('users/' + uid).once('value');
        const user = userSnap.val();
        if (!user) continue;
        
        const div = document.createElement('div');
        div.className = 'contact-item';
        div.innerHTML = `
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="contact-info">
                <div class="contact-name">${esc(user.displayName || user.username)}</div>
                <div class="contact-username">@${esc(user.username)}</div>
                <div class="contact-status ${user.online ? 'online' : ''}">${user.online ? 'в сети' : formatLastSeen(user.lastSeen)}</div>
            </div>
            <div class="contact-actions">
                <button class="icon-btn" onclick="event.stopPropagation(); removeContact('${uid}')" title="Удалить">
                    <i class="fas fa-user-minus"></i>
                </button>
            </div>
        `;
        div.onclick = () => startPrivateChat(user);
        list.appendChild(div);
    }
}

async function addContact(user) {
    if (typeof user === 'string') {
        user = JSON.parse(user);
    }
    await db.ref(`contacts/${currentUser.uid}/${user.uid}`).set({
        addedAt: firebase.database.ServerValue.TIMESTAMP,
        username: user.username,
        displayName: user.displayName || user.username
    });
    showToast(`${user.displayName || user.username} добавлен в контакты`);
    // Refresh search results
    const query = $('searchInput').value;
    if (query) searchChats(query);
}

async function removeContact(uid) {
    if (!confirm('Удалить из контактов?')) return;
    await db.ref(`contacts/${currentUser.uid}/${uid}`).remove();
    loadContacts();
    showToast('Контакт удалён');
}

async function isContact(uid) {
    const snap = await db.ref(`contacts/${currentUser.uid}/${uid}`).once('value');
    return snap.exists();
}

// Load users for group creation
async function loadUsersForGroup() {
    selectedMembers = [];
    $('selectedMembers').innerHTML = '';
    $('groupMembersResults').innerHTML = '';
    $('groupMembersSearch').value = '';
}

// Make functions global
// Copy username
function copyUsername(username) {
    navigator.clipboard.writeText(username).then(() => {
        showToast('Username скопирован!');
    }).catch(() => {
        showToast('Не удалось скопировать');
    });
}

window.removeMember = removeMember;
window.removeContact = removeContact;
window.addContact = addContact;
window.copyUsername = copyUsername;
