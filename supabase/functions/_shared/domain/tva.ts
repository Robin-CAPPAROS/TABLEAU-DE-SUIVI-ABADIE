import type {
  AnomalieGeneration, DossierRegles, EcheanceGeneree, ExerciceRegles, ISODate,
  ParametresFiscaux, ResultatGeneration, TypeEcheance,
} from './types.ts';
import {
  ajouterJours, ajouterMois, calendrierPertinent, estDansFenetre, finDeMois, reporterJourOuvre,
} from './dates.ts';
import { trierEcheances } from './exercice.ts';

const deuxChiffres = (n: number) => String(n).padStart(2, '0');

// Dernier jour (plafonné) du mois, puis report au prochain jour ouvré.
function limiteAuJour(annee: number, mois: number, jour: number, feries: ISODate[]): ISODate {
  const dernier = Number(finDeMois(annee, mois).slice(8));
  const brute = `${annee}-${deuxChiffres(mois)}-${deuxChiffres(Math.min(jour, dernier))}`;
  return reporterJourOuvre(brute, feries);
}

// Décale (annee, mois) de n mois.
function decaler(annee: number, mois: number, n: number): [number, number] {
  const index = annee * 12 + (mois - 1) + n;
  return [Math.floor(index / 12), (index % 12) + 1];
}

export function genererTva(
  d: DossierRegles,
  exercices: ExerciceRegles[],
  p: ParametresFiscaux,
  aujourdhui: ISODate,
  horizonMois: number,
): ResultatGeneration {
  const echeances: EcheanceGeneree[] = [];
  const anomalies: AnomalieGeneration[] = [];
  const regime = d.regimeTva;
  if (regime === null || regime === 'non_assujetti') return { echeances, anomalies };

  const dansFenetre = (limite: ISODate) => estDansFenetre(limite, aujourdhui, horizonMois);
  const ajouter = (
    type: TypeEcheance, exerciceId: string | null,
    periodeDebut: ISODate, periodeFin: ISODate, dateLimite: ISODate,
  ) => {
    if (dansFenetre(dateLimite)) {
      echeances.push({ dossierId: d.id, exerciceId, type, periodeDebut, periodeFin, dateLimite });
    }
  };

  // Plage de mois candidats, large pour couvrir la fenêtre quel que soit le décalage de limite.
  const debut = ajouterMois(ajouterJours(aujourdhui, -60), -3);
  const fin = ajouterMois(aujourdhui, horizonMois);
  const indexMois = (d: ISODate) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;
  const premier = indexMois(debut);
  const dernier = indexMois(fin);

  const jour = d.jourEcheanceTva;
  if (jour === null) {
    anomalies.push({
      dossierId: d.id, type: 'jour_tva_absent', cle: '',
      message: "Jour d'échéance de TVA non renseigné : échéances de TVA périodiques non générées.",
    });
  } else {
    for (let index = premier; index <= dernier; index++) {
      const annee = Math.floor(index / 12);
      const mois = (index % 12) + 1;
      const debutMois = `${annee}-${deuxChiffres(mois)}-01`;
      if (regime === 'mensuel') {
        const [a, m] = decaler(annee, mois, 1);
        ajouter('tva_mensuelle', null, debutMois, finDeMois(annee, mois), limiteAuJour(a, m, jour, p.feries));
      } else if (regime === 'trimestriel' && (mois - 1) % 3 === 0) {
        const [a, m] = decaler(annee, mois, 3);
        ajouter('tva_trimestrielle', null, debutMois, finDeMois(...decaler(annee, mois, 2)), limiteAuJour(a, m, jour, p.feries));
      } else if (regime === 'annuel' && (mois === 7 || mois === 12)) {
        ajouter(
          mois === 7 ? 'tva_ca12_acompte_juillet' : 'tva_ca12_acompte_decembre',
          null, debutMois, finDeMois(annee, mois), limiteAuJour(annee, mois, jour, p.feries),
        );
      }
    }
  }

  if (regime === 'annuel') {
    for (const ex of exercices) {
      let limite: ISODate | null;
      if (ex.dateFin.slice(5) === '12-31') {
        const annee = Number(ex.dateFin.slice(0, 4)) + 1;
        const calendrier = p.calendriers.find((c) => c.annee === annee);
        if (calendrier === undefined) {
          if (calendrierPertinent(annee, aujourdhui, horizonMois)) anomalies.push({
            dossierId: d.id, type: 'calendrier_absent', cle: String(annee),
            message: `Calendrier fiscal ${annee} absent : CA12 de l'exercice clos le ${ex.dateFin} non générée.`,
          });
          limite = null;
        } else {
          limite = reporterJourOuvre(calendrier.dateCa12_3112, p.feries);
        }
      } else {
        limite = reporterJourOuvre(ajouterMois(ex.dateFin, 3), p.feries);
      }
      if (limite !== null) ajouter('tva_ca12_annuelle', ex.id, ex.dateDebut, ex.dateFin, limite);
    }
  }

  return { echeances: trierEcheances(echeances), anomalies };
}
