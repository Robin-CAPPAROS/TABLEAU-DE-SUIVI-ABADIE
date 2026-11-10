import { supabase } from '@/lib/supabase';
import { lireTout } from '@/data/pagination';
import type { Anomalie } from '@/data/types';

/** Horodatage (ISO) de la dernière synchronisation Pennylane terminée, ou null. */
export async function derniereSynchro(): Promise<string | null> {
  const { data, error } = await supabase.rpc('derniere_synchro');
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Anomalies de synchronisation non résolues (visibles des managers seulement via la RLS). */
export function listerAnomaliesOuvertes(): Promise<Anomalie[]> {
  return lireTout<Anomalie>(
    (de, a) =>
      supabase
        .from('anomalies')
        .select('id, type, dossier_id, message, cree_le')
        .is('resolue_le', null)
        .order('cree_le', { ascending: false })
        .order('id')
        .range(de, a) as unknown as PromiseLike<{ data: Anomalie[] | null; error: { message: string } | null }>,
  );
}
