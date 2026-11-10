import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dateDuJourParis } from '@domain/dates';
import { useMoi } from '@/auth/SessionProvider';
import { peutAdministrer } from '@/auth/permissions';
import { listerCollaborateurs, listerEcheances, listerEcheancesAAttention } from '@/data/echeances';
import { listerExercices } from '@/data/exercices';
import { listerAnomaliesOuvertes } from '@/data/synchro';
import type { LigneEcheance, LigneExercice } from '@/data/types';
import { StatutEcheanceBadge } from '@/components/StatutBadge';
import { formaterDate } from '@/lib/format';
import { LIBELLES_TYPE } from '@/lib/libelles';

function Bloc({ titre, children, vide }: { titre: string; children?: ReactNode; vide?: boolean }) {
  return (
    <section className="rounded border border-gris/60 bg-white p-4">
      <h3 className="mb-2 text-base font-bold text-marine">{titre}</h3>
      {vide ? <p className="text-sm text-gris">Rien à signaler.</p> : children}
    </section>
  );
}

function ListeEcheances({ lignes }: { lignes: LigneEcheance[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {lignes.map((l) => (
        <li key={l.id} className="flex flex-wrap items-center gap-2">
          <Link to={`/dossiers/${l.dossier_id}`} className="font-bold text-primaire hover:underline">{l.raison_sociale}</Link>
          <span>{LIBELLES_TYPE[l.type]}</span>
          <span className="text-gris">{formaterDate(l.date_limite)}</span>
          <StatutEcheanceBadge echeance={l} />
        </li>
      ))}
    </ul>
  );
}

function ListeExercices({ lignes }: { lignes: LigneExercice[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {lignes.map((x) => (
        <li key={x.id} className="flex flex-wrap items-center gap-2">
          <Link to={`/dossiers/${x.dossier_id}`} className="font-bold text-primaire hover:underline">{x.raison_sociale}</Link>
          <span>Étape {x.etape_actuelle}</span>
          {x.date_cible && <span className="text-gris">Date cible : {formaterDate(x.date_cible)}</span>}
        </li>
      ))}
    </ul>
  );
}

function ajouterJours(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function Accueil() {
  const { moi } = useMoi();
  const supervise = !!moi && peutAdministrer(moi);
  const aujourdhui = dateDuJourParis(new Date());
  const dans30 = ajouterJours(aujourdhui, 30);

  const perso = useQuery({
    queryKey: ['accueil', 'echeances', moi?.id],
    enabled: !!moi,
    queryFn: () => listerEcheances({ statuts: ['a_faire', 'depose'], au: dans30, mesDossiers: true }, moi!.id),
  });
  const bilans = useQuery({
    queryKey: ['accueil', 'exercices', moi?.id],
    enabled: !!moi,
    queryFn: () => listerExercices({ mesDossiers: true }, moi!.id),
  });
  const attention = useQuery({
    queryKey: ['accueil', 'attention'],
    enabled: supervise,
    queryFn: listerEcheancesAAttention,
  });
  const file = useQuery({
    queryKey: ['accueil', 'supervision'],
    enabled: supervise,
    queryFn: () => listerExercices({ mesDossiers: false }, moi!.id),
  });
  const anomalies = useQuery({ queryKey: ['accueil', 'anomalies'], enabled: supervise, queryFn: listerAnomaliesOuvertes });
  const collaborateurs = useQuery({ queryKey: ['collaborateurs'], enabled: supervise, queryFn: listerCollaborateurs });

  if (!moi) return null;

  const echeances = perso.data ?? [];
  const a7 = echeances.filter((e) => e.sous_7_jours);
  const a30 = echeances.filter((e) => e.statut === 'a_faire' && !e.en_retard && !e.sous_7_jours);
  const enRetard = echeances.filter((e) => e.en_retard);
  const paiements = echeances.filter((e) => e.alerte_paiement);
  const exercices = bilans.data ?? [];
  const parEtape = Array.from({ length: 7 }, (_, n) => ({ n, nb: exercices.filter((x) => x.etape_actuelle === n).length }));
  const bilansEnRetard = exercices.filter((x) => x.en_retard);

  const retards = attention.data?.filter((e) => e.en_retard) ?? [];
  const comptes = new Map<string, number>();
  for (const e of retards) {
    for (const id of new Set([e.csp_id, e.senior_id])) if (id) comptes.set(id, (comptes.get(id) ?? 0) + 1);
  }
  const trigramme = (id: string) => collaborateurs.data?.find((c) => c.id === id)?.trigramme ?? '?';
  const parCollaborateur = [...comptes.entries()]
    .map(([id, nb]) => ({ id, nb, tri: trigramme(id) }))
    .sort((a, b) => b.nb - a.nb || a.tri.localeCompare(b.tri));
  const nonQualifies = attention.data?.filter((e) => e.retard_non_qualifie) ?? [];
  const aSuperviser = file.data?.filter((x) => x.etape_actuelle === 3) ?? [];

  return (
    <div className="space-y-4 font-cabinet">
      <h2 className="text-xl font-bold text-marine">Bonjour {moi.prenom}</h2>
      {(perso.error || bilans.error) && <p role="alert" className="text-sm text-red-600">Chargement impossible.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Bloc titre="Mes échéances à 7 jours" vide={a7.length === 0}><ListeEcheances lignes={a7} /></Bloc>
        <Bloc titre="À 30 jours" vide={a30.length === 0}><ListeEcheances lignes={a30} /></Bloc>
        <Bloc titre="En retard" vide={enRetard.length === 0}><ListeEcheances lignes={enRetard} /></Bloc>
        <Bloc titre="Paiements de TVA non constatés" vide={paiements.length === 0}><ListeEcheances lignes={paiements} /></Bloc>
        <Bloc titre="Mes bilans par étape">
          <ul className="flex flex-wrap gap-2 text-sm">
            {parEtape.map((p) => (
              <li key={p.n} className="rounded bg-gris/30 px-2 py-1 text-marine">
                Étape {p.n} : <span className="font-bold">{p.nb}</span>
              </li>
            ))}
          </ul>
        </Bloc>
        <Bloc titre="Bilans en retard" vide={bilansEnRetard.length === 0}><ListeExercices lignes={bilansEnRetard} /></Bloc>
        {supervise && (
          <>
            <Bloc titre="Retards par collaborateur" vide={parCollaborateur.length === 0}>
              <ul className="space-y-1 text-sm">
                {parCollaborateur.map((c) => (
                  <li key={c.id} className="flex gap-2"><span className="font-bold">{c.tri}</span><span>{c.nb} en retard</span></li>
                ))}
              </ul>
            </Bloc>
            <Bloc titre="File de supervision" vide={aSuperviser.length === 0}><ListeExercices lignes={aSuperviser} /></Bloc>
            <Bloc titre="Anomalies de synchronisation" vide={(anomalies.data ?? []).length === 0}>
              <ul className="space-y-1 text-sm">
                {(anomalies.data ?? []).map((a) => <li key={a.id}>{a.message}</li>)}
              </ul>
            </Bloc>
            <Bloc titre="Retards non qualifiés" vide={nonQualifies.length === 0}><ListeEcheances lignes={nonQualifies} /></Bloc>
          </>
        )}
      </div>
    </div>
  );
}
