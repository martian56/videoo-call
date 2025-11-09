import { Mic, MicOff, Video, VideoOff, Monitor, Pin, X, Users } from 'lucide-react';

interface ParticipantData {
  displayName?: string;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  screenSharing?: boolean;
}

interface Participant extends ParticipantData {
  clientId: string;
  isLocal?: boolean;
}

interface ParticipantsListProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Map<string, ParticipantData>;
  localClientId: string;
  pinnedClientId: string | null;
  onPin: (clientId: string | null) => void;
  totalParticipants: number;
}

export default function ParticipantsList({
  isOpen,
  onClose,
  participants,
  localClientId,
  pinnedClientId,
  onPin,
  totalParticipants,
}: ParticipantsListProps) {

  const participantsArray: Participant[] = Array.from(participants.entries()).map(([clientId, data]) => ({
    ...data,
    clientId,
    isLocal: clientId === localClientId,
  }));

  // Sort: local first, then by display name
  participantsArray.sort((a, b) => {
    if (a.isLocal) return -1;
    if (b.isLocal) return 1;
    return (a.displayName || a.clientId).localeCompare(b.displayName || b.clientId);
  });

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-full md:w-96 bg-gray-900 border-l border-gray-700 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-500/20 rounded-lg">
            <Users className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Participants</h2>
            <div className="text-xs text-gray-400">{totalParticipants} {totalParticipants === 1 ? 'person' : 'people'}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-2">
        {participantsArray.map((participant) => {
          const isPinned = pinnedClientId === participant.clientId;
          const displayName = participant.displayName || (participant.isLocal ? 'You' : participant.clientId.substring(0, 8));

          return (
              <div
                key={participant.clientId}
                className="flex items-center gap-3 p-3 hover:bg-gray-800/50 transition-colors border-b border-gray-800/50 last:border-b-0"
              >
                {/* Avatar/Status */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  {participant.isLocal && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900"></div>
                  )}
                </div>

                {/* Name and Status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {displayName}
                    </span>
                    {participant.isLocal && (
                      <span className="text-xs text-gray-400">(You)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {participant.audioEnabled !== false ? (
                      <Mic className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <MicOff className="w-3.5 h-3.5 text-red-400" />
                    )}
                    {participant.screenSharing ? (
                      <Monitor className="w-3.5 h-3.5 text-primary-400" />
                    ) : participant.videoEnabled !== false ? (
                      <Video className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <VideoOff className="w-3.5 h-3.5 text-red-400" />
                    )}
                  </div>
                </div>

                {/* Pin Button */}
                <button
                  onClick={() => onPin(isPinned ? null : participant.clientId)}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                    isPinned
                      ? 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30'
                      : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                  }`}
                  title={isPinned ? 'Unpin' : 'Pin'}
                >
                  <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
                </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

