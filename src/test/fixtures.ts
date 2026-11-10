import type { LigneEcheance, LigneExercice, Moi } from '@/data/types';

export const MOI_CSP: Moi = { id: 'c1', prenom: 'Camille', nom: 'Test', trigramme: 'CTE', role: 'csp', administrateur: false };
export const MOI_MANAGER: Moi = { id: 'm1', prenom: 'Manon', nom: 'Test', trigramme: 'MTE', role: 'manager', administrateur: false };

export function echeance(p: Partial<LigneEcheance> = {}): LigneEcheance {
  return {
    id: 'e1', dossier_id: 'd1', exercice_id: null, type: 'is_solde',
    periode_debut: '2026-01-01', periode_fin: '2026-12-31', date_limite: '2026-11-20',
    statut: 'a_faire', statut_pennylane: null, source_statut: null, date_depot: null, montant: null,
    cause_retard: null, raison_sociale: 'Société Fictive', equipe: 1, csp_id: 'c1', senior_id: 's1',
    manager_id: 'm1', pennylane_id: null, en_retard: false, sous_7_jours: false, alerte_paiement: false,
    depot_tardif: false, retard_non_qualifie: false, synchronisee: false, ...p,
  };
}

export function exercice(p: Partial<LigneExercice> = {}): LigneExercice {
  return {
    id: 'x1', dossier_id: 'd1', date_debut: '2026-01-01', date_fin: '2026-12-31', date_cible: '2027-03-31',
    etape_actuelle: 1, date_approbation: null, raison_sociale: 'Société Fictive', equipe: 1, csp_id: 'c1',
    senior_id: 's1', manager_id: 'm1', pennylane_id: null, mission: 'tenue', jalon_etape2: null,
    jalon_etape3: null, jalon_etape4: null, etape_attendue: null, en_retard: false, ...p,
  };
}
