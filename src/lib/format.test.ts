import { formaterDate, formaterDateLongue } from './format';

test('formaterDate', () => {
  expect(formaterDate('2026-11-19')).toBe('19/11/2026');
});

test('formaterDateLongue', () => {
  expect(formaterDateLongue('2026-11-16')).toBe('lundi 16 novembre 2026');
});
