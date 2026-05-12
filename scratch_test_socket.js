const { io } = require('socket.io-client');
const url = 'https://baileysservice-production.up.railway.app';
console.log(`Connecting to ${url}...`);

const socket = io(url, {
    path: '/baileys-ws',
    transports: ['websocket', 'polling']
});

socket.on('connect', () => {
    console.log('✅ Connected with ID:', socket.id);
});

socket.onAny((event, ...args) => {
    console.log(`[Event Received] ${event}:`, args);
});

socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected:', reason);
});

socket.on('connect_error', (err) => {
    console.error('❌ Connection error:', err.message);
});

setTimeout(() => {
    console.log('Closing test...');
    socket.close();
}, 20000);
