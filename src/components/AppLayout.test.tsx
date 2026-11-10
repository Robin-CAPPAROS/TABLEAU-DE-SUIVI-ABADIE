import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import AppLayout from './AppLayout';
import { useMoi } from '@/auth/SessionProvider';
import type { Moi } from '@/data/types';

vi.mock('@/data/synchro', () => ({ derniereSynchro: vi.fn().mockResolvedValue(null) }));
vi.mock('@/auth/SessionProvider', () => ({
  useMoi: vi.fn(),
  useSession: () => ({ session: {}, chargement: false, deconnecter: vi.fn() }),
}));

function rendre(moi: Moi) {
  vi.mocked(useMoi).mockReturnValue({ moi, chargement: false });
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const base = { id: 'u', prenom: 'Paul', nom: 'Martin', trigramme: 'PMA', administrateur: false };

test('manager : voit Indicateurs et Administration', () => {
  rendre({ ...base, role: 'manager' });
  expect(screen.getByRole('link', { name: 'Indicateurs' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Administration' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Accueil' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Production des bilans' })).toBeInTheDocument();
  expect(screen.getByText('PMA')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument();
});

test('senior : ne voit ni Indicateurs ni Administration', () => {
  rendre({ ...base, role: 'senior' });
  expect(screen.queryByRole('link', { name: 'Indicateurs' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Échéancier' })).toBeInTheDocument();
});
