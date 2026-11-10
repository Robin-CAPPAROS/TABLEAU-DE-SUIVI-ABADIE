export { formaterDate, formaterDateLongue } from '@shared/format';

const formatHeureParis = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Horodatage ISO (UTC) affiché à Europe/Paris : « 10/11/2026 à 02:15 ». */
export function formaterDateHeureParis(iso: string): string {
  const p: Record<string, string> = {};
  for (const part of formatHeureParis.formatToParts(new Date(iso))) p[part.type] = part.value;
  return `${p.day}/${p.month}/${p.year} à ${p.hour}:${p.minute}`;
}

const formatNombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** Nombre au format français (virgule décimale) ; « n/d » si la valeur est absente. */
export function formaterNombre(n: number | null | undefined): string {
  return n === null || n === undefined ? 'n/d' : formatNombre.format(n);
}

/** Pourcentage au format français : « 33,3 % ». */
export function formaterPourcentage(n: number | null | undefined): string {
  return n === null || n === undefined ? 'n/d' : `${formatNombre.format(n)} %`;
}

/** Saison fiscale d'une date ISO : année de la date plus 3 mois (miroir de saison_fiscale en SQL). */
export function saisonFiscale(iso: string): number {
  const [a, m] = iso.split('-').map(Number);
  return m >= 10 ? a + 1 : a;
}
