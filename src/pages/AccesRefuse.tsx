import { useSession } from '@/auth/SessionProvider';

export default function AccesRefuse() {
  const { deconnecter } = useSession();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-marine p-8 text-center font-cabinet text-white">
      <p className="text-lg font-bold">Votre compte n'est pas autorisé à accéder à l'outil. Contactez un administrateur.</p>
      <button type="button" onClick={deconnecter} className="rounded bg-primaire px-5 py-2 font-bold text-white">
        Se déconnecter
      </button>
    </main>
  );
}
