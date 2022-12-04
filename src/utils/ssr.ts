import { useEffect, useState } from 'react';

// Is the component server-side rendering or not
export function useIsSsr() {
  const [isSsr, setIsSsr] = useState(true);
  useEffect(() => {
    setIsSsr(false);
  }, []);
  return isSsr;
}
