import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Moi } from '@/data/types';

type ContexteSession = {
  session: Session | null;
  chargement: boolean;
  deconnecter: () => Promise<void>;
};

const Contexte = createContext<ContexteSession | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChargement(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const deconnecter = async () => {
    await supabase.auth.signOut();
  };

  return <Contexte.Provider value={{ session, chargement, deconnecter }}>{children}</Contexte.Provider>;
}

export function useSession(): ContexteSession {
  const ctx = useContext(Contexte);
  if (!ctx) throw new Error('useSession doit être utilisé dans SessionProvider');
  return ctx;
}

export function useMoi(): { moi: Moi | null; chargement: boolean } {
  const { session } = useSession();
  const { data, isLoading } = useQuery({
    queryKey: ['moi', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('moi');
      if (error) throw error;
      const ligne = data as (Moi & { id: string | null }) | null;
      if (!ligne || !ligne.id) return null;
      const { id, prenom, nom, trigramme, role, administrateur } = ligne;
      return { id, prenom, nom, trigramme, role, administrateur } as Moi;
    },
  });
  return { moi: data ?? null, chargement: !!session && isLoading };
}
