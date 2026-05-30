import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useStore';
import { RefreshCwIcon, WifiOffIcon } from 'lucide-react';

const MAX_RETRIES = 6;

export const NetworkStatus = observer(function NetworkStatus() {
  const { connectionStore } = useStore();
  const state = connectionStore.connectionState;
  const retryCount = connectionStore.retryCount;

  // Show nothing when connected
  if (state === 'connected') return null;

  // Retry failed panel — replace main content
  if (state === 'failed') {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="text-center max-w-sm">
          <WifiOffIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <div className="text-xl font-semibold text-zinc-100 mb-2">Connection Failed</div>
          <div className="text-sm text-zinc-500 mb-6">
            Unable to reach the backend after multiple attempts. Check your network or restart the backend server.
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-sm transition-colors border border-zinc-700"
            >
              <RefreshCwIcon className="w-4 h-4" />
              Reload Page
            </button>
            <button
              onClick={() => {
                retryCount === MAX_RETRIES; // reset trigger
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm transition-colors border border-red-800"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reconnecting banner
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-yellow-900/30 border-b border-yellow-800 text-sm">
      <RefreshCwIcon className="w-4 h-4 text-yellow-400 animate-spin" />
      <span className="text-yellow-200">
        {state === 'disconnected'
          ? 'Disconnected — attempting to reconnect…'
          : state === 'stale'
          ? 'Data may be outdated — reconnecting…'
          : 'Reconnecting…'}
      </span>
      <span className="text-yellow-500 ml-auto font-mono">
        attempt {Math.min(retryCount, MAX_RETRIES)}/{MAX_RETRIES}
      </span>
    </div>
  );
});
