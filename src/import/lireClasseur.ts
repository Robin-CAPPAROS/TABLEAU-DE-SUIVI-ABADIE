export interface ClasseurLu {
  lignesSuivi: Record<string, unknown>[];
  lignesSources: unknown[][];
}

/**
 * Lit le classeur de suivi : « Suivi compta » (lignes indexées par l'en-tête de la ligne 1, toutes les lignes
 * de 2 à la dernière, vides comprises) et « Source listes » (tableaux de valeurs brutes, en-tête compris).
 */
export async function lireClasseur(fichier: ArrayBuffer): Promise<ClasseurLu> {
  const { default: ExcelJS } = await import('exceljs');
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(fichier);

  const suivi = classeur.getWorksheet('Suivi compta');
  if (!suivi) throw new Error('Feuille « Suivi compta » introuvable dans le classeur.');
  const sources = classeur.getWorksheet('Source listes');

  const entetes: string[] = [];
  suivi.getRow(1).eachCell({ includeEmpty: false }, (cellule, col) => {
    entetes[col] = String(cellule.text ?? '').trim();
  });

  const lignesSuivi: Record<string, unknown>[] = [];
  for (let i = 2; i <= suivi.rowCount; i++) {
    const ligne: Record<string, unknown> = {};
    suivi.getRow(i).eachCell({ includeEmpty: false }, (cellule, col) => {
      const cle = entetes[col];
      if (cle) ligne[cle] = cellule.value;
    });
    lignesSuivi.push(ligne);
  }

  const lignesSources: unknown[][] = [];
  if (sources) {
    for (let i = 1; i <= sources.rowCount; i++) {
      const valeurs = sources.getRow(i).values as unknown[];
      lignesSources.push(Array.from({ length: Math.max(valeurs.length - 1, 0) }, (_, k) => valeurs[k + 1]));
    }
  }
  return { lignesSuivi, lignesSources };
}
