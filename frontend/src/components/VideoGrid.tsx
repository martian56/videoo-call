import { useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: Map<string, { displayName?: string; audioEnabled?: boolean; videoEnabled?: boolean }>;
  localClientId: string;
}

export default function VideoGrid({
  localStream,
  remoteStreams,
  participants,
  localClientId,
}: VideoGridProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    remoteStreams.forEach((stream, clientId) => {
      const videoRef = remoteVideoRefs.current.get(clientId);
      if (videoRef && stream) {
        videoRef.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  const totalParticipants = 1 + remoteStreams.size;
  const gridClass = `video-grid video-grid-${Math.min(totalParticipants, 10)}`;

  const getParticipantInfo = (clientId: string) => {
    return participants.get(clientId) || {};
  };

  return (
    <div className={`${gridClass} h-full w-full`}>
      {/* Local Video */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden group min-h-0 flex items-center justify-center">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
          <span className="text-sm font-medium text-white">
            {getParticipantInfo(localClientId).displayName || 'You'}
          </span>
          {localStream?.getAudioTracks()[0]?.enabled ? (
            <Mic className="w-4 h-4 text-green-400" />
          ) : (
            <MicOff className="w-4 h-4 text-red-400" />
          )}
          {localStream?.getVideoTracks()[0]?.enabled ? (
            <Video className="w-4 h-4 text-green-400" />
          ) : (
            <VideoOff className="w-4 h-4 text-red-400" />
          )}
        </div>
      </div>

      {/* Remote Videos */}
      {Array.from(remoteStreams.entries()).map(([clientId, stream]) => {
        const participant = getParticipantInfo(clientId);
        return (
          <div key={clientId} className="relative bg-gray-900 rounded-lg overflow-hidden group min-h-0 flex items-center justify-center">
            <video
              ref={(el) => {
                if (el) remoteVideoRefs.current.set(clientId, el);
              }}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <span className="text-sm font-medium text-white">
                {participant.displayName || clientId}
              </span>
              {participant.audioEnabled !== false ? (
                <Mic className="w-4 h-4 text-green-400" />
              ) : (
                <MicOff className="w-4 h-4 text-red-400" />
              )}
              {participant.videoEnabled !== false ? (
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


