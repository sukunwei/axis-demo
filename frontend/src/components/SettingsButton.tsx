import { SettingsIcon } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useStore';

export const SettingsButton = observer(function SettingsButton() {
  const { settingsStore } = useStore();

  return (
    <button
      type="button"
      onClick={() => settingsStore.openSettings()}
      className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
      aria-label="Open settings"
      title="Settings"
    >
      <SettingsIcon className="h-5 w-5" />
    </button>
  );
});
