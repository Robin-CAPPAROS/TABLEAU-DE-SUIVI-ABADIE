import type { Mission } from '@domain/types';

export interface DossierImport {
  siren: string; raisonSociale: string; equipe: 1 | 2 | 3 | null; mission: Mission | null;
  statut: 'actif' | 'sorti'; jourEcheanceTva: number | null; isN1Superieur3000: boolean | null;
  commentaire: string | null;
}
export interface CollaborateurImport { prenom: string; nom: string; trigramme: string; nomPennylane: string }
export interface LigneRapport { ligne: number; champ: string; valeur: string; message: string }
export interface ResultatAnalyse { dossiers: DossierImport[]; collaborateurs: CollaborateurImport[]; rapport: LigneRapport[] }

/** Valeur de cellule normalisée : texte nettoyé ou chaîne vide ; `erreur` vrai pour une cellule en erreur (#...). */
function cellule(v: unknown): { texte: string; erreur: boolean } {
  let x: unknown = v;
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if ('error' in o) return { texte: String(o.error ?? '#'), erreur: true };
    if ('result' in o) x = o.result;
    else if (Array.isArray(o.richText)) x = o.richText.map((p) => String((p as { text?: unknown }).text ?? '')).join('');
    else if (typeof o.text === 'string') x = o.text;
    else x = '';
    if (x && typeof x === 'object') {
      const e = x as Record<string, unknown>;
      return 'error' in e ? { texte: String(e.error ?? '#'), erreur: true } : { texte: '', erreur: false };
    }
  }
  if (x === null || x === undefined) return { texte: '', erreur: false };
  if (x instanceof Date) return { texte: x.toISOString().slice(0, 10), erreur: false };
  const t = String(x).trim();
  return t.startsWith('#') ? { texte: t, erreur: true } : { texte: t, erreur: false };
}

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function mapperMission(texte: string): { mission: Mission | null; sorti: boolean; inconnue: boolean } {
  const k = sansAccent(texte);
  if (k === 'sorti') return { mission: null, sorti: true, inconnue: false };
  if (k === 'tenue comptable') return { mission: 'tenue', sorti: false, inconnue: false };
  if (k === 'revision') return { mission: 'revision', sorti: false, inconnue: false };
  if (k === 'micro bnc' || k === 'micro') return { mission: 'micro_bnc', sorti: false, inconnue: false };
  if (k === 'irpp') return { mission: 'irpp', sorti: false, inconnue: false };
  return { mission: null, sorti: false, inconnue: true };
}

function enNombre(texte: string): number | null {
  if (!/^\d+([.,]0+)?$/.test(texte)) return null;
  return Number(texte.replace(',', '.'));
}

export function analyserClasseur(lignesSuivi: Record<string, unknown>[], lignesSources: unknown[][]): ResultatAnalyse {
  const dossiers: DossierImport[] = [];
  const rapport: LigneRapport[] = [];

  lignesSuivi.forEach((brut, idx) => {
    const ligne = idx + 2;
    const note = (champ: string, valeur: string, message: string) => rapport.push({ ligne, champ, valeur, message });
    // Lecture d'un champ ; une cellule en erreur est vide et signalée.
    const lire = (champ: string): string => {
      const c = cellule(brut[champ]);
      if (c.erreur) { note(champ, c.texte, `Cellule en erreur : ${c.texte}`); return ''; }
      return c.texte;
    };

    const sirenBrut = lire('Siren').replace(/\s+/g, '');
    const raison = lire('Raison Sociale');
    if (!/^\d{1,9}$/.test(sirenBrut)) {
      note('Siren', sirenBrut, sirenBrut === '' ? 'SIREN absent : ligne ignorée' : 'SIREN invalide : ligne ignorée');
      return;
    }
    const siren = sirenBrut.padStart(9, '0');

    let equipe: 1 | 2 | 3 | null = null;
    const eq = lire('Equipe');
    if (eq !== '') {
      const n = enNombre(eq);
      if (n === 1 || n === 2 || n === 3) equipe = n;
      else note('Equipe', eq, `Équipe non prévue : ${eq}`);
    }

    let mission: Mission | null = null;
    let statut: 'actif' | 'sorti' = 'actif';
    const mi = lire('Mission');
    if (mi !== '') {
      const m = mapperMission(mi);
      mission = m.mission;
      if (m.sorti) statut = 'sorti';
      if (m.inconnue) note('Mission', mi, `Mission non prévue : ${mi}`);
    }

    let jour: number | null = null;
    const ja = lire("Date d'échéance");
    if (ja !== '' && sansAccent(ja) !== 'non applicable') {
      const n = enNombre(ja);
      if (n !== null && n >= 15 && n <= 24) jour = n;
      else note("Date d'échéance", ja, `Jour d'échéance TVA non prévu : ${ja}`);
    }

    let is: boolean | null = null;
    const isv = lire('IS N-1>3000 €');
    if (isv !== '') {
      if (isv.toUpperCase() === 'OUI') is = true;
      else if (isv.toUpperCase() === 'NON') is = false;
      else note('IS N-1>3000 €', isv, `Valeur IS N-1 non prévue : ${isv}`);
    }

    const com = lire('Commentaire');
    dossiers.push({ siren, raisonSociale: raison, equipe, mission, statut, jourEcheanceTva: jour,
      isN1Superieur3000: is, commentaire: com === '' ? null : com });
  });

  return { dossiers, collaborateurs: extraireCollaborateurs(lignesSources), rapport };
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const casseTitre = (s: string) => s.split('-').map(majuscule).join('-');

function extraireCollaborateurs(lignes: unknown[][]): CollaborateurImport[] {
  if (lignes.length === 0) return [];
  const entete = lignes[0].map((c) => cellule(c).texte);
  // Paires (colonne nom, colonne trigramme suivante).
  const paires: [number, number][] = [];
  entete.forEach((h, i) => {
    const k = sansAccent(h);
    if ((k === 'prenom nom junior' || k === 'prenom nom senior') && sansAccent(entete[i + 1] ?? '') === 'trigramme') {
      paires.push([i, i + 1]);
    }
  });
  const vus = new Set<string>();
  const res: CollaborateurImport[] = [];
  for (const row of lignes.slice(1)) {
    for (const [cn, ct] of paires) {
      const nomComplet = cellule(row[cn]).texte.replace(/\s+/g, ' ');
      const tri = cellule(row[ct]).texte;
      if (nomComplet === '' || tri === '' || nomComplet.startsWith('#') || tri.startsWith('#')) continue;
      if (vus.has(tri)) continue;
      vus.add(tri);
      const mots = nomComplet.split(' ');
      const prenom = casseTitre(mots[0]);
      const nom = mots.slice(1).join(' ').toUpperCase();
      res.push({ prenom, nom, trigramme: tri, nomPennylane: `${prenom} ${nom}`.trim() });
    }
  }
  return res;
}
