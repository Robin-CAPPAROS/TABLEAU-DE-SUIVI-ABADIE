// Planification du récapitulatif : lundi, 7 h (heure de Paris), une seule fois par jour.

const formatParis = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Paris',
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
});

export function doitEnvoyer(maintenant: Date, dejaEnvoyeAujourdhui: boolean): boolean {
  if (dejaEnvoyeAujourdhui) return false;
  const parties = formatParis.formatToParts(maintenant);
  const lire = (type: string) => parties.find((p) => p.type === type)?.value ?? '';
  return lire('weekday') === 'Mon' && Number(lire('hour')) === 7;
}
