import type { ISODate, StatutEcheance, TypeEcheance } from '@domain/types';

export type Role = 'csp' | 'senior' | 'manager' | 'associe';

export type Moi = {
  id: string;
  prenom: string;
  nom: string;
  trigramme: string;
  role: Role;
  administrateur: boolean;
};

export type CauseRetard = 'cabinet' | 'client' | 'administration' | 'autre';

/** Ligne de la vue v_echeances. */
export type LigneEcheance = {
  id: string;
  dossier_id: string;
  exercice_id: string | null;
  type: TypeEcheance;
  periode_debut: ISODate;
  periode_fin: ISODate;
  date_limite: ISODate;
  statut: StatutEcheance;
  statut_pennylane: string | null;
  source_statut: 'pennylane' | 'manuel' | null;
  date_depot: ISODate | null;
  montant: number | null;
  cause_retard: CauseRetard | null;
  raison_sociale: string;
  equipe: number | null;
  csp_id: string | null;
  senior_id: string | null;
  manager_id: string | null;
  pennylane_id: string | null;
  en_retard: boolean;
  sous_7_jours: boolean;
  alerte_paiement: boolean;
  depot_tardif: boolean;
  retard_non_qualifie: boolean;
  synchronisee: boolean;
};

/** Ligne de la vue v_exercices. */
export type LigneExercice = {
  id: string;
  dossier_id: string;
  date_debut: ISODate;
  date_fin: ISODate;
  date_cible: ISODate | null;
  etape_actuelle: number;
  date_approbation: ISODate | null;
  raison_sociale: string;
  equipe: number | null;
  csp_id: string | null;
  senior_id: string | null;
  manager_id: string | null;
  pennylane_id: string | null;
  mission: string | null;
  jalon_etape2: ISODate | null;
  jalon_etape3: ISODate | null;
  jalon_etape4: ISODate | null;
  etape_attendue: number | null;
  en_retard: boolean;
};

export type Anomalie = {
  id: string;
  type: string;
  dossier_id: string | null;
  message: string;
  cree_le: string | null;
};

export type CollaborateurRef = { id: string; trigramme: string; prenom: string; nom: string };
