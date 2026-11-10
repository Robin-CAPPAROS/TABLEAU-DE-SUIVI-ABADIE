import type { ISODate } from './types';

// Arithmétique calendaire en UTC, sans dépendance : une date ISO YYYY-MM-DD
// est lue et reconstruite sans passer par le fuseau local.

function versDate(d: ISODate): Date {
  const [annee, mois, jour] = d.split('-').map(Number);
  return new Date(Date.UTC(annee, mois - 1, jour));
}

function versIso(date: Date): ISODate {
  const annee = String(date.getUTCFullYear()).padStart(4, '0');
  const mois = String(date.getUTCMonth() + 1).padStart(2, '0');
  const jour = String(date.getUTCDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

export function ajouterJours(d: ISODate, n: number): ISODate {
  const date = versDate(d);
  date.setUTCDate(date.getUTCDate() + n);
  return versIso(date);
}

export function finDeMois(annee: number, mois: number): ISODate {
  // Le jour 0 du mois suivant est le dernier jour du mois demandé (mois de 1 à 12).
  const dernier = new Date(Date.UTC(annee, mois, 0));
  return versIso(dernier);
}

export function ajouterMois(d: ISODate, n: number): ISODate {
  const [annee, mois, jour] = d.split('-').map(Number);
  const indexCible = mois - 1 + n;
  const anneeCible = annee + Math.floor(indexCible / 12);
  const moisCible = ((indexCible % 12) + 12) % 12 + 1;
  const dernierJourOrigine = Number(finDeMois(annee, mois).slice(8));
  const dernierJourCible = Number(finDeMois(anneeCible, moisCible).slice(8));
  const jourCible = jour === dernierJourOrigine ? dernierJourCible : Math.min(jour, dernierJourCible);
  return versIso(new Date(Date.UTC(anneeCible, moisCible - 1, jourCible)));
}

function estWeekEnd(d: ISODate): boolean {
  const jourSemaine = versDate(d).getUTCDay();
  return jourSemaine === 0 || jourSemaine === 6;
}

export function reporterJourOuvre(d: ISODate, feries: ISODate[]): ISODate {
  let courant = d;
  while (estWeekEnd(courant) || feries.includes(courant)) {
    courant = ajouterJours(courant, 1);
  }
  return courant;
}

export function dateDuJourParis(maintenant: Date): ISODate {
  const parties = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(maintenant);
  const lire = (type: string) => parties.find((p) => p.type === type)?.value ?? '';
  return `${lire('year')}-${lire('month')}-${lire('day')}`;
}

export function estDansFenetre(d: ISODate, aujourdhui: ISODate, horizonMois: number): boolean {
  return d >= ajouterJours(aujourdhui, -60) && d <= ajouterMois(aujourdhui, horizonMois);
}
