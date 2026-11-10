import { supabase } from '@/lib/supabase';
import { lireTout } from '@/data/pagination';
import type { LigneEcheance, LigneExercice } from '@/data/types';

export type Dossier = {
  id: string;
  pennylane_id: number;
  raison_sociale: string;
  siren: string | null;
  forme_juridique: string | null;
  regime_tva: string | null;
  categorie_fiscale: string | null;
  regime_fiscal: string | null;
  csp_id: string | null;
  senior_id: string | null;
  manager_id: string | null;
  equipe: number | null;
  mission: 'tenue' | 'revision' | 'micro_bnc' | 'irpp' | null;
  statut: 'actif' | 'sorti';
  jour_echeance_tva: number | null;
  is_n1_superieur_3000: boolean;
  commentaire: string | null;
};

export type EtapeHistorique = {
  id: string;
  exercice_id: string;
  etape: number;
  sens: 'validation' | 'retour';
  date: string;
  auteur_id: string | null;
  commentaire: string | null;
};

export type FicheDossier = { dossier: Dossier; exercices: LigneExercice[]; historique: EtapeHistorique[] };

type Retour<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export async function lireDossier(id: string): Promise<FicheDossier> {
  const { data, error } = await supabase.from('dossiers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Dossier introuvable.');
  const exercices = await lireTout<LigneExercice>(
    (de, a) => supabase.from('v_exercices').select('*').eq('dossier_id', id).order('date_fin').order('id').range(de, a) as unknown as Retour<LigneExercice>,
  );
  const ids = exercices.map((x) => x.id);
  const historique = ids.length
    ? await lireTout<EtapeHistorique>(
        (de, a) => supabase.from('historique_etapes').select('*').in('exercice_id', ids).order('date').order('id').range(de, a) as unknown as Retour<EtapeHistorique>,
      )
    : [];
  return { dossier: data as Dossier, exercices, historique };
}

export function listerEcheancesDossier(id: string): Promise<LigneEcheance[]> {
  return lireTout<LigneEcheance>(
    (de, a) => supabase.from('v_echeances').select('*').eq('dossier_id', id).order('date_limite').order('id').range(de, a) as unknown as Retour<LigneEcheance>,
  );
}

export type ChampsOutil = {
  equipe: number | null;
  mission: Dossier['mission'];
  statut: Dossier['statut'];
  jourTva: number | null;
  isN1: boolean;
  commentaire: string | null;
};

export async function majDossierOutil(id: string, c: ChampsOutil): Promise<void> {
  const { error } = await supabase.rpc('maj_dossier_outil', {
    p_dossier: id,
    p_equipe: c.equipe,
    p_mission: c.mission,
    p_statut: c.statut,
    p_jour_tva: c.jourTva,
    p_is_n1: c.isN1,
    p_commentaire: c.commentaire,
  });
  if (error) throw error;
}

/** Exercice en cours : date de fin la plus proche parmi ceux dont l'étape est inférieure à 6, sinon le plus récent. */
export function exerciceEnCours(exercices: LigneExercice[]): LigneExercice | null {
  const ouverts = exercices.filter((x) => x.etape_actuelle < 6).sort((a, b) => a.date_fin.localeCompare(b.date_fin));
  if (ouverts[0]) return ouverts[0];
  return [...exercices].sort((a, b) => b.date_fin.localeCompare(a.date_fin))[0] ?? null;
}

