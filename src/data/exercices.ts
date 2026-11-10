import { supabase } from '@/lib/supabase';
import type { LigneExercice } from '@/data/types';

export type FiltresExercices = {
  collaborateurId?: string;
  equipe?: number;
  managerId?: string;
  seniorId?: string;
  mesDossiers: boolean;
};

const intervenant = (id: string) => `csp_id.eq.${id},senior_id.eq.${id},manager_id.eq.${id}`;

export async function listerExercices(f: FiltresExercices, moiId: string): Promise<LigneExercice[]> {
  let q = supabase.from('v_exercices').select('*').order('date_cible').order('raison_sociale');
  if (f.equipe !== undefined) q = q.eq('equipe', f.equipe);
  if (f.managerId) q = q.eq('manager_id', f.managerId);
  if (f.seniorId) q = q.eq('senior_id', f.seniorId);
  if (f.collaborateurId) q = q.or(intervenant(f.collaborateurId));
  if (f.mesDossiers) q = q.or(intervenant(moiId));
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as LigneExercice[];
}
