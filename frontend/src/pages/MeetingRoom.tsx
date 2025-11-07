import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Check, Users } from 'lucide-react';
import VideoGrid from '../components/VideoGrid';
import ChatPanel from '../components/ChatPanel';
import MeetingControls from '../components/MeetingControls';
import { useWebSocket } from '../hooks/useWebSocket';
import type { WSMessage } from '../hooks/useWebSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { generateClientId } from '../utils/generateId';
import { WSMessageType } from '../api/meetings';

interface ChatMessage {
  from: string;
  displayName?: string;
  message: string;
  timestamp: string;
}

export default function MeetingRoom() {
  const { meetingCode } = useParams<{ meetingCode: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [clientId] = useState(() => generateClientId());
  const [displayName] = useState(() => searchParams.get('name') || 'Anonymous');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [copied, setCopied] = useState(false);
  const [participants, setParticipants] = useState<Map<string, { displayName?: string; audioEnabled?: boolean; videoEnabled?: boolean }>>(new Map());
  const [, setOtherParticipants] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const sendMessageRef = useRef<((message: any) => void) | null>(null);

  const {
    localStream,
    remoteStreams,
    initializeLocalStream,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate: handleRemoteIceCandidate,
    removePeer,
    toggleAudio,
    toggleVideo,
    cleanup,
    hasPeerConnection,
  } = useWebRTC({
    onIceCandidate: (clientId: string, candidate: RTCIceCandidate) => {
      if (sendMessageRef.current) {
        console.log('Sending ICE candidate to:', clientId);
        sendMessageRef.current({
          type: WSMessageType.ICE_CANDIDATE,
          target: clientId,
          data: candidate.toJSON(),
        });
      } else {
        console.warn('sendMessageRef is null, cannot send ICE candidate to:', clientId);
      }
    },
  });

  // Initialize local stream
  useEffect(() => {
    const init = async () => {
      const success = await initializeLocalStream();
      if (!success) {
        alert('Failed to access camera/microphone. Please allow permissions.');
        navigate('/');
      }
    };
    init();

    return () => {
      cleanup();
    };
  }, []);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: WSMessage) => {
    console.log('Received WebSocket message:', message.type, 'Full message:', message);

    switch (message.type) {
      case WSMessageType.USER_JOINED:
        if (message.clientId && message.clientId !== clientId) {
          console.log('User joined:', message.clientId);
          setOtherParticipants((prev) => {
            if (!prev.includes(message.clientId!)) {
              return [...prev, message.clientId!];
            }
            return prev;
          });
          // Create offer to new participant only if we don't already have a connection
          if (!hasPeerConnection(message.clientId) && sendMessageRef.current) {
            console.log('Creating offer to:', message.clientId);
            createOffer(message.clientId).then((offer) => {
              if (offer && sendMessageRef.current) {
                console.log('Sending offer to:', message.clientId);
                sendMessageRef.current({
                  type: WSMessageType.OFFER,
                  target: message.clientId,
                  data: offer,
                });
              } else {
                console.error('Failed to create offer or sendMessageRef is null');
              }
            }).catch((error) => {
              console.error('Error creating offer:', error);
            });
          } else {
            console.log('Already have peer connection with:', message.clientId);
          }
        }
        break;

      case WSMessageType.USER_LEFT:
        if (message.clientId) {
          removePeer(message.clientId);
          setOtherParticipants((prev) => prev.filter((id) => id !== message.clientId));
          setParticipants((prev) => {
            const newMap = new Map(prev);
            newMap.delete(message.clientId!);
            return newMap;
          });
        }
        break;

      case WSMessageType.PARTICIPANTS_UPDATE:
        if (message.participants) {
          const others = message.participants.filter((id: string) => id !== clientId);
          setOtherParticipants(others);
          
          // When we first join, we receive the list of existing participants
          // We should wait for existing participants to send us offers (via USER_JOINED on their side)
          // Don't create offers here - let existing participants initiate via USER_JOINED
          setIsInitialized(true);
        }
        break;

      case WSMessageType.OFFER:
        if (message.from && message.data) {
          console.log('Received offer from:', message.from, 'localStream ready:', !!localStream);
          // Handle offer - the useWebRTC hook will check if local stream is ready
          handleOffer(message.from, message.data).then((answer) => {
            if (answer && sendMessageRef.current) {
              console.log('Sending answer to:', message.from);
              sendMessageRef.current({
                type: WSMessageType.ANSWER,
                target: message.from,
                data: answer,
              });
            } else {
              console.error('Failed to create answer or sendMessageRef is null');
            }
          }).catch((error) => {
            console.error('Error handling offer:', error);
          });
        }
        break;

      case WSMessageType.ANSWER:
        if (message.from && message.data) {
          console.log('Received answer from:', message.from);
          handleAnswer(message.from, message.data).catch((error) => {
            console.error('Error handling answer:', error);
          });
        }
        break;

      case WSMessageType.ICE_CANDIDATE:
        if (message.from && message.data) {
          console.log('Received ICE candidate from:', message.from);
          handleRemoteIceCandidate(message.from, message.data).catch((error) => {
            console.error('Error handling ICE candidate:', error);
          });
        }
        break;

      case WSMessageType.CHAT_MESSAGE:
        if (message.message) {
          setChatMessages((prev) => [
            ...prev,
            {
              from: message.from || 'unknown',
              displayName: message.displayName,
              message: message.message!,
              timestamp: message.timestamp || new Date().toISOString(),
            },
          ]);
          // Show notification if chat is closed
          if (!chatOpen) {
            setHasUnreadMessages(true);
          }
        }
        break;

      case WSMessageType.CHAT_HISTORY:
        if (message.messages) {
          setChatMessages(message.messages as ChatMessage[]);
        }
        break;

      case WSMessageType.AUDIO_TOGGLE:
        if (message.clientId && message.clientId !== clientId) {
          setParticipants((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.clientId!) || {};
            newMap.set(message.clientId!, { ...existing, audioEnabled: message.enabled });
            return newMap;
          });
        }
        break;

      case WSMessageType.VIDEO_TOGGLE:
        if (message.clientId && message.clientId !== clientId) {
          setParticipants((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.clientId!) || {};
            newMap.set(message.clientId!, { ...existing, videoEnabled: message.enabled });
            return newMap;
          });
        }
        break;

      default:
        console.warn('Unhandled WebSocket message type:', message.type, message);
        break;
    }
  }, [clientId, createOffer, handleOffer, handleAnswer, handleRemoteIceCandidate, removePeer, hasPeerConnection, isInitialized, localStream, chatOpen]);

  // Normalize meeting code to lowercase for backend consistency
  const normalizedMeetingCode = meetingCode?.toLowerCase() || '';
  
  const { sendMessage, isConnected } = useWebSocket(
    normalizedMeetingCode,
    clientId,
    handleWebSocketMessage
  );

  // Store sendMessage in ref for ICE candidate handler
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  // Update local participant info
  useEffect(() => {
    setParticipants((prev) => {
      const newMap = new Map(prev);
      newMap.set(clientId, {
        displayName,
        audioEnabled,
        videoEnabled,
      });
      return newMap;
    });
  }, [clientId, displayName, audioEnabled, videoEnabled]);

  // ICE candidate handling is now done via the useWebRTC hook callback

  const handleToggleAudio = () => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);
    toggleAudio(newState);
    
    if (sendMessageRef.current) {
      sendMessageRef.current({
        type: WSMessageType.AUDIO_TOGGLE,
        enabled: newState,
      });
    }
  };

  const handleToggleVideo = () => {
    const newState = !videoEnabled;
    setVideoEnabled(newState);
    toggleVideo(newState);
    
    if (sendMessageRef.current) {
      sendMessageRef.current({
        type: WSMessageType.VIDEO_TOGGLE,
        enabled: newState,
      });
    }
  };

  const handleSendChatMessage = (message: string) => {
    if (sendMessageRef.current) {
      sendMessageRef.current({
        type: WSMessageType.CHAT_MESSAGE,
        message,
        displayName,
      });
    }
  };

  const handleLeave = () => {
    cleanup();
    if (sendMessageRef.current) {
      sendMessageRef.current({
        type: WSMessageType.LEAVE,
      });
    }
    navigate('/');
  };

  const copyMeetingLink = () => {
    // Use normalized code for sharing
    const link = `${window.location.origin}/join?code=${normalizedMeetingCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!normalizedMeetingCode) {
    navigate('/');
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-400" />
            <span className="text-sm text-gray-300">
              {1 + remoteStreams.size} participant{remoteStreams.size !== 1 ? 's' : ''}
            </span>
          </div>
          {!isConnected && (
            <div className="flex items-center gap-2 text-yellow-400">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span className="text-sm">Connecting...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-lg">
            <span className="text-sm font-mono text-primary-400">{normalizedMeetingCode.toUpperCase()}</span>
            <button
              onClick={copyMeetingLink}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Copy meeting link"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        {localStream ? (
          <VideoGrid
            localStream={localStream}
            remoteStreams={remoteStreams}
            participants={participants}
            localClientId={clientId}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Initializing camera...</p>
            </div>
          </div>
        )}

        {/* Chat Panel */}
        <ChatPanel
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          messages={chatMessages}
          onSendMessage={handleSendChatMessage}
          displayName={displayName}
        />
      </div>

      {/* Controls */}
      <MeetingControls
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onLeave={handleLeave}
        onToggleChat={() => {
          const newChatState = !chatOpen;
          setChatOpen(newChatState);
          // Clear unread notification when opening chat
          if (newChatState) {
            setHasUnreadMessages(false);
          }
        }}
        chatOpen={chatOpen}
        hasUnreadMessages={hasUnreadMessages}
      />
    </div>
  );
}

