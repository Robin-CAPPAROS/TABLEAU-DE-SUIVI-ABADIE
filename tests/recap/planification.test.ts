import { describe, it, expect } from 'vitest';
import { doitEnvoyer } from '@shared/recap/planification';

describe('doitEnvoyer', () => {
  it('envoie le lundi à 7 h (heure de Paris) si rien n\'est parti', () => {
    expect(doitEnvoyer(new Date('2026-11-16T06:30:00Z'), false)).toBe(true); // lundi, 7 h 30 en hiver
    expect(doitEnvoyer(new Date('2026-11-16T05:30:00Z'), false)).toBe(false); // 6 h 30
    expect(doitEnvoyer(new Date('2027-06-07T05:30:00Z'), false)).toBe(true); // lundi, 7 h 30 en été
    expect(doitEnvoyer(new Date('2027-06-07T06:30:00Z'), false)).toBe(false); // 8 h 30
  });
  it('n\'envoie pas deux fois le même jour', () => {
    expect(doitEnvoyer(new Date('2026-11-16T06:30:00Z'), true)).toBe(false);
  });
  it('n\'envoie pas un autre jour que le lundi', () => {
    expect(doitEnvoyer(new Date('2026-11-17T06:30:00Z'), false)).toBe(false); // mardi
  });
});
