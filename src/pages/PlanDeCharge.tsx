import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ajouterJours, dateDuJourParis } from '@domain/dates';
import type { ISODate } from '@domain/types';
import { useMoi } from '@/auth/SessionProvider';
import { peutModifierDossier } from '@/auth/permissions';
import { listerCollaborateurs } from '@/data/echeances';
import { listerExercices, majDateCible, planDeCharge, type FiltresExercices } from '@/data/exercices';
import type { LigneExercice } from '@/data/types';
import Bloc from '@/components/Bloc';
import { messageErreur } from '@/lib/erreurs';
import { formaterDate } from '@/lib/format';
import { CHARTE, teintes } from '@/lib/charte';
import { LIBELLES_ETAPE } from '@/lib/libelles';
import { cn } from '@/lib/utils';

const SEMAINES = 26;
const SANS_SENIOR = 'none';
type Clic = { lundi?: ISODate; payload?: { lundi?: ISODate } };
const CHAMP = 'rounded border border-gris px-2 py-1 text-sm';

/** Lundi de la semaine de la date donnée. */
export function lundiDe(iso: ISODate): ISODate {
  const jour = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return ajouterJours(iso, -((jour + 6) % 7));
}

function LigneSemaine({ x, peutModifier }: { x: LigneExercice; peutModifier: boolean }) {
  const client = useQueryClient();
  const [date, setDate] = useState(x.date_cible ?? '');
  const mutation = useMutation({
    mutationFn: () => majDateCible(x.id, date, x.date_approbation),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['plan'] }),
        client.invalidateQueries({ queryKey: ['exercices'] }),
        client.invalidateQueries({ queryKey: ['accueil'] }),
      ]),
  });
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <Link to={`/dossiers/${x.dossier_id}`} className="font-bold text-primaire hover:underline">{x.raison_sociale}</Link>
      <span>Étape {x.etape_actuelle} : {LIBELLES_ETAPE[x.etape_actuelle]}</span>
      {peutModifier ? (
        <>
          <input type="date" aria-label={`Date cible de ${x.raison_sociale}`} className={CHAMP} value={date} onChange={(e) => setDate(e.target.value)} />
          <button
            type="button"
            disabled={!date || date === x.date_cible || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="rounded border border-primaire px-2 py-1 text-xs font-bold text-primaire hover:bg-primaire/10 disabled:opacity-50"
          >
            Enregistrer la date cible
          </button>
        </>
      ) : (
        <span className="text-gris">Date cible : {x.date_cible ? formaterDate(x.date_cible) : 'non définie'}</span>
      )}
      {mutation.error && <span role="alert" className="text-xs text-red-600">{messageErreur(mutation.error)}</span>}
    </li>
  );
}

export default function PlanDeCharge() {
  const { moi } = useMoi();
  const [equipe, setEquipe] = useState('');
  const [managerId, setManagerId] = useState('');
  const [seniorId, setSeniorId] = useState('');
  const [semaine, setSemaine] = useState<ISODate | null>(null);

  const debut = lundiDe(dateDuJourParis(new Date()));
  const filtres: FiltresExercices = {
    mesDossiers: false,
    equipe: equipe === '' ? undefined : Number(equipe),
    managerId: managerId || undefined,
  };
  const plan = useQuery({ queryKey: ['plan', debut, filtres], queryFn: () => planDeCharge(debut, SEMAINES, filtres) });
  const { data: collaborateurs = [] } = useQuery({ queryKey: ['collaborateurs'], queryFn: listerCollaborateurs });
  const tous = useQuery({ queryKey: ['exercices', 'managers'], queryFn: () => listerExercices({ mesDossiers: false }, moi!.id), enabled: !!moi });
  const liste = useQuery({
    queryKey: ['exercices', 'plan', semaine, filtres, seniorId, moi?.id],
    enabled: !!moi && !!semaine,
    queryFn: () => listerExercices({ ...filtres, seniorId: seniorId || undefined }, moi!.id),
  });

  if (!moi) return null;

  const lignes = plan.data ?? [];
  const trigramme = (id: string) => collaborateurs.find((c) => c.id === id)?.trigramme ?? '?';
  const nom = (id: string | null) => (id ? trigramme(id) : 'Non affecté');
  const seniors = [...new Set(lignes.map((l) => l.senior_id))]
    .map((id) => ({ id: id ?? SANS_SENIOR, tri: nom(id) }))
    .sort((a, b) => a.tri.localeCompare(b.tri));
  const visibles = lignes.filter((l) => !seniorId || l.senior_id === seniorId);
  const segments = seniors.filter((s) => !seniorId || s.id === seniorId);
  const nbSegments = Math.max(segments.length, 1);
  const teintesFaire = teintes(CHARTE.primaire, nbSegments);
  const teintesSup = teintes(CHARTE.gris, nbSegments);
  const managers = [...new Set((tous.data ?? []).map((x) => x.manager_id).filter((id): id is string => !!id))]
    .map((id) => ({ id, tri: trigramme(id) }))
    .sort((a, b) => a.tri.localeCompare(b.tri));
  const semaines = Array.from({ length: SEMAINES }, (_, i) => {
    const lundi = ajouterJours(debut, 7 * i);
    const doc = visibles.filter((l) => l.semaine === lundi);
    const d: Record<string, string | number> = { lundi, label: formaterDate(lundi), a_faire: 0, supervises: 0 };
    for (const l of doc) {
      const k = l.senior_id ?? SANS_SENIOR;
      d[`af_${k}`] = ((d[`af_${k}`] as number) ?? 0) + l.a_faire;
      d[`su_${k}`] = ((d[`su_${k}`] as number) ?? 0) + l.supervises;
      d.a_faire = (d.a_faire as number) + l.a_faire;
      d.supervises = (d.supervises as number) + l.supervises;
    }
    return d as { lundi: ISODate; label: string; a_faire: number; supervises: number };
  });
  const dossiersSemaine = semaine
    ? (liste.data ?? []).filter((x) => x.date_cible && x.date_cible >= semaine && x.date_cible < ajouterJours(semaine, 7))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded border border-gris/60 p-3">
        <label className="flex flex-col text-xs font-bold">
          Équipe
          <input type="number" min={1} className={cn(CHAMP, 'w-20')} value={equipe} onChange={(e) => { setEquipe(e.target.value); setSemaine(null); }} />
        </label>
        <label className="flex flex-col text-xs font-bold">
          Manager
          <select className={CHAMP} value={managerId} onChange={(e) => { setManagerId(e.target.value); setSemaine(null); }}>
            <option value="">Tous</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.tri}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs font-bold">
          Senior
          <select className={CHAMP} value={seniorId} onChange={(e) => { setSeniorId(e.target.value); setSemaine(null); }}>
            <option value="">Tous</option>
            {seniors.filter((s) => s.id !== SANS_SENIOR).map((s) => <option key={s.id} value={s.id}>{s.tri}</option>)}
          </select>
        </label>
      </div>

      <Bloc titre="Exercices par semaine de date cible" requetes={[plan]}>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={semaines} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={3} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              {segments.map((sg, i) => (
                <Bar key={`af_${sg.id}`} dataKey={`af_${sg.id}`} name={`${sg.tri} : à faire`} stackId="afaire" fill={teintesFaire[i]} cursor="pointer" onClick={(d: Clic) => { const l = d.payload?.lundi ?? d.lundi; if (l) setSemaine(l); }} />
              ))}
              {segments.map((sg, i) => (
                <Bar key={`su_${sg.id}`} dataKey={`su_${sg.id}`} name={`${sg.tri} : supervisés`} stackId="supervises" fill={teintesSup[i]} cursor="pointer" onClick={(d: Clic) => { const l = d.payload?.lundi ?? d.lundi; if (l) setSemaine(l); }} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="mt-3 w-full text-left text-sm">
          <caption className="sr-only">Détail par semaine</caption>
          <thead>
            <tr className="border-b border-gris text-marine">
              <th className="px-2 py-1 font-bold">Semaine du</th>
              <th className="px-2 py-1 font-bold">À faire</th>
              <th className="px-2 py-1 font-bold">Supervisés</th>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {semaines.map((s) => (
              <tr key={s.lundi} className="border-b border-gris/40">
                <td className="px-2 py-1">{s.label}</td>
                <td className="px-2 py-1">{s.a_faire}</td>
                <td className="px-2 py-1">{s.supervises}</td>
                <td className="px-2 py-1">
                  <button type="button" onClick={() => setSemaine(s.lundi)} className="text-xs font-bold text-primaire hover:underline">
                    Voir la semaine du {s.label}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloc>

      {semaine && (
        <Bloc titre={`Dossiers de la semaine du ${formaterDate(semaine)}`} requetes={[liste]} vide={dossiersSemaine.length === 0}>
          <ul className="space-y-2">
            {dossiersSemaine.map((x) => <LigneSemaine key={`${x.id}-${x.date_cible}`} x={x} peutModifier={peutModifierDossier(moi)} />)}
          </ul>
        </Bloc>
      )}
    </div>
  );
}
