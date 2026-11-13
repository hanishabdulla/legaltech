import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Id } from '@convex/_generated/dataModel';

const KEY = 'common-counsel.userId';

type Session = {
  ready: boolean;
  userId: Id<'users'> | null;
  setUser: (id: Id<'users'>) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<Id<'users'> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((id) => setUserId(id as Id<'users'> | null))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setUser = useCallback(async (id: Id<'users'>) => {
    setUserId(id);
    await AsyncStorage.setItem(KEY, id).catch(() => {});
  }, []);

  const signOut = useCallback(async () => {
    setUserId(null);
    await AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  return (
    <SessionContext.Provider value={{ ready, userId, setUser, signOut }}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** For screens behind sign-in: the layout guarantees a user. */
export function useUserId() {
  const { userId } = useSession();
  if (!userId) throw new Error('Not signed in');
  return userId;
}
