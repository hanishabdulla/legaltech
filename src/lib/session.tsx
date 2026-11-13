import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const CLIENT_KEY = 'cc.clientToken';
const STAFF_KEY = 'cc.staffToken';
const BUSINESS_KEY = 'remedy.businessToken';
const LAWYER_KEY = 'remedy.lawyerToken';
const FIRM_KEY = 'remedy.firmToken';

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
  /** MVP 2 (Remedy): business client, Remedy lawyer and partner-firm user, kept apart so three tabs can demo the loop. */
  businessToken: string | null;
  lawyerToken: string | null;
  firmToken: string | null;
  setBusinessToken: (t: string | null) => Promise<void>;
  setLawyerToken: (t: string | null) => Promise<void>;
  setFirmToken: (t: string | null) => Promise<void>;
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
  const [businessToken, setBusiness] = useState<string | null>(null);
  const [lawyerToken, setLawyer] = useState<string | null>(null);
  const [firmToken, setFirm] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([CLIENT_KEY, STAFF_KEY, BUSINESS_KEY, LAWYER_KEY, FIRM_KEY].map((k) => AsyncStorage.getItem(k)))
      .then(([c, s, b, l, f]) => {
        setClient(c);
        setStaff(s);
        setBusiness(b);
        setLawyer(l);
        setFirm(f);
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
  const setBusinessToken = useCallback(async (t: string | null) => {
    setBusiness(t);
    await persist(BUSINESS_KEY, t);
  }, []);
  const setLawyerToken = useCallback(async (t: string | null) => {
    setLawyer(t);
    await persist(LAWYER_KEY, t);
  }, []);
  const setFirmToken = useCallback(async (t: string | null) => {
    setFirm(t);
    await persist(FIRM_KEY, t);
  }, []);

  return (
    <SessionContext.Provider value={{
        ready,
        clientToken,
        staffToken,
        setClientToken,
        setStaffToken,
        businessToken,
        lawyerToken,
        firmToken,
        setBusinessToken,
        setLawyerToken,
        setFirmToken,
      }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
