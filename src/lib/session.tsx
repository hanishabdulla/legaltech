import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const CLIENT_KEY = 'cc.clientToken';
const STAFF_KEY = 'cc.staffToken';

/**
 * Two independent demo sessions on one device: an anonymous client and an
 * adviser. Both are random secrets issued by Convex; only their hashes are stored there.
 */
type Session = {
  ready: boolean;
  clientToken: string | null;
  staffToken: string | null;
  setClientToken: (t: string | null) => Promise<void>;
  setStaffToken: (t: string | null) => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

async function persist(key: string, value: string | null) {
  try {
    if (value) await AsyncStorage.setItem(key, value);
    else await AsyncStorage.removeItem(key);
  } catch {
    // Storage can be unavailable (private browsing). The session just won't survive a reload.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [clientToken, setClient] = useState<string | null>(null);
  const [staffToken, setStaff] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(CLIENT_KEY), AsyncStorage.getItem(STAFF_KEY)])
      .then(([c, s]) => {
        setClient(c);
        setStaff(s);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setClientToken = useCallback(async (t: string | null) => {
    setClient(t);
    await persist(CLIENT_KEY, t);
  }, []);
  const setStaffToken = useCallback(async (t: string | null) => {
    setStaff(t);
    await persist(STAFF_KEY, t);
  }, []);

  return (
    <SessionContext.Provider value={{ ready, clientToken, staffToken, setClientToken, setStaffToken }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
