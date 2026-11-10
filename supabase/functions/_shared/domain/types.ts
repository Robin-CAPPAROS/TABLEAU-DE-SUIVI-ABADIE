export type ISODate = string;
export type RegimeTva = 'mensuel' | 'trimestriel' | 'annuel' | 'non_assujetti';
export type Mission = 'tenue' | 'revision' | 'micro_bnc' | 'irpp';
export type StatutEcheance = 'a_faire' | 'depose' | 'paye' | 'non_applicable';
export const TYPES_SYNCHRONISES: TypeEcheance[] = ['tva_mensuelle', 'tva_trimestrielle', 'tva_ca12_annuelle', 'liasse'];
export type TypeEcheance = 'tva_mensuelle' | 'tva_trimestrielle' | 'tva_ca12_acompte_juillet'
  | 'tva_ca12_acompte_decembre' | 'tva_ca12_annuelle' | 'liasse' | 'is_acompte_1' | 'is_acompte_2'
  | 'is_acompte_3' | 'is_acompte_4' | 'is_solde' | 'approbation' | 'depot_greffe';
export interface DossierRegles { id: string; regimeTva: RegimeTva | null; categorieFiscale: string | null;
  formeJuridique: string | null; mission: Mission | null; statut: 'actif' | 'sorti';
  jourEcheanceTva: number | null; isN1Superieur3000: boolean; }
export interface ExerciceRegles { id: string; dateDebut: ISODate; dateFin: ISODate; dateApprobation: ISODate | null; }
export interface CalendrierAnnuel { annee: number; dateLiasse3112: ISODate; dateSoldeIs3112: ISODate; dateCa12_3112: ISODate; }
export interface FormeParam { code: string; approbation: boolean; depotGreffe: boolean; }
export interface ParametresFiscaux { feries: ISODate[]; calendriers: CalendrierAnnuel[]; formes: FormeParam[]; delaiGreffeMois: number; }
export interface EcheanceGeneree { dossierId: string; exerciceId: string | null; type: TypeEcheance;
  periodeDebut: ISODate; periodeFin: ISODate; dateLimite: ISODate; }
export type TypeAnomalieGeneration = 'calendrier_absent' | 'jour_tva_absent' | 'forme_inconnue' | 'exercice_long';
export interface AnomalieGeneration { dossierId: string; type: TypeAnomalieGeneration; cle: string; message: string; }
export interface ResultatGeneration { echeances: EcheanceGeneree[]; anomalies: AnomalieGeneration[]; }
