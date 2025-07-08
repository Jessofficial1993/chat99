class Chat99Client {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.messageCount = 0;
        this.canSendMessage = true;
        
        this.initializeElements();
        this.bindEvents();
        this.showScreen('welcome-screen');
    }

    initializeElements() {
        this.screens = {
            welcome: document.getElementById('welcome-screen'),
            guestSetup: document.getElementById('guest-setup'),
            register: document.getElementById('register-screen'),
            waiting: document.getElementById('waiting-screen'),
            chat: document.getElementById('chat-screen'),
            disconnected: document.getElementById('disconnected-screen')
        };

        this.elements = {
            guestChatBtn: document.getElementById('guest-chat-btn'),
            guestForm: document.getElementById('guest-form'),
            messageInput: document.getElementById('message-input'),
            sendBtn: document.getElementById('send-btn'),
            imageBtn: document.getElementById('image-btn'),
            imageInput: document.getElementById('image-input'),
            messagesContainer: document.getElementById('chat-messages'),
            newChatBtn: document.getElementById('new-chat-btn'),
            disconnectBtn: document.getElementById('disconnect-btn'),
            cancelSearchBtn: document.getElementById('cancel-search'),
            findNewStrangerBtn: document.getElementById('find-new-stranger'),
            backToHomeBtn: document.getElementById('back-to-home'),
            backToWelcomeBtn: document.getElementById('back-to-welcome'),
            messageLimitWarning: document.getElementById('message-limit-warning')
        };
    }

    bindEvents() {
        this.elements.guestChatBtn.addEventListener('click', () => {
            this.showScreen('guest-setup');
        });


        this.elements.backToWelcomeBtn.addEventListener('click', () => {
            this.showScreen('welcome-screen');
        });


        this.elements.guestForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.startGuestChat();
        });


        this.elements.sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        this.elements.imageBtn.addEventListener('click', () => {
            this.elements.imageInput.click();
        });

        this.elements.imageInput.addEventListener('change', (e) => {
            this.handleImageUpload(e.target.files[0]);
        });

        this.elements.newChatBtn.addEventListener('click', () => {
            this.findNewStranger();
        });

        this.elements.disconnectBtn.addEventListener('click', () => {
            this.disconnect();
        });

        this.elements.cancelSearchBtn.addEventListener('click', () => {
            this.cancelSearch();
        });

        this.elements.findNewStrangerBtn.addEventListener('click', () => {
            this.findNewStranger();
        });

        this.elements.backToHomeBtn.addEventListener('click', () => {
            this.showScreen('welcome-screen');
        });
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
        
        const targetScreen = Object.values(this.screens).find(screen => 
            screen.id === screenName
        );
        
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
    }

    connectSocket() {
        const serverUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001' 
            : window.location.origin;
            
        this.socket = io(serverUrl);
        
        this.socket.on('connect', () => {
            console.log('Connected to Chat99 server');
        });

        this.socket.on('user-registered', (data) => {
            this.currentUser = data;
            this.findStranger();
        });

        this.socket.on('waiting-for-stranger', () => {
            this.showScreen('waiting-screen');
        });

        this.socket.on('stranger-found', (data) => {
            this.currentRoom = data.roomId;
            this.messageCount = 0;
            this.canSendMessage = true;
            this.elements.messageLimitWarning.classList.add('hidden');
            this.showScreen('chat-screen');
            this.addSystemMessage('Connected to a stranger! Say hello!');
        });

        this.socket.on('new-message', (data) => {
            this.displayMessage(data);
            if (data.senderId !== this.currentUser.userId) {
                this.canSendMessage = true;
                this.messageCount = 0;
                this.elements.messageLimitWarning.classList.add('hidden');
            }
        });

        this.socket.on('stranger-disconnected', () => {
            this.showScreen('disconnected-screen');
        });

        this.socket.on('message-limit-reached', () => {
            this.elements.messageLimitWarning.classList.remove('hidden');
        });

        this.socket.on('error', (error) => {
            alert('Error: ' + error.message);
        });
    }

    startGuestChat() {
        const username = document.getElementById('guest-username').value.trim();
        const gender = document.getElementById('guest-gender').value;
        const genderFilter = document.getElementById('gender-filter').value;

        if (!gender) {
            alert('Please select your gender');
            return;
        }

        this.connectSocket();
        
        this.socket.emit('join-platform', {
            isGuest: true,
            username: username,
            gender: gender
        });

        this.genderFilter = genderFilter;
    }


    findStranger() {
        this.socket.emit('find-stranger', {
            genderFilter: this.genderFilter || 'any'
        });
    }

    findNewStranger() {
        this.elements.messagesContainer.innerHTML = '';
        this.messageCount = 0;
        this.canSendMessage = true;
        this.elements.messageLimitWarning.classList.add('hidden');
        this.findStranger();
    }

    sendMessage() {
        const message = this.elements.messageInput.value.trim();
        if (!message || !this.currentRoom) return;

        if (this.messageCount >= 2 && !this.canSendMessage) {
            this.elements.messageLimitWarning.classList.remove('hidden');
            return;
        }

        this.socket.emit('send-message', {
            roomId: this.currentRoom,
            message: message
        });

        this.elements.messageInput.value = '';
        this.messageCount++;
        
        if (this.messageCount >= 2) {
            this.canSendMessage = false;
        }
    }

    handleImageUpload(file) {
        if (!file || !this.currentRoom) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should be less than 5MB');
            return;
        }

        if (this.messageCount >= 2 && !this.canSendMessage) {
            this.elements.messageLimitWarning.classList.remove('hidden');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.socket.emit('send-message', {
                roomId: this.currentRoom,
                message: '',
                imageUrl: e.target.result
            });

            this.messageCount++;
            if (this.messageCount >= 2) {
                this.canSendMessage = false;
            }
        };
        reader.readAsDataURL(file);
    }

    displayMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.senderId === this.currentUser.userId ? 'own' : 'other'}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        if (data.imageUrl) {
            const img = document.createElement('img');
            img.src = data.imageUrl;
            img.className = 'message-image';
            img.alt = 'Shared image';
            contentDiv.appendChild(img);
        }

        if (data.message) {
            const textDiv = document.createElement('div');
            textDiv.textContent = data.message;
            contentDiv.appendChild(textDiv);
        }

        messageDiv.appendChild(contentDiv);
        this.elements.messagesContainer.appendChild(messageDiv);
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    }

    addSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.style.textAlign = 'center';
        messageDiv.style.color = '#6c757d';
        messageDiv.style.fontSize = '0.9rem';
        messageDiv.style.fontStyle = 'italic';
        messageDiv.textContent = message;
        
        this.elements.messagesContainer.appendChild(messageDiv);
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.showScreen('welcome-screen');
    }

    cancelSearch() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.showScreen('welcome-screen');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Chat99Client();
});