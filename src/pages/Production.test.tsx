import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import Production from './Production';
import { useMoi } from '@/auth/SessionProvider';
import { listerCollaborateurs } from '@/data/echeances';
import { listerExercices, revenirEtape, validerEtape } from '@/data/exercices';
import { exercice, MOI_CSP, MOI_MANAGER } from '@/test/fixtures';
import type { Moi } from '@/data/types';

vi.mock('@/auth/SessionProvider', () => ({ useMoi: vi.fn() }));
vi.mock('@/lib/exportExcel', () => ({ exporterExcel: vi.fn() }));
vi.mock('@/data/echeances', () => ({ listerCollaborateurs: vi.fn() }));
vi.mock('@/data/exercices', () => ({
  listerExercices: vi.fn(),
  validerEtape: vi.fn(),
  revenirEtape: vi.fn(),
  majDateCible: vi.fn(),
  planDeCharge: vi.fn(),
}));

const MOI_SENIOR: Moi = { id: 's1', prenom: 'Sam', nom: 'Test', trigramme: 'STE', role: 'senior', administrateur: false };

function rendre() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Production />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useMoi).mockReturnValue({ moi: MOI_SENIOR, chargement: false });
  vi.mocked(listerCollaborateurs).mockResolvedValue([
    { id: 'c1', trigramme: 'CTE', prenom: 'Camille', nom: 'Test' },
    { id: 's1', trigramme: 'STE', prenom: 'Sam', nom: 'Test' },
    { id: 'm1', trigramme: 'MTE', prenom: 'Manon', nom: 'Test' },
  ]);
});

test('un Senior valide l étape suivante d un exercice à l étape 2', async () => {
  vi.mocked(listerExercices).mockResolvedValue([exercice({ etape_actuelle: 2 })]);
  vi.mocked(validerEtape).mockResolvedValue();
  rendre();
  fireEvent.click(await screen.findByRole('button', { name: 'Valider : Révision terminée' }));
  await waitFor(() => expect(validerEtape).toHaveBeenCalledWith('x1', 3));
});

test('un CSP ne voit pas le bouton de validation de l étape 3', async () => {
  vi.mocked(useMoi).mockReturnValue({ moi: MOI_CSP, chargement: false });
  vi.mocked(listerExercices).mockResolvedValue([exercice({ etape_actuelle: 2 })]);
  rendre();
  expect(await screen.findByText('Société Fictive')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Valider/ })).not.toBeInTheDocument();
});

test('aucun bouton de validation à l étape 5 et pastille de retard', async () => {
  vi.mocked(listerExercices).mockResolvedValue([exercice({ etape_actuelle: 5, en_retard: true })]);
  rendre();
  expect(await screen.findByText('En retard')).toBeInTheDocument();
  expect(screen.getByText('En attente de la liasse')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Valider/ })).not.toBeInTheDocument();
});

test('l intervenant attendu affiche le trigramme', async () => {
  vi.mocked(listerExercices).mockResolvedValue([exercice({ etape_actuelle: 3 })]);
  rendre();
  expect(await screen.findByText('MTE')).toBeInTheDocument();
});

test('le retour à une étape exige un commentaire', async () => {
  vi.mocked(useMoi).mockReturnValue({ moi: MOI_MANAGER, chargement: false });
  vi.mocked(listerExercices).mockResolvedValue([exercice({ etape_actuelle: 3 })]);
  vi.mocked(revenirEtape).mockResolvedValue();
  rendre();
  fireEvent.click(await screen.findByRole('button', { name: 'Revenir à une étape' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer le retour' }));
  expect(await screen.findByText('Le commentaire est obligatoire.')).toBeInTheDocument();
  expect(revenirEtape).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Commentaire'), { target: { value: 'Pièces manquantes' } });
  fireEvent.change(screen.getByLabelText('Étape de retour'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer le retour' }));
  await waitFor(() => expect(revenirEtape).toHaveBeenCalledWith('x1', 1, 'Pièces manquantes'));
});

test('affiche l erreur renvoyée par la fonction SQL', async () => {
  vi.mocked(listerExercices).mockResolvedValue([exercice({ etape_actuelle: 2 })]);
  vi.mocked(validerEtape).mockRejectedValue({ message: 'Étape non autorisée.' });
  rendre();
  fireEvent.click(await screen.findByRole('button', { name: 'Valider : Révision terminée' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Étape non autorisée.');
});

test('l onglet Tableau liste les exercices', async () => {
  vi.mocked(listerExercices).mockResolvedValue([exercice({ etape_actuelle: 1 })]);
  rendre();
  fireEvent.click(await screen.findByRole('tab', { name: 'Tableau' }));
  expect(await screen.findByRole('columnheader', { name: 'Intervenant attendu' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Exporter en Excel' })).toBeInTheDocument();
});
