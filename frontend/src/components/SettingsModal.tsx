import { observer } from 'mobx-react-lite';
import { XIcon } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { wsClient } from '../ws/client';
import { ToggleSwitch } from './ToggleSwitch';

export const SettingsModal = observer(function SettingsModal() {
  const { settingsStore, themeStore } = useStore();

  if (!settingsStore.settingsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => settingsStore.closeSettings()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
          <button
            type="button"
            onClick={() => settingsStore.closeSettings()}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close settings"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-zinc-100">Price Colors</div>
              <div className="mt-0.5 text-xs text-zinc-500">Choose color direction</div>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 p-1">
              <button
                type="button"
                onClick={() => themeStore.setGreenUp()}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  themeStore.colorTheme === 'green-red'
                    ? 'bg-green-500/20 text-green-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>▲</span>
                <span>Green</span>
              </button>
              <button
                type="button"
                onClick={() => themeStore.setRedUp()}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  themeStore.colorTheme === 'red-green'
                    ? 'bg-red-500/20 text-red-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>▲</span>
                <span>Red</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-zinc-100">Mock Data</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                Use simulated market data (default: real Hyperliquid data)
              </div>
            </div>
            <ToggleSwitch
              checked={settingsStore.mockDataEnabled}
              onChange={(checked) => {
                settingsStore.setMockDataEnabled(checked, (mode) => {
                  wsClient.sendFeedMode(mode);
                });
              }}
            />
          </div>
        </div>

        <div className="border-t border-zinc-800 p-5">
          <button
            type="button"
            onClick={() => settingsStore.closeSettings()}
            className="w-full rounded-xl bg-blue-500 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
});
