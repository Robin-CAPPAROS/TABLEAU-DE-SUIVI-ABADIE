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

  it('rejette un pennylane_id manquant', () => {
    const r = validerPayload({ source: 'mcp', dossiers: [{ raison_sociale: 'X' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toContain('pennylane_id');
  });

  it('accepte un montant numérique et rejette une date mal formée', () => {
    const d = exempleSpec.declarations_tva[0];
    expect(validerPayload({ source: 'api', declarations_tva: [{ ...d, montant: -1512 }] }).ok).toBe(true);
    expect(validerPayload({ source: 'api', declarations_tva: [{ ...d, date_limite: '19/10/2026' }] }).ok).toBe(false);
  });
});
