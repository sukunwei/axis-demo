import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useStore';

const THEMES = {
  'green-red': { up: 'text-green-400', down: 'text-red-400', label: 'G' },
  'red-green': { up: 'text-red-400', down: 'text-green-400', label: 'R' },
} as const;

export const ThemeToggle = observer(function ThemeToggle() {
  const { themeStore } = useStore();
  const theme = THEMES[themeStore.colorTheme];

  return (
    <button
      onClick={() => themeStore.toggle()}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700"
      title={`Color mode (${theme.label === 'G' ? 'green-up red-down' : 'red-up green-down'})`}
    >
      <span className="text-green-400">↑</span>
      <span className="text-red-400">↓</span>
      <span className="text-zinc-400 ml-1">{theme.label}</span>
    </button>
  );
});
