import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'M', description: 'Toggle mute/unmute microphone' },
    { key: 'V', description: 'Toggle video on/off' },
    { key: 'C', description: 'Toggle chat panel' },
    { key: 'P', description: 'Toggle participants panel' },
    { key: 'S', description: 'Toggle screen sharing' },
    { key: 'Esc', description: 'Close panels or leave meeting' },
    { key: '?', description: 'Show keyboard shortcuts' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/20 rounded-lg">
              <Keyboard className="w-6 h-6 text-primary-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-6 space-y-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <span className="text-gray-300 flex-1">{shortcut.description}</span>
              <kbd className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm font-mono text-white shadow-inner min-w-[3rem] text-center">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 bg-gray-800/30">
          <p className="text-sm text-gray-400 text-center">
            Shortcuts are disabled when typing in input fields
          </p>
        </div>
      </div>
    </div>
  );
}

