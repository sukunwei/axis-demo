import type { ConnectionState } from '../types/market';

interface ConnectionIndicatorProps {
  state: ConnectionState;
}

export function ConnectionIndicator({ state }: ConnectionIndicatorProps) {
  const stateConfig = {
    connected: {
      color: 'bg-green-500',
      text: 'Connected',
      pulse: false
    },
    reconnecting: {
      color: 'bg-yellow-500',
      text: 'Reconnecting...',
      pulse: true
    },
    disconnected: {
      color: 'bg-red-500',
      text: 'Disconnected',
      pulse: false
    },
    stale: {
      color: 'bg-orange-500',
      text: 'Stale Data',
      pulse: true
    }
  };

  const config = stateConfig[state];

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full border border-gray-300">
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.pulse && (
          <div className={`absolute inset-0 w-2 h-2 rounded-full ${config.color} animate-ping opacity-75`} />
        )}
      </div>
      <span className="text-xs text-gray-700">{config.text}</span>
    </div>
  );
}
