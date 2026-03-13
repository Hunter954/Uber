import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useSocket(token, handlers = {}) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    const socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    Object.entries(handlers).forEach(([event, fn]) => {
      if (typeof fn === 'function') socket.on(event, fn);
    });

    return () => socket.disconnect();
  }, [token]);

  return socketRef;
}
