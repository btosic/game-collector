import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL;

export function useSocket(
  namespace: string,
  onEvent: (event: string, data: unknown) => void,
) {
  const socketRef = useRef<Socket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const socket = io(`${WS_URL}${namespace}`, {
      auth: { token: token ?? '' },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.onAny((event: string, data: unknown) => {
      onEventRef.current(event, data);
    });

    return () => {
      socket.disconnect();
    };
  }, [namespace]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('join-trade-room', roomId);
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('leave-trade-room', roomId);
  }, []);

  return { emit, joinRoom, leaveRoom };
}
