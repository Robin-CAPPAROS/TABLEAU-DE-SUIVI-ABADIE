import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import Indicateurs from './Indicateurs';
import { useMoi } from '@/auth/SessionProvider';
import { listerCollaborateurs } from '@/data/echeances';
import { listerExercices } from '@/data/exercices';
import { lireIndicateurs, type BlocIndicateurs, type Indicateurs as Donnees } from '@/data/pilotage';
import { MOI_CSP, MOI_MANAGER } from '@/test/fixtures';

vi.mock('@/auth/SessionProvider', () => ({ useMoi: vi.fn() }));
vi.mock('@/data/echeances', () => ({ listerCollaborateurs: vi.fn() }));
vi.mock('@/data/exercices', () => ({ listerExercices: vi.fn() }));
vi.mock('@/data/pilotage', () => ({ lireIndicateurs: vi.fn() }));

const bloc = (p: Partial<BlocIndicateurs> = {}): BlocIndicateurs => ({
  depots_en_retard: { total: 5, par_cause: { cabinet: 2, client: 1, administration: 0, autre: 0, non_qualifie: 2 }, par_type: {} },
  bilans_supervises_avant_cible: { numerateur: 1, denominateur: 3, pourcentage: 33.3 },
  marge_liasse: { moyenne_jours: 12.5, repartition: { en_retard: 1, moins_7: 2, de_7_a_30: 3, plus_30: 4 } },
  delai_cloture_supervision: { moyenne_jours: 45 },
  ...p,
});

const donnees = (precedente: BlocIndicateurs | null): Donnees => ({
  saison: 2027, global: bloc(), precedente,
  par_equipe: [{ equipe: 1, ...bloc() }],
  par_senior: [{ senior_id: 's1', ...bloc() }],
});

function rendre() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/indicateurs']}>
        <Routes>
          <Route path="/" element={<p>Accueil</p>} />
          <Route path="/indicateurs" element={<Indicateurs />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
  vi.mocked(useMoi).mockReturnValue({ moi: MOI_MANAGER, chargement: false });
  vi.mocked(listerCollaborateurs).mockResolvedValue([{ id: 's1', trigramme: 'STE', prenom: 'Sam', nom: 'Test' }]);
  vi.mocked(listerExercices).mockResolvedValue([]);
});

test('affiche les pourcentages français et la comparaison indisponible', async () => {
  vi.mocked(lireIndicateurs).mockResolvedValue(donnees(null));
  rendre();
  expect((await screen.findAllByText('33,3 %')).length).toBeGreaterThan(0);
  expect(screen.getAllByText('Comparaison indisponible pour la première saison')).toHaveLength(4);
  expect(screen.getByText('STE')).toBeInTheDocument();
  expect(lireIndicateurs).toHaveBeenCalledWith(2027, expect.objectContaining({ mesDossiers: false }));
});

test('affiche la valeur de la saison précédente et change de saison', async () => {
  vi.mocked(lireIndicateurs).mockResolvedValue(donnees(bloc({ bilans_supervises_avant_cible: { numerateur: 2, denominateur: 5, pourcentage: 40 } })));
  rendre();
  expect(await screen.findByText('Saison précédente : 40 %')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Saison'), { target: { value: '2026' } });
  await waitFor(() => expect(lireIndicateurs).toHaveBeenCalledWith(2026, expect.anything()));
});

test('un CSP est redirigé vers l\'accueil', async () => {
  vi.mocked(useMoi).mockReturnValue({ moi: MOI_CSP, chargement: false });
  rendre();
  expect(await screen.findByText('Accueil')).toBeInTheDocument();
  expect(lireIndicateurs).not.toHaveBeenCalled();
});
