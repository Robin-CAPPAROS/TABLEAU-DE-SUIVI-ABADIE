// Verification a temps constant de l'en-tete Authorization : "Bearer <secret>".
export function verifierCle(entete: string | null, secret: string): boolean {
  if (entete === null || secret === '') return false;
  const attendu = `Bearer ${secret}`;
  const longueur = Math.max(entete.length, attendu.length);
  let diff = entete.length ^ attendu.length;
  for (let i = 0; i < longueur; i++) {
    diff |= (entete.charCodeAt(i) || 0) ^ (attendu.charCodeAt(i) || 0);
  }
  return diff === 0;
}
