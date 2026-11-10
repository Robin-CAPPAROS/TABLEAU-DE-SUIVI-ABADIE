import type { Moi, Role } from '@/data/types';

// Miroir de valider_etape / revenir_etape et des droits SQL (affichage uniquement).
const ROLES_PAR_ETAPE: Record<number, Role[]> = {
  1: ['csp', 'senior', 'manager', 'associe'],
  2: ['csp', 'manager', 'associe'],
  3: ['senior', 'manager', 'associe'],
  4: ['manager', 'associe'],
  5: ['senior', 'manager', 'associe'],
  6: [],
};

export function peutValiderEtape(role: Role, etape: number): boolean {
  return (ROLES_PAR_ETAPE[etape] ?? []).includes(role);
}

export function peutRevenir(role: Role): boolean {
  return role === 'manager' || role === 'associe';
}

const estManagerOuAssocie = (moi: Moi) => moi.role === 'manager' || moi.role === 'associe';

export function peutAgirSurEcheance(moi: Moi, dossier: { csp_id: string | null; senior_id: string | null }): boolean {
  return moi.id === dossier.csp_id || moi.id === dossier.senior_id || estManagerOuAssocie(moi);
}

/** Échappatoire de marquer_echeance : rendre non applicable une échéance synchronisée à faire (R28). */
export function peutNeutraliserSynchronisee(moi: Moi): boolean {
  return estManagerOuAssocie(moi);
}

export function peutModifierDossier(moi: Moi): boolean {
  return estManagerOuAssocie(moi) || moi.administrateur;
}

export function peutVoirIndicateurs(moi: Moi): boolean {
  return estManagerOuAssocie(moi) || moi.administrateur;
}

export function peutAdministrer(moi: Moi): boolean {
  return estManagerOuAssocie(moi) || moi.administrateur;
}

export function peutModifierAdministration(moi: Moi): boolean {
  return moi.administrateur;
}
