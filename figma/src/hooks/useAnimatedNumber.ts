import { useEffect, useRef, useState } from 'react';

interface UseAnimatedNumberOptions {
  duration?: number; // Animation duration in ms
  decimals?: number; // Number of decimal places
}

export function useAnimatedNumber(
  value: number,
  options: UseAnimatedNumberOptions = {}
): { displayValue: number; direction: 'up' | 'down' | 'none' } {
  const { duration = 300, decimals = 2 } = options;
  const [displayValue, setDisplayValue] = useState(value);
  const [direction, setDirection] = useState<'up' | 'down' | 'none'>('none');
  const rafRef = useRef<number>();
  const startTimeRef = useRef<number>();
  const startValueRef = useRef<number>(value);
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    if (value === prevValueRef.current) return;

    const newDirection = value > prevValueRef.current ? 'up' : 'down';
    setDirection(newDirection);

    // Reset direction after flash duration
    const flashTimer = setTimeout(() => {
      setDirection('none');
    }, 300);

    prevValueRef.current = value;
    startValueRef.current = displayValue;
    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth transition
      const eased = 1 - Math.pow(1 - progress, 3); // Cubic ease-out

      const currentValue = startValueRef.current + (value - startValueRef.current) * eased;
      setDisplayValue(Number(currentValue.toFixed(decimals)));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      clearTimeout(flashTimer);
    };
  }, [value, duration, decimals, displayValue]);

  return { displayValue, direction };
}
