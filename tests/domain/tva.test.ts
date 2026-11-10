import { describe, expect, it } from 'vitest';
import { genererTva } from '@domain/tva.ts';
import type { DossierRegles, ExerciceRegles, ParametresFiscaux } from '@domain/types.ts';

const base: DossierRegles = {
  id: 'd1',
  regimeTva: null,
  categorieFiscale: 'bic_is',
  formeJuridique: 'Société à responsabilité limitée (SARL)',
  mission: 'tenue',
  statut: 'actif',
  jourEcheanceTva: null,
  isN1Superieur3000: false,
};

// Calendrier 2027 fictif : données de test uniquement, sans valeur officielle.
const params: ParametresFiscaux = {
  feries: [],
  calendriers: [
    { annee: 2027, dateLiasse3112: '2027-05-19', dateSoldeIs3112: '2027-05-19', dateCa12_3112: '2027-05-04' },
  ],
  formes: [],
  delaiGreffeMois: 2,
};

const exercice2026: ExerciceRegles = { id: 'e2026', dateDebut: '2026-01-01', dateFin: '2026-12-31', dateApprobation: null };

describe('genererTva', () => {
  it('mensuel', () => {
    const mensuel = genererTva({ ...base, regimeTva: 'mensuel', jourEcheanceTva: 19 }, [], params, '2026-11-10', 15);
    expect(mensuel.echeances).toHaveLength(17);
    expect(mensuel.echeances[0]).toMatchObject({ type: 'tva_mensuelle', periodeDebut: '2026-08-01', periodeFin: '2026-08-31', dateLimite: '2026-09-21' });
    expect(mensuel.echeances).toContainEqual(expect.objectContaining({ periodeDebut: '2026-10-01', dateLimite: '2026-11-19' }));
    expect(mensuel.echeances.at(-1)!.periodeDebut).toBe('2027-12-01');
    expect(mensuel.echeances.every((e) => e.exerciceId === null && e.dossierId === 'd1')).toBe(true);
  });

  it('plafonne le jour à la fin du mois', () => {
    const r = genererTva({ ...base, regimeTva: 'mensuel', jourEcheanceTva: 31 }, [], params, '2026-11-10', 15);
    // période janvier 2027 : limite en février 2027 (28 jours), 28/02/2027 est un dimanche, report au 01/03
    expect(r.echeances).toContainEqual(expect.objectContaining({ periodeDebut: '2027-01-01', dateLimite: '2027-03-01' }));
  });

  it('trimestriel', () => {
    const trim = genererTva({ ...base, regimeTva: 'trimestriel', jourEcheanceTva: 24 }, [], params, '2026-11-10', 15);
    expect(trim.echeances).toHaveLength(6);
    expect(trim.echeances[0]).toMatchObject({ type: 'tva_trimestrielle', periodeDebut: '2026-07-01', periodeFin: '2026-09-30', dateLimite: '2026-10-26' });
  });

  it('annuel : acomptes et CA12', () => {
    const ca12 = genererTva({ ...base, regimeTva: 'annuel', jourEcheanceTva: 24 }, [exercice2026], params, '2026-11-10', 15);
    expect(ca12.echeances).toContainEqual(expect.objectContaining({ type: 'tva_ca12_acompte_decembre', periodeDebut: '2026-12-01', dateLimite: '2026-12-24' }));
    expect(ca12.echeances).toContainEqual(expect.objectContaining({ type: 'tva_ca12_acompte_juillet', periodeDebut: '2027-07-01', dateLimite: '2027-07-26' }));
    expect(ca12.echeances).toContainEqual(expect.objectContaining({ type: 'tva_ca12_annuelle', exerciceId: 'e2026', periodeDebut: '2026-01-01', periodeFin: '2026-12-31', dateLimite: '2027-05-04' }));
    expect(ca12.anomalies).toEqual([]);
  });

  it('annuel : CA12 d un exercice non clos au 31/12 (clôture + 3 mois)', () => {
    const ex: ExerciceRegles = { id: 'e30', dateDebut: '2026-07-01', dateFin: '2027-06-30', dateApprobation: null };
    const r = genererTva({ ...base, regimeTva: 'annuel', jourEcheanceTva: 24 }, [ex], params, '2026-11-10', 15);
    expect(r.echeances).toContainEqual(expect.objectContaining({ type: 'tva_ca12_annuelle', exerciceId: 'e30', dateLimite: '2027-09-30' }));
  });

  it('annuel : calendrier absent', () => {
    const sansCalendrier = { ...params, calendriers: [] };
    const r = genererTva({ ...base, regimeTva: 'annuel', jourEcheanceTva: 24 }, [exercice2026], sansCalendrier, '2026-11-10', 15);
    expect(r.echeances.some((e) => e.type === 'tva_ca12_annuelle')).toBe(false);
    expect(r.anomalies).toEqual([
      expect.objectContaining({ dossierId: 'd1', type: 'calendrier_absent', cle: '2027' }),
    ]);
  });

  it('non assujetti et null', () => {
    expect(genererTva({ ...base, regimeTva: 'non_assujetti' }, [], params, '2026-11-10', 15).echeances).toEqual([]);
    expect(genererTva({ ...base, regimeTva: null }, [], params, '2026-11-10', 15)).toEqual({ echeances: [], anomalies: [] });
  });

  it('jour absent', () => {
    const sansJour = genererTva({ ...base, regimeTva: 'mensuel', jourEcheanceTva: null }, [], params, '2026-11-10', 15);
    expect(sansJour.echeances).toEqual([]);
    expect(sansJour.anomalies[0].type).toBe('jour_tva_absent');
    expect(sansJour.anomalies[0].cle).toBe('');
  });
});
