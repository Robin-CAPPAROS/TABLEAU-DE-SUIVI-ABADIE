import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMoi } from '@/auth/SessionProvider';
import { peutModifierDossier } from '@/auth/permissions';
import { listerCollaborateurs } from '@/data/echeances';
import { majDateCible } from '@/data/exercices';
import {
  exerciceEnCours, lireDossier, listerEcheancesDossier, majDossierOutil,
  type ChampsOutil, type Dossier,
} from '@/data/dossiers';
import type { LigneExercice } from '@/data/types';
import ActionsEcheance from '@/components/ActionsEcheance';
import Bloc from '@/components/Bloc';
import { StatutEcheanceBadge } from '@/components/StatutBadge';
import { messageErreur } from '@/lib/erreurs';
import { formaterDate, formaterDateHeureParis } from '@/lib/format';
import { LIBELLES_ETAPE, LIBELLES_TYPE } from '@/lib/libelles';

const CHAMP = 'rounded border border-gris px-2 py-1 text-sm';
const BOUTON = 'rounded border border-primaire px-3 py-1.5 text-sm font-bold text-primaire hover:bg-primaire/10 disabled:opacity-50';
const MISSIONS: Record<string, string> = { tenue: 'Tenue', revision: 'Révision', micro_bnc: 'Micro-BNC', irpp: 'IRPP' };
const STATUTS: Record<string, string> = { actif: 'Actif', sorti: 'Sorti' };

const versChamps = (d: Dossier): ChampsOutil => ({
  equipe: d.equipe, mission: d.mission, statut: d.statut, jourTva: d.jour_echeance_tva,
  isN1: d.is_n1_superieur_3000, commentaire: d.commentaire,
});

function Valeur({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gris">{libelle}</dt>
      <dd className="text-sm font-bold text-marine">{children ?? 'Non renseigné'}</dd>
    </div>
  );
}

function ChampsOutilBloc({ dossier, peutModifier }: { dossier: Dossier; peutModifier: boolean }) {
  const client = useQueryClient();
  const [edition, setEdition] = useState(false);
  const [c, setC] = useState<ChampsOutil>(versChamps(dossier));
  const mutation = useMutation({
    mutationFn: () => majDossierOutil(dossier.id, { ...c, commentaire: c.commentaire?.trim() ? c.commentaire : null }),
    onSuccess: async () => {
      setEdition(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['dossier', dossier.id] }),
        client.invalidateQueries({ queryKey: ['echeances'] }),
        client.invalidateQueries({ queryKey: ['exercices'] }),
      ]);
    },
  });
  const annuler = () => { setC(versChamps(dossier)); setEdition(false); mutation.reset(); };
  const maj = (p: Partial<ChampsOutil>) => setC((v) => ({ ...v, ...p }));

  return (
    <section className="rounded border border-gris/60 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-base font-bold text-marine">Informations de suivi</h3>
        {peutModifier && !edition && <button type="button" className={BOUTON} onClick={() => setEdition(true)}>Modifier</button>}
      </div>
      {!edition ? (
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Valeur libelle="Équipe">{dossier.equipe}</Valeur>
          <Valeur libelle="Mission">{dossier.mission ? MISSIONS[dossier.mission] : null}</Valeur>
          <Valeur libelle="Statut">{STATUTS[dossier.statut]}</Valeur>
          <Valeur libelle="Jour d'échéance de TVA">{dossier.jour_echeance_tva}</Valeur>
          <Valeur libelle="IS N-1 supérieur à 3 000 €">{dossier.is_n1_superieur_3000 ? 'Oui' : 'Non'}</Valeur>
          <Valeur libelle="Commentaire">{dossier.commentaire}</Valeur>
        </dl>
      ) : (
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <label className="flex flex-col text-xs font-bold">
            Équipe
            <select className={CHAMP} value={c.equipe ?? ''} onChange={(e) => maj({ equipe: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">Non définie</option>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs font-bold">
            Mission
            <select className={CHAMP} value={c.mission ?? ''} onChange={(e) => maj({ mission: (e.target.value || null) as Dossier['mission'] })}>
              <option value="">Non définie</option>
              {Object.entries(MISSIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs font-bold">
            Statut
            <select className={CHAMP} value={c.statut} onChange={(e) => maj({ statut: e.target.value as Dossier['statut'] })}>
              {Object.entries(STATUTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs font-bold">
            Jour de TVA
            <input type="number" min={15} max={24} className={`${CHAMP} w-20`} value={c.jourTva ?? ''} onChange={(e) => maj({ jourTva: e.target.value === '' ? null : Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={c.isN1} onChange={(e) => maj({ isN1: e.target.checked })} />
            IS N-1 supérieur à 3 000 €
          </label>
          <label className="flex w-full flex-col text-xs font-bold">
            Commentaire
            <textarea className={CHAMP} rows={3} value={c.commentaire ?? ''} onChange={(e) => maj({ commentaire: e.target.value })} />
          </label>
          <button type="submit" disabled={mutation.isPending} className="rounded bg-primaire px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
          <button type="button" className={BOUTON} onClick={annuler}>Annuler</button>
        </form>
      )}
      {mutation.isError && <p role="alert" className="mt-2 text-sm text-red-600">{messageErreur(mutation.error)}</p>}
    </section>
  );
}

function DatesExercice({ exercice: x }: { exercice: LigneExercice }) {
  const client = useQueryClient();
  const [cible, setCible] = useState(x.date_cible ?? '');
  const [approbation, setApprobation] = useState(x.date_approbation ?? '');
  useEffect(() => { setCible(x.date_cible ?? ''); setApprobation(x.date_approbation ?? ''); }, [x.id, x.date_cible, x.date_approbation]);
  const mutation = useMutation({
    mutationFn: () => majDateCible(x.id, cible, approbation || null),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['dossier', x.dossier_id] }),
        client.invalidateQueries({ queryKey: ['exercices'] }),
        client.invalidateQueries({ queryKey: ['plan'] }),
        client.invalidateQueries({ queryKey: ['accueil'] }),
      ]),
  });
  return (
    <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
      <label className="flex flex-col text-xs font-bold">
        Date cible
        <input type="date" className={CHAMP} value={cible} onChange={(e) => setCible(e.target.value)} />
      </label>
      <label className="flex flex-col text-xs font-bold">
        Date d'approbation
        <input type="date" className={CHAMP} value={approbation} onChange={(e) => setApprobation(e.target.value)} />
      </label>
      <button type="submit" disabled={!cible || mutation.isPending} className={BOUTON}>Enregistrer les dates</button>
      {mutation.isError && <p role="alert" className="w-full text-sm text-red-600">{messageErreur(mutation.error)}</p>}
    </form>
  );
}

export default function FicheDossier() {
  const { id = '' } = useParams();
  const { moi } = useMoi();
  const fiche = useQuery({ queryKey: ['dossier', id], queryFn: () => lireDossier(id), enabled: !!id });
  const echeances = useQuery({ queryKey: ['echeances', 'dossier', id], queryFn: () => listerEcheancesDossier(id), enabled: !!id });
  const { data: collaborateurs = [] } = useQuery({ queryKey: ['collaborateurs'], queryFn: listerCollaborateurs });

  if (!moi) return null;
  const tri = (cid: string | null) => (cid ? collaborateurs.find((c) => c.id === cid)?.trigramme ?? '?' : 'Non affecté');
  const d = fiche.data?.dossier;
  const exercices = fiche.data?.exercices ?? [];
  const enCours = exerciceEnCours(exercices);
  const historique = (fiche.data?.historique ?? []).filter((h) => h.exercice_id === enCours?.id).sort((a, b) => b.date.localeCompare(a.date));
  const peutModifier = peutModifierDossier(moi);

  return (
    <div className="space-y-4">
      <Bloc titre={d?.raison_sociale ?? 'Dossier'} requetes={[fiche]}>
        {d && (
          <>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Valeur libelle="SIREN">{d.siren}</Valeur>
              <Valeur libelle="Forme juridique">{d.forme_juridique}</Valeur>
              <Valeur libelle="Régime de TVA">{d.regime_tva}</Valeur>
              <Valeur libelle="Régime fiscal">{d.regime_fiscal}</Valeur>
              <Valeur libelle="CSP">{tri(d.csp_id)}</Valeur>
              <Valeur libelle="Senior">{tri(d.senior_id)}</Valeur>
              <Valeur libelle="Manager">{tri(d.manager_id)}</Valeur>
            </dl>
            <a href={`https://app.pennylane.com/companies/${d.pennylane_id}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-primaire hover:underline">
              Ouvrir dans Pennylane
            </a>
          </>
        )}
      </Bloc>

      {d && <ChampsOutilBloc key={`${d.id}-${JSON.stringify(versChamps(d))}`} dossier={d} peutModifier={peutModifier} />}

      <Bloc titre="Exercice en cours" requetes={[fiche]} vide={!!fiche.data && !enCours}>
        {enCours && (
          <>
            <p className="text-sm">
              Du {formaterDate(enCours.date_debut)} au <strong>{formaterDate(enCours.date_fin)}</strong>, étape {enCours.etape_actuelle} : {LIBELLES_ETAPE[enCours.etape_actuelle]}
            </p>
            <p className="text-sm text-gris">
              Date cible : {enCours.date_cible ? formaterDate(enCours.date_cible) : 'non définie'}. Date d'approbation : {enCours.date_approbation ? formaterDate(enCours.date_approbation) : 'non définie'}.
            </p>
            {peutModifier && <DatesExercice exercice={enCours} />}
            <h4 className="mt-4 text-sm font-bold text-marine">Historique des étapes</h4>
            {historique.length === 0 ? (
              <p className="text-sm text-gris">Aucune étape enregistrée.</p>
            ) : (
              <ul aria-label="Historique des étapes" className="mt-1 space-y-1 text-sm">
                {historique.map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-x-3">
                    <span>{formaterDateHeureParis(h.date)}</span>
                    <span className="font-bold">{h.sens === 'retour' ? `Retour à : ${LIBELLES_ETAPE[h.etape]}` : LIBELLES_ETAPE[h.etape]}</span>
                    <span>{h.auteur_id ? tri(h.auteur_id) : 'Pennylane'}</span>
                    {h.commentaire && <span className="text-gris">{h.commentaire}</span>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Bloc>

      <Bloc titre="Exercices" requetes={[fiche]} vide={!!fiche.data && exercices.length === 0}>
        <ul className="space-y-1 text-sm">
          {exercices.map((x) => (
            <li key={x.id}>
              <strong>{formaterDate(x.date_fin)}</strong> : {LIBELLES_ETAPE[x.etape_actuelle]}
            </li>
          ))}
        </ul>
      </Bloc>

      <Bloc titre="Échéances du dossier" requetes={[echeances]} vide={!!echeances.data && echeances.data.length === 0}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gris text-marine">
              <th className="px-2 py-1 font-bold">Échéance</th>
              <th className="px-2 py-1 font-bold">Date limite</th>
              <th className="px-2 py-1 font-bold">Statut</th>
              <th className="px-2 py-1 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(echeances.data ?? []).map((e) => (
              <tr key={e.id} className="border-b border-gris/40 align-top">
                <td className="px-2 py-1">{LIBELLES_TYPE[e.type]}</td>
                <td className="px-2 py-1">{formaterDate(e.date_limite)}</td>
                <td className="px-2 py-1"><StatutEcheanceBadge echeance={e} /></td>
                <td className="px-2 py-1"><ActionsEcheance echeance={e} moi={moi} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloc>
    </div>
  );
}
