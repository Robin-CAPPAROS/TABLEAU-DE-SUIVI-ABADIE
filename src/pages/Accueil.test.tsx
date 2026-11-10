import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import Accueil from './Accueil';
import { useMoi } from '@/auth/SessionProvider';
import { listerCollaborateurs, listerEcheances, listerEcheancesAAttention } from '@/data/echeances';
import { listerExercices } from '@/data/exercices';
import { listerAnomaliesOuvertes } from '@/data/synchro';
import { echeance, exercice, MOI_CSP, MOI_MANAGER } from '@/test/fixtures';

vi.mock('@/auth/SessionProvider', () => ({ useMoi: vi.fn() }));
vi.mock('@/data/echeances', () => ({
  listerEcheances: vi.fn(),
  listerEcheancesAAttention: vi.fn(),
  listerCollaborateurs: vi.fn(),
}));
vi.mock('@/data/exercices', () => ({ listerExercices: vi.fn() }));
vi.mock('@/data/synchro', () => ({ listerAnomaliesOuvertes: vi.fn() }));

function rendre() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Accueil />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listerEcheances).mockResolvedValue([
    echeance({ id: 'a', sous_7_jours: true, raison_sociale: 'Alpha' }),
    echeance({ id: 'b', en_retard: true, raison_sociale: 'Bravo' }),
    echeance({ id: 'c', statut: 'depose', alerte_paiement: true, type: 'tva_mensuelle', raison_sociale: 'Charlie' }),
  ]);
  vi.mocked(listerExercices).mockResolvedValue([exercice({ raison_sociale: 'Delta', etape_actuelle: 3, en_retard: true })]);
  vi.mocked(listerEcheancesAAttention).mockResolvedValue([
    echeance({ id: 'b', en_retard: true, csp_id: 'c1', senior_id: 's1' }),
    echeance({ id: 'n', retard_non_qualifie: true, depot_tardif: true, statut: 'depose', raison_sociale: 'Echo' }),
  ]);
  vi.mocked(listerCollaborateurs).mockResolvedValue([
    { id: 'c1', trigramme: 'CTE', prenom: 'Camille', nom: 'Test' },
    { id: 's1', trigramme: 'SEN', prenom: 'Sam', nom: 'Test' },
  ]);
  vi.mocked(listerAnomaliesOuvertes).mockResolvedValue([
    { id: 'an1', type: 'forme_inconnue', dossier_id: null, message: 'Forme inconnue', cree_le: null },
  ]);
});

test('un CSP voit ses blocs mais pas la file de supervision', async () => {
  vi.mocked(useMoi).mockReturnValue({ moi: MOI_CSP, chargement: false });
  rendre();
  expect(await screen.findByText('Mes échéances à 7 jours')).toBeInTheDocument();
  expect(screen.getByText('Alpha')).toBeInTheDocument();
  expect(screen.getByText('Paiements de TVA non constatés')).toBeInTheDocument();
  expect(screen.getByText('Mes bilans par étape')).toBeInTheDocument();
  expect(screen.queryByText('File de supervision')).not.toBeInTheDocument();
  expect(screen.queryByText('Retards par collaborateur')).not.toBeInTheDocument();
  expect(listerEcheancesAAttention).not.toHaveBeenCalled();
});

test('un manager voit la supervision, les retards par collaborateur et les anomalies', async () => {
  vi.mocked(useMoi).mockReturnValue({ moi: MOI_MANAGER, chargement: false });
  rendre();
  expect(await screen.findByText('File de supervision')).toBeInTheDocument();
  expect(await screen.findByText('Retards par collaborateur')).toBeInTheDocument();
  expect(await screen.findByText('CTE')).toBeInTheDocument();
  expect(screen.getByText('SEN')).toBeInTheDocument();
  expect(screen.getByText('Anomalies de synchronisation')).toBeInTheDocument();
  expect(await screen.findByText('Forme inconnue')).toBeInTheDocument();
  expect(screen.getByText('Retards non qualifiés')).toBeInTheDocument();
  expect(await screen.findByText('Echo')).toBeInTheDocument();
});
