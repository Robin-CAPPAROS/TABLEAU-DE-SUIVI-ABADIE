import { describe, expect, it } from 'vitest';
import { analyserClasseur } from '@/import/analyserClasseur';

const ligne = { 'Raison Sociale': 'ALPHA', Siren: 44229590, Equipe: 1, Mission: 'Tenue Comptable',
  "Date d'échéance": 24, 'IS N-1>3000 €': 'NON ', Commentaire: null };

describe('analyserClasseur : Suivi compta', () => {
  it('complète le SIREN', () => {
    const r = analyserClasseur([ligne], []);
    expect(r.dossiers[0]).toMatchObject({ siren: '044229590', mission: 'tenue', jourEcheanceTva: 24, isN1Superieur3000: false,
      equipe: 1, statut: 'actif', commentaire: null, raisonSociale: 'ALPHA' });
    expect(r.rapport).toEqual([]);
  });
  it('ignore une ligne sans SIREN avec rapport', () => {
    const r = analyserClasseur([{ ...ligne, Siren: null }], []);
    expect(r.dossiers).toEqual([]);
    expect(r.rapport[0]).toMatchObject({ ligne: 2, champ: 'Siren' });
  });
  it('mappe les missions sans tenir compte de la casse ni des accents', () => {
    const m = (v: string) => analyserClasseur([{ ...ligne, Mission: v }], []).dossiers[0].mission;
    expect(m('Révision')).toBe('revision');
    expect(m('REVISION')).toBe('revision');
    expect(m('MICRO BNC')).toBe('micro_bnc');
    expect(m('Micro')).toBe('micro_bnc');
    expect(m('irpp')).toBe('irpp');
  });
  it('Sorti donne statut sorti et mission nulle', () => {
    expect(analyserClasseur([{ ...ligne, Mission: 'Sorti' }], []).dossiers[0]).toMatchObject({ statut: 'sorti', mission: null });
  });
  it('mission non prévue', () => {
    const r = analyserClasseur([{ ...ligne, Mission: 'Social' }], []);
    expect(r.rapport[0].message).toBe('Mission non prévue : Social');
    expect(r.dossiers[0].mission).toBeNull();
  });
  it('cellule en erreur : vide avec rapport', () => {
    const r = analyserClasseur([{ ...ligne, 'IS N-1>3000 €': '#VALUE!' }], []);
    expect(r.dossiers[0].isN1Superieur3000).toBeNull();
    expect(r.rapport).toHaveLength(1);
    const r2 = analyserClasseur([{ ...ligne, 'IS N-1>3000 €': { error: '#VALUE!' } }], []);
    expect(r2.dossiers[0].isN1Superieur3000).toBeNull();
    expect(r2.rapport).toHaveLength(1);
  });
  it('IS OUI/NON, autre valeur nulle avec rapport', () => {
    expect(analyserClasseur([{ ...ligne, 'IS N-1>3000 €': ' OUI' }], []).dossiers[0].isN1Superieur3000).toBe(true);
    const r = analyserClasseur([{ ...ligne, 'IS N-1>3000 €': 'peut-être' }], []);
    expect(r.dossiers[0].isN1Superieur3000).toBeNull();
    expect(r.rapport).toHaveLength(1);
  });
  it('jour TVA', () => {
    const j = (v: unknown) => analyserClasseur([{ ...ligne, "Date d'échéance": v }], []);
    expect(j('Non applicable').dossiers[0].jourEcheanceTva).toBeNull();
    expect(j('Non applicable').rapport).toEqual([]);
    expect(j(14).dossiers[0].jourEcheanceTva).toBeNull();
    expect(j(14).rapport).toHaveLength(1);
    expect(j('abc').rapport).toHaveLength(1);
    expect(j(15).dossiers[0].jourEcheanceTva).toBe(15);
    expect(j({ result: 20 }).dossiers[0].jourEcheanceTva).toBe(20);
  });
  it('équipe', () => {
    const r = analyserClasseur([{ ...ligne, Equipe: 4 }], []);
    expect(r.dossiers[0].equipe).toBeNull();
    expect(r.rapport).toHaveLength(1);
    expect(analyserClasseur([{ ...ligne, Equipe: '2' }], []).dossiers[0].equipe).toBe(2);
  });
  it('commentaire et texte enrichi', () => {
    const r = analyserClasseur([{ ...ligne, Commentaire: { richText: [{ text: 'a' }, { text: 'b' }] } }], []);
    expect(r.dossiers[0].commentaire).toBe('ab');
  });
  it('numéro de ligne Excel', () => {
    const r = analyserClasseur([ligne, { ...ligne, Siren: '12345678', Equipe: 9 }], []);
    expect(r.rapport[0].ligne).toBe(3);
  });
});

describe('analyserClasseur : Source listes', () => {
  const sources = [['Prénom Nom Junior', 'Trigramme', 'Tx', 'Prénom Nom Senior', 'Trigramme'],
                   ['amina ouihaka', 'AOU', 40, 'azer horrigue', 'AHO'], ['amina ouihaka', 'AOU', 40, null, null]];
  it('extrait et dédoublonne les collaborateurs', () => {
    expect(analyserClasseur([], sources).collaborateurs).toEqual([
      { prenom: 'Amina', nom: 'OUIHAKA', trigramme: 'AOU', nomPennylane: 'Amina OUIHAKA' },
      { prenom: 'Azer', nom: 'HORRIGUE', trigramme: 'AHO', nomPennylane: 'Azer HORRIGUE' }]);
  });
  it('prénoms composés et nom multiple', () => {
    const r = analyserClasseur([], [['Prénom Nom Junior', 'Trigramme'], ['jean-marc de la tour', 'JMT']]);
    expect(r.collaborateurs[0]).toEqual({ prenom: 'Jean-Marc', nom: 'DE LA TOUR', trigramme: 'JMT', nomPennylane: 'Jean-Marc DE LA TOUR' });
  });
  it('ignore les paires incomplètes', () => {
    const r = analyserClasseur([], [['Prénom Nom Junior', 'Trigramme'], ['x y', null], [null, 'ZZZ'], ['seul', 'SEU']]);
    expect(r.collaborateurs.map((c) => c.trigramme)).toEqual(['SEU']);
  });
});
