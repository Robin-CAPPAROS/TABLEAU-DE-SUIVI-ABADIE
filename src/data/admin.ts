import { supabase } from '@/lib/supabase';
import { lireTout } from '@/data/pagination';
import type { Role } from '@/data/types';
import type { DossierImport, CollaborateurImport } from '@/import/analyserClasseur';

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export type CollaborateurAdmin = {
  id: string; prenom: string; nom: string; trigramme: string; email: string;
  role: Role | null; administrateur: boolean; actif: boolean;
};
export type ModifCollaborateur = Partial<Pick<CollaborateurAdmin, 'email' | 'role' | 'administrateur' | 'actif'>>;
export type NouveauCollaborateur = Pick<CollaborateurAdmin, 'prenom' | 'nom' | 'trigramme' | 'email' | 'role'>;

export type Parametres = {
  date_cible_mois_tenue: number; date_cible_mois_revision: number; date_cible_mois_micro_bnc: number; date_cible_mois_irpp: number;
  jalon_etape2_jours: number; jalon_etape3_jours: number; delai_greffe_mois: number; delai_alerte_paiement_jours: number;
  recap_actif: boolean; recap_equipes: number[]; recap_expediteur: string | null;
};
export type CalendrierAnnuel = { annee: number; date_liasse_3112: string; date_solde_is_3112: string; date_ca12_3112: string };
export type FormeJuridique = { code: string; approbation: boolean; depot_greffe: boolean };
export type LigneJournal = {
  id: string; debut: string; fin: string | null; source: string | null; nature: string | null;
  nb_dossiers: number | null; nb_echeances: number | null;
};
export type AnomalieAdmin = { id: string; type: string; dossier_id: string | null; message: string; cree_le: string | null; raison_sociale: string | null };

export type Proposition = { dossier_id: string; raison_sociale: string };
export type NonRapproche = { siren: string; raison_sociale: string; propositions: Proposition[] };
export type ResultatImport = { rapproches: number; non_rapproches: NonRapproche[]; collaborateurs: number };

const COLLAB = 'id, prenom, nom, trigramme, email, role, administrateur, actif';

export function listerCollaborateursAdmin(): Promise<CollaborateurAdmin[]> {
  return lireTout<CollaborateurAdmin>((de, a) =>
    supabase.from('collaborateurs').select(COLLAB).order('trigramme').order('id').range(de, a) as unknown as Page<CollaborateurAdmin>);
}

export async function modifierCollaborateur(id: string, modif: ModifCollaborateur): Promise<void> {
  const { error } = await supabase.from('collaborateurs').update(modif).eq('id', id);
  if (error) throw error;
}

export async function ajouterCollaborateur(c: NouveauCollaborateur): Promise<void> {
  const { error } = await supabase.from('collaborateurs')
    .insert({ ...c, nom_pennylane: `${c.prenom} ${c.nom}`.trim() });
  if (error) throw error;
}

export async function lireParametres(): Promise<Parametres> {
  const { data, error } = await supabase.from('parametres').select('*').eq('id', 1).single();
  if (error) throw error;
  return data as Parametres;
}

export async function enregistrerParametres(p: Parametres): Promise<void> {
  const { error } = await supabase.from('parametres').update(p).eq('id', 1);
  if (error) throw error;
}

export function listerCalendriers(): Promise<CalendrierAnnuel[]> {
  return lireTout<CalendrierAnnuel>((de, a) =>
    supabase.from('calendriers_annuels').select('annee, date_liasse_3112, date_solde_is_3112, date_ca12_3112').order('annee').range(de, a) as unknown as Page<CalendrierAnnuel>);
}

export async function enregistrerCalendrier(c: CalendrierAnnuel): Promise<void> {
  const { error } = await supabase.from('calendriers_annuels').upsert(c, { onConflict: 'annee' });
  if (error) throw error;
}

export function listerFormes(): Promise<FormeJuridique[]> {
  return lireTout<FormeJuridique>((de, a) =>
    supabase.from('formes_juridiques').select('code, approbation, depot_greffe').order('code').range(de, a) as unknown as Page<FormeJuridique>);
}

export async function enregistrerForme(f: FormeJuridique): Promise<void> {
  const { error } = await supabase.from('formes_juridiques').upsert(f, { onConflict: 'code' });
  if (error) throw error;
}

export function listerJoursFeries(): Promise<string[]> {
  return lireTout<{ jour: string }>((de, a) =>
    supabase.from('jours_feries').select('jour').order('jour').range(de, a) as unknown as Page<{ jour: string }>).then((l) => l.map((x) => x.jour));
}

export async function ajouterJourFerie(jour: string): Promise<void> {
  const { error } = await supabase.from('jours_feries').insert({ jour });
  if (error) throw error;
}

/** 50 dernières lignes du journal de synchronisation et des envois. */
export async function listerJournal(): Promise<LigneJournal[]> {
  const { data, error } = await supabase.from('journal_synchro')
    .select('id, debut, fin, source, nature, nb_dossiers, nb_echeances').order('debut', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as LigneJournal[];
}

type AnomalieBrute = Omit<AnomalieAdmin, 'raison_sociale'> & { dossiers: { raison_sociale: string } | null };

export async function listerAnomaliesAdmin(): Promise<AnomalieAdmin[]> {
  const lignes = await lireTout<AnomalieBrute>((de, a) =>
    supabase.from('anomalies').select('id, type, dossier_id, message, cree_le, dossiers(raison_sociale)')
      .is('resolue_le', null).order('cree_le', { ascending: false }).order('id').range(de, a) as unknown as Page<AnomalieBrute>);
  return lignes.map(({ dossiers, ...reste }) => ({ ...reste, raison_sociale: dossiers?.raison_sociale ?? null }));
}

export async function resoudreAnomalie(id: string): Promise<void> {
  const { error } = await supabase.from('anomalies').update({ resolue_le: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function importerClasseurRpc(dossiers: DossierImport[], collaborateurs: CollaborateurImport[]): Promise<ResultatImport> {
  const { data, error } = await supabase.rpc('import_classeur', { p: { dossiers, collaborateurs } });
  if (error) throw error;
  return data as ResultatImport;
}

export async function rapprocherDossier(dossierId: string, ligne: DossierImport): Promise<void> {
  const { error } = await supabase.rpc('rapprocher_dossier', { p_dossier: dossierId, p_import: ligne });
  if (error) throw error;
}
