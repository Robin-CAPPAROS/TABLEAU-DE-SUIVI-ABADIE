import type { ISODate, StatutEcheance, TypeEcheance } from '@domain/types';
import { supabase } from '@/lib/supabase';
import type { CauseRetard, CollaborateurRef, LigneEcheance } from '@/data/types';

export type FiltresEcheances = {
  types?: TypeEcheance[];
  statuts?: StatutEcheance[];
  collaborateurId?: string;
  equipe?: number;
  du?: ISODate;
  au?: ISODate;
  mesDossiers: boolean;
};

const intervenant = (id: string) => `csp_id.eq.${id},senior_id.eq.${id},manager_id.eq.${id}`;

export async function listerEcheances(f: FiltresEcheances, moiId?: string): Promise<LigneEcheance[]> {
  let q = supabase.from('v_echeances').select('*').order('date_limite').order('raison_sociale');
  if (f.types?.length) q = q.in('type', f.types);
  if (f.statuts?.length) q = q.in('statut', f.statuts);
  if (f.equipe !== undefined) q = q.eq('equipe', f.equipe);
  if (f.du) q = q.gte('date_limite', f.du);
  if (f.au) q = q.lte('date_limite', f.au);
  if (f.collaborateurId) q = q.or(intervenant(f.collaborateurId));
  if (f.mesDossiers && moiId) q = q.or(intervenant(moiId));
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as LigneEcheance[];
}

/** Toutes les échéances nécessitant une attention (retard, paiement non constaté, retard non qualifié). */
export async function listerEcheancesAAttention(): Promise<LigneEcheance[]> {
  const { data, error } = await supabase
    .from('v_echeances')
    .select('*')
    .or('en_retard.eq.true,alerte_paiement.eq.true,retard_non_qualifie.eq.true')
    .order('date_limite');
  if (error) throw error;
  return (data ?? []) as LigneEcheance[];
}

export async function listerCollaborateurs(): Promise<CollaborateurRef[]> {
  const { data, error } = await supabase.from('collaborateurs').select('id, trigramme, prenom, nom').order('trigramme');
  if (error) throw error;
  return (data ?? []) as CollaborateurRef[];
}

export async function marquerEcheance(
  id: string,
  statut: StatutEcheance,
  dateDepot?: ISODate,
  montant?: number,
): Promise<void> {
  const { error } = await supabase.rpc('marquer_echeance', {
    p_echeance: id,
    p_statut: statut,
    p_date_depot: dateDepot ?? null,
    p_montant: montant ?? null,
  });
  if (error) throw error;
}

export async function confirmerPaiement(id: string): Promise<void> {
  const { error } = await supabase.rpc('confirmer_paiement', { p_echeance: id });
  if (error) throw error;
}

export async function qualifierRetard(id: string, cause: CauseRetard): Promise<void> {
  const { error } = await supabase.rpc('qualifier_retard', { p_echeance: id, p_cause: cause });
  if (error) throw error;
}
