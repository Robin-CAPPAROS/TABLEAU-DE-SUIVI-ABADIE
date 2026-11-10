import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import Echeancier from './Echeancier';
import { useMoi } from '@/auth/SessionProvider';
import { confirmerPaiement, listerCollaborateurs, listerEcheances, marquerEcheance } from '@/data/echeances';
import { ajouterJours, dateDuJourParis } from '@domain/dates';
import { echeance, MOI_CSP, MOI_MANAGER } from '@/test/fixtures';

vi.mock('@/auth/SessionProvider', () => ({ useMoi: vi.fn() }));
vi.mock('@/lib/exportExcel', () => ({ exporterExcel: vi.fn() }));
vi.mock('@/data/echeances', () => ({
  listerEcheances: vi.fn(),
  listerCollaborateurs: vi.fn(),
  marquerEcheance: vi.fn(),
  confirmerPaiement: vi.fn(),
  qualifierRetard: vi.fn(),
}));

function rendre() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Echeancier />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useMoi).mockReturnValue({ moi: MOI_CSP, chargement: false });
  vi.mocked(listerCollaborateurs).mockResolvedValue([]);
});

test('le filtre Mes dossiers est coché par défaut', async () => {
  vi.mocked(listerEcheances).mockResolvedValue([]);
  rendre();
  expect(await screen.findByLabelText('Mes dossiers')).toBeChecked();
  expect(listerEcheances).toHaveBeenCalledWith(expect.objectContaining({ mesDossiers: true }), 'c1');
});

test('une TVA mensuelle affiche Pennylane et aucune action de dépôt', async () => {
  vi.mocked(listerEcheances).mockResolvedValue([
    echeance({ id: 't1', type: 'tva_mensuelle', synchronisee: true, source_statut: 'pennylane' }),
  ]);
  rendre();
  expect(await screen.findByText('Société Fictive')).toBeInTheDocument();
  expect(screen.getByText('Pennylane')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Marquer déposé' })).not.toBeInTheDocument();
});

test('un solde d IS du CSP connecté se marque déposé', async () => {
  vi.mocked(listerEcheances).mockResolvedValue([echeance({ id: 'e9', type: 'is_solde' })]);
  vi.mocked(marquerEcheance).mockResolvedValue();
  rendre();
  fireEvent.click(await screen.findByRole('button', { name: 'Marquer déposé' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le dépôt' }));
  await waitFor(() =>
    expect(marquerEcheance).toHaveBeenCalledWith('e9', 'depose', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), undefined),
  );
});

test('affiche l erreur renvoyée par la fonction SQL', async () => {
  vi.mocked(listerEcheances).mockResolvedValue([echeance({ id: 'e9' })]);
  vi.mocked(marquerEcheance).mockRejectedValue(new Error('Votre rôle ne permet pas de modifier cette échéance.'));
  rendre();
  fireEvent.click(await screen.findByRole('button', { name: 'Marquer déposé' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le dépôt' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Votre rôle ne permet pas de modifier cette échéance.');
});

test('une alerte de paiement affiche le badge et Confirmer le paiement', async () => {
  vi.mocked(listerEcheances).mockResolvedValue([
    echeance({ id: 'p1', type: 'tva_mensuelle', statut: 'depose', alerte_paiement: true, synchronisee: true, montant: 100 }),
  ]);
  vi.mocked(confirmerPaiement).mockResolvedValue();
  rendre();
  const ligne = (await screen.findByText('Société Fictive')).closest('tr') as HTMLElement;
  expect(within(ligne).getByText('Paiement non constaté')).toBeInTheDocument();
  fireEvent.click(within(ligne).getByRole('button', { name: 'Confirmer le paiement' }));
  await waitFor(() => expect(confirmerPaiement).toHaveBeenCalledWith('p1'));
});

test('un dépôt tardif propose de qualifier la cause', async () => {
  vi.mocked(listerEcheances).mockResolvedValue([
    echeance({ id: 'q1', type: 'tva_mensuelle', statut: 'depose', depot_tardif: true, retard_non_qualifie: true, synchronisee: true }),
  ]);
  rendre();
  expect(await screen.findByLabelText('Qualifier la cause du retard')).toBeInTheDocument();
});

test('bascule vers le calendrier mensuel', async () => {
  vi.mocked(listerEcheances).mockResolvedValue([echeance({ date_limite: '2026-11-20' })]);
  rendre();
  fireEvent.click(await screen.findByRole('button', { name: 'Calendrier' }));
  expect(screen.getByRole('grid')).toBeInTheDocument();
});

test('un CSP non intervenant du dossier ne voit aucune action', async () => {
  vi.mocked(listerEcheances).mockResolvedValue([echeance({ csp_id: 'autre', senior_id: 'autre2' })]);
  rendre();
  expect(await screen.findByText('Société Fictive')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Marquer déposé' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Non applicable' })).not.toBeInTheDocument();
});

test('un acompte CA12 sans source Pennylane propose Marquer déposé', async () => {
  vi.mocked(listerEcheances).mockResolvedValue([echeance({ type: 'tva_ca12_acompte_juillet' })]);
  rendre();
  expect(await screen.findByRole('button', { name: 'Marquer déposé' })).toBeInTheDocument();
});

test('un montant invalide affiche un message sans appeler la fonction', async () => {
  vi.mocked(listerEcheances).mockResolvedValue([echeance({ id: 'e9' })]);
  rendre();
  fireEvent.click(await screen.findByRole('button', { name: 'Marquer déposé' }));
  fireEvent.change(screen.getByLabelText('Montant (facultatif)'), { target: { value: 'abc' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le dépôt' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Montant invalide');
  expect(marquerEcheance).not.toHaveBeenCalled();
});

test('la période par défaut va de J-60 à J+120 et reste modifiable et effaçable', async () => {
  vi.mocked(listerEcheances).mockResolvedValue([]);
  const jour = dateDuJourParis(new Date());
  rendre();
  expect(await screen.findByLabelText('Du')).toHaveValue(ajouterJours(jour, -60));
  expect(screen.getByLabelText('Au')).toHaveValue(ajouterJours(jour, 120));
  expect(listerEcheances).toHaveBeenCalledWith(
    expect.objectContaining({ du: ajouterJours(jour, -60), au: ajouterJours(jour, 120) }), 'c1');
  fireEvent.change(screen.getByLabelText('Du'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Au'), { target: { value: '2027-12-31' } });
  await waitFor(() =>
    expect(listerEcheances).toHaveBeenLastCalledWith(expect.objectContaining({ du: undefined, au: '2027-12-31' }), 'c1'),
  );
});

test('une erreur de chargement PostgREST affiche son message', async () => {
  vi.mocked(listerEcheances).mockRejectedValue({ message: 'permission denied for view v_echeances' });
  rendre();
  expect(await screen.findByRole('alert')).toHaveTextContent('permission denied for view v_echeances');
});

test('une erreur PostgREST d une action affiche son message', async () => {
  vi.mocked(listerEcheances).mockResolvedValue([echeance({ id: 'e9' })]);
  vi.mocked(marquerEcheance).mockRejectedValue({ message: 'Échéance introuvable.' });
  rendre();
  fireEvent.click(await screen.findByRole('button', { name: 'Non applicable' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Échéance introuvable.');
});

test('un manager peut rendre non applicable une échéance synchronisée à faire, puis la remettre à faire', async () => {
  vi.mocked(useMoi).mockReturnValue({ moi: MOI_MANAGER, chargement: false });
  vi.mocked(listerEcheances).mockResolvedValue([
    echeance({ id: 't1', type: 'tva_mensuelle', synchronisee: true }),
    echeance({ id: 't2', type: 'tva_mensuelle', synchronisee: true, statut: 'non_applicable', source_statut: 'manuel', raison_sociale: 'Autre Société' }),
    echeance({ id: 't3', type: 'tva_mensuelle', synchronisee: true, statut: 'depose', source_statut: 'pennylane', raison_sociale: 'Troisième Société' }),
  ]);
  vi.mocked(marquerEcheance).mockResolvedValue();
  rendre();
  const l1 = (await screen.findByText('Société Fictive')).closest('tr') as HTMLElement;
  expect(within(l1).queryByRole('button', { name: 'Marquer déposé' })).not.toBeInTheDocument();
  fireEvent.click(within(l1).getByRole('button', { name: 'Non applicable' }));
  await waitFor(() => expect(marquerEcheance).toHaveBeenCalledWith('t1', 'non_applicable'));
  const l2 = screen.getByText('Autre Société').closest('tr') as HTMLElement;
  fireEvent.click(within(l2).getByRole('button', { name: 'Remettre à faire' }));
  await waitFor(() => expect(marquerEcheance).toHaveBeenCalledWith('t2', 'a_faire'));
  const l3 = screen.getByText('Troisième Société').closest('tr') as HTMLElement;
  expect(within(l3).queryByRole('button')).not.toBeInTheDocument();
});

test('un CSP ne peut pas rendre non applicable une échéance synchronisée', async () => {
  vi.mocked(listerEcheances).mockResolvedValue([echeance({ id: 't1', type: 'tva_mensuelle', synchronisee: true })]);
  rendre();
  expect(await screen.findByText('Société Fictive')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Non applicable' })).not.toBeInTheDocument();
});
