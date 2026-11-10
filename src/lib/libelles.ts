import type { StatutEcheance, TypeEcheance } from '@domain/types';
import type { CauseRetard } from '@/data/types';

export const LIBELLES_TYPE: Record<TypeEcheance, string> = {
  tva_mensuelle: 'TVA mensuelle',
  tva_trimestrielle: 'TVA trimestrielle',
  tva_ca12_acompte_juillet: 'Acompte CA12 de juillet',
  tva_ca12_acompte_decembre: 'Acompte CA12 de décembre',
  tva_ca12_annuelle: 'CA12 annuelle',
  liasse: 'Liasse fiscale',
  is_acompte_1: "Acompte d'IS n° 1",
  is_acompte_2: "Acompte d'IS n° 2",
  is_acompte_3: "Acompte d'IS n° 3",
  is_acompte_4: "Acompte d'IS n° 4",
  is_solde: "Solde d'IS",
  approbation: 'Approbation des comptes',
  depot_greffe: 'Dépôt au greffe',
};

export const LIBELLES_CAUSE: Record<CauseRetard, string> = {
  cabinet: 'Cabinet',
  client: 'Client',
  administration: 'Administration',
  autre: 'Autre',
};

export const LIBELLES_STATUT: Record<StatutEcheance, string> = {
  a_faire: 'À faire',
  depose: 'Déposé',
  paye: 'Payé',
  non_applicable: 'Non applicable',
};
