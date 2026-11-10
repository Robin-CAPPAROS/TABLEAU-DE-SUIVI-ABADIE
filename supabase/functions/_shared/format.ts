// Formats de date français. TypeScript pur, sans import : utilisable aussi par les fonctions Deno.

const formatCourt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const formatLong = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** "2026-11-19" -> "19/11/2026" */
export function formaterDate(iso: string): string {
  return formatCourt.format(new Date(iso + 'T00:00:00Z'));
}

/** "2026-11-16" -> "lundi 16 novembre 2026" */
export function formaterDateLongue(iso: string): string {
  return formatLong.format(new Date(iso + 'T00:00:00Z'));
}
