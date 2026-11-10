import { describe, it, expect } from 'vitest';
import {
  ajouterJours,
  ajouterMois,
  finDeMois,
  reporterJourOuvre,
  dateDuJourParis,
  estDansFenetre,
} from '@domain/dates';

describe('ajouterJours', () => {
  it('ajoute et retire des jours', () => {
    expect(ajouterJours('2026-11-10', 5)).toBe('2026-11-15');
    expect(ajouterJours('2026-11-10', -10)).toBe('2026-10-31');
  });

  it('franchit une frontière de mois et d\'année', () => {
    expect(ajouterJours('2026-12-31', 1)).toBe('2027-01-01');
    expect(ajouterJours('2027-01-01', -1)).toBe('2026-12-31');
    expect(ajouterJours('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('gère les années bissextiles', () => {
    expect(ajouterJours('2028-02-28', 1)).toBe('2028-02-29');
    expect(ajouterJours('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('ajouterMois', () => {
  it('applique les règles de fin de mois', () => {
    expect(ajouterMois('2026-03-31', 3)).toBe('2026-06-30');
    expect(ajouterMois('2026-02-28', 3)).toBe('2026-05-31');
    expect(ajouterMois('2026-01-30', 1)).toBe('2026-02-28');
    expect(ajouterMois('2026-06-15', 1)).toBe('2026-07-15');
  });

  it('plafonne un jour qui n\'est pas la fin du mois d\'origine (année bissextile)', () => {
    expect(ajouterMois('2028-02-28', 1)).toBe('2028-03-28');
  });

  it('franchit une frontière d\'année', () => {
    expect(ajouterMois('2026-11-15', 3)).toBe('2027-02-15');
    expect(ajouterMois('2026-12-31', 1)).toBe('2027-01-31');
  });
});

describe('finDeMois', () => {
  it('renvoie le dernier jour du mois, y compris en année bissextile', () => {
    expect(finDeMois(2026, 2)).toBe('2026-02-28');
    expect(finDeMois(2028, 2)).toBe('2028-02-29');
    expect(finDeMois(2026, 12)).toBe('2026-12-31');
    expect(finDeMois(2026, 4)).toBe('2026-04-30');
  });
});

describe('reporterJourOuvre', () => {
  it('reporte un samedi au lundi', () => {
    expect(reporterJourOuvre('2026-11-14', [])).toBe('2026-11-16');
  });

  it('reporte un jour férié au lendemain', () => {
    expect(reporterJourOuvre('2026-11-11', ['2026-11-11'])).toBe('2026-11-12');
  });

  it('enchaîne un samedi puis un lundi férié', () => {
    expect(reporterJourOuvre('2027-05-15', ['2027-05-17'])).toBe('2027-05-18');
  });

  it('laisse inchangé un jour ouvré', () => {
    expect(reporterJourOuvre('2026-11-10', [])).toBe('2026-11-10');
  });
});

describe('dateDuJourParis', () => {
  it('donne la date de Paris, pas la date UTC', () => {
    expect(dateDuJourParis(new Date('2026-11-09T23:30:00Z'))).toBe('2026-11-10');
  });
});

describe('estDansFenetre', () => {
  it('borne basse incluse : aujourd\'hui moins 60 jours', () => {
    expect(estDansFenetre('2026-09-11', '2026-11-10', 15)).toBe(true);
    expect(estDansFenetre('2026-09-10', '2026-11-10', 15)).toBe(false);
  });

  it('borne haute incluse : aujourd\'hui plus horizonMois', () => {
    expect(estDansFenetre('2028-02-10', '2026-11-10', 15)).toBe(true);
    expect(estDansFenetre('2028-02-11', '2026-11-10', 15)).toBe(false);
  });
});
