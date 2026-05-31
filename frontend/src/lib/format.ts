/**
 * Format a number with given decimal places, then trim trailing zeros.
 * e.g. 0.10000000 → "0.1", 0.12345678 → "0.12345678", 1.00000000 → "1"
 */
export function formatTrimmed(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  // Trim trailing zeros but keep at least one decimal place
  return fixed.replace(/\.?0+$/, '') || '0';
}
