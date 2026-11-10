// Libellés de formes juridiques et catégories fiscales (valeurs saisies ou importées).

export function codeForme(libelle: string | null): string | null {
  if (libelle === null) return null;
  const texte = libelle.trim();
  if (texte === '') return null;

  const groupes = [...texte.matchAll(/\(([^()]*)\)/g)];
  const dernier = groupes.length > 0 ? groupes[groupes.length - 1][1].trim() : '';
  if (dernier !== '') return dernier.toUpperCase();

  return texte.replace(/\s+/g, ' ').toUpperCase();
}

export function estIS(categorie: string | null): boolean {
  if (categorie === null) return false;
  return /(^|_)is$/.test(categorie);
}
