import { createClient } from '@supabase/supabase-js';
import { verifierCle } from '../_shared/cle.ts';
import { validerPayload } from '../_shared/sync/valider.ts';

function reponse(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return reponse({ erreur: 'Méthode non autorisée' }, 405);

  const secret = Deno.env.get('SYNC_SECRET');
  if (!secret) return reponse({ erreur: 'SYNC_SECRET non configuré' }, 500);
  if (!verifierCle(req.headers.get('Authorization'), secret)) {
    return reponse({ erreur: 'Non autorisé' }, 401);
  }

  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return reponse({ erreur: 'JSON invalide' }, 400);
  }

  const validation = validerPayload(corps);
  if (!validation.ok) return reponse({ erreur: validation.erreur }, 400);
  const { payload } = validation;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data, error } = await supabase.rpc('sync_appliquer', {
    p_payload: payload,
    p_source: payload.source,
  });
  if (error) {
    console.error('sync_appliquer en échec', error.message);
    return reponse({ erreur: error.message }, 500);
  }
  return reponse(data);
});
