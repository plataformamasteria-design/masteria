import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
    path: '/baileys-ws',
    transports: ['websocket', 'polling']
});

socket.on('connect', () => {
    console.log('Connected to Baileys WS');
});

socket.on('baileys:incoming-message', (data) => {
    console.log('Received message:', JSON.stringify(data, null, 2));
});

socket.on('disconnect', () => {
    console.log('Disconnected');
});
