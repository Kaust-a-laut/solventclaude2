import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './config';
import { getSecret } from './api-client';

// The socket connects to the same base URL as the API
const socketUrl = API_BASE_URL.replace('/api/v1', '');

// Create socket without auto-connecting — we need to attach auth first
export const socket: Socket = io(socketUrl, {
  autoConnect: false,
  reconnection: true,
});

// Attach auth token and connect
export async function connectSocket(): Promise<void> {
  try {
    const secret = await getSecret();
    socket.auth = { token: secret };
    socket.connect();
  } catch (err) {
    console.error('[Socket] Failed to get auth token — socket will not connect:', err);
  }
}

// Expose on window so components (e.g. SupervisorHistory) can listen for events
if (typeof window !== 'undefined') {
  (window as any).socket = socket;
}

connectSocket();
