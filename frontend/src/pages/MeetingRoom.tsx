import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Check, Users, HelpCircle } from 'lucide-react';
import VideoGrid from '../components/VideoGrid';
import ChatPanel from '../components/ChatPanel';
import MeetingControls from '../components/MeetingControls';
import ParticipantsList from '../components/ParticipantsList';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';
import LeaveMeetingModal from '../components/LeaveMeetingModal';
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
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [participants, setParticipants] = useState<Map<string, { displayName?: string; audioEnabled?: boolean; videoEnabled?: boolean; screenSharing?: boolean }>>(new Map());
  const [, setOtherParticipants] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [pinnedClientId, setPinnedClientId] = useState<string | null>(null);
  const sendMessageRef = useRef<((message: any) => void) | null>(null);
  const pendingConnectionsRef = useRef<Set<string>>(new Set());
  const retryTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const {
    localStream,
    remoteStreams,
    isScreenSharing,
    initializeLocalStream,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate: handleRemoteIceCandidate,
    removePeer,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
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
      // Clean up retry timeouts
      retryTimeoutRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      retryTimeoutRef.current.clear();
    };
  }, []);

  // Process pending connections when local stream becomes ready
  useEffect(() => {
    if (localStream && pendingConnectionsRef.current.size > 0 && sendMessageRef.current) {
      console.log('Local stream ready, processing pending connections:', Array.from(pendingConnectionsRef.current));
      const pending = Array.from(pendingConnectionsRef.current);
      pendingConnectionsRef.current.clear();
      
      pending.forEach((clientIdToConnect) => {
        if (!hasPeerConnection(clientIdToConnect)) {
          console.log(`Retrying connection to ${clientIdToConnect} now that stream is ready`);
          createOffer(clientIdToConnect).then((offer) => {
            if (offer && sendMessageRef.current) {
              console.log('Sending offer to pending connection:', clientIdToConnect);
              sendMessageRef.current({
                type: WSMessageType.OFFER,
                target: clientIdToConnect,
                data: offer,
              });
            }
          }).catch((error) => {
            console.error('Error creating offer for pending connection:', error);
          });
        }
      });
    }
  }, [localStream, createOffer, hasPeerConnection]);


  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: WSMessage) => {
    console.log('Received WebSocket message:', message.type, 'Full message:', message);

    switch (message.type) {
      case WSMessageType.USER_JOINED:
        if (message.clientId && message.clientId !== clientId) {
          console.log('User joined:', message.clientId, 'displayName:', message.displayName);
          
          // Always create/update participant entry
          setParticipants((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.clientId!) || {};
            newMap.set(message.clientId!, { 
              ...existing, 
              displayName: message.displayName || existing.displayName || undefined
            });
            console.log('Updated participants Map for', message.clientId, ':', newMap.get(message.clientId!));
            return newMap;
          });
          
          setOtherParticipants((prev) => {
            if (!prev.includes(message.clientId!)) {
              return [...prev, message.clientId!];
            }
            return prev;
          });
          
          // Attempt to create connection with retry logic
          const attemptConnection = (clientIdToConnect: string, retryCount = 0) => {
            if (!hasPeerConnection(clientIdToConnect) && sendMessageRef.current && localStream) {
              console.log(`Creating offer to: ${clientIdToConnect} (attempt ${retryCount + 1})`);
              createOffer(clientIdToConnect).then((offer) => {
                if (offer && sendMessageRef.current) {
                  console.log('Sending offer to:', clientIdToConnect);
                  sendMessageRef.current({
                    type: WSMessageType.OFFER,
                    target: clientIdToConnect,
                    data: offer,
                  });
                  // Remove from pending if successful
                  pendingConnectionsRef.current.delete(clientIdToConnect);
                  const timeoutId = retryTimeoutRef.current.get(clientIdToConnect);
                  if (timeoutId) {
                    clearTimeout(timeoutId);
                    retryTimeoutRef.current.delete(clientIdToConnect);
                  }
                } else {
                  console.warn(`Failed to create offer for ${clientIdToConnect}, will retry`);
                  // Retry if local stream wasn't ready or offer creation failed
                  if (retryCount < 5) {
                    pendingConnectionsRef.current.add(clientIdToConnect);
                    const timeoutId = setTimeout(() => {
                      attemptConnection(clientIdToConnect, retryCount + 1);
                    }, 1000 * (retryCount + 1)); // Exponential backoff
                    retryTimeoutRef.current.set(clientIdToConnect, timeoutId);
                  } else {
                    console.error(`Max retries reached for ${clientIdToConnect}`);
                    pendingConnectionsRef.current.delete(clientIdToConnect);
                  }
                }
              }).catch((error) => {
                console.error('Error creating offer:', error);
                // Retry on error
                if (retryCount < 5) {
                  pendingConnectionsRef.current.add(clientIdToConnect);
                  const timeoutId = setTimeout(() => {
                    attemptConnection(clientIdToConnect, retryCount + 1);
                  }, 1000 * (retryCount + 1));
                  retryTimeoutRef.current.set(clientIdToConnect, timeoutId);
                } else {
                  pendingConnectionsRef.current.delete(clientIdToConnect);
                }
              });
            } else if (!localStream) {
              // Queue connection attempt for when stream is ready
              console.log(`Local stream not ready, queueing connection to ${clientIdToConnect}`);
              pendingConnectionsRef.current.add(clientIdToConnect);
            } else {
              console.log('Already have peer connection with:', clientIdToConnect);
            }
          };
          
          attemptConnection(message.clientId!);
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
          // Wait a bit for existing participants to send us offers, but if they don't, we'll initiate
          setIsInitialized(true);
          
          // If we're a new user and don't receive offers within 3 seconds, initiate connections ourselves
          if (localStream && others.length > 0) {
            setTimeout(() => {
              others.forEach((otherId: string) => {
                // Only initiate if we don't have a connection and haven't received an offer
                if (!hasPeerConnection(otherId) && !pendingConnectionsRef.current.has(otherId)) {
                  console.log(`New user: initiating connection to existing participant ${otherId}`);
                  const attemptConnection = (clientIdToConnect: string, retryCount = 0) => {
                    if (!hasPeerConnection(clientIdToConnect) && sendMessageRef.current && localStream) {
                      createOffer(clientIdToConnect).then((offer) => {
                        if (offer && sendMessageRef.current) {
                          console.log('New user sending offer to:', clientIdToConnect);
                          sendMessageRef.current({
                            type: WSMessageType.OFFER,
                            target: clientIdToConnect,
                            data: offer,
                          });
                          pendingConnectionsRef.current.delete(clientIdToConnect);
                        } else if (retryCount < 3) {
                          setTimeout(() => attemptConnection(clientIdToConnect, retryCount + 1), 2000);
                        }
                      }).catch((error) => {
                        console.error('Error creating offer from new user:', error);
                        if (retryCount < 3) {
                          setTimeout(() => attemptConnection(clientIdToConnect, retryCount + 1), 2000);
                        }
                      });
                    }
                  };
                  attemptConnection(otherId);
                }
              });
            }, 3000); // Wait 3 seconds for offers from existing participants
          }
        }
        break;

      case 'participant-name-update':
        if (message.clientId && message.displayName) {
          console.log('Received display name update for', message.clientId, ':', message.displayName);
          setParticipants((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.clientId!) || {};
            const updated = { ...existing, displayName: message.displayName };
            newMap.set(message.clientId!, updated);
            console.log('Updated participant name in Map:', message.clientId, updated, 'Full Map:', Array.from(newMap.entries()));
            return newMap;
          });
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

      case WSMessageType.SCREEN_SHARE_START:
        if (message.clientId && message.clientId !== clientId) {
          setParticipants((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.clientId!) || {};
            newMap.set(message.clientId!, { ...existing, screenSharing: true });
            return newMap;
          });
          
          // Auto-pin: If no one is pinned, or if the currently pinned person is not screen sharing, pin this person
          setPinnedClientId((currentPinned) => {
            if (!currentPinned) {
              // No one is pinned, pin the screen sharer
              console.log('Auto-pinning screen sharer:', message.clientId);
              return message.clientId || null;
            } else {
              // Check if currently pinned person is still screen sharing
              const pinnedParticipant = participants.get(currentPinned);
              if (!pinnedParticipant?.screenSharing) {
                // Currently pinned person is not screen sharing, pin the new screen sharer
                console.log('Auto-pinning new screen sharer (previous pinned person stopped sharing):', message.clientId);
                return message.clientId || null;
              }
              // First screen sharer is still sharing, keep them pinned
              return currentPinned;
            }
          });
        }
        break;

      case WSMessageType.SCREEN_SHARE_STOP:
        if (message.clientId && message.clientId !== clientId) {
          setParticipants((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.clientId!) || {};
            newMap.set(message.clientId!, { ...existing, screenSharing: false });
            
            // If the pinned person stopped sharing, check if anyone else is sharing
            if (pinnedClientId === message.clientId) {
              // The pinned person stopped sharing, find another screen sharer
              const screenSharers = Array.from(newMap.entries())
                .filter(([id, p]) => id !== message.clientId && p.screenSharing)
                .map(([id]) => id);
              
              if (screenSharers.length > 0) {
                // Pin the first screen sharer (they started first)
                console.log('Auto-pinning remaining screen sharer:', screenSharers[0]);
                setPinnedClientId(screenSharers[0]);
              } else {
                // No one is screen sharing anymore, unpin
                console.log('No one is screen sharing, unpinning');
                setPinnedClientId(null);
              }
            }
            
            return newMap;
          });
        }
        break;

      default:
        console.warn('Unhandled WebSocket message type:', message.type, message);
        break;
    }
  }, [clientId, createOffer, handleOffer, handleAnswer, handleRemoteIceCandidate, removePeer, hasPeerConnection, isInitialized, localStream, chatOpen, isScreenSharing, startScreenShare, stopScreenShare, participants, pinnedClientId]);

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

  // Send display name when WebSocket connects
  useEffect(() => {
    if (isConnected && sendMessageRef.current && displayName) {
      console.log('Sending JOIN message with displayName:', displayName);
      sendMessageRef.current({
        type: WSMessageType.JOIN,
        displayName: displayName,
      });
    }
  }, [isConnected, displayName]);

  // Update local participant info
  useEffect(() => {
    setParticipants((prev) => {
      const newMap = new Map(prev);
      newMap.set(clientId, {
        displayName,
        audioEnabled,
        videoEnabled,
        screenSharing: isScreenSharing,
      });
      return newMap;
    });
  }, [clientId, displayName, audioEnabled, videoEnabled, isScreenSharing]);

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

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      await stopScreenShare();
      if (sendMessageRef.current) {
        sendMessageRef.current({
          type: WSMessageType.SCREEN_SHARE_STOP,
        });
      }
      
      // If we were pinned and stopped sharing, unpin if no one else is sharing
      setPinnedClientId((currentPinned) => {
        if (currentPinned === clientId) {
          // Check if anyone else is screen sharing
          const otherScreenSharers = Array.from(participants.entries())
            .filter(([id, p]) => id !== clientId && p.screenSharing)
            .map(([id]) => id);
          
          if (otherScreenSharers.length > 0) {
            // Pin the first other screen sharer
            return otherScreenSharers[0];
          } else {
            // No one is screen sharing, unpin
            return null;
          }
        }
        return currentPinned;
      });
    } else {
      // Start screen sharing
      const success = await startScreenShare();
      if (success && sendMessageRef.current) {
        sendMessageRef.current({
          type: WSMessageType.SCREEN_SHARE_START,
        });
        
        // Auto-pin ourselves when we start screen sharing
        // Only if no one else is currently screen sharing and pinned
        setPinnedClientId((currentPinned) => {
          if (!currentPinned) {
            // No one is pinned, pin ourselves
            console.log('Auto-pinning self (starting screen share)');
            return clientId;
          } else {
            // Check if currently pinned person is screen sharing
            const pinnedParticipant = participants.get(currentPinned);
            if (!pinnedParticipant?.screenSharing) {
              // Currently pinned person is not screen sharing, pin ourselves
              console.log('Auto-pinning self (previous pinned person not sharing)');
              return clientId;
            }
            // First screen sharer is still sharing, keep them pinned
            return currentPinned;
          }
        });
        
        // Listen for when user stops sharing via browser UI
        if (localStream) {
          const videoTrack = localStream.getVideoTracks()[0];
          if (videoTrack && videoTrack.label === 'screen') {
            videoTrack.onended = async () => {
              await stopScreenShare();
              if (sendMessageRef.current) {
                sendMessageRef.current({
                  type: WSMessageType.SCREEN_SHARE_STOP,
                });
              }
              
              // Handle unpinning when screen share ends via browser UI
              setPinnedClientId((currentPinned) => {
                if (currentPinned === clientId) {
                  const otherScreenSharers = Array.from(participants.entries())
                    .filter(([id, p]) => id !== clientId && p.screenSharing)
                    .map(([id]) => id);
                  
                  if (otherScreenSharers.length > 0) {
                    return otherScreenSharers[0];
                  } else {
                    return null;
                  }
                }
                return currentPinned;
              });
            };
          }
        }
      } else if (!success) {
        alert('Failed to start screen sharing. Please check your browser permissions.');
      }
    }
  };

  const handlePin = (clientIdToPin: string | null) => {
    console.log('handlePin called:', { clientIdToPin, currentPinned: pinnedClientId });
    if (clientIdToPin === null) {
      // Always unpin when null is passed
      console.log('Unpinning');
      setPinnedClientId(null);
    } else if (pinnedClientId === clientIdToPin) {
      // Unpin if clicking the same person
      console.log('Unpinning:', clientIdToPin);
      setPinnedClientId(null);
    } else {
      // Pin the selected person
      console.log('Pinning:', clientIdToPin);
      setPinnedClientId(clientIdToPin);
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

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't trigger if modifier keys are pressed (to avoid browser shortcuts)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      switch (key) {
        case 'm':
          // Toggle mute
          event.preventDefault();
          handleToggleAudio();
          break;

        case 'v':
          // Toggle video
          event.preventDefault();
          handleToggleVideo();
          break;

        case 'c':
          // Toggle chat
          event.preventDefault();
          setChatOpen((prev) => {
            const newState = !prev;
            if (newState) {
              setParticipantsOpen(false);
              setHasUnreadMessages(false);
            }
            return newState;
          });
          break;

        case 'p':
          // Toggle participants
          event.preventDefault();
          setParticipantsOpen((prev) => {
            const newState = !prev;
            if (newState) {
              setChatOpen(false);
            }
            return newState;
          });
          break;

        case 's':
          // Toggle screen share
          event.preventDefault();
          handleScreenShare();
          break;

        case 'escape':
        case 'esc':
          // Close panels or leave meeting
          event.preventDefault();
          if (chatOpen || participantsOpen || shortcutsOpen || leaveModalOpen) {
            setChatOpen(false);
            setParticipantsOpen(false);
            setShortcutsOpen(false);
            setLeaveModalOpen(false);
          } else {
            // Show leave meeting modal
            setLeaveModalOpen(true);
          }
          break;

        case '?':
          // Show keyboard shortcuts help
          event.preventDefault();
          setShortcutsOpen((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [chatOpen, participantsOpen, handleToggleAudio, handleToggleVideo, handleScreenShare, handleLeave]);

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
          <button
            onClick={() => setShortcutsOpen(true)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <HelpCircle className="w-5 h-5 text-gray-400 hover:text-primary-400 transition-colors" />
          </button>
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
            pinnedClientId={pinnedClientId}
            onPin={handlePin}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Initializing camera...</p>
            </div>
          </div>
        )}

        {/* Participants Panel */}
        <ParticipantsList
          isOpen={participantsOpen}
          onClose={() => setParticipantsOpen(false)}
          participants={participants}
          localClientId={clientId}
          pinnedClientId={pinnedClientId}
          onPin={handlePin}
          totalParticipants={1 + remoteStreams.size}
        />

        {/* Chat Panel */}
        <ChatPanel
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          messages={chatMessages}
          onSendMessage={handleSendChatMessage}
          displayName={displayName}
        />

        {/* Keyboard Shortcuts Help */}
        <KeyboardShortcutsHelp
          isOpen={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />

        {/* Leave Meeting Modal */}
        <LeaveMeetingModal
          isOpen={leaveModalOpen}
          onClose={() => setLeaveModalOpen(false)}
          onConfirm={() => {
            setLeaveModalOpen(false);
            handleLeave();
          }}
        />
      </div>

      {/* Controls */}
      <MeetingControls
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onScreenShare={handleScreenShare}
        isScreenSharing={isScreenSharing}
        onLeave={handleLeave}
        onToggleChat={() => {
          const newChatState = !chatOpen;
          setChatOpen(newChatState);
          // Close participants panel when opening chat
          if (newChatState) {
            setParticipantsOpen(false);
            setHasUnreadMessages(false);
          }
        }}
        chatOpen={chatOpen}
        hasUnreadMessages={hasUnreadMessages}
        onToggleParticipants={() => {
          const newParticipantsState = !participantsOpen;
          setParticipantsOpen(newParticipantsState);
          // Close chat panel when opening participants
          if (newParticipantsState) {
            setChatOpen(false);
          }
        }}
        participantsOpen={participantsOpen}
      />
    </div>
  );
}

