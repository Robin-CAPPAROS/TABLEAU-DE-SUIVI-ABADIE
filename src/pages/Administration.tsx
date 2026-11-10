import { useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMoi } from '@/auth/SessionProvider';
import { peutAdministrer, peutModifierAdministration } from '@/auth/permissions';
import {
  ajouterCollaborateur, ajouterJourFerie, enregistrerCalendrier, enregistrerForme, enregistrerParametres,
  importerClasseurRpc, lireParametres, listerAnomaliesAdmin, listerCalendriers, listerCollaborateursAdmin,
  listerFormes, listerJournal, listerJoursFeries, modifierCollaborateur, rapprocherDossier, resoudreAnomalie,
  type CalendrierAnnuel, type CollaborateurAdmin, type FormeJuridique, type NonRapproche, type Parametres, type ResultatImport,
} from '@/data/admin';
import Bloc from '@/components/Bloc';
import { lireClasseur } from '@/import/lireClasseur';
import { analyserClasseur, type ResultatAnalyse } from '@/import/analyserClasseur';
import { formaterDate, formaterDateHeureParis } from '@/lib/format';
import { messageErreur } from '@/lib/erreurs';
import type { Role } from '@/data/types';

const CHAMP = 'rounded border border-gris px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gris';
const BOUTON = 'rounded bg-primaire px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50';
const TH = 'px-2 py-1 text-left font-bold text-marine';
const ONGLETS = ['Collaborateurs', 'Paramètres', 'Journal et anomalies', 'Import du classeur'] as const;
const ROLES: { valeur: Role; libelle: string }[] = [
  { valeur: 'csp', libelle: 'CSP' }, { valeur: 'senior', libelle: 'Senior' },
  { valeur: 'manager', libelle: 'Manager' }, { valeur: 'associe', libelle: 'Associé' },
];
const SUFFIXE_PROVISOIRE = '@a-renseigner.invalid';

function Erreur({ e }: { e: string | null }) {
  return e ? <p role="alert" className="mt-1 text-sm text-red-600">{e}</p> : null;
}

/** Exécute une action asynchrone, mémorise son message d'erreur et invalide les lectures concernées. */
function useAction() {
  const client = useQueryClient();
  const [erreur, setErreur] = useState<string | null>(null);
  const executer = async (action: () => Promise<unknown>, invalider: string[] = []) => {
    setErreur(null);
    try {
      await action();
      await Promise.all([
        ...invalider.map((k) => client.invalidateQueries({ queryKey: ['admin', k] })),
        client.invalidateQueries({ queryKey: ['collaborateurs'] }),
      ]);
      return true;
    } catch (e) {
      setErreur(messageErreur(e));
      return false;
    }
  };
  return { erreur, executer };
}

function Champ({ libelle, children }: { libelle: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs font-bold text-marine">{libelle}{children}</label>;
}

// --- Collaborateurs ---

function LigneCollaborateur({ c, modifiable, executer }: { c: CollaborateurAdmin; modifiable: boolean; executer: (f: () => Promise<unknown>) => Promise<boolean> }) {
  const [email, setEmail] = useState(c.email);
  const provisoire = c.email.endsWith(SUFFIXE_PROVISOIRE);
  const maj = (modif: Parameters<typeof modifierCollaborateur>[1]) => executer(() => modifierCollaborateur(c.id, modif));
  return (
    <tr className="border-t border-gris/40">
      <td className="px-2 py-1">{c.prenom}</td>
      <td className="px-2 py-1">{c.nom}</td>
      <td className="px-2 py-1 font-bold">{c.trigramme}</td>
      <td className="px-2 py-1">
        <input aria-label={`E-mail ${c.trigramme}`} className={CHAMP} value={email} disabled={!modifiable}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => { if (email.trim() && email !== c.email) void maj({ email: email.trim() }); }} />
        {provisoire && <span className="ml-2 text-xs font-bold text-red-600">E-mail à renseigner</span>}
      </td>
      <td className="px-2 py-1">
        <select aria-label={`Rôle ${c.trigramme}`} className={CHAMP} disabled={!modifiable} value={c.role ?? ''}
          onChange={(e) => void maj({ role: (e.target.value || null) as Role | null })}>
          <option value="">Non attribué</option>
          {ROLES.map((r) => <option key={r.valeur} value={r.valeur}>{r.libelle}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <input type="checkbox" aria-label={`Administrateur ${c.trigramme}`} disabled={!modifiable} checked={c.administrateur}
          onChange={(e) => void maj({ administrateur: e.target.checked })} />
      </td>
      <td className="px-2 py-1">
        <input type="checkbox" aria-label={`Actif ${c.trigramme}`} disabled={!modifiable} checked={c.actif}
          onChange={(e) => void maj({ actif: e.target.checked })} />
      </td>
    </tr>
  );
}

function AjoutCollaborateur({ executer }: { executer: (f: () => Promise<unknown>) => Promise<boolean> }) {
  const vide = { prenom: '', nom: '', trigramme: '', email: '', role: '' };
  const [f, setF] = useState(vide);
  const valide = f.prenom.trim() && f.nom.trim() && f.trigramme.trim() && f.email.trim();
  const ajouter = async () => {
    const ok = await executer(() => ajouterCollaborateur({
      prenom: f.prenom.trim(), nom: f.nom.trim(), trigramme: f.trigramme.trim().toUpperCase(),
      email: f.email.trim(), role: (f.role || null) as Role | null,
    }));
    if (ok) setF(vide);
  };
  const champ = (cle: keyof typeof vide, libelle: string) => (
    <Champ libelle={libelle}><input className={CHAMP} value={f[cle]} onChange={(e) => setF({ ...f, [cle]: e.target.value })} /></Champ>
  );
  return (
    <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void ajouter(); }}>
      {champ('prenom', 'Prénom')}{champ('nom', 'Nom')}{champ('trigramme', 'Trigramme')}{champ('email', 'E-mail')}
      <Champ libelle="Rôle">
        <select className={CHAMP} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="">Non attribué</option>
          {ROLES.map((r) => <option key={r.valeur} value={r.valeur}>{r.libelle}</option>)}
        </select>
      </Champ>
      <button type="submit" className={BOUTON} disabled={!valide}>Ajouter un collaborateur</button>
    </form>
  );
}

function OngletCollaborateurs({ modifiable }: { modifiable: boolean }) {
  const liste = useQuery({ queryKey: ['admin', 'collaborateurs'], queryFn: listerCollaborateursAdmin });
  const { erreur, executer } = useAction();
  const exec = (f: () => Promise<unknown>) => executer(f, ['collaborateurs']);
  return (
    <Bloc titre="Collaborateurs" requetes={[liste]} vide={liste.data?.length === 0}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>{['Prénom', 'Nom', 'Trigramme', 'E-mail', 'Rôle', 'Administrateur', 'Actif'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>{liste.data?.map((c) => <LigneCollaborateur key={`${c.id}-${c.email}`} c={c} modifiable={modifiable} executer={exec} />)}</tbody>
        </table>
      </div>
      <Erreur e={erreur} />
      {modifiable && <AjoutCollaborateur executer={exec} />}
    </Bloc>
  );
}

// --- Paramètres ---

const CHAMPS_NOMBRES: { cle: keyof Parametres; libelle: string }[] = [
  { cle: 'date_cible_mois_tenue', libelle: 'Date cible, tenue (mois)' },
  { cle: 'date_cible_mois_revision', libelle: 'Date cible, révision (mois)' },
  { cle: 'date_cible_mois_micro_bnc', libelle: 'Date cible, micro-BNC (mois)' },
  { cle: 'date_cible_mois_irpp', libelle: 'Date cible, IRPP (mois)' },
  { cle: 'jalon_etape2_jours', libelle: 'Jalon étape 2 (jours)' },
  { cle: 'jalon_etape3_jours', libelle: 'Jalon étape 3 (jours)' },
  { cle: 'delai_greffe_mois', libelle: 'Délai du greffe (mois)' },
  { cle: 'delai_alerte_paiement_jours', libelle: "Délai d'alerte de paiement (jours)" },
];

function FormulaireParametres({ initial, modifiable }: { initial: Parametres; modifiable: boolean }) {
  const [p, setP] = useState<Parametres>(initial);
  const { erreur, executer } = useAction();
  const [ok, setOk] = useState(false);
  const basculerEquipe = (n: number) =>
    setP({ ...p, recap_equipes: p.recap_equipes.includes(n) ? p.recap_equipes.filter((x) => x !== n) : [...p.recap_equipes, n].sort() });
  const enregistrer = async () => {
    setOk(false);
    if (await executer(() => enregistrerParametres(p), ['parametres'])) setOk(true);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); void enregistrer(); }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CHAMPS_NOMBRES.map(({ cle, libelle }) => (
          <Champ key={cle} libelle={libelle}>
            <input type="number" className={CHAMP} disabled={!modifiable} value={Number(p[cle])}
              onChange={(e) => setP({ ...p, [cle]: Number(e.target.value) })} />
          </Champ>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" disabled={!modifiable} checked={p.recap_actif}
          onChange={(e) => setP({ ...p, recap_actif: e.target.checked })} />Récapitulatif hebdomadaire actif</label>
        {[1, 2, 3].map((n) => (
          <label key={n} className="flex items-center gap-2"><input type="checkbox" disabled={!modifiable} checked={p.recap_equipes.includes(n)}
            onChange={() => basculerEquipe(n)} />Équipe {n}</label>
        ))}
        <Champ libelle="Expéditeur du récapitulatif">
          <input className={CHAMP} disabled={!modifiable} value={p.recap_expediteur ?? ''}
            onChange={(e) => setP({ ...p, recap_expediteur: e.target.value || null })} />
        </Champ>
      </div>
      {modifiable && <button type="submit" className={`${BOUTON} mt-3`}>Enregistrer les paramètres</button>}
      {ok && <p role="status" className="mt-1 text-sm text-marine">Paramètres enregistrés.</p>}
      <Erreur e={erreur} />
    </form>
  );
}

function LigneCalendrier({ initial, nouveau, modifiable }: { initial: CalendrierAnnuel; nouveau?: boolean; modifiable: boolean }) {
  const [c, setC] = useState(initial);
  const { erreur, executer } = useAction();
  const enregistrer = async () => {
    const ok = await executer(() => enregistrerCalendrier({ ...c, annee: Number(c.annee) }), ['calendriers']);
    if (ok && nouveau) setC(initial);
  };
  const date = (cle: 'date_liasse_3112' | 'date_solde_is_3112' | 'date_ca12_3112', libelle: string) => (
    <Champ libelle={libelle}><input type="date" className={CHAMP} disabled={!modifiable} value={c[cle]} onChange={(e) => setC({ ...c, [cle]: e.target.value })} /></Champ>
  );
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void enregistrer(); }}>
      <Champ libelle="Année">
        <input type="number" className={`${CHAMP} w-24`} disabled={!modifiable || !nouveau} value={c.annee || ''} onChange={(e) => setC({ ...c, annee: Number(e.target.value) })} />
      </Champ>
      {date('date_liasse_3112', 'Date de la liasse (31/12)')}{date('date_solde_is_3112', "Solde de l'IS (31/12)")}{date('date_ca12_3112', 'CA12 (31/12)')}
      {modifiable && <button type="submit" className={BOUTON} disabled={!c.annee || !c.date_liasse_3112 || !c.date_solde_is_3112 || !c.date_ca12_3112}>{nouveau ? 'Ajouter le calendrier' : 'Enregistrer'}</button>}
      <Erreur e={erreur} />
    </form>
  );
}

function LigneForme({ initial, nouveau, modifiable }: { initial: FormeJuridique; nouveau?: boolean; modifiable: boolean }) {
  const [f, setF] = useState(initial);
  const { erreur, executer } = useAction();
  const enregistrer = async () => {
    const ok = await executer(() => enregistrerForme({ ...f, code: f.code.trim() }), ['formes']);
    if (ok && nouveau) setF(initial);
  };
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void enregistrer(); }}>
      <Champ libelle="Forme juridique">
        <input className={`${CHAMP} w-32`} disabled={!modifiable || !nouveau} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
      </Champ>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!modifiable} checked={f.approbation} onChange={(e) => setF({ ...f, approbation: e.target.checked })} />Approbation des comptes</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!modifiable} checked={f.depot_greffe} onChange={(e) => setF({ ...f, depot_greffe: e.target.checked })} />Dépôt au greffe</label>
      {modifiable && <button type="submit" className={BOUTON} disabled={!f.code.trim()}>{nouveau ? 'Ajouter la forme' : 'Enregistrer'}</button>}
      <Erreur e={erreur} />
    </form>
  );
}

function JoursFeries({ modifiable }: { modifiable: boolean }) {
  const liste = useQuery({ queryKey: ['admin', 'feries'], queryFn: listerJoursFeries });
  const { erreur, executer } = useAction();
  const [jour, setJour] = useState('');
  const ajouter = async () => { if (await executer(() => ajouterJourFerie(jour), ['feries'])) setJour(''); };
  return (
    <Bloc titre="Jours fériés" requetes={[liste]} vide={liste.data?.length === 0 && !modifiable}>
      <p className="text-sm">{liste.data?.map((j) => formaterDate(j)).join(', ')}</p>
      {modifiable && (
        <form className="mt-2 flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); void ajouter(); }}>
          <Champ libelle="Jour férié"><input type="date" className={CHAMP} value={jour} onChange={(e) => setJour(e.target.value)} /></Champ>
          <button type="submit" className={BOUTON} disabled={!jour}>Ajouter le jour férié</button>
        </form>
      )}
      <Erreur e={erreur} />
    </Bloc>
  );
}

function OngletParametres({ modifiable }: { modifiable: boolean }) {
  const parametres = useQuery({ queryKey: ['admin', 'parametres'], queryFn: lireParametres });
  const calendriers = useQuery({ queryKey: ['admin', 'calendriers'], queryFn: listerCalendriers });
  const formes = useQuery({ queryKey: ['admin', 'formes'], queryFn: listerFormes });
  return (
    <div className="space-y-4">
      <Bloc titre="Paramètres" requetes={[parametres]}>
        {parametres.data && <FormulaireParametres key={JSON.stringify(parametres.data)} initial={parametres.data} modifiable={modifiable} />}
      </Bloc>
      <Bloc titre="Calendriers annuels" requetes={[calendriers]}>
        <div className="space-y-2">
          {calendriers.data?.map((c) => <LigneCalendrier key={`${c.annee}-${c.date_liasse_3112}-${c.date_solde_is_3112}-${c.date_ca12_3112}`} initial={c} modifiable={modifiable} />)}
          {modifiable && <LigneCalendrier nouveau initial={{ annee: 0, date_liasse_3112: '', date_solde_is_3112: '', date_ca12_3112: '' }} modifiable />}
        </div>
      </Bloc>
      <Bloc titre="Formes juridiques" requetes={[formes]}>
        <div className="space-y-2">
          {formes.data?.map((f) => <LigneForme key={`${f.code}-${f.approbation}-${f.depot_greffe}`} initial={f} modifiable={modifiable} />)}
          {modifiable && <LigneForme nouveau initial={{ code: '', approbation: false, depot_greffe: false }} modifiable />}
        </div>
      </Bloc>
      <JoursFeries modifiable={modifiable} />
    </div>
  );
}

// --- Journal et anomalies ---

function OngletJournal({ modifiable }: { modifiable: boolean }) {
  const journal = useQuery({ queryKey: ['admin', 'journal'], queryFn: listerJournal });
  const anomalies = useQuery({ queryKey: ['admin', 'anomalies'], queryFn: listerAnomaliesAdmin });
  const { erreur, executer } = useAction();
  return (
    <div className="space-y-4">
      <Bloc titre="Journal de synchronisation et des envois" requetes={[journal]} vide={journal.data?.length === 0}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{['Début', 'Fin', 'Nature', 'Source', 'Dossiers', 'Échéances'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {journal.data?.map((l) => (
                <tr key={l.id} className="border-t border-gris/40">
                  <td className="px-2 py-1">{formaterDateHeureParis(l.debut)}</td>
                  <td className="px-2 py-1">{l.fin ? formaterDateHeureParis(l.fin) : 'Inachevé'}</td>
                  <td className="px-2 py-1">{l.nature ?? ''}</td>
                  <td className="px-2 py-1">{l.source ?? ''}</td>
                  <td className="px-2 py-1">{l.nb_dossiers ?? 0}</td>
                  <td className="px-2 py-1">{l.nb_echeances ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloc>
      <Bloc titre="Anomalies ouvertes" requetes={[anomalies]} vide={anomalies.data?.length === 0}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{['Type', 'Dossier', 'Message', 'Date', ''].map((h, i) => <th key={i} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {anomalies.data?.map((a) => (
                <tr key={a.id} className="border-t border-gris/40">
                  <td className="px-2 py-1">{a.type}</td>
                  <td className="px-2 py-1">{a.raison_sociale ?? ''}</td>
                  <td className="px-2 py-1">{a.message}</td>
                  <td className="px-2 py-1">{a.cree_le ? formaterDateHeureParis(a.cree_le) : ''}</td>
                  <td className="px-2 py-1">
                    {modifiable && <button type="button" className="text-xs font-bold text-primaire hover:underline"
                      onClick={() => void executer(() => resoudreAnomalie(a.id), ['anomalies'])}>Marquer résolue</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Erreur e={erreur} />
      </Bloc>
    </div>
  );
}

// --- Import du classeur ---

function LigneNonRapproche({ n, onRapprocher }: { n: NonRapproche; onRapprocher: (dossierId: string) => Promise<void> }) {
  const [choix, setChoix] = useState(n.propositions[0]?.dossier_id ?? '');
  return (
    <li className="flex flex-wrap items-center gap-2 py-1 text-sm">
      <span className="font-bold">{n.raison_sociale}</span><span className="text-gris">SIREN {n.siren}</span>
      {n.propositions.length === 0 ? <span className="text-gris">Aucune proposition</span> : (
        <>
          <select aria-label={`Proposition pour ${n.raison_sociale}`} className={CHAMP} value={choix} onChange={(e) => setChoix(e.target.value)}>
            {n.propositions.map((p) => <option key={p.dossier_id} value={p.dossier_id}>{p.raison_sociale}</option>)}
          </select>
          <button type="button" className={BOUTON} disabled={!choix} onClick={() => void onRapprocher(choix)}>Rapprocher</button>
        </>
      )}
    </li>
  );
}

function OngletImport() {
  const { erreur, executer } = useAction();
  const [analyse, setAnalyse] = useState<ResultatAnalyse | null>(null);
  const [resultat, setResultat] = useState<ResultatImport | null>(null);
  const [restants, setRestants] = useState<NonRapproche[]>([]);
  const [lecture, setLecture] = useState(false);

  const choisir = async (fichier: File | undefined) => {
    setAnalyse(null); setResultat(null); setRestants([]);
    if (!fichier) return;
    setLecture(true);
    await executer(async () => {
      const { lignesSuivi, lignesSources } = await lireClasseur(await fichier.arrayBuffer());
      setAnalyse(analyserClasseur(lignesSuivi, lignesSources));
    });
    setLecture(false);
  };
  const lancer = async () => {
    if (!analyse) return;
    await executer(async () => {
      const r = await importerClasseurRpc(analyse.dossiers, analyse.collaborateurs);
      setResultat(r); setRestants(r.non_rapproches);
    }, ['collaborateurs']);
  };
  const rapprocher = async (n: NonRapproche, dossierId: string) => {
    const ligne = analyse?.dossiers.find((d) => d.siren === n.siren);
    if (!ligne) return;
    const ok = await executer(() => rapprocherDossier(dossierId, ligne), ['collaborateurs']);
    if (ok) setRestants((l) => l.filter((x) => x.siren !== n.siren));
  };

  return (
    <div className="space-y-4">
      <Bloc titre="Import du classeur">
        <label className="flex flex-col gap-1 text-xs font-bold text-marine">Classeur de suivi (.xlsx ou .xlsm)
          <input type="file" accept=".xlsx,.xlsm" onChange={(e) => void choisir(e.target.files?.[0])} className="text-sm font-normal" />
        </label>
        {lecture && <p className="mt-2 text-sm text-gris">Analyse en cours…</p>}
        <Erreur e={erreur} />
        {analyse && (
          <div className="mt-3">
            <p className="text-sm">{analyse.dossiers.length} dossiers lus, {analyse.collaborateurs.length} collaborateurs lus, {analyse.rapport.length} lignes de rapport.</p>
            {analyse.rapport.length > 0 && (
              <div className="mt-2 max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead><tr>{['Ligne', 'Champ', 'Valeur', 'Message'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
                  <tbody>
                    {analyse.rapport.map((l, i) => (
                      <tr key={i} className="border-t border-gris/40">
                        <td className="px-2 py-1">{l.ligne}</td><td className="px-2 py-1">{l.champ}</td>
                        <td className="px-2 py-1">{l.valeur}</td><td className="px-2 py-1">{l.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button type="button" className={`${BOUTON} mt-3`} onClick={() => void lancer()}>Lancer l'import</button>
          </div>
        )}
      </Bloc>
      {resultat && (
        <Bloc titre="Résultat de l'import">
          <p className="text-sm">{resultat.rapproches} dossiers rapprochés, {resultat.collaborateurs} collaborateurs traités.</p>
          {restants.length > 0 && (
            <>
              <h4 className="mt-3 text-sm font-bold text-marine">Dossiers non rapprochés</h4>
              <ul>{restants.map((n) => <LigneNonRapproche key={n.siren} n={n} onRapprocher={(id) => rapprocher(n, id)} />)}</ul>
            </>
          )}
        </Bloc>
      )}
    </div>
  );
}

// --- Page ---

export default function Administration() {
  const { moi } = useMoi();
  const [onglet, setOnglet] = useState<(typeof ONGLETS)[number]>('Collaborateurs');
  if (!moi) return null;
  if (!peutAdministrer(moi)) return <Navigate to="/" replace />;
  const modifiable = peutModifierAdministration(moi);
  const onglets = modifiable ? ONGLETS : ONGLETS.filter((o) => o !== 'Import du classeur');
  return (
    <section>
      <h2 className="text-xl font-bold text-marine">Administration</h2>
      <div role="tablist" className="mt-3 flex flex-wrap gap-2 border-b border-gris/60">
        {onglets.map((o) => (
          <button key={o} type="button" role="tab" aria-selected={onglet === o} onClick={() => setOnglet(o)}
            className={`px-3 py-1.5 text-sm font-bold ${onglet === o ? 'border-b-2 border-primaire text-primaire' : 'text-marine'}`}>{o}</button>
        ))}
      </div>
      <div className="mt-4">
        {onglet === 'Collaborateurs' && <OngletCollaborateurs modifiable={modifiable} />}
        {onglet === 'Paramètres' && <OngletParametres modifiable={modifiable} />}
        {onglet === 'Journal et anomalies' && <OngletJournal modifiable={modifiable} />}
        {onglet === 'Import du classeur' && modifiable && <OngletImport />}
      </div>
    </section>
  );
}
