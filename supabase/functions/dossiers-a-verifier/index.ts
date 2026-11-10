import { createClient } from '@supabase/supabase-js';
import { verifierCle } from '../_shared/cle.ts';

function reponse(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return reponse({ erreur: 'Méthode non autorisée' }, 405);

  const secret = Deno.env.get('SYNC_SECRET');
  if (!secret) return reponse({ erreur: 'SYNC_SECRET non configuré' }, 500);
  if (!verifierCle(req.headers.get('Authorization'), secret)) {
    return reponse({ erreur: 'Non autorisé' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data, error } = await supabase.rpc('dossiers_a_verifier');
  if (error) {
    console.error('dossiers_a_verifier en échec', error.message);
    return reponse({ erreur: error.message }, 500);
  }
  return reponse({ pennylane_ids: (data ?? []) as number[] });
});
