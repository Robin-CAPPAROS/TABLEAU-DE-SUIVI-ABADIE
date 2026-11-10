import { formaterDate, formaterDateLongue } from '../format.ts';

export interface LigneRecap {
  dossierId: string;
  raisonSociale: string;
  type: string;
  dateLimite: string;
}

export interface LigneExerciceRecap {
  dossierId: string;
  raisonSociale: string;
  dateCible: string;
  etapeActuelle: number;
}

export interface DonneesRecap {
  collaborateur: { prenom: string; role: string };
  semaineDu: string;
  echeances7j: LigneRecap[];
  echeancesEnRetard: LigneRecap[];
  alertesPaiement: LigneRecap[];
  exercicesEnRetard: LigneExerciceRecap[];
  synthese: { trigramme: string; echeances: number; retards: number; alertes: number }[] | null;
  fileSupervision: LigneExerciceRecap[] | null;
  anomaliesOuvertes: number | null;
}

const LIBELLES_TYPES: Record<string, string> = {
  tva_mensuelle: 'TVA mensuelle',
  tva_trimestrielle: 'TVA trimestrielle',
  tva_ca12_acompte_juillet: 'Acompte de TVA CA12 de juillet',
  tva_ca12_acompte_decembre: 'Acompte de TVA CA12 de décembre',
  tva_ca12_annuelle: 'TVA annuelle CA12',
  liasse: 'Liasse fiscale',
  is_acompte_1: 'Acompte d\'IS n° 1',
  is_acompte_2: 'Acompte d\'IS n° 2',
  is_acompte_3: 'Acompte d\'IS n° 3',
  is_acompte_4: 'Acompte d\'IS n° 4',
  is_solde: 'Solde d\'IS',
  approbation: 'Approbation des comptes',
  depot_greffe: 'Dépôt au greffe',
};

const MARINE = '#0E2A42';
const BLEU = '#2784C6';
const GRIS = '#B2B2B1';
// Apostrophes : la pile de polices est insérée dans des attributs style="...".
const POLICE = "'Century Gothic', 'CenturyGothic', 'AppleGothic', 'Questrial', sans-serif";
const MESSAGE_VIDE = 'Aucune échéance ni aucun retard cette semaine.';

function echapper(valeur: string | number): string {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function libelleType(type: string): string {
  return LIBELLES_TYPES[type] ?? type;
}

const STYLE_CELLULE = `padding:6px 8px;border-bottom:1px solid ${GRIS};text-align:left;font-size:14px;`;
const STYLE_ENTETE = `${STYLE_CELLULE}font-weight:bold;color:${MARINE};`;

function titre(texte: string): string {
  return `<h2 style="font-family:${POLICE};font-size:16px;font-weight:bold;color:${MARINE};margin:24px 0 8px 0;">${echapper(texte)}</h2>`;
}

function tableau(entetes: string[], lignes: string[][]): string {
  const tete = entetes.map((e) => `<th style="${STYLE_ENTETE}">${echapper(e)}</th>`).join('');
  const corps = lignes
    .map((cellules) => `<tr>${cellules.map((c) => `<td style="${STYLE_CELLULE}">${c}</td>`).join('')}</tr>`)
    .join('');
  return `<table style="border-collapse:collapse;width:100%;font-family:${POLICE};"><thead><tr>${tete}</tr></thead><tbody>${corps}</tbody></table>`;
}

function lien(url: string, dossierId: string, nom: string): string {
  return `<a href="${echapper(`${url}/dossiers/${dossierId}`)}" style="color:${BLEU};font-weight:bold;text-decoration:none;">${echapper(nom)}</a>`;
}

interface Section {
  titre: string;
  html: string;
  texte: string[];
}

function sectionEcheances(titreSection: string, lignes: LigneRecap[], url: string): Section | null {
  if (lignes.length === 0) return null;
  return {
    titre: titreSection,
    html: tableau(
      ['Dossier', 'Échéance', 'Date limite'],
      lignes.map((l) => [
        lien(url, l.dossierId, l.raisonSociale),
        echapper(libelleType(l.type)),
        echapper(formaterDate(l.dateLimite)),
      ]),
    ),
    texte: lignes.map(
      (l) => `- ${l.raisonSociale} : ${libelleType(l.type)}, ${formaterDate(l.dateLimite)} (${url}/dossiers/${l.dossierId})`,
    ),
  };
}

function sectionExercices(titreSection: string, lignes: LigneExerciceRecap[] | null, url: string): Section | null {
  if (!lignes || lignes.length === 0) return null;
  return {
    titre: titreSection,
    html: tableau(
      ['Dossier', 'Date cible', 'Étape actuelle'],
      lignes.map((l) => [
        lien(url, l.dossierId, l.raisonSociale),
        echapper(formaterDate(l.dateCible)),
        echapper(l.etapeActuelle),
      ]),
    ),
    texte: lignes.map(
      (l) =>
        `- ${l.raisonSociale} : date cible ${formaterDate(l.dateCible)}, étape ${l.etapeActuelle} (${url}/dossiers/${l.dossierId})`,
    ),
  };
}

function sectionSynthese(synthese: DonneesRecap['synthese']): Section | null {
  if (!synthese || synthese.length === 0) return null;
  return {
    titre: 'Synthèse du portefeuille',
    html: tableau(
      ['Collaborateur', 'Échéances de la semaine', 'Retards', 'Alertes'],
      synthese.map((s) => [
        `<strong>${echapper(s.trigramme)}</strong>`,
        echapper(s.echeances),
        echapper(s.retards),
        echapper(s.alertes),
      ]),
    ),
    texte: synthese.map(
      (s) => `- ${s.trigramme} : ${s.echeances} échéance(s), ${s.retards} retard(s), ${s.alertes} alerte(s)`,
    ),
  };
}

function sectionAnomalies(n: number | null): Section | null {
  if (n === null || n <= 0) return null;
  const phrase = n === 1 ? '1 anomalie ouverte.' : `${n} anomalies ouvertes.`;
  return {
    titre: 'Anomalies de synchronisation',
    html: `<p style="font-family:${POLICE};font-size:14px;margin:0;">${echapper(phrase)}</p>`,
    texte: [phrase],
  };
}

export function construireRecapitulatif(
  d: DonneesRecap,
  urlApplication: string,
): { sujet: string; html: string; texte: string } {
  const url = urlApplication.replace(/\/+$/, '');
  const sujet = `Suivi CPA & ABADIE : votre semaine du ${formaterDateLongue(d.semaineDu)}`;

  const sections = [
    sectionEcheances('Échéances des 7 prochains jours', d.echeances7j, url),
    sectionEcheances('Échéances en retard', d.echeancesEnRetard, url),
    sectionEcheances('Paiements de TVA non constatés', d.alertesPaiement, url),
    sectionExercices('Bilans en retard', d.exercicesEnRetard, url),
    sectionSynthese(d.synthese),
    sectionExercices('File de supervision', d.fileSupervision, url),
    sectionAnomalies(d.anomaliesOuvertes),
  ].filter((s): s is Section => s !== null);

  const salutation = `Bonjour ${d.collaborateur.prenom},`;
  const introduction = `Voici votre récapitulatif pour la semaine du ${formaterDateLongue(d.semaineDu)}.`;

  const corpsHtml =
    sections.length === 0
      ? `<p style="font-family:${POLICE};font-size:14px;margin:16px 0;">${echapper(MESSAGE_VIDE)}</p>`
      : sections.map((s) => titre(s.titre) + s.html).join('');

  const html =
    `<div style="font-family:${POLICE};color:${MARINE};max-width:720px;margin:0 auto;">` +
    `<div style="background:${MARINE};padding:16px;"><span style="font-family:${POLICE};font-size:18px;font-weight:bold;color:#FFFFFF;">Suivi CPA &amp; ABADIE</span></div>` +
    `<p style="font-family:${POLICE};font-size:14px;margin:16px 0 4px 0;">${echapper(salutation)}</p>` +
    `<p style="font-family:${POLICE};font-size:14px;margin:0;">${echapper(introduction)}</p>` +
    corpsHtml +
    `<p style="font-family:${POLICE};font-size:12px;color:${GRIS};border-top:1px solid ${GRIS};margin-top:24px;padding-top:8px;">Message automatique du tableau de suivi. <a href="${echapper(url)}" style="color:${BLEU};">Ouvrir l'application</a></p>` +
    `</div>`;

  const texteSections =
    sections.length === 0 ? [MESSAGE_VIDE] : sections.flatMap((s) => ['', s.titre.toUpperCase(), ...s.texte]);
  const texte = [salutation, introduction, ...texteSections, '', `Application : ${url}`].join('\n');

  return { sujet, html, texte };
}
