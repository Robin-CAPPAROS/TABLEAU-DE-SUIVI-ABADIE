import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import PlanDeCharge, { lundiDe } from './PlanDeCharge';
import { useMoi } from '@/auth/SessionProvider';
import { listerCollaborateurs } from '@/data/echeances';
import { listerExercices, majDateCible, planDeCharge } from '@/data/exercices';
import { exercice, MOI_CSP, MOI_MANAGER } from '@/test/fixtures';

// jsdom ne mesure aucune taille : le conteneur responsive est remplacé par un cadre fixe.
vi.mock('recharts', async (importOriginal) => {
  const reel = await importOriginal<typeof import('recharts')>();
  return {
    ...reel,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => <div style={{ width: 600, height: 288 }}>{children}</div>,
  };
});
vi.mock('@/auth/SessionProvider', () => ({ useMoi: vi.fn() }));
vi.mock('@/data/echeances', () => ({ listerCollaborateurs: vi.fn() }));
vi.mock('@/data/exercices', () => ({ listerExercices: vi.fn(), majDateCible: vi.fn(), planDeCharge: vi.fn() }));

function rendre() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PlanDeCharge />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const LUNDI = lundiDe('2026-11-10');

beforeEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
  vi.mocked(useMoi).mockReturnValue({ moi: MOI_MANAGER, chargement: false });
  vi.mocked(listerExercices).mockResolvedValue([]);
  vi.mocked(listerCollaborateurs).mockResolvedValue([{ id: 's1', trigramme: 'STE', prenom: 'Sam', nom: 'Test' }]);
});

test('lundiDe renvoie le lundi de la semaine', () => {
  expect(lundiDe('2026-11-10')).toBe('2026-11-09');
  expect(lundiDe('2026-11-08')).toBe('2026-11-02');
  expect(lundiDe('2026-11-09')).toBe('2026-11-09');
});

test('regroupe les lignes par semaine et ouvre la liste des dossiers au clic', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
  vi.mocked(planDeCharge).mockResolvedValue([
    { semaine: LUNDI, senior_id: 's1', a_faire: 2, supervises: 1 },
    { semaine: LUNDI, senior_id: 's2', a_faire: 3, supervises: 0 },
  ]);
  vi.mocked(listerExercices).mockResolvedValue([
    exercice({ id: 'x1', raison_sociale: 'Alpha', date_cible: LUNDI }),
    exercice({ id: 'x2', raison_sociale: 'Hors semaine', date_cible: '2027-02-01' }),
  ]);
  rendre();
  const bouton = await screen.findByRole('button', { name: 'Voir la semaine du 09/11/2026' });
  expect(bouton.closest('tr')).toHaveTextContent('5');
  expect(bouton.closest('tr')).toHaveTextContent('1');
  fireEvent.click(bouton);
  expect(await screen.findByText('Alpha')).toBeInTheDocument();
  expect(screen.queryByText('Hors semaine')).not.toBeInTheDocument();
  expect(planDeCharge).toHaveBeenCalledWith(LUNDI, 26, expect.objectContaining({ mesDossiers: false }));
});

test('le filtre Senior restreint les données affichées', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
  vi.mocked(planDeCharge).mockResolvedValue([
    { semaine: LUNDI, senior_id: 's1', a_faire: 2, supervises: 1 },
    { semaine: LUNDI, senior_id: 's2', a_faire: 3, supervises: 0 },
  ]);
  rendre();
  const ligne = async () => (await screen.findByRole('button', { name: 'Voir la semaine du 09/11/2026' })).closest('tr')!;
  const cellules = (tr: HTMLElement) => Array.from(tr.querySelectorAll('td')).slice(0, 3).map((td) => td.textContent);
  expect(cellules(await ligne())).toEqual(['09/11/2026', '5', '1']);
  fireEvent.change(screen.getByLabelText('Senior'), { target: { value: 's1' } });
  await waitFor(async () => expect(cellules(await ligne())).toEqual(['09/11/2026', '2', '1']));
});

test('un manager modifie la date cible, un CSP non', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
  vi.mocked(planDeCharge).mockResolvedValue([{ semaine: LUNDI, senior_id: 's1', a_faire: 1, supervises: 0 }]);
  vi.mocked(listerExercices).mockResolvedValue([exercice({ id: 'x1', raison_sociale: 'Alpha', date_cible: LUNDI, date_approbation: '2027-05-01' })]);
  vi.mocked(majDateCible).mockResolvedValue();
  const { unmount } = rendre();
  fireEvent.click(await screen.findByRole('button', { name: 'Voir la semaine du 09/11/2026' }));
  fireEvent.change(await screen.findByLabelText('Date cible de Alpha'), { target: { value: '2026-11-12' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la date cible' }));
  await waitFor(() => expect(majDateCible).toHaveBeenCalledWith('x1', '2026-11-12', '2027-05-01'));
  unmount();

  vi.mocked(useMoi).mockReturnValue({ moi: MOI_CSP, chargement: false });
  rendre();
  fireEvent.click(await screen.findByRole('button', { name: 'Voir la semaine du 09/11/2026' }));
  expect(await screen.findByText('Alpha')).toBeInTheDocument();
  expect(screen.queryByLabelText('Date cible de Alpha')).not.toBeInTheDocument();
});

test('les options Manager viennent des exercices', async () => {
  vi.mocked(planDeCharge).mockResolvedValue([]);
  vi.mocked(listerCollaborateurs).mockResolvedValue([
    { id: 'm1', trigramme: 'MTE', prenom: 'Manon', nom: 'Test' },
    { id: 'z9', trigramme: 'ZZZ', prenom: 'Zoe', nom: 'Test' },
  ]);
  vi.mocked(listerExercices).mockResolvedValue([exercice({ manager_id: 'm1' })]);
  rendre();
  expect(await screen.findByRole('option', { name: 'MTE' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'ZZZ' })).not.toBeInTheDocument();
});
