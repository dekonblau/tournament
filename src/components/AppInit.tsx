import { useEffect } from 'react';
import { useManager } from '../store/managerContext';

/**
 * Invisible component — mounts once inside ManagerProvider and triggers
 * the initial fetch from the server so db snapshot is populated from SQLite.
 */
export function AppInit() {
  const { refresh } = useManager();
  useEffect(() => {
    refresh().catch(() => {
      // Server might not be up yet; ServerStatus banner will show the error
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
