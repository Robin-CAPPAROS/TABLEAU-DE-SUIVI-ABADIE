import { createClient } from '@supabase/supabase-js';
import { verifierCle } from '../_shared/cle.ts';
import { dateDuJourParis } from '../_shared/domain/dates.ts';
import { construireRecapitulatif } from '../_shared/recap/construire.ts';
import type { DonneesRecap } from '../_shared/recap/construire.ts';
import { envoyerMail, obtenirJetonGraph } from '../_shared/recap/graph.ts';
import { doitEnvoyer } from '../_shared/recap/planification.ts';

function reponse(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return reponse({ erreur: 'Méthode non autorisée' }, 405);

  const secret = Deno.env.get('CRON_SECRET');
  if (!secret) return reponse({ erreur: 'CRON_SECRET non configuré' }, 500);
  if (!verifierCle(req.headers.get('Authorization'), secret)) {
    return reponse({ erreur: 'Non autorisé' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const maintenant = new Date();
  const aujourdhui = dateDuJourParis(maintenant);

  // Envoi du jour : une ligne de journal 'recapitulatif' dont le début tombe aujourd'hui (date de Paris).
  const depuis = new Date(maintenant.getTime() - 48 * 3600 * 1000).toISOString();
  const { data: recents, error: errRecents } = await supabase
    .from('journal_synchro')
    .select('debut')
    .eq('nature', 'recapitulatif')
    .gte('debut', depuis);
  if (errRecents) return reponse({ erreur: errRecents.message }, 500);
  const dejaEnvoye = (recents ?? []).some(
    (l: { debut: string }) => dateDuJourParis(new Date(l.debut)) === aujourdhui,
  );

  if (!doitEnvoyer(maintenant, dejaEnvoye)) return reponse({ envoye: false });

  const { data: journal, error: errJournal } = await supabase
    .from('journal_synchro')
    .insert({ source: 'outil', nature: 'recapitulatif' })
    .select('id')
    .single();
  if (errJournal || !journal) return reponse({ erreur: errJournal?.message ?? 'Journal indisponible' }, 500);

  const anomalie = async (type: string, cle: string, message: string) => {
    const { error } = await supabase.from('anomalies').insert({
      type,
      dossier_id: null,
      cle,
      message,
      journal_id: journal.id,
    });
    if (error) console.error('Anomalie non enregistrée', error.message);
  };

  try {
    const { data: param, error: errParam } = await supabase
      .from('parametres')
      .select('recap_expediteur')
      .eq('id', 1)
      .single();
    if (errParam) throw new Error(errParam.message);
    const expediteur = param?.recap_expediteur as string | null;
    if (!expediteur) {
      const message = "Adresse d'expédition du récapitulatif non configurée (parametres.recap_expediteur)";
      await anomalie('envoi_recapitulatif', 'expediteur', message);
      return reponse({ erreur: message }, 500);
    }

    const tenant = Deno.env.get('MS_TENANT_ID') ?? '';
    const client = Deno.env.get('MS_CLIENT_ID') ?? '';
    const secretClient = Deno.env.get('MS_CLIENT_SECRET') ?? '';
    const urlApplication = Deno.env.get('APP_URL') ?? '';
    if (!tenant || !client || !secretClient) throw new Error('Identifiants Microsoft Graph non configurés');

    const { data: destinataires, error: errDest } = await supabase.rpc('destinataires_recapitulatif');
    if (errDest) throw new Error(errDest.message);
    const liste = (destinataires ?? []) as { id: string; email: string }[];

    const jeton = liste.length > 0 ? await obtenirJetonGraph(tenant, client, secretClient) : '';

    let envoyes = 0;
    let echecs = 0;
    for (const d of liste) {
      try {
        const { data, error } = await supabase.rpc('donnees_recapitulatif', { p_collaborateur: d.id });
        if (error) throw new Error(error.message);
        const mail = construireRecapitulatif(data as DonneesRecap, urlApplication);
        await envoyerMail(jeton, expediteur, d.email, mail.sujet, mail.html);
        envoyes++;
      } catch (e) {
        echecs++;
        await anomalie('envoi_recapitulatif', d.email, e instanceof Error ? e.message : String(e));
      }
    }

    const { error: errFin } = await supabase
      .from('journal_synchro')
      .update({ fin: new Date().toISOString(), nb_dossiers: envoyes })
      .eq('id', journal.id);
    if (errFin) {
      console.error('Journal non finalisé', errFin.message);
      return reponse({ erreur: errFin.message }, 500);
    }

    return reponse({ envoye: true, destinataires: liste.length, envoyes, echecs });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await anomalie('envoi_recapitulatif', 'execution', message);
    return reponse({ erreur: message }, 500);
  }
});
