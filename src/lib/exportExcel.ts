export type ColonneExport = { cle: string; libelle: string };

/** Génère un classeur Excel et le télécharge via un lien temporaire. */
export async function exporterExcel(
  nomFichier: string,
  colonnes: ColonneExport[],
  lignes: Record<string, unknown>[],
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet('Export');
  feuille.columns = colonnes.map((c) => ({ header: c.libelle, key: c.cle, width: Math.max(14, c.libelle.length + 2) }));
  feuille.getRow(1).font = { bold: true };
  for (const l of lignes) feuille.addRow(l);
  const tampon = await classeur.xlsx.writeBuffer();
  const blob = new Blob([tampon], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier.endsWith('.xlsx') ? nomFichier : `${nomFichier}.xlsx`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}
