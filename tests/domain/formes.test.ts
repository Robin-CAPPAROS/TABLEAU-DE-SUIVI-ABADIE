import { describe, it, expect } from 'vitest';
import { codeForme, estIS } from '@domain/formes';

describe('codeForme', () => {
  it('prend le dernier sigle entre parenthèses', () => {
    expect(codeForme('Société à responsabilité limitée (SARL)')).toBe('SARL');
    expect(codeForme('Société par actions simplifiée (sas)')).toBe('SAS');
  });

  it('utilise le libellé complet en majuscules si pas de parenthèses', () => {
    expect(codeForme('Entreprise individuelle')).toBe('ENTREPRISE INDIVIDUELLE');
  });

  it('retient le dernier groupe quand il y en a plusieurs', () => {
    expect(codeForme('Société (ex SA) unipersonnelle (EURL)')).toBe('EURL');
  });

  it('réduit les espaces superflus du libellé', () => {
    expect(codeForme('  Entreprise   individuelle  ')).toBe('ENTREPRISE INDIVIDUELLE');
  });

  it('renvoie null pour une valeur vide ou absente', () => {
    expect(codeForme(null)).toBeNull();
    expect(codeForme('')).toBeNull();
    expect(codeForme('   ')).toBeNull();
  });
});

describe('estIS', () => {
  it('reconnaît les catégories à l\'IS', () => {
    expect(estIS('bic_is')).toBe(true);
    expect(estIS('is')).toBe(true);
  });

  it('rejette les autres catégories', () => {
    expect(estIS('bic_ir')).toBe(false);
    expect(estIS('bnc')).toBe(false);
    expect(estIS(null)).toBe(false);
  });
});
