import { formaterDate, formaterDateLongue, formaterDateHeureParis } from './format';

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
