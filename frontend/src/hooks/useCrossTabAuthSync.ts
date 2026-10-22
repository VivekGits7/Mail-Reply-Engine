import { useEffect } from 'react';
import { useAppSelector } from '@/redux/hooks';
import { PERSIST_KEY } from '@/utils/logout';

function readPersistedToken(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const root = JSON.parse(raw) as { auth?: string };
    return root.auth ? ((JSON.parse(root.auth) as { token: string | null }).token ?? null) : null;
  } catch {
    return null;
  }
}

export function useCrossTabAuthSync() {
  const token = useAppSelector((state) => state.auth.token);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== PERSIST_KEY) return;
      if (readPersistedToken(event.newValue) !== token) window.location.reload();
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [token]);
}
