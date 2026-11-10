import { describe, expect, it } from 'vitest';
import { genererEcheancesExercice } from '@domain/exercice.ts';
import type { DossierRegles, ExerciceRegles, ParametresFiscaux } from '@domain/types.ts';

const dossierIS: DossierRegles = {
  id: 'd1', regimeTva: 'non_assujetti', categorieFiscale: 'bic_is',
  formeJuridique: 'Société à responsabilité limitée (SARL)', mission: 'tenue', statut: 'actif',
  jourEcheanceTva: null, isN1Superieur3000: true,
};

// Calendrier 2027 fictif : données de test uniquement, sans valeur officielle.
const params: ParametresFiscaux = {
  feries: [],
  calendriers: [{ annee: 2027, dateLiasse3112: '2027-05-19', dateSoldeIs3112: '2027-05-19', dateCa12_3112: '2027-05-04' }],
  formes: [
    { code: 'SARL', approbation: true, depotGreffe: true },
    { code: 'SCI', approbation: true, depotGreffe: false },
  ],
  delaiGreffeMois: 2,
};

const ex2026: ExerciceRegles = { id: 'e', dateDebut: '2026-01-01', dateFin: '2026-12-31', dateApprobation: null };
const gen = (d: DossierRegles, e: ExerciceRegles, p = params) => genererEcheancesExercice(d, e, p, '2026-11-10', 15);
const types = (r: { echeances: { type: string }[] }) => r.echeances.map((x) => x.type);

describe('genererEcheancesExercice', () => {
  it('exercice au 31/12', () => {
    const r = gen(dossierIS, ex2026);
    expect(Object.fromEntries(r.echeances.map((e) => [e.type, e.dateLimite]))).toEqual({
      is_acompte_3: '2026-09-15', is_acompte_4: '2026-12-15', liasse: '2027-05-19',
      is_solde: '2027-05-19', approbation: '2027-06-30', depot_greffe: '2027-08-31',
    });
    expect(r.echeances.every((e) => e.exerciceId === 'e' && e.periodeDebut === '2026-01-01' && e.periodeFin === '2026-12-31')).toBe(true);
  });

  it('dépôt au greffe depuis la date d approbation réelle', () => {
    const r = gen(dossierIS, { ...ex2026, dateApprobation: '2027-06-10' });
    expect(r.echeances.find((e) => e.type === 'depot_greffe')!.dateLimite).toBe('2027-08-10');
  });

  it('exercice décalé', () => {
    const r = gen(dossierIS, { id: 'e', dateDebut: '2025-07-01', dateFin: '2026-06-30', dateApprobation: null });
    expect(Object.fromEntries(r.echeances.map((e) => [e.type, e.dateLimite]))).toMatchObject(
      { liasse: '2026-10-15', is_solde: '2026-10-15', approbation: '2026-12-31', depot_greffe: '2027-03-01' });
  });

  it('calendrier absent', () => {
    const r = gen(dossierIS, ex2026, { ...params, calendriers: [] });
    expect(types(r)).not.toContain('liasse');
    expect(types(r)).not.toContain('is_solde');
    expect(r.anomalies).toContainEqual(expect.objectContaining({ type: 'calendrier_absent', cle: '2027' }));
  });

  it('mission irpp : pas de liasse', () => {
    expect(types(gen({ ...dossierIS, mission: 'irpp' }, ex2026))).not.toContain('liasse');
  });

  it('IS N-1 inférieur à 3 000 : pas d acompte', () => {
    expect(gen({ ...dossierIS, isN1Superieur3000: false }, ex2026).echeances.some((e) => e.type.startsWith('is_acompte'))).toBe(false);
  });

  it('hors IS : aucune échéance d IS', () => {
    expect(gen({ ...dossierIS, categorieFiscale: 'bnc' }, ex2026).echeances.some((e) => e.type.startsWith('is_'))).toBe(false);
  });

  it('SCI : approbation sans greffe', () => {
    const r = gen({ ...dossierIS, formeJuridique: 'Société civile immobilière (SCI)' }, ex2026);
    expect(types(r)).toContain('approbation');
    expect(types(r)).not.toContain('depot_greffe');
  });

  it('forme inconnue ou absente', () => {
    const r = gen({ ...dossierIS, formeJuridique: 'Forme exotique (FEX)' }, ex2026);
    expect(r.anomalies).toContainEqual(expect.objectContaining({ type: 'forme_inconnue', cle: 'FEX' }));
    expect(types(r)).not.toContain('approbation');
    expect(types(r)).not.toContain('depot_greffe');
    expect(gen({ ...dossierIS, formeJuridique: null }, ex2026).anomalies)
      .toContainEqual(expect.objectContaining({ type: 'forme_inconnue', cle: '' }));
  });

  it('exercice long', () => {
    const r = gen(dossierIS, { id: 'e', dateDebut: '2025-10-01', dateFin: '2026-12-31', dateApprobation: null });
    expect(r.anomalies).toContainEqual(expect.objectContaining({ type: 'exercice_long', cle: '2026-12-31' }));
  });

  it('exercice long clos depuis longtemps : pas d anomalie', () => {
    const r = gen(dossierIS, { id: 'e', dateDebut: '2024-10-01', dateFin: '2025-12-31', dateApprobation: null });
    expect(r.anomalies.map((a) => a.type)).not.toContain('exercice_long');
  });
});
