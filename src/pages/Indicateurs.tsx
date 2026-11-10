import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dateDuJourParis } from '@domain/dates';
import { useMoi } from '@/auth/SessionProvider';
import { peutVoirIndicateurs } from '@/auth/permissions';
import { listerCollaborateurs, listerEcheances } from '@/data/echeances';
import { listerExercices, type FiltresExercices } from '@/data/exercices';
import { lireIndicateurs, type BlocIndicateurs } from '@/data/pilotage';
import Bloc from '@/components/Bloc';
import ExportExcel from '@/components/ExportExcel';
import { messageErreur } from '@/lib/erreurs';
import { bornesSaison, formaterDate, formaterNombre, formaterPourcentage, saisonFiscale } from '@/lib/format';
import { LIBELLES_CAUSE, LIBELLES_TYPE } from '@/lib/libelles';
import type { TypeEcheance } from '@domain/types';
import { cn } from '@/lib/utils';

const CHAMP = 'rounded border border-gris px-2 py-1 text-sm';
const INDISPONIBLE = 'Comparaison indisponible pour la première saison';

type LigneListe = { cle: string; dossierId: string; nom: string; detail: string };

function Carte({ contexte, titre, valeur, detail, precedente, titreListe = 'Dossiers concernés', charger }: {
  contexte: string; titre: string; valeur: string; detail: React.ReactNode; precedente: string | null; titreListe?: string; charger: () => Promise<LigneListe[]>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const liste = useQuery({ queryKey: ['indicateurs-liste', titre, contexte, ouvert], queryFn: charger, enabled: ouvert });
  return (
    <section className="rounded border border-gris/60 bg-white p-4">
      <h3 className="text-sm font-bold text-marine">{titre}</h3>
      <p className="mt-1 text-2xl font-bold text-primaire">{valeur}</p>
      <div className="mt-1 text-sm">{detail}</div>
      <p className="mt-2 text-xs text-gris">{precedente === null ? INDISPONIBLE : `Saison précédente : ${precedente}`}</p>
      <button type="button" aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)} className="mt-2 text-xs font-bold text-primaire hover:underline">
        {ouvert ? 'Masquer les dossiers concernés' : 'Voir les dossiers concernés'}
      </button>
      {ouvert && (
        <div className="mt-2">
          <h4 className="text-xs font-bold text-marine">{titreListe}</h4>
          {liste.error ? (
            <p role="alert" className="text-xs text-red-600">{messageErreur(liste.error, 'Chargement impossible.')}</p>
          ) : liste.isLoading ? (
            <p className="text-xs text-gris">Chargement…</p>
          ) : (liste.data ?? []).length === 0 ? (
            <p className="text-xs text-gris">Aucun dossier.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {(liste.data ?? []).map((l) => (
                <li key={l.cle}>
                  <Link to={`/dossiers/${l.dossierId}`} className="font-bold text-primaire hover:underline">{l.nom}</Link> : {l.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

const jours = (n: number | null) => (n === null ? 'non disponible' : `${formaterNombre(n)} jours`);

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
  const { du, au } = bornesSaison(saison);
  const horsFiltre = (x: { manager_id: string | null; senior_id: string | null }) =>
    (!managerId || x.manager_id === managerId) && (!seniorId || x.senior_id === seniorId);
  const echeancesSaison = async (types?: TypeEcheance[]) =>
    (await listerEcheances({ du, au, types, equipe: filtres.equipe, mesDossiers: false }, moi.id)).filter(horsFiltre);
  const exercicesSaison = async () =>
    (await listerExercices(filtres, moi.id)).filter((x) => x.date_fin >= du && x.date_fin <= au);
  const aujourdhui = dateDuJourParis(new Date());
  const chargerRetards = async (): Promise<LigneListe[]> =>
    (await echeancesSaison()).filter((e) => e.depot_tardif).map((e) => ({
      cle: e.id, dossierId: e.dossier_id, nom: e.raison_sociale,
      detail: `${LIBELLES_TYPE[e.type]}, limite ${formaterDate(e.date_limite)}, dépôt ${e.date_depot ? formaterDate(e.date_depot) : 'non disponible'}, cause : ${e.cause_retard ? LIBELLES_CAUSE[e.cause_retard] : 'non qualifiée'}`,
    }));
  const chargerNonSupervises = async (): Promise<LigneListe[]> =>
    (await exercicesSaison()).filter((x) => x.date_cible && x.date_cible <= aujourdhui && x.etape_actuelle < 4).map((x) => ({
      cle: x.id, dossierId: x.dossier_id, nom: x.raison_sociale,
      detail: `fin d'exercice ${formaterDate(x.date_fin)}, date cible ${formaterDate(x.date_cible!)}, étape ${x.etape_actuelle}`,
    }));
  const chargerLiasses = async (): Promise<LigneListe[]> =>
    (await echeancesSaison(['liasse'])).filter((e) => e.date_depot).map((e) => {
      const marge = Math.round((Date.parse(e.date_limite) - Date.parse(e.date_depot!)) / 86400000);
      return { cle: e.id, dossierId: e.dossier_id, nom: e.raison_sociale, detail: `limite ${formaterDate(e.date_limite)}, dépôt ${formaterDate(e.date_depot!)}, marge ${marge} jours` };
    });
  const chargerSupervises = async (): Promise<LigneListe[]> =>
    (await exercicesSaison()).filter((x) => x.etape_actuelle >= 4).map((x) => ({
      cle: x.id, dossierId: x.dossier_id, nom: x.raison_sociale,
      detail: `fin d'exercice ${formaterDate(x.date_fin)}, étape ${x.etape_actuelle}`,
    }));
  const contexte = JSON.stringify([saison, filtres]);
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
          <select className={cn(CHAMP, 'w-24')} value={equipe} onChange={(e) => setEquipe(e.target.value)}>
            <option value="">Toutes</option>
            {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
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
              contexte={contexte}
              titre="Dépôts en retard"
              valeur={String(g.depots_en_retard.total)}
              detail={<>
                <p>{(['cabinet', 'client', 'administration', 'autre'] as const).map((c) => `${LIBELLES_CAUSE[c]} : ${g.depots_en_retard.par_cause[c]}`).join(', ')}, Non qualifié : {g.depots_en_retard.par_cause.non_qualifie}</p>
                {Object.keys(g.depots_en_retard.par_type).length > 0 && (
                  <p className="text-gris">Par type : {Object.entries(g.depots_en_retard.par_type).map(([t, n]) => `${LIBELLES_TYPE[t as TypeEcheance] ?? t} : ${n}`).join(', ')}</p>
                )}
              </>}
              charger={chargerRetards}
              precedente={p ? String(p.depots_en_retard.total) : null}
            />
            <Carte
              contexte={contexte}
              titre="Bilans supervisés avant la date cible"
              valeur={formaterPourcentage(g.bilans_supervises_avant_cible.pourcentage)}
              detail={<>{g.bilans_supervises_avant_cible.numerateur} / {g.bilans_supervises_avant_cible.denominateur}</>}
              precedente={p ? formaterPourcentage(p.bilans_supervises_avant_cible.pourcentage) : null}
              titreListe="Bilans non supervisés à date"
              charger={chargerNonSupervises}
            />
            <Carte
              contexte={contexte}
              titre="Marge avant l'échéance de la liasse"
              valeur={jours(g.marge_liasse.moyenne_jours)}
              detail={<>en retard : {g.marge_liasse.repartition.en_retard}, moins de 7 jours : {g.marge_liasse.repartition.moins_7}, 7 à 30 jours : {g.marge_liasse.repartition.de_7_a_30}, plus de 30 jours : {g.marge_liasse.repartition.plus_30}</>}
              precedente={p ? jours(p.marge_liasse.moyenne_jours) : null}
              charger={chargerLiasses}
            />
            <Carte
              contexte={contexte}
              titre="Délai entre clôture et supervision"
              valeur={jours(g.delai_cloture_supervision.moyenne_jours)}
              detail={<>moyenne entre la fin d'exercice et la validation de l'étape 4</>}
              precedente={p ? jours(p.delai_cloture_supervision.moyenne_jours) : null}
              charger={chargerSupervises}
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
