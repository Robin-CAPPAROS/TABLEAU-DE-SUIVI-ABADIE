import { describe, expect, it } from 'vitest';
import { genererEcheancesDossier } from '@domain/generation.ts';
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
  formes: [{ code: 'SARL', approbation: true, depotGreffe: true }],
  delaiGreffeMois: 2,
};

const ex2026: ExerciceRegles = { id: 'e', dateDebut: '2026-01-01', dateFin: '2026-12-31', dateApprobation: null };

describe('genererEcheancesDossier', () => {
  it('dossier sorti : résultat vide', () => {
    expect(genererEcheancesDossier({ ...dossierIS, statut: 'sorti' }, [ex2026], params, '2026-11-10'))
      .toEqual({ echeances: [], anomalies: [] });
  });

  it('TVA mensuelle et exercice, triés', () => {
    const r = genererEcheancesDossier({ ...dossierIS, regimeTva: 'mensuel', jourEcheanceTva: 19 }, [ex2026], params, '2026-11-10');
    const types = r.echeances.map((e) => e.type);
    expect(types).toContain('tva_mensuelle');
    expect(types).toContain('liasse');
    expect(types).toContain('depot_greffe');
    const dates = r.echeances.map((e) => e.dateLimite);
    expect(dates).toEqual([...dates].sort());
  });

  it('anomalies dédoublonnées', () => {
    const ex2025: ExerciceRegles = { id: 'e0', dateDebut: '2025-01-01', dateFin: '2025-12-31', dateApprobation: null };
    const r = genererEcheancesDossier({ ...dossierIS, formeJuridique: 'Forme exotique (FEX)' }, [ex2025, ex2026], params, '2026-11-10');
    expect(r.anomalies.filter((a) => a.type === 'forme_inconnue')).toHaveLength(1);
  });
});
