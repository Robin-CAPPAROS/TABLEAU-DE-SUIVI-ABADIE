import { supabase } from '@/lib/supabase';

export default function Connexion() {
  const connecter = () =>
    supabase.auth.signInWithOAuth({ provider: 'azure', options: { scopes: 'email openid profile' } });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-marine p-8 font-cabinet text-white">
      <h1 className="text-2xl font-bold">Suivi CPA &amp; ABADIE</h1>
      <button type="button" onClick={connecter} className="rounded bg-primaire px-5 py-2 font-bold text-white">
        Se connecter avec Microsoft 365
      </button>
    </main>
  );
}
