import { flashColor } from './themeColors';

export { flashColor };

export function applyBackgroundFlash(el: HTMLElement, color: string): () => void {
  el.style.backgroundColor = color;
  const raf = requestAnimationFrame(() => {
    el.style.transition = 'background-color 0.6s ease-out';
    el.style.backgroundColor = 'transparent';
    window.setTimeout(() => {
      el.style.transition = '';
    }, 600);
  });
  return () => cancelAnimationFrame(raf);
}
