import type {
  AnomalieGeneration, DossierRegles, EcheanceGeneree, ExerciceRegles, ISODate,
  ParametresFiscaux, ResultatGeneration, TypeEcheance,
} from './types.ts';
import {
  ajouterJours, ajouterMois, calendrierPertinent, estDansFenetre, reporterJourOuvre,
} from './dates.ts';
import { codeForme, estIS } from './formes.ts';

const MOIS_ACOMPTES = ['03', '06', '09', '12'];

export function trierEcheances(echeances: EcheanceGeneree[]): EcheanceGeneree[] {
  return echeances.sort((a, b) =>
    a.dateLimite < b.dateLimite ? -1 : a.dateLimite > b.dateLimite ? 1
      : a.type < b.type ? -1 : a.type > b.type ? 1 : 0);
}

export function genererEcheancesExercice(
  d: DossierRegles,
  e: ExerciceRegles,
  p: ParametresFiscaux,
  aujourdhui: ISODate,
  horizonMois: number,
): ResultatGeneration {
  const echeances: EcheanceGeneree[] = [];
  const anomalies: AnomalieGeneration[] = [];
  const ajouter = (type: TypeEcheance, brute: ISODate) => {
    const dateLimite = reporterJourOuvre(brute, p.feries);
    if (estDansFenetre(dateLimite, aujourdhui, horizonMois)) {
      echeances.push({
        dossierId: d.id, exerciceId: e.id, type,
        periodeDebut: e.dateDebut, periodeFin: e.dateFin, dateLimite,
      });
    }
  };

  const is = estIS(d.categorieFiscale);

  // Exercice de plus de 12 mois (signalé tant qu'il est récent).
  if (e.dateFin > ajouterJours(ajouterMois(e.dateDebut, 12), -1) && e.dateFin >= ajouterJours(aujourdhui, -60)) {
    anomalies.push({
      dossierId: d.id, type: 'exercice_long', cle: e.dateFin,
      message: `Exercice du ${e.dateDebut} au ${e.dateFin} de plus de 12 mois : vérifier les échéances générées.`,
    });
  }

  // Liasse et solde d'IS.
  const liasse = d.mission !== 'irpp' && d.mission !== 'micro_bnc';
  if (liasse || is) {
    const cloture3112 = e.dateFin.slice(5) === '12-31';
    let brutLiasse: ISODate | null;
    let brutSolde: ISODate | null;
    if (cloture3112) {
      const annee = Number(e.dateFin.slice(0, 4)) + 1;
      const calendrier = p.calendriers.find((c) => c.annee === annee);
      if (calendrier === undefined) {
        if (calendrierPertinent(annee, aujourdhui, horizonMois)) anomalies.push({
          dossierId: d.id, type: 'calendrier_absent', cle: String(annee),
          message: `Calendrier fiscal ${annee} absent : liasse et solde d'IS de l'exercice clos le ${e.dateFin} non générés.`,
        });
        brutLiasse = null;
        brutSolde = null;
      } else {
        brutLiasse = calendrier.dateLiasse3112;
        brutSolde = calendrier.dateSoldeIs3112;
      }
    } else {
      brutLiasse = ajouterJours(ajouterMois(e.dateFin, 3), 15);
      brutSolde = `${ajouterMois(e.dateFin, 4).slice(0, 8)}15`;
    }
    if (liasse && brutLiasse !== null) ajouter('liasse', brutLiasse);
    if (is && brutSolde !== null) ajouter('is_solde', brutSolde);
  }

  // Acomptes d'IS, numérotés selon leur rang dans l'exercice (avant filtrage de fenêtre).
  if (is && d.isN1Superieur3000) {
    const anneeDebut = Number(e.dateDebut.slice(0, 4));
    const anneeFin = Number(e.dateFin.slice(0, 4));
    const dates: ISODate[] = [];
    for (let annee = anneeDebut; annee <= anneeFin; annee++) {
      for (const mois of MOIS_ACOMPTES) {
        const jour = `${annee}-${mois}-15`;
        if (jour >= e.dateDebut && jour <= e.dateFin) dates.push(jour);
      }
    }
    dates.slice(0, 4).forEach((jour, i) => ajouter(`is_acompte_${i + 1}` as TypeEcheance, jour));
  }

  // Approbation des comptes et dépôt au greffe.
  const code = codeForme(d.formeJuridique);
  const forme = code === null ? undefined : p.formes.find((f) => f.code === code);
  if (forme === undefined) {
    anomalies.push({
      dossierId: d.id, type: 'forme_inconnue', cle: code ?? '',
      message: code === null
        ? 'Forme juridique non renseignée : approbation et dépôt au greffe non générés.'
        : `Forme juridique ${code} inconnue : approbation et dépôt au greffe non générés.`,
    });
  } else {
    if (forme.approbation) ajouter('approbation', ajouterMois(e.dateFin, 6));
    if (forme.depotGreffe) {
      const base = e.dateApprobation ?? reporterJourOuvre(ajouterMois(e.dateFin, 6), p.feries);
      ajouter('depot_greffe', ajouterMois(base, p.delaiGreffeMois));
    }
  }

  return { echeances: trierEcheances(echeances), anomalies };
}
