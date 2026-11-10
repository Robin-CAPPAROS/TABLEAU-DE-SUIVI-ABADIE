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
