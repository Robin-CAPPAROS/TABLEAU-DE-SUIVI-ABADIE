import { supabase } from '@/lib/supabase';

/** Horodatage (ISO) de la dernière synchronisation Pennylane terminée, ou null. */
export async function derniereSynchro(): Promise<string | null> {
  const { data, error } = await supabase.rpc('derniere_synchro');
  if (error) throw error;
  return (data as string | null) ?? null;
}
