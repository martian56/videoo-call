import { useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, Pin, PinOff } from 'lucide-react';

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: Map<string, { displayName?: string; audioEnabled?: boolean; videoEnabled?: boolean; screenSharing?: boolean }>;
  localClientId: string;
  pinnedClientId: string | null;
  onPin: (clientId: string | null) => void;
}

export default function VideoGrid({
  localStream,
  remoteStreams,
  participants,
  localClientId,
  pinnedClientId,
  onPin,
}: VideoGridProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRefs = useRef<Set<HTMLVideoElement>>(new Set());
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Update all local video streams
  useEffect(() => {
    if (localStream) {
      // Update the main ref
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
      // Update all tracked local video elements
      localVideoRefs.current.forEach((videoEl) => {
        if (videoEl && videoEl.srcObject !== localStream) {
          videoEl.srcObject = localStream;
        }
      });
    }
  }, [localStream]);

  useEffect(() => {
    const cleanupFunctions: (() => void)[] = [];
    
    remoteStreams.forEach((stream, clientId) => {
      const videoRef = remoteVideoRefs.current.get(clientId);
      if (videoRef && stream) {
        // Force update by clearing and resetting
        if (videoRef.srcObject !== stream) {
          videoRef.srcObject = null;
          videoRef.srcObject = stream;
        } else {
          // Even if it's the same stream, the tracks might have changed
          // Force a reload by temporarily clearing
          videoRef.srcObject = null;
          setTimeout(() => {
            if (videoRef) {
              videoRef.srcObject = stream;
            }
          }, 0);
        }
        
        // Listen for track changes
        const handleTrackChange = () => {
          if (videoRef && videoRef.srcObject !== stream) {
            videoRef.srcObject = stream;
          }
        };
        
        stream.getTracks().forEach(track => {
          track.addEventListener('ended', handleTrackChange);
          track.addEventListener('mute', handleTrackChange);
          track.addEventListener('unmute', handleTrackChange);
        });
        
        cleanupFunctions.push(() => {
          stream.getTracks().forEach(track => {
            track.removeEventListener('ended', handleTrackChange);
            track.removeEventListener('mute', handleTrackChange);
            track.removeEventListener('unmute', handleTrackChange);
          });
        });
      } else if (!videoRef && stream) {
        // Stream arrived but video element doesn't exist yet
        // The ref will be set when the component renders
        console.log('Stream arrived for', clientId, 'but video ref not ready yet');
      }
    });
    
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [remoteStreams]);

  const getParticipantInfo = (clientId: string) => {
    return participants.get(clientId) || {};
  };

  // Find pinned video - get stream directly from remoteStreams for consistency
  const pinnedVideo = pinnedClientId 
    ? (() => {
        // If it's the local client, create the object
        if (pinnedClientId === localClientId) {
          return { clientId: localClientId, isLocal: true, stream: localStream };
        }
        
        // For remote participants, ALWAYS get the current stream from remoteStreams
        const remoteStream = remoteStreams.get(pinnedClientId);
        return { clientId: pinnedClientId, isLocal: false, stream: remoteStream || null };
      })()
    : null;

  // If someone is pinned, show them in full screen
  if (pinnedVideo && pinnedClientId) {
    const participant = getParticipantInfo(pinnedVideo.clientId);
    const displayName = participant?.displayName || (pinnedVideo.isLocal ? 'You' : pinnedVideo.clientId.substring(0, 8));

    return (
      <div className="h-full w-full p-2">
        {/* Pinned Video - Full Screen */}
        <div className="h-full w-full relative bg-gray-900 rounded-lg overflow-hidden">
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 text-sm rounded-lg z-50 flex items-center gap-2">
            <Pin className="w-4 h-4 text-primary-400 fill-primary-400" />
            <span>{displayName}</span>
          </div>
          {pinnedVideo.isLocal ? (
            <video
              key={`pinned-local-${localStream?.id || 'no-stream'}`}
              ref={(el) => {
                if (el) {
                  localVideoRef.current = el;
                  localVideoRefs.current.add(el);
                  // Set stream immediately
                  if (localStream && el.srcObject !== localStream) {
                    el.srcObject = localStream;
                  }
                } else {
                  // Element unmounted - clear main ref if it was this element
                  if (localVideoRef.current === el) {
                    localVideoRef.current = null;
                  }
                }
              }}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <>
              <video
                key={`pinned-${pinnedVideo.clientId}`}
                ref={(el) => {
                  if (el) {
                    remoteVideoRefs.current.set(pinnedVideo.clientId, el);
                    // Get the most up-to-date stream from remoteStreams
                    const stream = remoteStreams.get(pinnedVideo.clientId);
                    if (stream) {
                      console.log('Setting stream for pinned video:', pinnedVideo.clientId, 'stream ID:', stream.id, 'tracks:', stream.getTracks().length);
                      el.srcObject = stream;
                    } else {
                      console.log('No stream available for pinned video:', pinnedVideo.clientId);
                    }
                  } else {
                    remoteVideoRefs.current.delete(pinnedVideo.clientId);
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-cover bg-gray-800"
              />
              {!remoteStreams.get(pinnedVideo.clientId) && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Waiting for video...</p>
                    <p className="text-xs text-gray-500 mt-2">Client: {pinnedVideo.clientId.substring(0, 8)}</p>
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* Pin button - top right */}
          <button
            onClick={() => onPin(null)}
            className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg transition-colors z-10"
            title="Unpin"
          >
            <Pin className="w-5 h-5 text-primary-400 fill-primary-400" />
          </button>

          {/* Participant info - bottom left */}
          <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            <span className="text-sm font-medium text-white">
              {displayName}
            </span>
            {pinnedVideo.isLocal ? (
              <>
                {localStream?.getAudioTracks()[0]?.enabled ? (
                  <Mic className="w-4 h-4 text-green-400" />
                ) : (
                  <MicOff className="w-4 h-4 text-red-400" />
                )}
                {participant.screenSharing ? (
                  <div title="Sharing screen">
                    <Monitor className="w-4 h-4 text-primary-400" />
                  </div>
                ) : localStream?.getVideoTracks()[0]?.enabled ? (
                  <Video className="w-4 h-4 text-green-400" />
                ) : (
                  <VideoOff className="w-4 h-4 text-red-400" />
                )}
              </>
            ) : (
              <>
                {participant.audioEnabled !== false ? (
                  <Mic className="w-4 h-4 text-green-400" />
                ) : (
                  <MicOff className="w-4 h-4 text-red-400" />
                )}
                {participant.screenSharing ? (
                  <div title="Sharing screen">
                    <Monitor className="w-4 h-4 text-primary-400" />
                  </div>
                ) : participant.videoEnabled !== false ? (
                  <Video className="w-4 h-4 text-green-400" />
                ) : (
                  <VideoOff className="w-4 h-4 text-red-400" />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No one is pinned - show normal grid
  const totalParticipants = 1 + remoteStreams.size;
  const gridClass = `video-grid video-grid-${Math.min(totalParticipants, 10)}`;

  return (
    <div className={`${gridClass} h-full w-full`}>
      {/* Local Video */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden group min-h-0 flex items-center justify-center">
        <video
          key={`normal-local-${localStream?.id || 'no-stream'}`}
          ref={(el) => {
            if (el) {
              localVideoRef.current = el;
              localVideoRefs.current.add(el);
              // Set stream immediately
              if (localStream && el.srcObject !== localStream) {
                el.srcObject = localStream;
              }
            } else {
              // Element unmounted - clear main ref if it was this element
              if (localVideoRef.current === el) {
                localVideoRef.current = null;
              }
            }
          }}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover scale-x-[-1]"
        />
        
        {/* Pin button */}
        <button
          onClick={() => onPin(pinnedClientId === localClientId ? null : localClientId)}
          className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg transition-colors z-10 opacity-0 group-hover:opacity-100"
          title={pinnedClientId === localClientId ? 'Unpin' : 'Pin'}
        >
          {pinnedClientId === localClientId ? (
            <Pin className="w-5 h-5 text-primary-400 fill-primary-400" />
          ) : (
            <PinOff className="w-5 h-5 text-white" />
          )}
        </button>

        <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
          <span className="text-sm font-medium text-white">
            {getParticipantInfo(localClientId).displayName || 'You'}
          </span>
          {localStream?.getAudioTracks()[0]?.enabled ? (
            <Mic className="w-4 h-4 text-green-400" />
          ) : (
            <MicOff className="w-4 h-4 text-red-400" />
          )}
          {getParticipantInfo(localClientId).screenSharing ? (
            <div title="Sharing screen">
              <Monitor className="w-4 h-4 text-primary-400" />
            </div>
          ) : localStream?.getVideoTracks()[0]?.enabled ? (
            <Video className="w-4 h-4 text-green-400" />
          ) : (
            <VideoOff className="w-4 h-4 text-red-400" />
          )}
        </div>
      </div>

      {/* Remote Videos */}
      {Array.from(remoteStreams.entries()).map(([clientId, stream]) => {
        const participant = getParticipantInfo(clientId);
        const displayName = participant?.displayName || clientId.substring(0, 8);
        const isPinned = pinnedClientId === clientId;

        return (
          <div key={`${clientId}-${displayName}`} className="relative bg-gray-900 rounded-lg overflow-hidden group min-h-0 flex items-center justify-center">
            <video
              key={`normal-${clientId}-${stream.id}`}
              ref={(el) => {
                if (el) {
                  remoteVideoRefs.current.set(clientId, el);
                  // Set stream immediately when element is created
                  if (stream && el.srcObject !== stream) {
                    console.log('Setting stream for normal grid video:', clientId);
                    el.srcObject = stream;
                  }
                }
              }}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Pin button */}
            <button
              onClick={() => onPin(isPinned ? null : clientId)}
              className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg transition-colors z-10 opacity-0 group-hover:opacity-100"
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              {isPinned ? (
                <Pin className="w-5 h-5 text-primary-400 fill-primary-400" />
              ) : (
                <PinOff className="w-5 h-5 text-white" />
              )}
            </button>

            <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <span className="text-sm font-medium text-white">
                {displayName}
              </span>
              {participant.audioEnabled !== false ? (
                <Mic className="w-4 h-4 text-green-400" />
              ) : (
                <MicOff className="w-4 h-4 text-red-400" />
              )}
              {participant.screenSharing ? (
                <div title="Sharing screen">
                  <Monitor className="w-4 h-4 text-primary-400" />
                </div>
              ) : participant.videoEnabled !== false ? (
                <Video className="w-4 h-4 text-green-400" />
              ) : (
                <VideoOff className="w-4 h-4 text-red-400" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


