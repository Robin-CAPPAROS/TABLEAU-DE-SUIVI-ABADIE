import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import FicheDossierPage from './FicheDossier';
import { useMoi } from '@/auth/SessionProvider';
import { listerCollaborateurs } from '@/data/echeances';
import { majDateCible } from '@/data/exercices';
import { lireDossier, listerEcheancesDossier, majDossierOutil, type Dossier } from '@/data/dossiers';
import { echeance, exercice, MOI_CSP, MOI_MANAGER } from '@/test/fixtures';

vi.mock('@/auth/SessionProvider', () => ({ useMoi: vi.fn() }));
vi.mock('@/data/echeances', () => ({
  listerCollaborateurs: vi.fn(),
  marquerEcheance: vi.fn(),
  confirmerPaiement: vi.fn(),
  qualifierRetard: vi.fn(),
}));
vi.mock('@/data/exercices', () => ({ majDateCible: vi.fn() }));
vi.mock('@/data/dossiers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/dossiers')>()),
  lireDossier: vi.fn(),
  listerEcheancesDossier: vi.fn(),
  majDossierOutil: vi.fn(),
}));

const DOSSIER: Dossier = {
  id: 'd1', pennylane_id: 1001, raison_sociale: 'Société Fictive', siren: '123456789', forme_juridique: 'SAS',
  regime_tva: 'mensuel', categorie_fiscale: 'IS', regime_fiscal: 'réel normal', csp_id: 'c1', senior_id: 's1',
  manager_id: 'm1', equipe: 2, mission: 'revision', statut: 'actif', jour_echeance_tva: 20,
  is_n1_superieur_3000: false, commentaire: 'Client exigeant',
};

function rendre() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/dossiers/d1']}>
        <Routes>
          <Route path="/dossiers/:id" element={<FicheDossierPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useMoi).mockReturnValue({ moi: MOI_MANAGER, chargement: false });
  vi.mocked(listerCollaborateurs).mockResolvedValue([
    { id: 'c1', trigramme: 'CTE', prenom: 'Camille', nom: 'Test' },
    { id: 's1', trigramme: 'STE', prenom: 'Sam', nom: 'Test' },
    { id: 'm1', trigramme: 'MTE', prenom: 'Manon', nom: 'Test' },
  ]);
  vi.mocked(lireDossier).mockResolvedValue({
    dossier: DOSSIER,
    exercices: [
      exercice({ id: 'x0', date_fin: '2025-12-31', etape_actuelle: 6 }),
      exercice({ id: 'x1', date_fin: '2026-12-31', etape_actuelle: 4, date_cible: '2027-03-31' }),
    ],
    historique: [
      { id: 'h1', exercice_id: 'x1', etape: 6, sens: 'validation', date: '2026-11-10T01:15:00Z', auteur_id: null, commentaire: null },
      { id: 'h2', exercice_id: 'x1', etape: 4, sens: 'retour', date: '2026-11-09T10:00:00Z', auteur_id: 'm1', commentaire: 'Pièces manquantes' },
      { id: 'h0', exercice_id: 'x0', etape: 3, sens: 'validation', date: '2026-02-01T10:00:00Z', auteur_id: 's1', commentaire: null },
    ],
  });
  vi.mocked(listerEcheancesDossier).mockResolvedValue([echeance({ id: 'e1', type: 'is_solde' })]);
});

test('affiche le lien Pennylane, Pennylane comme auteur automatique et les retours', async () => {
  rendre();
  const lien = await screen.findByRole('link', { name: /Pennylane/ });
  expect(lien).toHaveAttribute('href', 'https://app.pennylane.com/companies/1001');
  const histo = await screen.findByRole('list', { name: "Historique des étapes" });
  expect(within(histo).getByText(/Pennylane/)).toBeInTheDocument();
  expect(within(histo).getByText(/10\/11\/2026 à 02:15/)).toBeInTheDocument();
  expect(within(histo).getByText(/Retour à : Supervision validée/)).toBeInTheDocument();
  expect(within(histo).queryByText(/STE/)).not.toBeInTheDocument();
  expect(screen.getByText('Solde d\'IS')).toBeInTheDocument();
});

test('un Senior ne voit pas le bouton Modifier', async () => {
  vi.mocked(useMoi).mockReturnValue({ moi: { ...MOI_CSP, role: 'senior' }, chargement: false });
  rendre();
  await screen.findByText('Client exigeant');
  expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();
});

test('un manager modifie les champs outil et les dates', async () => {
  vi.mocked(majDossierOutil).mockResolvedValue();
  vi.mocked(majDateCible).mockResolvedValue();
  rendre();
  fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
  fireEvent.change(screen.getByLabelText('Commentaire'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Équipe'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
  await waitFor(() =>
    expect(majDossierOutil).toHaveBeenCalledWith('d1', { equipe: 3, mission: 'revision', statut: 'actif', jourTva: 20, isN1: false, commentaire: null }),
  );
  fireEvent.change(await screen.findByLabelText('Date cible'), { target: { value: '2027-04-15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les dates' }));
  await waitFor(() => expect(majDateCible).toHaveBeenCalledWith('x1', '2027-04-15', null));
});

test('affiche l\'erreur de la fonction SQL', async () => {
  vi.mocked(majDossierOutil).mockRejectedValue({ message: 'Le jour de TVA doit être compris entre 15 et 24.' });
  rendre();
  fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Le jour de TVA doit être compris entre 15 et 24.');
});
