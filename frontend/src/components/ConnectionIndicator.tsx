import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useStore';
import type { ConnectionState } from '../stores/connectionStore';

const STATE_LABELS: Record<ConnectionState, string> = {
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  stale: 'Stale',
  disconnected: 'Disconnected',
};

const STATE_COLORS: Record<ConnectionState, string> = {
  connected: 'bg-green-500',
  reconnecting: 'bg-yellow-500',
  stale: 'bg-orange-500',
  disconnected: 'bg-red-500',
};

export const ConnectionIndicator = observer(function ConnectionIndicator() {
  const { connectionStore: cs } = useStore();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 text-xs font-medium">
      <span className={`w-2 h-2 rounded-full ${STATE_COLORS[cs.connectionState]}`} />
      <span className="text-zinc-300">{STATE_LABELS[cs.connectionState]}</span>
    </div>
  );
});
