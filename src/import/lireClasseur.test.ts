import ExcelJS from 'exceljs';
import { lireClasseur } from './lireClasseur';

async function fabriquer(): Promise<ArrayBuffer> {
  const c = new ExcelJS.Workbook();
  const s = c.addWorksheet('Suivi compta');
  s.addRow([' Nom ', 'SIREN', 'Mission']);
  s.addRow(['Société Fictive', '123456789', 'Révision']);
  s.addRow([]);
  s.addRow(['Autre', null, 'IRPP']);
  const l = c.addWorksheet('Source listes');
  l.addRow(['Code', 'Libellé']);
  l.addRow(['SARL', 'Société']);
  const tampon = await c.xlsx.writeBuffer();
  return tampon as ArrayBuffer;
}

test('lit les lignes de suivi par en-tête, lignes vides comprises, et les sources', async () => {
  const r = await lireClasseur(await fabriquer());
  expect(r.lignesSuivi).toHaveLength(3);
  expect(r.lignesSuivi[0]).toEqual({ Nom: 'Société Fictive', SIREN: '123456789', Mission: 'Révision' });
  expect(r.lignesSuivi[1]).toEqual({});
  expect(r.lignesSuivi[2]).toEqual({ Nom: 'Autre', Mission: 'IRPP' });
  expect(r.lignesSources).toEqual([['Code', 'Libellé'], ['SARL', 'Société']]);
});

test('feuille de suivi absente : erreur claire', async () => {
  const c = new ExcelJS.Workbook();
  c.addWorksheet('Autre');
  await expect(lireClasseur((await c.xlsx.writeBuffer()) as ArrayBuffer)).rejects.toThrow('Suivi compta');
});
