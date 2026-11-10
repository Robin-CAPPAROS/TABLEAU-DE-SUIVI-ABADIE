import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, vi } from 'vitest';
import BandeauSynchro from './BandeauSynchro';
import { derniereSynchro } from '@/data/synchro';

vi.mock('@/data/synchro', () => ({ derniereSynchro: vi.fn() }));

function rendre() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BandeauSynchro />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

test('affiche la date de la derniere synchronisation en heure de Paris', async () => {
  vi.setSystemTime(new Date('2026-11-10T08:00:00Z'));
  vi.mocked(derniereSynchro).mockResolvedValue('2026-11-10T01:15:00Z');
  rendre();
  const bandeau = await screen.findByText('Dernière synchronisation Pennylane : 10/11/2026 à 02:15');
  expect(bandeau).not.toHaveClass('bg-red-600');
});

test('passe en alerte au dela de 48 heures', async () => {
  vi.setSystemTime(new Date('2026-11-13T08:00:00Z'));
  vi.mocked(derniereSynchro).mockResolvedValue('2026-11-10T01:15:00Z');
  rendre();
  const bandeau = await screen.findByText('Synchronisation Pennylane interrompue depuis plus de 48 heures');
  expect(bandeau).toHaveClass('bg-red-600');
});

test('alerte quand aucune synchronisation n existe', async () => {
  vi.setSystemTime(new Date('2026-11-10T08:00:00Z'));
  vi.mocked(derniereSynchro).mockResolvedValue(null);
  rendre();
  const bandeau = await screen.findByText('Aucune synchronisation Pennylane enregistrée');
  expect(bandeau).toHaveClass('bg-red-600');
});
