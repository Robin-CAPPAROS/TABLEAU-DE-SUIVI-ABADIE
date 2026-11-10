import { formaterDate, formaterDateLongue, formaterDateHeureParis, formaterNombre, formaterPourcentage, saisonFiscale, bornesSaison } from './format';

test('formaterDate', () => {
  expect(formaterDate('2026-11-19')).toBe('19/11/2026');
});

test('formaterDateLongue', () => {
  expect(formaterDateLongue('2026-11-16')).toBe('lundi 16 novembre 2026');
});

test('formaterDateHeureParis convertit en heure de Paris', () => {
  expect(formaterDateHeureParis('2026-11-10T01:15:00Z')).toBe('10/11/2026 à 02:15');
  expect(formaterDateHeureParis('2026-07-10T01:15:00Z')).toBe('10/07/2026 à 03:15');
});

test('formaterNombre et formaterPourcentage utilisent la virgule décimale', () => {
  expect(formaterNombre(12.5)).toBe('12,5');
  expect(formaterNombre(null)).toBe('n/d');
  expect(formaterPourcentage(33.3)).toBe('33,3 %');
});

test('saisonFiscale : année de la date plus trois mois', () => {
  expect(saisonFiscale('2026-09-30')).toBe(2026);
  expect(saisonFiscale('2026-10-01')).toBe(2027);
  expect(saisonFiscale('2026-11-10')).toBe(2027);
  expect(saisonFiscale('2027-01-15')).toBe(2027);
});

test('bornesSaison', () => {
  expect(bornesSaison(2027)).toEqual({ du: '2026-10-01', au: '2027-09-30' });
});
