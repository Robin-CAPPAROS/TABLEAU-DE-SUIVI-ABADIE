import { supabase } from '@/lib/supabase';
import { intervenant } from '@/data/filtres';
import { lireTout } from '@/data/pagination';
import type { LigneExercice } from '@/data/types';

export type FiltresExercices = {
  collaborateurId?: string;
  equipe?: number;
  managerId?: string;
  seniorId?: string;
  mesDossiers: boolean;
};

export function listerExercices(f: FiltresExercices, moiId: string): Promise<LigneExercice[]> {
  return lireTout<LigneExercice>((de, a) => {
    let q = supabase.from('v_exercices').select('*').order('date_cible').order('raison_sociale').order('id');
    if (f.equipe !== undefined) q = q.eq('equipe', f.equipe);
    if (f.managerId) q = q.eq('manager_id', f.managerId);
    if (f.seniorId) q = q.eq('senior_id', f.seniorId);
    if (f.collaborateurId) q = q.or(intervenant(f.collaborateurId));
    if (f.mesDossiers) q = q.or(intervenant(moiId));
    return q.range(de, a) as unknown as PromiseLike<{ data: LigneExercice[] | null; error: { message: string } | null }>;
  });
}
