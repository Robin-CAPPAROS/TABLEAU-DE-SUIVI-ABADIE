import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dateDuJourParis } from '@domain/dates';
import { useMoi } from '@/auth/SessionProvider';
import { peutVoirIndicateurs } from '@/auth/permissions';
import { listerCollaborateurs } from '@/data/echeances';
import { listerExercices, type FiltresExercices } from '@/data/exercices';
import { lireIndicateurs, type BlocIndicateurs } from '@/data/pilotage';
import Bloc from '@/components/Bloc';
import ExportExcel from '@/components/ExportExcel';
import { formaterNombre, formaterPourcentage, saisonFiscale } from '@/lib/format';
import { cn } from '@/lib/utils';

const CHAMP = 'rounded border border-gris px-2 py-1 text-sm';
const INDISPONIBLE = 'Comparaison indisponible pour la première saison';

function Carte({ titre, valeur, detail, precedente }: { titre: string; valeur: string; detail: React.ReactNode; precedente: string | null }) {
  return (
    <section className="rounded border border-gris/60 bg-white p-4">
      <h3 className="text-sm font-bold text-marine">{titre}</h3>
      <p className="mt-1 text-2xl font-bold text-primaire">{valeur}</p>
      <div className="mt-1 text-sm">{detail}</div>
      <p className="mt-2 text-xs text-gris">{precedente === null ? INDISPONIBLE : `Saison précédente : ${precedente}`}</p>
    </section>
  );
}

const jours = (n: number | null) => (n === null ? 'n/d' : `${formaterNombre(n)} jours`);

const COLONNES = [
  { cle: 'groupe', libelle: '' },
  { cle: 'retards', libelle: 'Dépôts en retard' },
  { cle: 'cabinet', libelle: 'dont cause cabinet' },
  { cle: 'supervises', libelle: 'Supervisés avant la date cible' },
  { cle: 'marge', libelle: 'Marge liasse (jours)' },
  { cle: 'delai', libelle: 'Délai clôture et supervision (jours)' },
];

function ligne(groupe: string, b: BlocIndicateurs) {
  return {
    groupe,
    retards: b.depots_en_retard.total,
    cabinet: b.depots_en_retard.par_cause.cabinet,
    supervises: b.bilans_supervises_avant_cible.pourcentage,
    marge: b.marge_liasse.moyenne_jours,
    delai: b.delai_cloture_supervision.moyenne_jours,
  };
}

function Tableau({ titre, premiere, lignes, fichier }: { titre: string; premiere: string; lignes: ReturnType<typeof ligne>[]; fichier: string }) {
  return (
    <Bloc titre={titre} vide={lignes.length === 0}>
      <div className="mb-2"><ExportExcel nomFichier={fichier} colonnes={COLONNES.map((c, i) => (i === 0 ? { ...c, libelle: premiere } : c))} lignes={lignes} /></div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gris text-marine">
            {COLONNES.map((c, i) => <th key={c.cle} className="px-2 py-1 font-bold">{i === 0 ? premiere : c.libelle}</th>)}
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.groupe} className="border-b border-gris/40">
              <td className="px-2 py-1 font-bold">{l.groupe}</td>
              <td className="px-2 py-1">{l.retards}</td>
              <td className="px-2 py-1">{l.cabinet}</td>
              <td className="px-2 py-1">{formaterPourcentage(l.supervises)}</td>
              <td className="px-2 py-1">{formaterNombre(l.marge)}</td>
              <td className="px-2 py-1">{formaterNombre(l.delai)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Bloc>
  );
}

export default function Indicateurs() {
  const { moi } = useMoi();
  const saisonCourante = saisonFiscale(dateDuJourParis(new Date()));
  const [saison, setSaison] = useState(saisonCourante);
  const [equipe, setEquipe] = useState('');
  const [managerId, setManagerId] = useState('');
  const [seniorId, setSeniorId] = useState('');

  const autorise = !!moi && peutVoirIndicateurs(moi);
  const filtres: FiltresExercices = {
    mesDossiers: false,
    equipe: equipe === '' ? undefined : Number(equipe),
    managerId: managerId || undefined,
    seniorId: seniorId || undefined,
  };
  const ind = useQuery({ queryKey: ['indicateurs', saison, filtres], queryFn: () => lireIndicateurs(saison, filtres), enabled: autorise });
  const { data: collaborateurs = [] } = useQuery({ queryKey: ['collaborateurs'], queryFn: listerCollaborateurs, enabled: autorise });
  const tous = useQuery({ queryKey: ['exercices', 'managers'], queryFn: () => listerExercices({ mesDossiers: false }, moi!.id), enabled: autorise });

  if (!moi) return null;
  if (!autorise) return <Navigate to="/" replace />;

  const tri = (id: string) => collaborateurs.find((c) => c.id === id)?.trigramme ?? '?';
  const options = (champ: 'manager_id' | 'senior_id') =>
    [...new Set((tous.data ?? []).map((x) => x[champ]).filter((id): id is string => !!id))]
      .map((id) => ({ id, tri: tri(id) }))
      .sort((a, b) => a.tri.localeCompare(b.tri));
  const g = ind.data?.global;
  const p = ind.data?.precedente ?? null;
  const saisons = [0, 1, 2, 3].map((i) => saisonCourante - i);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded border border-gris/60 p-3">
        <label className="flex flex-col text-xs font-bold">
          Saison
          <select className={CHAMP} value={saison} onChange={(e) => setSaison(Number(e.target.value))}>
            {saisons.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs font-bold">
          Équipe
          <input type="number" min={1} max={3} className={cn(CHAMP, 'w-20')} value={equipe} onChange={(e) => setEquipe(e.target.value)} />
        </label>
        <label className="flex flex-col text-xs font-bold">
          Manager
          <select className={CHAMP} value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">Tous</option>
            {options('manager_id').map((m) => <option key={m.id} value={m.id}>{m.tri}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs font-bold">
          Senior
          <select className={CHAMP} value={seniorId} onChange={(e) => setSeniorId(e.target.value)}>
            <option value="">Tous</option>
            {options('senior_id').map((s) => <option key={s.id} value={s.id}>{s.tri}</option>)}
          </select>
        </label>
      </div>

      <Bloc titre={`Saison fiscale ${saison}`} requetes={[ind]}>
        {g && (
          <div className="grid gap-4 md:grid-cols-2">
            <Carte
              titre="Dépôts en retard"
              valeur={String(g.depots_en_retard.total)}
              detail={<>dont cause cabinet : {g.depots_en_retard.par_cause.cabinet}, non qualifiés : {g.depots_en_retard.par_cause.non_qualifie}</>}
              precedente={p ? String(p.depots_en_retard.total) : null}
            />
            <Carte
              titre="Bilans supervisés avant la date cible"
              valeur={formaterPourcentage(g.bilans_supervises_avant_cible.pourcentage)}
              detail={<>{g.bilans_supervises_avant_cible.numerateur} / {g.bilans_supervises_avant_cible.denominateur}</>}
              precedente={p ? formaterPourcentage(p.bilans_supervises_avant_cible.pourcentage) : null}
            />
            <Carte
              titre="Marge avant l'échéance de la liasse"
              valeur={jours(g.marge_liasse.moyenne_jours)}
              detail={<>en retard : {g.marge_liasse.repartition.en_retard}, moins de 7 jours : {g.marge_liasse.repartition.moins_7}, 7 à 30 jours : {g.marge_liasse.repartition.de_7_a_30}, plus de 30 jours : {g.marge_liasse.repartition.plus_30}</>}
              precedente={p ? jours(p.marge_liasse.moyenne_jours) : null}
            />
            <Carte
              titre="Délai entre clôture et supervision"
              valeur={jours(g.delai_cloture_supervision.moyenne_jours)}
              detail={<>moyenne entre la fin d'exercice et la validation de l'étape 4</>}
              precedente={p ? jours(p.delai_cloture_supervision.moyenne_jours) : null}
            />
          </div>
        )}
      </Bloc>

      {ind.data && (
        <>
          <Tableau titre="Par équipe" premiere="Équipe" fichier={`indicateurs-equipes-${saison}`} lignes={ind.data.par_equipe.map((b) => ligne(`Équipe ${b.equipe}`, b))} />
          <Tableau titre="Par Senior" premiere="Senior" fichier={`indicateurs-seniors-${saison}`} lignes={ind.data.par_senior.map((b) => ligne(tri(b.senior_id), b))} />
        </>
      )}
    </div>
  );
}
