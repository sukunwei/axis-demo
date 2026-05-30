import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useStore';

export const NewsTab = observer(function NewsTab() {
  const { newsStore } = useStore();

  useEffect(() => {
    newsStore.load();
  }, [newsStore]);

  if (newsStore.loading && newsStore.items.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
        Loading...
      </div>
    );
  }

  if (newsStore.error && newsStore.items.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-red-400 text-sm">
        {newsStore.error}
      </div>
    );
  }

  if (newsStore.items.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
        No news available
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto pr-1">
      {newsStore.items.map((item) => (
        <a
          key={item.id}
          href={item.url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-5 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-amber-600/50 hover:shadow-lg hover:shadow-amber-900/10 transition-all"
        >
          <div className="text-sm font-medium text-zinc-200 mb-1 leading-snug">{item.title}</div>
          {item.summary && item.summary !== item.title && (
            <div className="text-xs text-zinc-400 line-clamp-2 mb-3">{item.summary}</div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-600">{new Date(item.ts).toLocaleDateString()}</span>
            {item.symbols && item.symbols.length > 0 && (
              <div className="flex items-center gap-1.5">
                {item.symbols.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 bg-blue-900/40 text-blue-300 border border-blue-700/40 rounded-full font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            {item.tags && item.tags.length > 0 && (
              <div className="flex items-center gap-1.5">
                {item.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 bg-amber-900/30 text-amber-400/80 border border-amber-600/30 rounded-full"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </a>
      ))}
    </div>
  );
});
