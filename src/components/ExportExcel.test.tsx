import { fireEvent, render, screen } from '@testing-library/react';

import { vi } from 'vitest';
import ExportExcel from './ExportExcel';
import { exporterExcel } from '@/lib/exportExcel';

vi.mock('@/lib/exportExcel', () => ({ exporterExcel: vi.fn() }));

test('appelle exporterExcel avec les lignes filtrées', async () => {
  const colonnes = [{ cle: 'dossier', libelle: 'Dossier' }];
  const lignes = [{ dossier: 'Société Fictive' }];
  render(<ExportExcel nomFichier="echeancier" colonnes={colonnes} lignes={lignes} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exporter en Excel' }));
  expect(exporterExcel).toHaveBeenCalledWith('echeancier', colonnes, lignes);
});
