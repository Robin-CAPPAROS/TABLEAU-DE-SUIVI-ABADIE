import { NavLink, Outlet } from 'react-router-dom';
import { useMoi, useSession } from '@/auth/SessionProvider';
import { peutAdministrer, peutVoirIndicateurs } from '@/auth/permissions';
import BandeauSynchro from './BandeauSynchro';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const { moi } = useMoi();
  const { deconnecter } = useSession();

  const liens = [
    { to: '/', libelle: 'Accueil', visible: true },
    { to: '/echeancier', libelle: 'Échéancier', visible: true },
    { to: '/production', libelle: 'Production des bilans', visible: true },
    { to: '/indicateurs', libelle: 'Indicateurs', visible: !!moi && peutVoirIndicateurs(moi) },
    { to: '/administration', libelle: 'Administration', visible: !!moi && peutAdministrer(moi) },
  ].filter((l) => l.visible);

  return (
    <div className="flex min-h-screen flex-col font-cabinet md:flex-row">
      <aside className="flex flex-col gap-2 bg-marine p-4 text-white md:w-64 md:shrink-0">
        <h1 className="text-lg font-bold md:mb-6">Suivi CPA &amp; ABADIE</h1>
        <nav aria-label="Navigation principale" className="flex flex-wrap gap-1 md:flex-1 md:flex-col">
          {liens.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                cn('rounded px-3 py-2 text-sm', isActive ? 'bg-primaire font-bold text-white' : 'text-white hover:bg-white/10')
              }
            >
              {l.libelle}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t border-white/20 pt-3 md:flex-col md:items-start md:gap-2">
          <span className="text-sm font-bold">{moi?.trigramme}</span>
          <button type="button" onClick={deconnecter} className="text-sm underline">
            Se déconnecter
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-white text-marine">
        <BandeauSynchro />
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
