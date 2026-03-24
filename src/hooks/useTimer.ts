import { useState, useEffect, useCallback } from 'react';

export function useTimer(initialMinutes: number = 30) {
  const [timeLeft, setTimeLeft] = useState(initialMinutes * 60);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      if (interval) clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft]);

  const start = useCallback(() => setIsActive(true), []);
  const pause = useCallback(() => setIsActive(false), []);
  const reset = useCallback(() => {
    setIsActive(false);
    setTimeLeft(initialMinutes * 60);
  }, [initialMinutes]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isWarning = timeLeft > 0 && timeLeft <= 5 * 60; // Less than 5 minutes
  const isFinished = timeLeft === 0;

  return {
    timeLeft,
    minutes,
    seconds,
    isActive,
    isWarning,
    isFinished,
    start,
    pause,
    reset,
  };
}
