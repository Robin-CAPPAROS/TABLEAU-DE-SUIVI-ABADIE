import { supabase } from '@/lib/supabase';
import { intervenant } from '@/data/filtres';
import { lireTout } from '@/data/pagination';
import type { ISODate } from '@domain/types';
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
    let q = supabase.from('v_exercices').select('*').neq('dossier_statut', 'sorti')
      .order('date_cible').order('raison_sociale').order('id');
    if (f.equipe !== undefined) q = q.eq('equipe', f.equipe);
    if (f.managerId) q = q.eq('manager_id', f.managerId);
    if (f.seniorId) q = q.eq('senior_id', f.seniorId);
    if (f.collaborateurId) q = q.or(intervenant(f.collaborateurId));
    if (f.mesDossiers) q = q.or(intervenant(moiId));
    return q.range(de, a) as unknown as PromiseLike<{ data: LigneExercice[] | null; error: { message: string } | null }>;
  });
}

export async function validerEtape(id: string, etape: number, commentaire?: string): Promise<void> {
  const { error } = await supabase.rpc('valider_etape', { p_exercice: id, p_etape: etape, p_commentaire: commentaire ?? null });
  if (error) throw error;
}

export async function revenirEtape(id: string, etape: number, commentaire: string): Promise<void> {
  const { error } = await supabase.rpc('revenir_etape', { p_exercice: id, p_etape: etape, p_commentaire: commentaire });
  if (error) throw error;
}

/** Modifie la date cible ; la date d'approbation actuelle est conservée (maj_exercice la remplace sinon). */
export async function majDateCible(id: string, date: ISODate, dateApprobation: ISODate | null): Promise<void> {
  const { error } = await supabase.rpc('maj_exercice', { p_exercice: id, p_date_cible: date, p_date_approbation: dateApprobation });
  if (error) throw error;
}

export type LignePlan = { semaine: ISODate; senior_id: string | null; a_faire: number; supervises: number };

/**
 * Pas de pagination : la fonction renvoie un résultat déjà groupé par semaine et par Senior
 * (au plus 26 semaines x quelques Seniors), très en deçà du plafond de 1000 lignes de PostgREST.
 */
export async function planDeCharge(debut: ISODate, semaines: number, f: FiltresExercices): Promise<LignePlan[]> {
  const { data, error } = await supabase.rpc('plan_de_charge', {
    p_debut: debut,
    p_semaines: semaines,
    p_equipe: f.equipe ?? null,
    p_manager: f.managerId ?? null,
    p_senior: f.seniorId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as LignePlan[];
}
