import {
  peutAdministrer,
  peutAgirSurEcheance,
  peutModifierAdministration,
  peutModifierDossier,
  peutRevenir,
  peutValiderEtape,
  peutVoirIndicateurs,
} from './permissions';
import type { Moi } from '@/data/types';

const moi = (role: Moi['role'], administrateur = false, id = 'u1'): Moi => ({
  id,
  prenom: 'A',
  nom: 'B',
  trigramme: 'ABC',
  role,
  administrateur,
});

test('peutValiderEtape suit la matrice SQL', () => {
  expect(peutValiderEtape('csp', 3)).toBe(false);
  expect(peutValiderEtape('senior', 5)).toBe(true);
  expect(peutValiderEtape('manager', 6)).toBe(false);
  expect(peutValiderEtape('csp', 1)).toBe(true);
  expect(peutValiderEtape('senior', 2)).toBe(false);
  expect(peutValiderEtape('senior', 4)).toBe(false);
  expect(peutValiderEtape('manager', 4)).toBe(true);
  expect(peutValiderEtape('associe', 5)).toBe(true);
  expect(peutValiderEtape('associe', 7)).toBe(false);
});

test('peutRevenir : manager et associe', () => {
  expect(peutRevenir('csp')).toBe(false);
  expect(peutRevenir('senior')).toBe(false);
  expect(peutRevenir('manager')).toBe(true);
  expect(peutRevenir('associe')).toBe(true);
});

test('peutAgirSurEcheance', () => {
  const d = { csp_id: 'c1', senior_id: 's1' };
  expect(peutAgirSurEcheance(moi('csp', false, 'c1'), d)).toBe(true);
  expect(peutAgirSurEcheance(moi('senior', false, 's1'), d)).toBe(true);
  expect(peutAgirSurEcheance(moi('csp', false, 'c2'), d)).toBe(false);
  expect(peutAgirSurEcheance(moi('manager', false, 'm'), d)).toBe(true);
  expect(peutAgirSurEcheance(moi('associe', false, 'a'), d)).toBe(true);
  expect(peutAgirSurEcheance(moi('senior', true, 'x'), d)).toBe(false);
});

test('peutVoirIndicateurs', () => {
  expect(peutVoirIndicateurs(moi('csp'))).toBe(false);
  expect(peutVoirIndicateurs(moi('csp', true))).toBe(true);
  expect(peutVoirIndicateurs(moi('senior'))).toBe(false);
  expect(peutVoirIndicateurs(moi('manager'))).toBe(true);
  expect(peutVoirIndicateurs(moi('associe'))).toBe(true);
});

test('peutModifierDossier et administration', () => {
  expect(peutModifierDossier(moi('senior'))).toBe(false);
  expect(peutModifierDossier(moi('manager'))).toBe(true);
  expect(peutModifierDossier(moi('csp', true))).toBe(true);
  expect(peutAdministrer(moi('senior'))).toBe(false);
  expect(peutAdministrer(moi('manager'))).toBe(true);
  expect(peutAdministrer(moi('csp', true))).toBe(true);
  expect(peutModifierAdministration(moi('associe'))).toBe(false);
  expect(peutModifierAdministration(moi('csp', true))).toBe(true);
});
