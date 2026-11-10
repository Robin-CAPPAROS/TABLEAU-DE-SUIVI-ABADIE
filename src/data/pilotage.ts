import { supabase } from '@/lib/supabase';
import type { FiltresExercices } from '@/data/exercices';

export type CausesRetard = { cabinet: number; client: number; administration: number; autre: number; non_qualifie: number };

export type BlocIndicateurs = {
  depots_en_retard: { total: number; par_cause: CausesRetard; par_type: Record<string, number> };
  bilans_supervises_avant_cible: { numerateur: number; denominateur: number; pourcentage: number | null };
  marge_liasse: {
    moyenne_jours: number | null;
    repartition: { en_retard: number; moins_7: number; de_7_a_30: number; plus_30: number };
  };
  delai_cloture_supervision: { moyenne_jours: number | null };
};

export type Indicateurs = {
  saison: number;
  global: BlocIndicateurs;
  precedente: BlocIndicateurs | null;
  par_equipe: (BlocIndicateurs & { equipe: number })[];
  par_senior: (BlocIndicateurs & { senior_id: string })[];
};

/** Un seul appel : la fonction renvoie un objet agrégé de taille bornée (pas de pagination nécessaire). */
export async function lireIndicateurs(saison: number, f: FiltresExercices): Promise<Indicateurs> {
  const { data, error } = await supabase.rpc('indicateurs', {
    p_saison: saison,
    p_equipe: f.equipe ?? null,
    p_manager: f.managerId ?? null,
    p_senior: f.seniorId ?? null,
  });
  if (error) throw error;
  return data as Indicateurs;
}
