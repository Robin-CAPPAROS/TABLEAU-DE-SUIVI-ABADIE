import { describe, it, expect } from 'vitest';
import { verifierCle } from '@shared/cle';

describe('verifierCle', () => {
  it('accepte Bearer suivi du secret', () => {
    expect(verifierCle('Bearer abc', 'abc')).toBe(true);
  });
  it('refuse un secret différent', () => {
    expect(verifierCle('Bearer abd', 'abc')).toBe(false);
    expect(verifierCle('Bearer abcd', 'abc')).toBe(false);
  });
  it('refuse un en-tête absent ou sans Bearer', () => {
    expect(verifierCle(null, 'abc')).toBe(false);
    expect(verifierCle('abc', 'abc')).toBe(false);
  });
});
