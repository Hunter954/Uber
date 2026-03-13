import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useSocket(token, handlers = {}) {
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return undefined;
    }

    const socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    const subscriptions = Object.entries(handlersRef.current).map(([event, fn]) => {
      if (typeof fn !== 'function') return null;
      socket.on(event, fn);
      return [event, fn];
    }).filter(Boolean);

    return () => {
      subscriptions.forEach(([event, fn]) => socket.off(event, fn));
      socket.disconnect();
    };
  }, [token]);

  return socketRef;
}
