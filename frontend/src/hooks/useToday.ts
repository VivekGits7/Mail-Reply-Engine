import { useState } from 'react';

export function useNow(): Date {
  const [now] = useState(() => new Date());
  return now;
}

export function useToday(): Date {
  const [today] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });
  return today;
}
