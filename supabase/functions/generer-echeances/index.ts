import { createClient } from '@supabase/supabase-js';
import { verifierCle } from '../_shared/cle.ts';
import { genererEcheancesDossier } from '../_shared/domain/generation.ts';
import { dateDuJourParis } from '../_shared/domain/dates.ts';
import type {
  AnomalieGeneration,
  DossierRegles,
  EcheanceGeneree,
  ExerciceRegles,
  ParametresFiscaux,
} from '../_shared/domain/types.ts';

const TAILLE_PAQUET = 1000;

interface DonneesGeneration {
  dossiers: DossierRegles[];
  exercices: (ExerciceRegles & { dossierId: string })[];
  parametres: ParametresFiscaux;
}

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

  const { data: journal, error: errJournal } = await supabase
    .from('journal_synchro')
    .insert({ source: 'outil', nature: 'generation' })
    .select('id')
    .single();
  if (errJournal || !journal) return reponse({ erreur: errJournal?.message ?? 'Journal indisponible' }, 500);

  try {
    const { data, error } = await supabase.rpc('donnees_generation');
    if (error) throw new Error(error.message);
    const donnees = data as DonneesGeneration;
    const aujourdhui = dateDuJourParis(new Date());

    const echeances: EcheanceGeneree[] = [];
    const anomalies: AnomalieGeneration[] = [];
    for (const dossier of donnees.dossiers) {
      const exercices = donnees.exercices.filter((e) => e.dossierId === dossier.id);
      const resultat = genererEcheancesDossier(dossier, exercices, donnees.parametres, aujourdhui);
      echeances.push(...resultat.echeances);
      anomalies.push(...resultat.anomalies);
    }

    const totaux = { inserees: 0, mises_a_jour: 0, anomalies: 0 };
    const ajouter = (r: { inserees: number; mises_a_jour: number; anomalies: number }) => {
      totaux.inserees += r.inserees;
      totaux.mises_a_jour += r.mises_a_jour;
      totaux.anomalies += r.anomalies;
    };

    // Les anomalies partent avec le premier paquet.
    for (let i = 0; i === 0 || i < echeances.length; i += TAILLE_PAQUET) {
      const { data: r, error: errUpsert } = await supabase.rpc('upsert_echeances_generees', {
        p_echeances: echeances.slice(i, i + TAILLE_PAQUET),
        p_anomalies: i === 0 ? anomalies : [],
      });
      if (errUpsert) throw new Error(errUpsert.message);
      ajouter(r);
    }

    const { error: errFin } = await supabase
      .from('journal_synchro')
      .update({
        fin: new Date().toISOString(),
        nb_dossiers: donnees.dossiers.length,
        nb_echeances: echeances.length,
      })
      .eq('id', journal.id);
    if (errFin) {
      console.error('Journal non finalisé', errFin.message);
      return reponse({ erreur: errFin.message }, 500);
    }

    return reponse({ dossiers: donnees.dossiers.length, echeances: echeances.length, ...totaux });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // fin reste nul : une ligne ouverte marque une exécution en échec.
    const { error: errAnomalie } = await supabase.from('anomalies').insert({
      type: 'echec_generation',
      dossier_id: null,
      cle: journal.id,
      message,
      journal_id: journal.id,
    });
    if (errAnomalie) console.error('Anomalie non enregistrée', errAnomalie.message);
    return reponse({ erreur: message }, 500);
  }
});
