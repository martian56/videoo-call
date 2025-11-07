import axios from 'axios';
import { API_BASE_URL } from '../config';

export interface MeetingCreate {
  title?: string;
  max_participants?: number;
}

export interface Meeting {
  id: string;
  code: string;
  title?: string;
  created_at: string;
  is_active: boolean;
  max_participants: number;
  participant_count: number;
}

export const meetingsApi = {
  create: async (data: MeetingCreate): Promise<Meeting> => {
    const response = await axios.post<Meeting>(`${API_BASE_URL}/api/meetings`, data);
    return response.data;
  },

  getByCode: async (code: string): Promise<Meeting> => {
    // Convert to lowercase to match backend storage
    const normalizedCode = code.toLowerCase();
    const response = await axios.get<Meeting>(`${API_BASE_URL}/api/meetings/${normalizedCode}`);
    return response.data;
  },

  getParticipants: async (code: string) => {
    // Convert to lowercase to match backend storage
    const normalizedCode = code.toLowerCase();
    const response = await axios.get(`${API_BASE_URL}/api/meetings/${normalizedCode}/participants`);
    return response.data;
  },
};

// WebSocket message types
export const WSMessageType = {
  // Signaling
  JOIN: 'join',
  LEAVE: 'leave',
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice-candidate',
  
  // Meeting updates
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  PARTICIPANTS_UPDATE: 'participants-update',
  
  // Media controls
  AUDIO_TOGGLE: 'audio-toggle',
  VIDEO_TOGGLE: 'video-toggle',
  SCREEN_SHARE_START: 'screen-share-start',
  SCREEN_SHARE_STOP: 'screen-share-stop',
  
  // Chat
  CHAT_MESSAGE: 'chat-message',
  CHAT_HISTORY: 'chat-history',
  
  // System
  ERROR: 'error',
  SUCCESS: 'success',
} as const;


