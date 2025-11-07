import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_BASE_URL } from '../config';

export interface WSMessage {
  type: string;
  data?: any;
  from?: string;
  from_client?: string;
  clientId?: string;
  message?: string;
  displayName?: string;
  timestamp?: string;
  participants?: string[];
  enabled?: boolean;
  messages?: any[];
}

export interface UseWebSocketReturn {
  sendMessage: (message: any) => void;
  isConnected: boolean;
  lastMessage: WSMessage | null;
  error: Error | null;
}

export const useWebSocket = (
  meetingCode: string,
  clientId: string,
  onMessage?: (message: WSMessage) => void
): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${protocol === 'wss' ? WS_BASE_URL.replace('ws://', 'wss://') : WS_BASE_URL}/ws/${meetingCode}/${clientId}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessage?.(message);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError(new Error('WebSocket connection error'));
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            connect();
          }
        }, 3000);
      };
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError(err as Error);
    }
  }, [meetingCode, clientId, onMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  return { sendMessage, isConnected, lastMessage, error };
};


