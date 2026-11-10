import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import Administration from './Administration';
import { useMoi } from '@/auth/SessionProvider';
import * as admin from '@/data/admin';
import { lireClasseur } from '@/import/lireClasseur';
import { MOI_MANAGER } from '@/test/fixtures';
import type { Moi } from '@/data/types';

vi.mock('@/auth/SessionProvider', () => ({ useMoi: vi.fn() }));
vi.mock('@/data/admin');
vi.mock('@/import/lireClasseur', () => ({ lireClasseur: vi.fn() }));

const MOI_ADMIN: Moi = { id: 'a1', prenom: 'Alix', nom: 'Test', trigramme: 'ATE', role: 'manager', administrateur: true };
const PARAMS: admin.Parametres = {
  date_cible_mois_tenue: 3, date_cible_mois_revision: 3, date_cible_mois_micro_bnc: 3, date_cible_mois_irpp: 3,
  jalon_etape2_jours: 30, jalon_etape3_jours: 15, delai_greffe_mois: 2, delai_alerte_paiement_jours: 5,
  recap_actif: true, recap_equipes: [1, 2], recap_expediteur: null,
};
const COLLAB: admin.CollaborateurAdmin[] = [
  { id: 'k1', prenom: 'Zoé', nom: 'Fictif', trigramme: 'ZFI', email: 'zfi@a-renseigner.invalid', role: null, administrateur: false, actif: true },
  { id: 'k2', prenom: 'Léo', nom: 'Fictif', trigramme: 'LFI', email: 'leo@cabinet.test', role: 'senior', administrateur: false, actif: true },
];

function rendre() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/administration']}>
        <Routes><Route path="/" element={<p>Accueil</p>} /><Route path="/administration" element={<Administration />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useMoi).mockReturnValue({ moi: MOI_ADMIN, chargement: false });
  vi.mocked(admin.listerCollaborateursAdmin).mockResolvedValue(COLLAB);
  vi.mocked(admin.lireParametres).mockResolvedValue(PARAMS);
  vi.mocked(admin.listerCalendriers).mockResolvedValue([]);
  vi.mocked(admin.listerFormes).mockResolvedValue([]);
  vi.mocked(admin.listerJoursFeries).mockResolvedValue([]);
  vi.mocked(admin.listerJournal).mockResolvedValue([]);
  vi.mocked(admin.listerAnomaliesAdmin).mockResolvedValue([]);
  vi.mocked(admin.modifierCollaborateur).mockResolvedValue(undefined);
});

test('un manager non administrateur voit les onglets mais les champs sont désactivés', async () => {
  vi.mocked(useMoi).mockReturnValue({ moi: MOI_MANAGER, chargement: false });
  rendre();
  expect(await screen.findByLabelText('Administrateur LFI')).toBeDisabled();
  expect(screen.getByLabelText('E-mail LFI')).toBeDisabled();
  expect(screen.queryByText('Ajouter un collaborateur')).toBeNull();
  expect(screen.queryByRole('tab', { name: 'Import du classeur' })).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Paramètres' }));
  expect(await screen.findByLabelText('Jalon étape 2 (jours)')).toBeDisabled();
});

test('un administrateur coche Administrateur et les e-mails provisoires sont signalés', async () => {
  rendre();
  expect(await screen.findByText('E-mail à renseigner')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Administrateur LFI'));
  await waitFor(() => expect(admin.modifierCollaborateur).toHaveBeenCalledWith('k2', { administrateur: true }));
});

test('le message du garde-fou du dernier administrateur est affiché', async () => {
  vi.mocked(admin.modifierCollaborateur).mockRejectedValue({ message: 'Impossible de retirer le dernier administrateur actif.' });
  rendre();
  fireEvent.click(await screen.findByLabelText('Actif LFI'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de retirer le dernier administrateur actif.');
});

test('le journal affiche Inachevé et une anomalie se marque résolue', async () => {
  vi.mocked(admin.listerJournal).mockResolvedValue([{ id: 'j1', debut: '2026-11-10T04:00:00Z', fin: null, source: 'api', nature: 'fiches', nb_dossiers: 0, nb_echeances: 0 }]);
  vi.mocked(admin.listerAnomaliesAdmin).mockResolvedValue([{ id: 'an1', type: 'forme', dossier_id: 'd1', message: 'Forme inconnue', cree_le: '2026-11-10T04:00:00Z', raison_sociale: 'Société Fictive' }]);
  vi.mocked(admin.resoudreAnomalie).mockResolvedValue(undefined);
  rendre();
  fireEvent.click(screen.getByRole('tab', { name: 'Journal et anomalies' }));
  expect(await screen.findByText('Inachevé')).toBeInTheDocument();
  expect(screen.getByText('Société Fictive')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Marquer résolue'));
  await waitFor(() => expect(admin.resoudreAnomalie).toHaveBeenCalledWith('an1'));
});

test("l'import affiche le rapport, le nombre de rapprochés, puis rapproche un non rapproché", async () => {
  vi.mocked(lireClasseur).mockResolvedValue({
    lignesSuivi: [{ 'Raison Sociale': 'Société Fictive', Siren: '999999999', Mission: 'Mission inconnue' }],
    lignesSources: [],
  });
  vi.mocked(admin.importerClasseurRpc).mockResolvedValue({
    rapproches: 4, collaborateurs: 2,
    non_rapproches: [{ siren: '999999999', raison_sociale: 'Société Fictive', propositions: [{ dossier_id: 'D2', raison_sociale: 'Société Fictive' }] }],
  });
  vi.mocked(admin.rapprocherDossier).mockResolvedValue(undefined);
  rendre();
  fireEvent.click(screen.getByRole('tab', { name: 'Import du classeur' }));
  const fichier = new File([new Uint8Array([1])], 'suivi.xlsx');
  Object.defineProperty(fichier, 'arrayBuffer', { value: async () => new ArrayBuffer(1) });
  fireEvent.change(screen.getByLabelText(/Classeur de suivi/), { target: { files: [fichier] } });
  expect(await screen.findByText(/lignes de rapport/)).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Message' })).toBeInTheDocument();
  fireEvent.click(screen.getByText("Lancer l'import"));
  expect(await screen.findByText(/4 dossiers rapprochés/)).toBeInTheDocument();
  expect(screen.queryByText("Lancer l'import")).toBeNull();
  expect(admin.importerClasseurRpc).toHaveBeenCalledTimes(1);
  const select = screen.getByLabelText('Proposition pour Société Fictive');
  expect(within(select).getByText('Société Fictive')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Rapprocher'));
  await waitFor(() => expect(admin.rapprocherDossier).toHaveBeenCalledTimes(1));
  expect(vi.mocked(admin.rapprocherDossier).mock.calls[0][0]).toBe('D2');
  expect(vi.mocked(admin.rapprocherDossier).mock.calls[0][1]).toMatchObject({ siren: '999999999' });
});

test("Lancer l'import est désactivé pendant l'import et reste disponible après un échec", async () => {
  vi.mocked(lireClasseur).mockResolvedValue({ lignesSuivi: [], lignesSources: [] });
  let echouer: (e: unknown) => void = () => {};
  vi.mocked(admin.importerClasseurRpc).mockReturnValue(new Promise((_, rejeter) => { echouer = rejeter; }));
  rendre();
  fireEvent.click(screen.getByRole('tab', { name: 'Import du classeur' }));
  const fichier = new File([new Uint8Array([1])], 'suivi.xlsx');
  Object.defineProperty(fichier, 'arrayBuffer', { value: async () => new ArrayBuffer(1) });
  fireEvent.change(screen.getByLabelText(/Classeur de suivi/), { target: { files: [fichier] } });
  const bouton = await screen.findByRole('button', { name: "Lancer l'import" });
  fireEvent.click(bouton);
  await waitFor(() => expect(bouton).toBeDisabled());
  fireEvent.click(bouton);
  expect(admin.importerClasseurRpc).toHaveBeenCalledTimes(1);
  echouer({ message: 'Import refusé.' });
  expect(await screen.findByRole('alert')).toHaveTextContent('Import refusé.');
  expect(screen.getByRole('button', { name: "Lancer l'import" })).toBeEnabled();
});

test('un paramètre numérique vide bloque l enregistrement avec un message', async () => {
  vi.mocked(admin.enregistrerParametres).mockResolvedValue(undefined);
  rendre();
  fireEvent.click(screen.getByRole('tab', { name: 'Paramètres' }));
  const champ = await screen.findByLabelText('Jalon étape 2 (jours)');
  fireEvent.change(champ, { target: { value: '' } });
  expect(champ).toHaveValue(null);
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les paramètres' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Jalon étape 2 (jours)');
  expect(admin.enregistrerParametres).not.toHaveBeenCalled();
  fireEvent.change(champ, { target: { value: '45' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les paramètres' }));
  await waitFor(() => expect(admin.enregistrerParametres).toHaveBeenCalledWith({ ...PARAMS, jalon_etape2_jours: 45 }));
});
