import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, useMoi, useSession } from '@/auth/SessionProvider';
import AppLayout from '@/components/AppLayout';
import Connexion from '@/pages/Connexion';
import AccesRefuse from '@/pages/AccesRefuse';
import PageAVenir from '@/pages/PageAVenir';
import Accueil from '@/pages/Accueil';
import Echeancier from '@/pages/Echeancier';
import Production from '@/pages/Production';
import FicheDossier from '@/pages/FicheDossier';
import Indicateurs from '@/pages/Indicateurs';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

function Chargement() {
  return <p className="p-8 font-cabinet text-marine">Chargement…</p>;
}

function Routage() {
  const { session, chargement } = useSession();
  const { moi, chargement: chargementMoi } = useMoi();

  if (chargement) return <Chargement />;
  if (!session) {
    return (
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route path="*" element={<Navigate to="/connexion" replace />} />
      </Routes>
    );
  }
  if (chargementMoi) return <Chargement />;
  if (!moi) return <AccesRefuse />;

  return (
    <Routes>
      <Route path="/connexion" element={<Navigate to="/" replace />} />
      <Route element={<AppLayout />}>
        <Route index element={<Accueil />} />
        <Route path="echeancier" element={<Echeancier />} />
        <Route path="production" element={<Production />} />
        <Route path="dossiers/:id" element={<FicheDossier />} />
        <Route path="indicateurs" element={<Indicateurs />} />
        <Route path="administration" element={<PageAVenir titre="Administration" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BrowserRouter>
          <Routage />
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  );
}
