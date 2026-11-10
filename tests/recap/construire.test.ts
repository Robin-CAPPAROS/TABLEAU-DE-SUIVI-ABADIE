import { describe, it, expect } from 'vitest';
import { construireRecapitulatif, type DonneesRecap } from '@shared/recap/construire';

const base: DonneesRecap = {
  collaborateur: { prenom: 'Camille', role: 'csp' },
  semaineDu: '2026-11-16',
  echeances7j: [],
  echeancesEnRetard: [],
  alertesPaiement: [],
  exercicesEnRetard: [],
  synthese: null,
  fileSupervision: null,
  anomaliesOuvertes: null,
};

const donneesCsp: DonneesRecap = {
  ...base,
  echeances7j: [{ dossierId: 'd1', raisonSociale: 'Société <Test> & Fils', type: 'tva_mensuelle', dateLimite: '2026-11-19' }],
  echeancesEnRetard: [{ dossierId: 'd2', raisonSociale: 'Deux', type: 'is_acompte_1', dateLimite: '2026-11-02' }],
  alertesPaiement: [{ dossierId: 'd3', raisonSociale: 'Trois', type: 'tva_trimestrielle', dateLimite: '2026-10-19' }],
  exercicesEnRetard: [{ dossierId: 'd4', raisonSociale: 'Quatre', dateCible: '2026-09-30', etapeActuelle: 2 }],
};

const donneesManager: DonneesRecap = {
  ...donneesCsp,
  collaborateur: { prenom: 'Marc', role: 'manager' },
  synthese: [{ trigramme: 'CDU', echeances: 3, retards: 1, alertes: 0 }],
  fileSupervision: [{ dossierId: 'd5', raisonSociale: 'Cinq', dateCible: '2026-12-31', etapeActuelle: 3 }],
  anomaliesOuvertes: 4,
};

describe('construireRecapitulatif', () => {
  it('construit le sujet, les liens et les sections pour un CSP', () => {
    const m = construireRecapitulatif(donneesCsp, 'https://app.test');
    expect(m.sujet).toBe('Suivi CPA & ABADIE : votre semaine du lundi 16 novembre 2026');
    expect(m.html).toContain('https://app.test/dossiers/d1');
    expect(m.html).toContain('Échéances des 7 prochains jours');
    expect(m.html).toContain('Échéances en retard');
    expect(m.html).toContain('Paiements de TVA non constatés');
    expect(m.html).toContain('Bilans en retard');
    expect(m.html).toContain('TVA mensuelle');
    expect(m.html).toContain('Acompte d\'IS n° 1');
    expect(m.html).toContain('19/11/2026');
    expect(m.html).not.toContain('File de supervision');
    expect(m.html).not.toContain('—');
    expect(m.texte).not.toContain('—');
    expect(m.texte).toContain('https://app.test/dossiers/d1');
  });

  it('échappe le HTML des valeurs interpolées', () => {
    const m = construireRecapitulatif(donneesCsp, 'https://app.test');
    expect(m.html).toContain('Société &lt;Test&gt; &amp; Fils');
    expect(m.html).not.toContain('<Test>');
  });

  it('omet les sections vides', () => {
    const m = construireRecapitulatif({ ...base, echeances7j: donneesCsp.echeances7j }, 'https://app.test');
    expect(m.html).toContain('Échéances des 7 prochains jours');
    expect(m.html).not.toContain('Échéances en retard');
    expect(m.html).not.toContain('Aucune échéance ni aucun retard cette semaine.');
  });

  it('affiche le message vide quand rien n\'est à signaler', () => {
    const m = construireRecapitulatif(base, 'https://app.test');
    expect(m.html).toContain('Aucune échéance ni aucun retard cette semaine.');
    expect(m.texte).toContain('Aucune échéance ni aucun retard cette semaine.');
  });

  it('ajoute les sections de supervision pour un manager', () => {
    const m = construireRecapitulatif(donneesManager, 'https://app.test');
    expect(m.html).toContain('File de supervision');
    expect(m.html).toContain('Synthèse du portefeuille');
    expect(m.html).toContain('Anomalies de synchronisation');
    expect(m.html).toContain('CDU');
    expect(m.html).not.toContain('—');
  });

  it('utilise les couleurs et la police de la charte', () => {
    const m = construireRecapitulatif(donneesCsp, 'https://app.test');
    expect(m.html).toContain('#0E2A42');
    expect(m.html).toContain('#2784C6');
    expect(m.html).toContain('#B2B2B1');
    expect(m.html).toContain('Century Gothic');
  });
});
