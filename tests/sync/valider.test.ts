import { describe, expect, it } from 'vitest';
import { validerPayload } from '@shared/sync/valider';

const exempleSpec = {
  source: 'mcp',
  dossiers: [
    {
      pennylane_id: 22010195,
      raison_sociale: 'SOCIETE EXEMPLE',
      forme_juridique: 'Société à responsabilité limitée (SARL)',
      regime_tva: 'monthly',
      categorie_fiscale: 'bic_is',
      regime_fiscal: 'fr_rn',
      comptable: 'Alice Martin',
      superviseur: 'Bruno Durand',
      manager: 'Carine Petit',
      exercices: [{ debut: '2026-01-01', fin: '2026-12-31' }],
    },
  ],
  declarations_tva: [
    {
      pennylane_id: 22010195,
      periode_debut: '2026-09-01',
      periode_fin: '2026-09-30',
      date_limite: '2026-10-19',
      date_depot: '2026-10-19',
      statut: 'accepted',
      montant: '-1512',
    },
  ],
  liasses: [
    {
      pennylane_id: 22010195,
      periode_debut: '2025-01-01',
      periode_fin: '2025-12-31',
      categorie_fiscale: 'bic_is',
      statut: 'accepted',
    },
  ],
};

describe('validerPayload', () => {
  it('accepte l exemple de la spec', () => {
    expect(validerPayload(exempleSpec).ok).toBe(true);
  });

  it('rejette une source inconnue', () => {
    expect(validerPayload({ ...exempleSpec, source: 'autre' })).toEqual({
      ok: false,
      erreur: expect.stringContaining('source'),
    });
  });

  it('limite le lot à 50 dossiers', () => {
    const lot = {
      ...exempleSpec,
      dossiers: Array.from({ length: 51 }, (_, i) => ({ ...exempleSpec.dossiers[0], pennylane_id: i + 1 })),
    };
    expect(validerPayload(lot)).toEqual({ ok: false, erreur: 'Lot limité à 50 dossiers.' });
  });

  it('listes absentes = vides', () => {
    const r = validerPayload({ source: 'api' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.dossiers).toEqual([]);
      expect(r.payload.declarations_tva).toEqual([]);
      expect(r.payload.liasses).toEqual([]);
    }
  });

  it('R15 : une clé absente reste absente, un null explicite reste null', () => {
    const r = validerPayload({
      source: 'mcp',
      dossiers: [
        { pennylane_id: 1, manager: null },
        { pennylane_id: 2 },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const [a, b] = r.payload.dossiers;
      expect('comptable' in a).toBe(false);
      expect('superviseur' in a).toBe(false);
      expect(a.manager).toBeNull();
      expect('manager' in b).toBe(false);
      expect(Object.keys(b)).toEqual(['pennylane_id']);
    }
  });

  it('écarte un dossier sans pennylane_id et le signale dans les rejets', () => {
    const r = validerPayload({ source: 'mcp', dossiers: [{ raison_sociale: 'X' }, { pennylane_id: 7 }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.dossiers).toEqual([{ pennylane_id: 7 }]);
      expect(r.rejets).toEqual([
        { liste: 'dossiers', index: 0, pennylane_id: null, erreur: expect.stringContaining('pennylane_id') },
      ]);
    }
  });

  it('accepte un montant numérique et écarte une date mal formée', () => {
    const d = exempleSpec.declarations_tva[0];
    const ok = validerPayload({ source: 'api', declarations_tva: [{ ...d, montant: -1512 }] });
    expect(ok.ok && ok.rejets).toEqual([]);
    const r = validerPayload({ source: 'api', declarations_tva: [d, { ...d, date_limite: '19/10/2026' }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.declarations_tva).toEqual([d]);
      expect(r.rejets).toEqual([
        { liste: 'declarations_tva', index: 1, pennylane_id: 22010195, erreur: expect.stringContaining('date_limite') },
      ]);
    }
  });

  it('R32 : un élément invalide n écarte que lui-même, dans chaque liste', () => {
    const l = exempleSpec.liasses[0];
    const r = validerPayload({
      source: 'mcp',
      dossiers: [exempleSpec.dossiers[0], { pennylane_id: -3 }, 'texte'],
      liasses: [{ ...l, periode_fin: null }, l],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.dossiers).toEqual([exempleSpec.dossiers[0]]);
      expect(r.payload.liasses).toEqual([l]);
      expect(r.rejets.map(({ liste, index, pennylane_id }) => ({ liste, index, pennylane_id }))).toEqual([
        { liste: 'dossiers', index: 1, pennylane_id: null },
        { liste: 'dossiers', index: 2, pennylane_id: null },
        { liste: 'liasses', index: 0, pennylane_id: 22010195 },
      ]);
      expect(r.rejets.every((x) => x.erreur.length > 0)).toBe(true);
    }
  });

  it('R32 : raison_sociale, exercices et statut acceptent null', () => {
    const r = validerPayload({
      source: 'mcp',
      dossiers: [{ pennylane_id: 1, raison_sociale: null, exercices: null }],
      declarations_tva: [{ ...exempleSpec.declarations_tva[0], statut: null }],
      liasses: [{ ...exempleSpec.liasses[0], statut: null }],
    });
    expect(r.ok && r.rejets).toEqual([]);
    if (r.ok) {
      expect(r.payload.dossiers[0]).toEqual({ pennylane_id: 1, raison_sociale: null, exercices: null });
      expect(r.payload.declarations_tva[0].statut).toBeNull();
      expect(r.payload.liasses[0].statut).toBeNull();
    }
  });

  it('enveloppe invalide : refus global', () => {
    expect(validerPayload(null).ok).toBe(false);
    expect(validerPayload([]).ok).toBe(false);
    const r = validerPayload({ source: 'mcp', dossiers: { pennylane_id: 1 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toContain('dossiers');
  });

  it('la limite de 50 dossiers porte sur le lot reçu, éléments invalides compris', () => {
    const lot = {
      source: 'mcp',
      dossiers: [...Array.from({ length: 50 }, (_, i) => ({ pennylane_id: i + 1 })), { raison_sociale: 'sans id' }],
    };
    expect(validerPayload(lot)).toEqual({ ok: false, erreur: 'Lot limité à 50 dossiers.' });
  });
});
