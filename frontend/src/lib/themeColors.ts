import type { ColorTheme } from '../stores/themeStore';

/**
 * Theme-aware color utilities.
 * All price-direction colors should go through here so the
 * green-red / red-green setting is applied globally.
 */

export function upColor(theme: ColorTheme): string {
  return theme === 'green-red' ? 'text-green-400' : 'text-red-400';
}

export function downColor(theme: ColorTheme): string {
  return theme === 'green-red' ? 'text-red-400' : 'text-green-400';
}

export function upBgColor(theme: ColorTheme): string {
  return theme === 'green-red' ? 'bg-green-500/10' : 'bg-red-500/10';
}

export function downBgColor(theme: ColorTheme): string {
  return theme === 'green-red' ? 'bg-red-500/10' : 'bg-green-500/10';
}

export function upBorderColor(theme: ColorTheme): string {
  return theme === 'green-red' ? 'border-green-500/30' : 'border-red-500/30';
}

export function downBorderColor(theme: ColorTheme): string {
  return theme === 'green-red' ? 'border-red-500/30' : 'border-green-500/30';
}

export function flashColor(theme: ColorTheme, direction: 'up' | 'down'): string {
  return direction === 'up'
    ? (theme === 'green-red' ? 'rgba(74, 222, 128, 0.35)' : 'rgba(248, 113, 113, 0.35)')
    : (theme === 'green-red' ? 'rgba(248, 113, 113, 0.35)' : 'rgba(74, 222, 128, 0.35)');
}