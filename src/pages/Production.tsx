import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMoi } from '@/auth/SessionProvider';
import { peutRevenir, peutValiderEtape } from '@/auth/permissions';
import { listerCollaborateurs } from '@/data/echeances';
import { listerExercices, revenirEtape, validerEtape, type FiltresExercices } from '@/data/exercices';
import type { CollaborateurRef, LigneExercice, Moi } from '@/data/types';
import Bloc from '@/components/Bloc';
import ExportExcel from '@/components/ExportExcel';
import PlanDeCharge from '@/pages/PlanDeCharge';
import { messageErreur } from '@/lib/erreurs';
import { formaterDate } from '@/lib/format';
import { LIBELLES_ETAPE } from '@/lib/libelles';
import { cn } from '@/lib/utils';

const CHAMP = 'rounded border border-gris px-2 py-1 text-sm';
const COLONNES = [
  { cle: 'dossier', libelle: 'Dossier' },
  { cle: 'cloture', libelle: 'Clôture' },
  { cle: 'dateCible', libelle: 'Date cible' },
  { cle: 'etape', libelle: 'Étape' },
  { cle: 'intervenant', libelle: 'Intervenant attendu' },
  { cle: 'retard', libelle: 'Retard' },
];

/** Intervenant attendu pour faire avancer l'exercice, selon son étape actuelle. */
export function intervenantAttendu(x: LigneExercice, collaborateurs: CollaborateurRef[]): string {
  const tri = (id: string | null) => (id ? collaborateurs.find((c) => c.id === id)?.trigramme ?? '?' : '?');
  switch (x.etape_actuelle) {
    case 0:
    case 1:
      return tri(x.csp_id);
    case 2:
    case 4:
      return tri(x.senior_id);
    case 3:
      return tri(x.manager_id);
    case 5:
      return 'En attente de la liasse';
    default:
      return 'Terminé';
  }
}

function Retard() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" />
      En retard
    </span>
  );
}

function ActionsExercice({ x, moi }: { x: LigneExercice; moi: Moi }) {
  const client = useQueryClient();
  const [retour, setRetour] = useState(false);
  const [etape, setEtape] = useState(0);
  const [commentaire, setCommentaire] = useState('');
  const [manque, setManque] = useState(false);

  const mutation = useMutation({
    mutationFn: (action: () => Promise<void>) => action(),
    onSuccess: () => {
      setRetour(false);
      setCommentaire('');
      setManque(false);
      return Promise.all([
        client.invalidateQueries({ queryKey: ['exercices'] }),
        client.invalidateQueries({ queryKey: ['accueil'] }),
        client.invalidateQueries({ queryKey: ['plan'] }),
      ]);
    },
  });

  const suivante = x.etape_actuelle + 1;
  const peutValider = x.etape_actuelle < 5 && peutValiderEtape(moi.role, suivante);
  const peutRetour = peutRevenir(moi.role) && x.etape_actuelle > 0;
  if (!peutValider && !peutRetour) return null;

  const bouton = 'rounded border border-primaire px-2 py-1 text-xs font-bold text-primaire hover:bg-primaire/10';
  const envoyer = () => {
    if (commentaire.trim() === '') {
      setManque(true);
      return;
    }
    setManque(false);
    mutation.mutate(() => revenirEtape(x.id, etape, commentaire.trim()));
  };

  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap gap-1">
        {peutValider && (
          <button type="button" className={bouton} disabled={mutation.isPending} onClick={() => mutation.mutate(() => validerEtape(x.id, suivante))}>
            Valider : {LIBELLES_ETAPE[suivante]}
          </button>
        )}
        {peutRetour && (
          <button type="button" className={bouton} onClick={() => { setRetour((v) => !v); setEtape(0); mutation.reset(); }}>
            Revenir à une étape
          </button>
        )}
      </div>
      {retour && (
        <div className="space-y-1 rounded border border-gris/60 p-2 text-xs">
          <label className="flex flex-col font-bold">
            Étape de retour
            <select className={CHAMP} value={etape} onChange={(e) => setEtape(Number(e.target.value))}>
              {Array.from({ length: x.etape_actuelle }, (_, n) => (
                <option key={n} value={n}>{n} : {LIBELLES_ETAPE[n]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col font-bold">
            Commentaire
            <textarea className={CHAMP} rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          </label>
          {manque && <p role="alert" className="text-red-600">Le commentaire est obligatoire.</p>}
          <button type="button" className={bouton} disabled={mutation.isPending} onClick={envoyer}>Confirmer le retour</button>
        </div>
      )}
      {mutation.error && <p role="alert" className="text-xs text-red-600">{messageErreur(mutation.error)}</p>}
    </div>
  );
}

function Colonnes({ lignes, collaborateurs, moi }: { lignes: LigneExercice[]; collaborateurs: CollaborateurRef[]; moi: Moi }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: 7 }, (_, n) => {
        const cartes = lignes.filter((x) => x.etape_actuelle === n);
        return (
          <section key={n} aria-label={`Étape ${n}`} className="w-64 shrink-0 rounded border border-gris/60 bg-gris/10 p-2">
            <h3 className="mb-2 text-sm font-bold text-marine">{n} : {LIBELLES_ETAPE[n]} ({cartes.length})</h3>
            <ul className="space-y-2">
              {cartes.map((x) => (
                <li key={x.id} className="rounded border border-gris/60 bg-white p-2 text-xs">
                  <Link to={`/dossiers/${x.dossier_id}`} className="text-sm font-bold text-primaire hover:underline">{x.raison_sociale}</Link>
                  <p>Clôture : {formaterDate(x.date_fin)}</p>
                  <p>Date cible : {x.date_cible ? formaterDate(x.date_cible) : 'non définie'}</p>
                  <p>Intervenant attendu : <span className="font-bold">{intervenantAttendu(x, collaborateurs)}</span></p>
                  {x.en_retard && <Retard />}
                  <ActionsExercice x={x} moi={moi} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Tableau({ lignes, collaborateurs }: { lignes: LigneExercice[]; collaborateurs: CollaborateurRef[] }) {
  const exportables = lignes.map((x) => ({
    dossier: x.raison_sociale,
    cloture: formaterDate(x.date_fin),
    dateCible: x.date_cible ? formaterDate(x.date_cible) : '',
    etape: `${x.etape_actuelle} : ${LIBELLES_ETAPE[x.etape_actuelle]}`,
    intervenant: intervenantAttendu(x, collaborateurs),
    retard: x.en_retard ? 'En retard' : '',
  }));
  return (
    <div className="space-y-2">
      <ExportExcel nomFichier="production" colonnes={COLONNES} lignes={exportables} />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gris text-marine">
              {COLONNES.map((c) => <th key={c.cle} className="px-2 py-1 font-bold">{c.libelle}</th>)}
            </tr>
          </thead>
          <tbody>
            {lignes.map((x, i) => (
              <tr key={x.id} className="border-b border-gris/40">
                <td className="px-2 py-1"><Link to={`/dossiers/${x.dossier_id}`} className="font-bold text-primaire hover:underline">{x.raison_sociale}</Link></td>
                <td className="px-2 py-1">{exportables[i].cloture}</td>
                <td className="px-2 py-1">{exportables[i].dateCible}</td>
                <td className="px-2 py-1">{exportables[i].etape}</td>
                <td className="px-2 py-1">{exportables[i].intervenant}</td>
                <td className="px-2 py-1">{x.en_retard && <Retard />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Onglet = 'colonnes' | 'tableau' | 'plan';
const ONGLETS: { id: Onglet; libelle: string }[] = [
  { id: 'colonnes', libelle: 'Colonnes' },
  { id: 'tableau', libelle: 'Tableau' },
  { id: 'plan', libelle: 'Plan de charge' },
];

export default function Production() {
  const { moi } = useMoi();
  const [onglet, setOnglet] = useState<Onglet>('colonnes');
  const [mesDossiers, setMesDossiers] = useState(true);
  const [equipe, setEquipe] = useState('');
  const [collaborateurId, setCollaborateurId] = useState('');

  const filtres: FiltresExercices = {
    mesDossiers,
    equipe: equipe === '' ? undefined : Number(equipe),
    collaborateurId: collaborateurId || undefined,
  };
  const exercices = useQuery({
    queryKey: ['exercices', filtres, moi?.id],
    enabled: !!moi && onglet !== 'plan',
    queryFn: () => listerExercices(filtres, moi!.id),
  });
  const { data: collaborateurs = [] } = useQuery({ queryKey: ['collaborateurs'], queryFn: listerCollaborateurs });

  if (!moi) return null;
  const lignes = exercices.data ?? [];

  return (
    <section className="space-y-4 font-cabinet">
      <h2 className="text-xl font-bold text-marine">Production des bilans</h2>
      <div role="tablist" className="flex gap-2">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={onglet === o.id}
            onClick={() => setOnglet(o.id)}
            className={cn('rounded px-3 py-1.5 text-sm font-bold', onglet === o.id ? 'bg-primaire text-white' : 'border border-gris text-marine')}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      {onglet === 'plan' ? (
        <PlanDeCharge />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded border border-gris/60 p-3">
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={mesDossiers} onChange={(e) => setMesDossiers(e.target.checked)} />
              Mes dossiers
            </label>
            <label className="flex flex-col text-xs font-bold">
              Collaborateur
              <select className={CHAMP} value={collaborateurId} onChange={(e) => setCollaborateurId(e.target.value)}>
                <option value="">Tous</option>
                {collaborateurs.map((c) => <option key={c.id} value={c.id}>{c.trigramme} ({c.prenom} {c.nom})</option>)}
              </select>
            </label>
            <label className="flex flex-col text-xs font-bold">
              Équipe
              <input type="number" min={1} className={cn(CHAMP, 'w-20')} value={equipe} onChange={(e) => setEquipe(e.target.value)} />
            </label>
          </div>
          <Bloc titre={onglet === 'colonnes' ? 'Exercices par étape' : 'Exercices'} requetes={[exercices]}>
            {onglet === 'colonnes' ? (
              <Colonnes lignes={lignes} collaborateurs={collaborateurs} moi={moi} />
            ) : (
              <Tableau lignes={lignes} collaborateurs={collaborateurs} />
            )}
          </Bloc>
        </>
      )}
    </section>
  );
}
