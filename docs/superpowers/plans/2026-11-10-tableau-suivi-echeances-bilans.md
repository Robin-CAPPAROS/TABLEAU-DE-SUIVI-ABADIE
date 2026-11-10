# Tableau de suivi des échéances et des bilans : plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** construire l'application web de suivi des échéances fiscales et de la production des bilans du cabinet CPA & ABADIE ASSOCIES, alimentée par Pennylane, puis la mettre en ligne dans Lovable.

**Architecture :** application React (pile Lovable) adossée à Lovable Cloud (Supabase). Toutes les règles de droits et les écritures métier vivent dans PostgreSQL (RLS et fonctions SQL `security definer`), testées sur un PostgreSQL local. Les règles de calcul des dates d'échéance sont des fonctions TypeScript pures, partagées entre les tests Vitest et les fonctions serveur Deno. L'interface ne fait que lire des vues et appeler ces fonctions SQL.

**Tech Stack :** Vite 5.4.10, React 18.3.1, TypeScript 5.6.3, Tailwind CSS 3.4.14, shadcn/ui, @tanstack/react-query 5.59.0, react-router-dom 6.27.0, recharts 2.13.0, @supabase/supabase-js 2.45.4, zod 3.23.8, SheetJS (xlsx 0.20.3 depuis `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), Vitest 2.1.3, @testing-library/react 16.0.1, jsdom 25.0.1, PostgreSQL 16 (tests locaux), fonctions serveur Supabase (Deno).

**Spec :** `docs/superpowers/specs/2026-11-09-tableau-suivi-echeances-bilans-design.md`

**Hors de ce plan :** la phase 2 de synchronisation par l'API Pennylane cabinet (spec, section 9.6). Elle fera l'objet d'un plan distinct lorsque le jeton sera disponible ; la porte d'entrée `sync-pennylane` construite ici restera inchangée.

## Global Constraints

- Interface et e-mails en français ; aucun tiret cadratin (« — ») dans les textes affichés ou envoyés.
- Couleurs : `#0E2A42` (navigation, marine), `#2784C6` (actions et informations mises en avant), `#B2B2B1` (éléments secondaires).
- Polices : `"Century Gothic", "CenturyGothic", "AppleGothic", "Questrial", sans-serif` ; titres et informations clés en gras ; Questrial chargée depuis Google Fonts comme police de repli.
- Dates manipulées en chaînes ISO `YYYY-MM-DD` côté TypeScript et en type `date` côté SQL ; « aujourd'hui » est la date du jour à Europe/Paris (`aujourdhui()` en SQL, `dateDuJourParis()` en TypeScript).
- Aucune donnée client réelle dans le dépôt : le classeur Excel n'est jamais commité ; tous les jeux de test sont fictifs.
- Aucun champ issu de Pennylane n'est modifiable depuis l'outil.
- RLS activée sur toutes les tables ; aucune politique `update` ou `delete` pour le rôle `authenticated` sur les tables métier : toute écriture métier passe par une fonction SQL qui contrôle les droits.
- Refus de droit : `raise exception ... using errcode = '42501'`. Violation de règle métier : `errcode = 'P0001'`.
- Secrets uniquement en variables de fonction serveur ou dans Supabase Vault : `SYNC_SECRET`, `CRON_SECRET`, `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`.
- Synchronisation : au plus 50 dossiers par appel de `sync-pennylane`.
- Génération : échéances dont la date limite est comprise entre aujourd'hui moins 60 jours et aujourd'hui plus 15 mois.
- Versions de dépendances figées (pas de `^` ni de `~` dans `package.json`).

## Review Focus

1. Un collaborateur dont l'adresse Microsoft 365 diffère par la casse de celle saisie (`Prenom.Nom@` contre `prenom.nom@`) doit être reconnu. Test : Task 3, `connexion_insensible_casse`.
2. Pennylane renvoie un régime TVA ou un statut inattendu (`rejected`, `draft`, `weird`) : aucune erreur, statut `a_faire`, valeur brute conservée, anomalie créée. Test : Task 11, `statut_inconnu` et `regime_inconnu`.
3. Le calendrier fiscal d'une année n'a pas encore été saisi : aucune échéance avec une date fausse, une anomalie `calendrier_absent` visible. Test : Task 6, `calendrier absent`.
4. Changement d'heure : le récapitulatif part une seule fois, à 7 h 30 heure de Paris, en hiver comme en été. Test : Task 15, `doitEnvoyer`.
5. SIREN lu comme un nombre dans Excel (zéro initial perdu) : il doit être complété à 9 chiffres pour le rapprochement. Test : Task 14, `complète le SIREN`.

---

## Structure des fichiers

```
package.json, vite.config.ts, vitest.config.ts, tailwind.config.ts, postcss.config.js,
tsconfig.json, tsconfig.node.json, components.json, index.html
src/
  main.tsx, App.tsx, index.css
  lib/supabase.ts            client supabase-js
  lib/format.ts              formats de date français
  auth/SessionProvider.tsx   session Microsoft 365 et collaborateur courant
  auth/permissions.ts        miroir des droits SQL pour l'affichage
  data/types.ts              types des vues et retours de fonctions SQL
  data/echeances.ts, exercices.ts, dossiers.ts, pilotage.ts, admin.ts, synchro.ts
  components/AppLayout.tsx, BandeauSynchro.tsx, StatutBadge.tsx, ExportExcel.tsx
  pages/Connexion.tsx, AccesRefuse.tsx, Accueil.tsx, Echeancier.tsx, Production.tsx,
        PlanDeCharge.tsx, FicheDossier.tsx, Indicateurs.tsx, Administration.tsx
  import/analyserClasseur.ts
  test/setup.ts
supabase/
  config.toml
  migrations/202611100001_schema.sql … 202611100011_donnees_initiales.sql
  functions/deno.json                       import map (zod, supabase-js)
  functions/_shared/domain/types.ts, dates.ts, formes.ts, tva.ts, exercice.ts, generation.ts
  functions/_shared/sync/valider.ts
  functions/_shared/cle.ts
  functions/_shared/recap/construire.ts, planification.ts, graph.ts
  functions/generer-echeances/index.ts
  functions/sync-pennylane/index.ts
  functions/dossiers-a-verifier/index.ts
  functions/recapitulatif-hebdo/index.ts
  tests/bootstrap.sql, fixtures.sql, *.test.sql
scripts/test-db.sh
tests/domain/*.test.ts, tests/sync/*.test.ts, tests/recap/*.test.ts, tests/import/*.test.ts
docs/exploitation/synchro-claude.md, docs/exploitation/mise-en-service.md
```

Alias : `@domain` pointe vers `supabase/functions/_shared/domain`, `@shared` vers `supabase/functions/_shared`, `@` vers `src`.

---

### Task 1 : Socle du projet et charte graphique

**Files:**
- Create : fichiers racine listés ci-dessus, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test/setup.ts`, `src/lib/format.ts`
- Test : `src/lib/format.test.ts`

**Interfaces:**
- Produces : `formaterDate(iso: string): string` (ex. `"19/11/2026"`), `formaterDateLongue(iso: string): string` (ex. `"lundi 16 novembre 2026"`) ; scripts npm `dev`, `build`, `test` (`vitest run`), `test:db` (`bash scripts/test-db.sh`) ; jetons Tailwind `marine`, `primaire`, `gris`, police `font-cabinet`.

- [ ] **Step 1 : Initialiser le projet Vite React TypeScript** avec les versions figées du Tech Stack, Tailwind, shadcn/ui (`components.json`, style « default », couleur de base `slate`), Vitest en environnement `jsdom` avec `src/test/setup.ts` important `@testing-library/jest-dom/vitest`. Vitest inclut `src/**/*.test.{ts,tsx}` et `tests/**/*.test.ts`. Déclarer les trois alias dans `vite.config.ts`, `vitest.config.ts` et `tsconfig.json`.
- [ ] **Step 2 : Déclarer la charte dans `tailwind.config.ts`** : `colors.marine = '#0E2A42'`, `colors.primaire = '#2784C6'`, `colors.gris = '#B2B2B1'`, `fontFamily.cabinet` = pile des Global Constraints. Dans `index.html`, charger Questrial depuis Google Fonts. Dans `src/index.css`, `body` en `font-cabinet`, `h1, h2, h3, strong` en `font-bold`.
- [ ] **Step 3 : Écrire le test qui échoue**

```ts
import { formaterDate, formaterDateLongue } from './format';
test('formaterDate', () => { expect(formaterDate('2026-11-19')).toBe('19/11/2026'); });
test('formaterDateLongue', () => { expect(formaterDateLongue('2026-11-16')).toBe('lundi 16 novembre 2026'); });
```

- [ ] **Step 4 : Lancer `npm test`**, attendu : ÉCHEC (module absent).
- [ ] **Step 5 : Implémenter `src/lib/format.ts`** avec `Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' })` sur `new Date(iso + 'T00:00:00Z')`.
- [ ] **Step 6 : Lancer `npm test` puis `npm run build`**, attendu : tests verts, build sans erreur.
- [ ] **Step 7 : Commit** `chore: socle Vite React, charte graphique et formats de date`.

---

### Task 2 : Banc de test PostgreSQL et schéma de données

**Files:**
- Create : `scripts/test-db.sh`, `supabase/tests/bootstrap.sql`, `supabase/tests/fixtures.sql`, `supabase/migrations/202611100001_schema.sql`, `supabase/config.toml`
- Test : `supabase/tests/01_schema.test.sql`

**Interfaces:**
- Produces :
  - `scripts/test-db.sh` : crée un cluster temporaire avec `/usr/lib/postgresql/16/bin/initdb` (via `runuser -u postgres` si l'utilisateur est root), le démarre sur le port 54329, exécute `bootstrap.sql`, toutes les migrations dans l'ordre, puis chaque `supabase/tests/*.test.sql` précédé de `fixtures.sql`, avec `psql -v ON_ERROR_STOP=1`. Code de sortie non nul au premier échec. Arrête et supprime le cluster en sortie (`trap`).
  - `bootstrap.sql` : rôles `anon`, `authenticated`, `service_role` (nologin) ; schéma `auth` avec `auth.jwt() returns jsonb` lisant `current_setting('request.jwt.claims', true)` ; schémas `vault` et `extensions` vides.
  - Convention de test : chaque fichier `*.test.sql` s'exécute dans `begin; … rollback;`, se connecte avec `set local role authenticated; select set_config('request.jwt.claims', '{"email":"…"}', true);`, fixe la date avec `set local app.aujourdhui = '2026-11-10';` et vérifie avec des blocs `do $$ begin assert …, 'message'; end $$;`. Un refus attendu se vérifie par un bloc `begin … exception when sqlstate '42501' then … end`.
  - `fixtures.sql` (UUID fixes) : collaborateurs `csp1@cabinet.test` (csp, `…c1`), `csp2@cabinet.test` (csp, `…c2`), `sen1@cabinet.test` (senior, `…51`), `man1@cabinet.test` (manager, `…41`), `ass1@cabinet.test` (associe, administrateur, `…a1`), `rca@cabinet.test` (manager, administrateur, `…a2`), `inactif@cabinet.test` (csp, inactif, `…99`) ; dossier `D1` (`…d1`, pennylane_id 1001, SARL, mensuel, `bic_is`, jour TVA 19, csp1/sen1/man1, équipe 1, mission tenue) ; dossier `D2` (`…d2`, pennylane_id 1002, csp2, même senior et manager) ; exercice `E1` (`…e1`, D1, 2026-01-01 au 2026-12-31, étape 0).
  - Tables du schéma (section 6 de la spec) : `collaborateurs`, `dossiers`, `exercices`, `historique_etapes`, `echeances`, `journal_synchro`, `parametres`, plus :
    - `echeances.date_limite_source text not null default 'calcul' check (in ('calcul','pennylane'))` ; `echeances.source_statut` nullable (nul tant qu'aucun statut n'a été posé) ;
    - `journal_synchro (id uuid pk, debut timestamptz not null default now(), fin timestamptz null, source text check (in ('mcp','api','outil')), nature text check (in ('fiches','declarations','generation','recapitulatif')), nb_dossiers int default 0, nb_echeances int default 0)` ;
    - `collaborateurs.role` nullable (rôle attribué après import) ;
    - `anomalies (id uuid pk, type text not null, dossier_id uuid null references dossiers, cle text not null default '', message text not null, journal_id uuid null references journal_synchro, cree_le timestamptz default now(), resolue_le timestamptz null)` avec index unique partiel `(type, coalesce(dossier_id, '00000000-0000-0000-0000-000000000000'), cle) where resolue_le is null` ;
    - `calendriers_annuels (annee int pk, date_liasse_3112 date not null, date_solde_is_3112 date not null, date_ca12_3112 date not null)`, où `annee` est l'année de l'échéance (clôture 31/12/2026 donne 2027) ;
    - `formes_juridiques (code text pk, approbation bool not null, depot_greffe bool not null)` ;
    - `jours_feries (jour date pk)` ;
    - `parametres` à ligne unique (`id int pk check (id = 1)`) : `date_cible_mois_tenue`, `date_cible_mois_revision`, `date_cible_mois_micro_bnc`, `date_cible_mois_irpp` (int, défaut 3), `jalon_etape2_jours` (30), `jalon_etape3_jours` (15), `delai_greffe_mois` (2), `delai_alerte_paiement_jours` (5), `recap_actif bool default true`, `recap_equipes int[] default '{1,2,3}'`, `recap_expediteur text null`.
  - Énumérés SQL : `role_collaborateur`, `regime_tva`, `mission`, `statut_dossier`, `type_echeance` (13 valeurs de la spec, section 8.1), `statut_echeance`, `source_statut`, `cause_retard`, `sens_etape`.
  - Contraintes : unicité `exercices (dossier_id, date_fin)`, `echeances (dossier_id, type, periode_debut, periode_fin)`, `collaborateurs (lower(email))`, `collaborateurs (trigramme)`, `dossiers (pennylane_id)` ; `exercices.etape_actuelle between 0 and 6`.

- [ ] **Step 1 : Écrire `01_schema.test.sql`** : insérer deux fois la même échéance (D1, `tva_mensuelle`, 2026-10-01, 2026-10-31) doit lever `unique_violation` ; insérer un collaborateur `CSP1@cabinet.test` doit lever `unique_violation` ; `etape_actuelle = 7` doit lever `check_violation` ; `select count(*) from parametres` vaut 1 après les fixtures.
- [ ] **Step 2 : Lancer `npm run test:db`**, attendu : ÉCHEC (tables absentes).
- [ ] **Step 3 : Écrire `scripts/test-db.sh`, `bootstrap.sql`, la migration de schéma et `fixtures.sql`.** `fixtures.sql` insère la ligne `parametres (id) values (1)`.
- [ ] **Step 4 : Lancer `npm run test:db`**, attendu : `01_schema.test.sql` OK.
- [ ] **Step 5 : Commit** `feat(db): schéma de données et banc de test PostgreSQL`.

---

### Task 3 : Identification du collaborateur et règles de sécurité

**Files:**
- Create : `supabase/migrations/202611100002_securite.sql`
- Test : `supabase/tests/02_securite.test.sql`

**Interfaces:**
- Produces (SQL, schéma `public`) :
  - `moi() returns collaborateurs` : collaborateur actif, au rôle non nul, dont `lower(email) = lower(auth.jwt() ->> 'email')` ; sinon `null`. `stable security definer`.
  - `est_admin() returns boolean`, `a_role(variadic roles role_collaborateur[]) returns boolean`, `est_intervenant(p_dossier uuid) returns boolean` (moi est CSP, Senior ou Manager du dossier).
  - Politiques : `select` pour `authenticated` quand `moi() is not null` sur toutes les tables métier et de paramètres ; `insert/update` sur `collaborateurs`, `parametres`, `calendriers_annuels`, `formes_juridiques`, `jours_feries` quand `est_admin()` ; `select` sur `journal_synchro` et `anomalies` pour managers, associé et administrateurs.
  - Déclencheur `garde_dernier_admin` sur `collaborateurs` : refuse (`P0001`, message `Impossible de retirer le dernier administrateur actif.`) toute mise à jour ou suppression qui laisserait zéro administrateur actif.

- [ ] **Step 1 : Écrire `02_securite.test.sql`** avec ces cas :
  - `connexion_insensible_casse` : claims `{"email":"CSP1@Cabinet.test"}` puis `select count(*) from dossiers` vaut 2.
  - Adresse inconnue : `count(*)` vaut 0. Collaborateur inactif : 0. Collaborateur au rôle nul : 0.
  - `man1` exécute `update dossiers set equipe = 3` : 0 ligne modifiée, D1 garde l'équipe 1.
  - `man1` insère un collaborateur : `42501`. `ass1` l'insère : OK.
  - `ass1` retire le droit administrateur à `rca` : OK ; `rca` ne peut plus insérer de collaborateur (`42501`) ; `ass1`, désormais seul administrateur actif, tente de se retirer ce droit : `P0001`.
  - `csp1` lit `journal_synchro` : 0 ligne visible même si une ligne existe ; `man1` : 1.
- [ ] **Step 2 : Lancer `npm run test:db`**, attendu : ÉCHEC.
- [ ] **Step 3 : Écrire la migration** (fonctions, `alter table … enable row level security`, politiques, déclencheur, `grant select` à `authenticated`, `revoke` de tout droit à `anon`).
- [ ] **Step 4 : Lancer `npm run test:db`**, attendu : OK.
- [ ] **Step 5 : Commit** `feat(db): identification par e-mail Microsoft 365 et règles RLS`.

---

### Task 4 : Fonctions de dates, formes juridiques et régime fiscal

**Files:**
- Create : `supabase/functions/_shared/domain/types.ts`, `dates.ts`, `formes.ts`
- Test : `tests/domain/dates.test.ts`, `tests/domain/formes.test.ts`

**Interfaces:**
- Produces (`types.ts`) :

```ts
export type ISODate = string;
export type RegimeTva = 'mensuel' | 'trimestriel' | 'annuel' | 'non_assujetti';
export type Mission = 'tenue' | 'revision' | 'micro_bnc' | 'irpp';
export type StatutEcheance = 'a_faire' | 'depose' | 'paye' | 'non_applicable';
export const TYPES_SYNCHRONISES: TypeEcheance[] = ['tva_mensuelle', 'tva_trimestrielle', 'tva_ca12_annuelle', 'liasse'];
export type TypeEcheance = 'tva_mensuelle' | 'tva_trimestrielle' | 'tva_ca12_acompte_juillet'
  | 'tva_ca12_acompte_decembre' | 'tva_ca12_annuelle' | 'liasse' | 'is_acompte_1' | 'is_acompte_2'
  | 'is_acompte_3' | 'is_acompte_4' | 'is_solde' | 'approbation' | 'depot_greffe';
export interface DossierRegles { id: string; regimeTva: RegimeTva | null; categorieFiscale: string | null;
  formeJuridique: string | null; mission: Mission | null; statut: 'actif' | 'sorti';
  jourEcheanceTva: number | null; isN1Superieur3000: boolean; }
export interface ExerciceRegles { id: string; dateDebut: ISODate; dateFin: ISODate; dateApprobation: ISODate | null; }
export interface CalendrierAnnuel { annee: number; dateLiasse3112: ISODate; dateSoldeIs3112: ISODate; dateCa12_3112: ISODate; }
export interface FormeParam { code: string; approbation: boolean; depotGreffe: boolean; }
export interface ParametresFiscaux { feries: ISODate[]; calendriers: CalendrierAnnuel[]; formes: FormeParam[]; delaiGreffeMois: number; }
export interface EcheanceGeneree { dossierId: string; exerciceId: string | null; type: TypeEcheance;
  periodeDebut: ISODate; periodeFin: ISODate; dateLimite: ISODate; }
export type TypeAnomalieGeneration = 'calendrier_absent' | 'jour_tva_absent' | 'forme_inconnue' | 'exercice_long';
export interface AnomalieGeneration { dossierId: string; type: TypeAnomalieGeneration; cle: string; message: string; }
export interface ResultatGeneration { echeances: EcheanceGeneree[]; anomalies: AnomalieGeneration[]; }
```

- Produces (`dates.ts`) : `ajouterJours(d: ISODate, n: number): ISODate` ; `ajouterMois(d: ISODate, n: number): ISODate` (si `d` est le dernier jour de son mois, le résultat est le dernier jour du mois cible ; sinon le jour est conservé et plafonné à la fin du mois) ; `finDeMois(annee: number, mois: number): ISODate` (mois de 1 à 12) ; `reporterJourOuvre(d: ISODate, feries: ISODate[]): ISODate` ; `dateDuJourParis(maintenant: Date): ISODate` ; `estDansFenetre(d: ISODate, aujourdhui: ISODate, horizonMois: number): boolean` (bornes `ajouterJours(aujourdhui, -60)` et `ajouterMois(aujourdhui, horizonMois)` incluses).
- Produces (`formes.ts`) : `codeForme(libelle: string | null): string | null` (dernier sigle entre parenthèses, sinon libellé en majuscules sans espaces superflus ; `null` si vide) ; `estIS(categorie: string | null): boolean` (`/(^|_)is$/`).

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
expect(ajouterMois('2026-03-31', 3)).toBe('2026-06-30');
expect(ajouterMois('2026-02-28', 3)).toBe('2026-05-31');
expect(ajouterMois('2026-01-30', 1)).toBe('2026-02-28');
expect(ajouterMois('2026-06-15', 1)).toBe('2026-07-15');
expect(reporterJourOuvre('2026-11-14', [])).toBe('2026-11-16');            // samedi
expect(reporterJourOuvre('2026-11-11', ['2026-11-11'])).toBe('2026-11-12'); // férié
expect(reporterJourOuvre('2027-05-15', ['2027-05-17'])).toBe('2027-05-18'); // samedi puis lundi de Pentecôte
expect(dateDuJourParis(new Date('2026-11-09T23:30:00Z'))).toBe('2026-11-10');
expect(estDansFenetre('2026-09-11', '2026-11-10', 15)).toBe(true);
expect(estDansFenetre('2026-09-10', '2026-11-10', 15)).toBe(false);
expect(estDansFenetre('2028-02-10', '2026-11-10', 15)).toBe(true);
expect(codeForme('Société à responsabilité limitée (SARL)')).toBe('SARL');
expect(codeForme('Entreprise individuelle')).toBe('ENTREPRISE INDIVIDUELLE');
expect(codeForme(null)).toBeNull();
expect(estIS('bic_is')).toBe(true); expect(estIS('bic_ir')).toBe(false); expect(estIS('bnc')).toBe(false);
```

- [ ] **Step 2 : Lancer `npm test -- tests/domain`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter `dates.ts` et `formes.ts`** en arithmétique UTC sur `Date` (aucune dépendance). `dateDuJourParis` utilise `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' })`.
- [ ] **Step 4 : Lancer `npm test -- tests/domain`**, attendu : OK.
- [ ] **Step 5 : Commit** `feat(domaine): calcul de dates, jours ouvrés et formes juridiques`.

---

### Task 5 : Génération des échéances de TVA

**Files:**
- Create : `supabase/functions/_shared/domain/tva.ts`
- Test : `tests/domain/tva.test.ts`

**Interfaces:**
- Consumes : Task 4.
- Produces : `genererTva(d: DossierRegles, exercices: ExerciceRegles[], p: ParametresFiscaux, aujourdhui: ISODate, horizonMois: number): ResultatGeneration`.
- Règles (spec 8.1) : mensuel, période = mois M, limite = jour `jourEcheanceTva` (plafonné à la fin du mois) du mois M+1 ; trimestriel, trimestres civils, limite au jour du mois suivant le trimestre ; annuel, acomptes de juillet et décembre (période = le mois, limite = jour du mois) et `tva_ca12_annuelle` par exercice connu (période = exercice ; clôture au 31/12 : `dateCa12_3112` du calendrier de l'année suivante ; sinon `ajouterMois(dateFin, 3)`). Toute limite passe par `reporterJourOuvre`, puis seules les échéances `estDansFenetre` sont conservées. `non_assujetti` ou `null` : aucune échéance. Assujetti sans `jourEcheanceTva` : aucune échéance périodique et anomalie `jour_tva_absent` (cle `''`). Calendrier absent pour une CA12 au 31/12 : anomalie `calendrier_absent` (cle = année).

- [ ] **Step 1 : Écrire les tests qui échouent** (aujourd'hui `2026-11-10`, horizon 15, aucun férié sauf mention)

```ts
const mensuel = genererTva({ ...base, regimeTva: 'mensuel', jourEcheanceTva: 19 }, [], params, '2026-11-10', 15);
expect(mensuel.echeances).toHaveLength(17);
expect(mensuel.echeances[0]).toMatchObject({ type: 'tva_mensuelle', periodeDebut: '2026-08-01', periodeFin: '2026-08-31', dateLimite: '2026-09-21' });
expect(mensuel.echeances).toContainEqual(expect.objectContaining({ periodeDebut: '2026-10-01', dateLimite: '2026-11-19' }));
expect(mensuel.echeances.at(-1)!.periodeDebut).toBe('2027-12-01');

const trim = genererTva({ ...base, regimeTva: 'trimestriel', jourEcheanceTva: 24 }, [], params, '2026-11-10', 15);
expect(trim.echeances).toHaveLength(6);
expect(trim.echeances[0]).toMatchObject({ type: 'tva_trimestrielle', periodeDebut: '2026-07-01', periodeFin: '2026-09-30', dateLimite: '2026-10-26' });

// calendrier fictif de test : { annee: 2027, dateLiasse3112: '2027-05-19', dateSoldeIs3112: '2027-05-19', dateCa12_3112: '2027-05-04' }
const ca12 = genererTva({ ...base, regimeTva: 'annuel', jourEcheanceTva: 24 }, [exercice2026], params, '2026-11-10', 15);
expect(ca12.echeances).toContainEqual(expect.objectContaining({ type: 'tva_ca12_acompte_decembre', periodeDebut: '2026-12-01', dateLimite: '2026-12-24' }));
expect(ca12.echeances).toContainEqual(expect.objectContaining({ type: 'tva_ca12_acompte_juillet', periodeDebut: '2027-07-01', dateLimite: '2027-07-26' }));
expect(ca12.echeances).toContainEqual(expect.objectContaining({ type: 'tva_ca12_annuelle', periodeDebut: '2026-01-01', periodeFin: '2026-12-31', dateLimite: '2027-05-04' }));

expect(genererTva({ ...base, regimeTva: 'non_assujetti' }, [], params, '2026-11-10', 15).echeances).toEqual([]);
const sansJour = genererTva({ ...base, regimeTva: 'mensuel', jourEcheanceTva: null }, [], params, '2026-11-10', 15);
expect(sansJour.echeances).toEqual([]);
expect(sansJour.anomalies[0].type).toBe('jour_tva_absent');
```

- [ ] **Step 2 : Lancer `npm test -- tests/domain/tva.test.ts`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter `genererTva`.**
- [ ] **Step 4 : Relancer**, attendu : OK.
- [ ] **Step 5 : Commit** `feat(domaine): génération des échéances de TVA`.

---

### Task 6 : Génération des échéances liées à l'exercice et assemblage

**Files:**
- Create : `supabase/functions/_shared/domain/exercice.ts`, `generation.ts`
- Test : `tests/domain/exercice.test.ts`, `tests/domain/generation.test.ts`

**Interfaces:**
- Consumes : Tasks 4 et 5.
- Produces : `genererEcheancesExercice(d: DossierRegles, e: ExerciceRegles, p: ParametresFiscaux, aujourdhui: ISODate, horizonMois: number): ResultatGeneration` ; `genererEcheancesDossier(d: DossierRegles, exercices: ExerciceRegles[], p: ParametresFiscaux, aujourdhui: ISODate, horizonMois = 15): ResultatGeneration` (dossier `sorti` : résultat vide ; sinon concaténation de `genererTva` et de `genererEcheancesExercice` pour chaque exercice connu ; les exercices futurs non encore créés dans Pennylane ne sont pas extrapolés).
- Règles (spec 8.1) : période = exercice. Liasse sauf missions `irpp` et `micro_bnc` ; 31/12 : `dateLiasse3112` de l'année suivante ; sinon `ajouterJours(ajouterMois(dateFin, 3), 15)`. IS si `estIS` : acomptes aux 15/03, 15/06, 15/09, 15/12 compris dans l'exercice, numérotés selon leur rang dans l'exercice, quatre au plus, seulement si `isN1Superieur3000` ; exercice de plus de 12 mois : anomalie `exercice_long` (cle = `dateFin`). Solde d'IS : 31/12 : `dateSoldeIs3112` ; sinon le 15 du 4e mois suivant la clôture. Approbation si la forme (`codeForme`) a `approbation` : `ajouterMois(dateFin, 6)`. Dépôt au greffe si `depotGreffe` : `ajouterMois(dateApprobation ?? limiteApprobationNonReportee, delaiGreffeMois)`. Forme absente de `p.formes` : anomalie `forme_inconnue` (cle = code), aucune échéance juridique. Calendrier manquant : anomalie `calendrier_absent` (cle = année), ni liasse ni solde d'IS. Report en jour ouvré et filtre de fenêtre comme en Task 5.

- [ ] **Step 1 : Écrire les tests qui échouent** (aujourd'hui `2026-11-10` ; dossier IS, SARL, mission tenue, IS N-1 > 3 000 € ; formes de test `SARL {approbation, depotGreffe}`, `SCI {approbation}` ; calendrier fictif 2027 de la Task 5)

```ts
const r = genererEcheancesExercice(dossierIS, { id: 'e', dateDebut: '2026-01-01', dateFin: '2026-12-31', dateApprobation: null }, params, '2026-11-10', 15);
const parType = Object.fromEntries(r.echeances.map(e => [e.type, e.dateLimite]));
expect(parType).toEqual({ is_acompte_3: '2026-09-15', is_acompte_4: '2026-12-15', liasse: '2027-05-19',
  is_solde: '2027-05-19', approbation: '2027-06-30', depot_greffe: '2027-08-31' });

const approuve = genererEcheancesExercice(dossierIS, { ...ex2026, dateApprobation: '2027-06-10' }, params, '2026-11-10', 15);
expect(approuve.echeances.find(e => e.type === 'depot_greffe')!.dateLimite).toBe('2027-08-10');

const decale = genererEcheancesExercice(dossierIS, { id: 'e', dateDebut: '2025-07-01', dateFin: '2026-06-30', dateApprobation: null }, params, '2026-11-10', 15);
expect(Object.fromEntries(decale.echeances.map(e => [e.type, e.dateLimite]))).toMatchObject(
  { liasse: '2026-10-15', is_solde: '2026-10-15', approbation: '2026-12-31', depot_greffe: '2027-03-01' });

test('calendrier absent', () => {
  const r = genererEcheancesExercice(dossierIS, ex2026, { ...params, calendriers: [] }, '2026-11-10', 15);
  expect(r.echeances.map(e => e.type)).not.toContain('liasse');
  expect(r.echeances.map(e => e.type)).not.toContain('is_solde');
  expect(r.anomalies).toContainEqual(expect.objectContaining({ type: 'calendrier_absent', cle: '2027' }));
});
expect(genererEcheancesExercice({ ...dossierIS, mission: 'irpp' }, ex2026, params, '2026-11-10', 15).echeances.map(e => e.type)).not.toContain('liasse');
expect(genererEcheancesExercice({ ...dossierIS, isN1Superieur3000: false }, ex2026, params, '2026-11-10', 15).echeances.some(e => e.type.startsWith('is_acompte'))).toBe(false);
expect(genererEcheancesExercice({ ...dossierIS, categorieFiscale: 'bnc' }, ex2026, params, '2026-11-10', 15).echeances.some(e => e.type.startsWith('is_'))).toBe(false);
const sci = genererEcheancesExercice({ ...dossierIS, formeJuridique: 'Société civile immobilière (SCI)' }, ex2026, params, '2026-11-10', 15);
expect(sci.echeances.map(e => e.type)).toContain('approbation');
expect(sci.echeances.map(e => e.type)).not.toContain('depot_greffe');
const inconnue = genererEcheancesExercice({ ...dossierIS, formeJuridique: 'Forme exotique (FEX)' }, ex2026, params, '2026-11-10', 15);
expect(inconnue.anomalies).toContainEqual(expect.objectContaining({ type: 'forme_inconnue', cle: 'FEX' }));
const long = genererEcheancesExercice(dossierIS, { id: 'e', dateDebut: '2025-10-01', dateFin: '2026-12-31', dateApprobation: null }, params, '2026-11-10', 15);
expect(long.anomalies).toContainEqual(expect.objectContaining({ type: 'exercice_long' }));
expect(genererEcheancesDossier({ ...dossierIS, statut: 'sorti' }, [ex2026], params, '2026-11-10')).toEqual({ echeances: [], anomalies: [] });
```

- [ ] **Step 2 : Lancer `npm test -- tests/domain`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter `exercice.ts` et `generation.ts`.**
- [ ] **Step 4 : Relancer**, attendu : OK.
- [ ] **Step 5 : Commit** `feat(domaine): échéances de liasse, d'IS, d'approbation et de greffe`.

---

### Task 7 : Écriture des échéances générées et fonction serveur nocturne

**Files:**
- Create : `supabase/migrations/202611100003_generation.sql`, `supabase/functions/deno.json`, `supabase/functions/_shared/cle.ts`, `supabase/functions/generer-echeances/index.ts`
- Test : `supabase/tests/03_generation.test.sql`, `tests/sync/cle.test.ts`

**Interfaces:**
- Consumes : Task 6 (`genererEcheancesDossier`).
- Produces :
  - `donnees_generation() returns jsonb` (réservée à `service_role`) : `{ dossiers: DossierRegles[], exercices: (ExerciceRegles & { dossierId })[], parametres: ParametresFiscaux }` en camelCase, dossiers actifs uniquement.
  - `upsert_echeances_generees(p_echeances jsonb, p_anomalies jsonb) returns jsonb` (réservée à `service_role`) : insère les échéances absentes avec `statut = 'a_faire'`, `source_statut` nul, `date_limite_source = 'calcul'` ; pour une échéance existante, met à jour `date_limite` seulement si `date_limite_source = 'calcul'`, sans jamais toucher au statut. Insère les anomalies en ignorant les doublons ouverts. Retourne `{ "inserees": n, "mises_a_jour": n, "anomalies": n }`.
  - `verifierCle(entete: string | null, secret: string): boolean` (comparaison à temps constant de `Bearer <secret>`).
  - Fonction `generer-echeances` : `POST` protégé par `CRON_SECRET` ; appelle `donnees_generation`, génère, écrit par paquets de 1 000 et consigne une ligne `journal_synchro` (source `outil`, nature `generation`).
  - `deno.json` : `{ "imports": { "zod": "npm:zod@3.23.8", "@supabase/supabase-js": "npm:@supabase/supabase-js@2.45.4" } }`.

- [ ] **Step 1 : Écrire les tests qui échouent**
  - SQL : une échéance générée deux fois existe une seule fois ; une échéance au statut `depose` reste `depose` après un nouvel appel ; une échéance avec `date_limite_source = 'pennylane'` garde sa date ; `csp1` appelant `upsert_echeances_generees` reçoit `42501` ; une anomalie envoyée deux fois n'existe qu'une fois tant qu'elle est ouverte.
  - TS : `verifierCle('Bearer abc', 'abc')` vaut `true` ; `verifierCle('Bearer abd', 'abc')`, `verifierCle(null, 'abc')` et `verifierCle('abc', 'abc')` valent `false`.
- [ ] **Step 2 : Lancer `npm run test:db` et `npm test -- tests/sync`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter la migration, `cle.ts` et la fonction serveur.** `supabase/config.toml` : `verify_jwt = false` pour `generer-echeances`, `sync-pennylane`, `dossiers-a-verifier`, `recapitulatif-hebdo`.
- [ ] **Step 4 : Relancer les deux suites**, attendu : OK.
- [ ] **Step 5 : Commit** `feat: écriture idempotente des échéances générées`.

---

### Task 8 : Date cible, retards et alertes de paiement

**Files:**
- Create : `supabase/migrations/202611100004_regles.sql`
- Test : `supabase/tests/04_regles.test.sql`

**Interfaces:**
- Produces :
  - `aujourdhui() returns date` : `current_setting('app.aujourdhui', true)::date` si défini, sinon `(now() at time zone 'Europe/Paris')::date`.
  - Déclencheur `exercices_date_cible` (avant insertion) : si `date_cible` est nul, `date_fin + make_interval(months => <paramètre de la mission du dossier>)`, `date_cible_mois_tenue` si la mission est nulle.
  - Vue `v_echeances` (`security_invoker = true`) : colonnes de `echeances` plus `raison_sociale`, `equipe`, `csp_id`, `senior_id`, `manager_id`, `pennylane_id`, et les booléens `en_retard` (`a_faire` et limite passée), `sous_7_jours` (`a_faire` et limite entre aujourd'hui et aujourd'hui + 7), `alerte_paiement` (type TVA, statut `depose`, montant > 0, `date_limite + delai_alerte_paiement_jours < aujourdhui()`), `depot_tardif` (`date_depot > date_limite`), `retard_non_qualifie` (`depot_tardif` et `cause_retard` nulle), `synchronisee` (type parmi `tva_mensuelle`, `tva_trimestrielle`, `tva_ca12_annuelle`, `liasse`, ou `source_statut = 'pennylane'`). « Type TVA » désigne tout type commençant par `tva_`.
  - Vue `v_exercices` (`security_invoker = true`) : colonnes de `exercices` plus informations du dossier, `jalon_etape2 = date_cible - jalon_etape2_jours`, `jalon_etape3 = date_cible - jalon_etape3_jours`, `jalon_etape4 = date_cible`, `etape_attendue` (2, 3 ou 4 : la plus haute dont le jalon est dépassé, sinon nulle), `en_retard` (`etape_attendue` non nulle et `etape_actuelle < etape_attendue`).

- [ ] **Step 1 : Écrire `04_regles.test.sql`** (`app.aujourdhui = '2026-11-10'`) :
  - `a_faire` au 2026-11-05 : `en_retard` ; au 2026-11-15 : `sous_7_jours`.
  - TVA `depose`, montant 515, limite 2026-11-01 : `alerte_paiement` ; montant -10 : non ; limite 2026-11-08 : non.
  - Dépôt le 2026-11-12 pour une limite au 2026-11-10 sans cause : `depot_tardif` et `retard_non_qualifie`.
  - Nouvel exercice D1 clos le 2026-12-31 sans date cible : `date_cible = '2027-03-31'`.
  - Exercice à date cible 2026-11-20 : étape 1, `en_retard` ; étape 2, `en_retard` ; étape 3, pas de retard.
  - `sen1` peut lire `v_echeances` ; un inconnu ne voit aucune ligne.
- [ ] **Step 2 : Lancer `npm run test:db`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter la migration.**
- [ ] **Step 4 : Relancer**, attendu : OK.
- [ ] **Step 5 : Commit** `feat(db): date cible, jalons, retards et alerte de paiement`.

---

### Task 9 : Circuit de production des bilans

**Files:**
- Create : `supabase/migrations/202611100005_circuit.sql`
- Test : `supabase/tests/05_circuit.test.sql`

**Interfaces:**
- Produces (`security definer`, exécutables par `authenticated`) :
  - `valider_etape(p_exercice uuid, p_etape int, p_commentaire text default null) returns void` : refuse `42501` si `moi()` est nul ou si le rôle n'est pas habilité (1 : csp, senior, manager, associe ; 2 : csp, manager, associe ; 3 : senior, manager, associe ; 4 : manager, associe ; 5 : senior, manager, associe) ; refuse `P0001` si `p_etape <> etape_actuelle + 1` ou si `p_etape = 6` (message `L'étape 6 est validée automatiquement par Pennylane.`). Écrit `historique_etapes` (`sens = 'validation'`) et met à jour `etape_actuelle`.
  - `revenir_etape(p_exercice uuid, p_etape int, p_commentaire text) returns void` : manager ou associé seulement (`42501`) ; commentaire vide refusé `P0001` ; `p_etape` doit être inférieure à `etape_actuelle` (`P0001`) ; `etape_actuelle` devient `p_etape` ; historique `sens = 'retour'`.

- [ ] **Step 1 : Écrire `05_circuit.test.sql`** : `csp1` valide 1 puis 2 ; `csp1` tente 3 : `42501` ; `sen1` tente 4 depuis 2 : `42501` ; `sen1` tente 4 depuis 3 : `42501` ; `sen1` valide 3 ; `man1` tente 5 depuis 3 : `P0001` ; `man1` valide 4 ; personne ne valide 6 : `P0001` ; `sen1` tente un retour : `42501` ; `man1` revient à 2 sans commentaire : `P0001`, avec commentaire : `etape_actuelle = 2` et 5 lignes d'historique dont une `retour` ; `inactif` : `42501`.
- [ ] **Step 2 : Lancer `npm run test:db`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter la migration.**
- [ ] **Step 4 : Relancer**, attendu : OK.
- [ ] **Step 5 : Commit** `feat(db): circuit de production en 6 étapes`.

---

### Task 10 : Actions sur les échéances, les dossiers et les exercices

**Files:**
- Create : `supabase/migrations/202611100006_actions.sql`
- Test : `supabase/tests/06_actions.test.sql`

**Interfaces:**
- Produces (`security definer`) :
  - `marquer_echeance(p_echeance uuid, p_statut statut_echeance, p_date_depot date default null, p_montant numeric default null) returns void` : statuts admis `depose`, `non_applicable`, `a_faire` (annulation) ; échéance `synchronisee` (définition de la Task 8) refusée `P0001` (`Échéance synchronisée par Pennylane.`) ; les acomptes CA12 restent donc saisissables tant que Pennylane ne les a pas fournis ; droit : CSP du dossier, Senior du dossier, manager ou associé, sinon `42501`. `depose` sans date prend `aujourdhui()`. Renseigne `source_statut = 'manuel'` et `auteur_id`.
  - `confirmer_paiement(p_echeance uuid) returns void` : échéance de TVA au statut `depose`, sinon `P0001` ; mêmes droits ; passe à `paye`, `source_statut = 'manuel'`.
  - `qualifier_retard(p_echeance uuid, p_cause cause_retard) returns void` : exige `date_depot > date_limite`, sinon `P0001` ; mêmes droits.
  - `maj_dossier_outil(p_dossier uuid, p_equipe int, p_mission mission, p_statut statut_dossier, p_jour_tva int, p_is_n1 boolean, p_commentaire text) returns void` : manager, associé ou administrateur ; sinon `42501`.
  - `maj_exercice(p_exercice uuid, p_date_cible date, p_date_approbation date) returns void` : mêmes droits.

- [ ] **Step 1 : Écrire `06_actions.test.sql`** : `csp1` marque déposé le `is_solde` de D1 : OK, `date_depot = '2026-11-10'` ; `csp1` sur une échéance de D2 : `42501` ; `csp1` sur une `tva_mensuelle` : `P0001` ; `csp1` marque déposé un `tva_ca12_acompte_decembre` sans source : OK ; `confirmer_paiement` sur une TVA `depose` : statut `paye` source `manuel` ; sur une TVA `a_faire` : `P0001` ; `qualifier_retard` sans dépôt tardif : `P0001`, avec : cause enregistrée ; `sen1` appelle `maj_dossier_outil` : `42501` ; `man1` : équipe modifiée ; `rca` modifie une date cible : OK.
- [ ] **Step 2 : Lancer `npm run test:db`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter la migration.**
- [ ] **Step 4 : Relancer**, attendu : OK.
- [ ] **Step 5 : Commit** `feat(db): actions sur les échéances, dossiers et exercices`.

---

### Task 11 : Application des données Pennylane

**Files:**
- Create : `supabase/migrations/202611100007_synchro.sql`
- Test : `supabase/tests/07_synchro.test.sql`

**Interfaces:**
- Produces (réservées à `service_role`) :
  - `normaliser_nom(t text) returns text` : minuscules, accents retirés par `translate`, espaces réduits.
  - `sync_appliquer(p_payload jsonb, p_source text) returns jsonb` : charge utile au format de la spec, section 9.2 (`siren` facultatif dans chaque dossier). Crée une ligne `journal_synchro` (nature `fiches` si seuls des dossiers sont présents, sinon `declarations`) et y rattache les anomalies. Règles :
    - Dossiers : insertion ou mise à jour par `pennylane_id` des seuls champs Pennylane ; `vat_frequency` `monthly` donne `mensuel`, `quarterly` `trimestriel`, `yearly`, `annual` ou `annually` `annuel`, `none` ou nul `non_assujetti`, toute autre valeur laisse le régime inchangé avec l'anomalie `regime_tva_inconnu` ; intervenants rapprochés par `normaliser_nom(nom_pennylane)`, nom inconnu : affectation nulle et anomalie `collaborateur_inconnu` (cle = nom) ; nouveau dossier : anomalie `dossier_nouveau` ; exercices insérés ou mis à jour par `(dossier_id, date_fin)`.
    - Déclarations de TVA : dossier inconnu, anomalie `dossier_inconnu` et ligne ignorée ; type selon le régime du dossier (annuel : période de plus de 62 jours `tva_ca12_annuelle`, mois de juillet `tva_ca12_acompte_juillet`, mois de décembre `tva_ca12_acompte_decembre`) ; `date_limite` reçue enregistrée avec `date_limite_source = 'pennylane'` ; statut : `accepted_and_paid` donne `paye` (source `pennylane`) ; `accepted` donne `depose` (source `pennylane`) sauf si l'échéance est déjà `paye` en source `manuel` ; toute autre valeur donne `a_faire`, sauf si l'échéance est déjà `paye` en source `manuel` ; valeur brute dans `statut_pennylane`, montant et date de dépôt enregistrés. Échéance absente : créée, plus anomalie `declaration_sans_echeance`.
    - Liasses : exercice retrouvé par `periode_fin` (créé s'il manque) ; échéance `liasse` mise à jour ; `accepted` donne `depose` avec `date_depot = coalesce(date_depot, aujourdhui())` ; si l'exercice est sous l'étape 6 : passage à 6, historique avec auteur nul, et anomalie `etapes_non_renseignees` si l'étape était inférieure à 5.
    - Isolation : chaque dossier, déclaration ou liasse est traité dans un sous-bloc `begin … exception when others` ; une erreur crée l'anomalie `erreur_dossier` (cle = `pennylane_id`, message = `sqlerrm`) sans interrompre les autres lignes. `fin` du journal est renseignée en sortie.
    - Retour : `{ "journal_id", "dossiers": n, "echeances": n, "anomalies": [{ "type", "dossier_id", "message" }] }`.
  - `dossiers_a_verifier() returns setof bigint` : `pennylane_id` des dossiers actifs ayant une échéance TVA ou liasse `a_faire` dont la limite est entre `aujourdhui() - 60` et `aujourdhui() + 5`.

- [ ] **Step 1 : Écrire `07_synchro.test.sql`** (exécuté en `service_role`, sauf le dernier cas) :
  - `idempotence` : la charge utile d'exemple de la spec (adaptée à D1, `pennylane_id` 1001, noms de collaborateurs des fixtures) appliquée deux fois donne le même nombre d'échéances et un statut `depose`.
  - `accepted_and_paid` : statut `paye`, source `pennylane`.
  - Confirmation manuelle puis `accepted` : reste `paye` en source `manuel`.
  - `statut_inconnu` : `rejected` donne `a_faire` avec `statut_pennylane = 'rejected'`.
  - `regime_inconnu` : `vat_frequency = 'weird'` laisse `mensuel` et crée `regime_tva_inconnu` ; `quarterly` donne `trimestriel`.
  - Déclaration sans échéance : créée, anomalie `declaration_sans_echeance`.
  - Liasse `accepted` sur E1 à l'étape 2 : `etape_actuelle = 6`, historique d'étape 6 sans auteur, anomalie `etapes_non_renseignees`, `date_depot = '2026-11-10'`.
  - Nom `Inconnu TOTAL` : affectation nulle, anomalie `collaborateur_inconnu`. `pennylane_id` 2000 : dossier créé, anomalie `dossier_nouveau`.
  - Date limite Pennylane puis `upsert_echeances_generees` : la date Pennylane est conservée.
  - `dossiers_a_verifier()` contient 1001 quand D1 a une TVA `a_faire` due le 2026-11-12.
  - Une déclaration à la date invalide (`"2026-13-01"`) au milieu de deux déclarations valides : les deux valides sont appliquées, une anomalie `erreur_dossier` est créée, `fin` du journal est renseignée.
  - `csp1` appelant `sync_appliquer` : `42501`.
- [ ] **Step 2 : Lancer `npm run test:db`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter la migration.**
- [ ] **Step 4 : Relancer**, attendu : OK.
- [ ] **Step 5 : Commit** `feat(db): application idempotente des données Pennylane`.

---

### Task 12 : Fonctions serveur de synchronisation

**Files:**
- Create : `supabase/functions/_shared/sync/valider.ts`, `supabase/functions/sync-pennylane/index.ts`, `supabase/functions/dossiers-a-verifier/index.ts`
- Test : `tests/sync/valider.test.ts`

**Interfaces:**
- Consumes : `verifierCle` (Task 7), `sync_appliquer` et `dossiers_a_verifier` (Task 11).
- Produces : `schemaPayload` (zod, format de la spec section 9.2 ; `siren`, `exercices`, `date_depot`, `date_limite` et `montant` facultatifs ; `dossiers`, `declarations_tva` et `liasses` facultatifs, vides par défaut) et `validerPayload(corps: unknown): { ok: true; payload: PayloadSync } | { ok: false; erreur: string }` ; `sync-pennylane` : `POST`, clé `SYNC_SECRET`, 401 sans clé valide, 400 si invalide, sinon appel de `sync_appliquer(payload, payload.source)` et renvoi de son résultat ; `dossiers-a-verifier` : `GET`, même clé, renvoie `{ "pennylane_ids": number[] }`.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
expect(validerPayload(exempleSpec).ok).toBe(true);
expect(validerPayload({ ...exempleSpec, source: 'autre' })).toEqual({ ok: false, erreur: expect.stringContaining('source') });
const lot = { ...exempleSpec, dossiers: Array.from({ length: 51 }, (_, i) => ({ ...exempleSpec.dossiers[0], pennylane_id: i + 1 })) };
expect(validerPayload(lot)).toEqual({ ok: false, erreur: 'Lot limité à 50 dossiers.' });
expect(validerPayload({ source: 'api' }).ok).toBe(true); // listes absentes = vides
```

- [ ] **Step 2 : Lancer `npm test -- tests/sync`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter `valider.ts` et les deux fonctions serveur** (client `@supabase/supabase-js` créé avec `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`).
- [ ] **Step 4 : Relancer**, attendu : OK.
- [ ] **Step 5 : Commit** `feat: porte d'entrée de synchronisation Pennylane`.

---

### Task 13 : Indicateurs de pilotage et plan de charge

**Files:**
- Create : `supabase/migrations/202611100008_pilotage.sql`
- Test : `supabase/tests/08_pilotage.test.sql`

**Interfaces:**
- Produces :
  - `saison_fiscale(d date) returns int` : `extract(year from d + interval '3 months')`.
  - `indicateurs(p_saison int, p_equipe int default null, p_manager uuid default null, p_senior uuid default null) returns jsonb` : manager, associé ou administrateur, sinon `42501`. Structure : `{ "saison", "global": Bloc, "precedente": Bloc | null, "par_equipe": [{ "equipe", ...Bloc }], "par_senior": [{ "senior_id", ...Bloc }] }` où `Bloc = { "depots_en_retard": { "total", "par_cause": { "cabinet", "client", "administration", "autre", "non_qualifie" }, "par_type": { <type>: n } }, "bilans_supervises_avant_cible": { "numerateur", "denominateur", "pourcentage" }, "marge_liasse": { "moyenne_jours", "repartition": { "en_retard", "moins_7", "de_7_a_30", "plus_30" } }, "delai_cloture_supervision": { "moyenne_jours" } }`. Calculs de la spec, section 8.6 : exercices rattachés à la saison par `date_fin`, échéances par `date_limite` ; date de supervision = dernière validation de l'étape 4 ; marge = `date_limite - date_depot` des liasses déposées ; `pourcentage` et moyennes arrondis à une décimale ; `precedente` nul si la saison précédente ne contient aucun exercice.
  - `plan_de_charge(p_debut date, p_semaines int default 26, p_equipe int default null, p_manager uuid default null, p_senior uuid default null) returns table (semaine date, senior_id uuid, a_faire int, supervises int)` : semaines ISO (`date_trunc('week', date_cible)::date`) dans `[p_debut, p_debut + 7 * p_semaines)`, `supervises` = exercices à l'étape 4 ou plus.

- [ ] **Step 1 : Écrire `08_pilotage.test.sql`** :
  - `saison_fiscale('2025-10-01') = 2026`, `('2026-09-30') = 2026`, `('2026-10-01') = 2027`.
  - Trois exercices clos le 2025-12-31, date cible 2026-03-31 : étape 4 validée le 2026-03-20, le 2026-04-10, non validée. Attendu : `numerateur 1`, `denominateur 3`, `pourcentage 33.3`, `delai_cloture_supervision.moyenne_jours 89.5`.
  - Liasses à limite 2026-05-19 déposées le 2026-05-04 et le 2026-05-21 : `moyenne_jours 6.5`, `de_7_a_30 = 1`, `en_retard = 1`.
  - TVA à limite 2026-03-19 déposée le 2026-03-25, cause `cabinet` : `depots_en_retard.total = 2`, `par_cause.cabinet = 1`, `par_cause.non_qualifie = 1`.
  - `precedente` est nul pour la saison 2026.
  - `csp1` appelle `indicateurs` : `42501`.
  - `plan_de_charge('2027-03-01', 8)` : deux exercices à date cible 2027-03-31 du même Senior, dont un à l'étape 4, donnent la ligne `('2027-03-29', senior, 1, 1)`.
- [ ] **Step 2 : Lancer `npm run test:db`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter la migration.**
- [ ] **Step 4 : Relancer**, attendu : OK.
- [ ] **Step 5 : Commit** `feat(db): indicateurs de pilotage et plan de charge`.

---

### Task 14 : Import initial du classeur

**Files:**
- Create : `src/import/analyserClasseur.ts`, `supabase/migrations/202611100009_import.sql`
- Test : `tests/import/analyserClasseur.test.ts`, `supabase/tests/09_import.test.sql`

**Interfaces:**
- Produces :
  - `analyserClasseur(lignesSuivi: Record<string, unknown>[], lignesSources: unknown[][]): ResultatAnalyse` avec `ResultatAnalyse = { dossiers: DossierImport[]; collaborateurs: CollaborateurImport[]; rapport: LigneRapport[] }`, `DossierImport = { siren: string; raisonSociale: string; equipe: 1 | 2 | 3 | null; mission: Mission | null; statut: 'actif' | 'sorti'; jourEcheanceTva: number | null; isN1Superieur3000: boolean | null; commentaire: string | null }`, `CollaborateurImport = { prenom: string; nom: string; trigramme: string; nomPennylane: string }`, `LigneRapport = { ligne: number; champ: string; valeur: string; message: string }`. Les lignes de « Suivi compta » sont lues par en-tête (`Raison Sociale`, `Siren`, `Equipe`, `Mission`, `Date d'échéance`, `IS N-1>3000 €`, `Commentaire`) ; dans « Source listes », chaque colonne `Prénom Nom Junior` ou `Prénom Nom Senior` est suivie de sa colonne `Trigramme`.
  - Normalisations : SIREN complété à 9 chiffres (ligne sans SIREN ignorée avec rapport) ; mission insensible à la casse (`Tenue comptable` → `tenue`, `Révision` → `revision`, `MICRO BNC` et `Micro` → `micro_bnc`, `IRPP` → `irpp`, `Sorti` → `statut: 'sorti'` et mission nulle, autre valeur → nulle avec rapport `Mission non prévue : <valeur>`) ; jour TVA entier de 15 à 24, `Non applicable` → nul, autre → nul avec rapport ; IS `OUI` / `NON` après `trim`, autre → nul avec rapport ; équipe 1 à 3, autre → nulle avec rapport ; cellule commençant par `#` → vide avec rapport ; collaborateur : prénom en casse de titre, nom en majuscules, `nomPennylane = "Prénom NOM"`, dédoublonné par trigramme.
  - Page d'administration (Task 21) : lecture du fichier avec SheetJS, appel de `analyserClasseur`, affichage du rapport, envoi à `import_classeur`.
  - `import_classeur(p jsonb) returns jsonb` (administrateur, sinon `42501`) : `p = { dossiers: DossierImport[], collaborateurs: CollaborateurImport[] }` ; met à jour les champs outil des dossiers rapprochés par SIREN ; insère ou met à jour les collaborateurs par trigramme (rôle et e-mail inchangés s'ils existent déjà) ; retourne `{ "rapproches": n, "non_rapproches": [{ "siren", "raison_sociale", "propositions": [{ "dossier_id", "raison_sociale" }] }], "collaborateurs": n }`, où les propositions sont les dossiers sans SIREN dont `normaliser_nom(raison_sociale)` est identique.
  - `rapprocher_dossier(p_dossier uuid, p_import jsonb) returns void` (administrateur) : enregistre le SIREN et les champs outil d'une ligne `DossierImport` sur le dossier choisi.

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
test('complète le SIREN', () => {
  const r = analyserClasseur([{ 'Raison Sociale': 'ALPHA', Siren: 44229590, Equipe: 1, Mission: 'Tenue Comptable',
    "Date d'échéance": 24, 'IS N-1>3000 €': 'NON ', Commentaire: null }], []);
  expect(r.dossiers[0]).toMatchObject({ siren: '044229590', mission: 'tenue', jourEcheanceTva: 24, isN1Superieur3000: false });
});
expect(analyserClasseur([{ ...ligne, Mission: 'Sorti' }], []).dossiers[0]).toMatchObject({ statut: 'sorti', mission: null });
expect(analyserClasseur([{ ...ligne, Mission: 'Social' }], []).rapport[0].message).toBe('Mission non prévue : Social');
expect(analyserClasseur([{ ...ligne, 'IS N-1>3000 €': '#VALUE!' }], []).dossiers[0].isN1Superieur3000).toBeNull();
expect(analyserClasseur([{ ...ligne, "Date d'échéance": 'Non applicable' }], []).dossiers[0].jourEcheanceTva).toBeNull();
expect(analyserClasseur([{ ...ligne, Equipe: 4 }], []).dossiers[0].equipe).toBeNull();
const sources = [['Prénom Nom Junior', 'Trigramme', 'Tx', 'Prénom Nom Senior', 'Trigramme'],
                 ['amina ouihaka', 'AOU', 40, 'azer horrigue', 'AHO'], ['amina ouihaka', 'AOU', 40, null, null]];
expect(analyserClasseur([], sources).collaborateurs).toEqual([
  { prenom: 'Amina', nom: 'OUIHAKA', trigramme: 'AOU', nomPennylane: 'Amina OUIHAKA' },
  { prenom: 'Azer', nom: 'HORRIGUE', trigramme: 'AHO', nomPennylane: 'Azer HORRIGUE' }]);
```

  SQL : `rca` importe un dossier au SIREN de D1 : équipe et mission mises à jour, `rapproches = 1` ; un SIREN inconnu dont la raison sociale normalisée égale celle de D2 (sans SIREN) figure dans `non_rapproches` avec D2 en proposition ; `man1` (non administrateur) : `42501`.
- [ ] **Step 2 : Lancer `npm test -- tests/import` et `npm run test:db`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter `analyserClasseur.ts` et la migration.**
- [ ] **Step 4 : Relancer les deux suites**, attendu : OK.
- [ ] **Step 5 : Commit** `feat: import initial du classeur et rapprochement des dossiers`.

---

### Task 15 : Récapitulatif hebdomadaire

**Files:**
- Create : `supabase/migrations/202611100010_recapitulatif.sql`, `supabase/functions/_shared/recap/construire.ts`, `planification.ts`, `graph.ts`, `supabase/functions/recapitulatif-hebdo/index.ts`
- Test : `tests/recap/planification.test.ts`, `tests/recap/construire.test.ts`, `supabase/tests/10_recapitulatif.test.sql`

**Interfaces:**
- Produces :
  - `destinataires_recapitulatif() returns setof collaborateurs` (`service_role`) : collaborateurs actifs, à e-mail non nul ; CSP et Seniors limités aux équipes `recap_equipes` (au moins un dossier de ces équipes) ; managers et associé toujours inclus ; aucun destinataire si `recap_actif` est faux.
  - `donnees_recapitulatif(p_collaborateur uuid) returns jsonb` (`service_role`) au format `DonneesRecap = { collaborateur: { prenom, role }, semaineDu: ISODate, echeances7j: LigneRecap[], echeancesEnRetard: LigneRecap[], alertesPaiement: LigneRecap[], exercicesEnRetard: LigneExerciceRecap[], synthese: { trigramme, echeances, retards, alertes }[] | null, fileSupervision: LigneExerciceRecap[] | null, anomaliesOuvertes: number | null }`, avec `LigneRecap = { dossierId, raisonSociale, type, dateLimite }` et `LigneExerciceRecap = { dossierId, raisonSociale, dateCible, etapeActuelle }`. CSP et Senior : leurs dossiers ; manager : les dossiers dont il est manager, avec `synthese` par collaborateur et `fileSupervision` (étape 3) ; associé : tout le cabinet.
  - `doitEnvoyer(maintenant: Date, dejaEnvoyeAujourdhui: boolean): boolean` : vrai si, à Europe/Paris, c'est un lundi, l'heure vaut 7 et aucun envoi n'a eu lieu ce jour.
  - `construireRecapitulatif(d: DonneesRecap, urlApplication: string): { sujet: string; html: string; texte: string }` : sujet `Suivi CPA & ABADIE : votre semaine du <formaterDateLongue(semaineDu)>` ; liens `<urlApplication>/dossiers/<dossierId>` ; sections « Échéances des 7 prochains jours », « Échéances en retard », « Paiements de TVA non constatés », « Bilans en retard » ; pour un manager ou l'associé, en plus « Synthèse du portefeuille », « File de supervision », « Anomalies de synchronisation » ; sans aucun élément : `Aucune échéance ni aucun retard cette semaine.` ; styles en ligne aux couleurs de la charte, police de la charte.
  - `envoyerMail(jeton: string, expediteur: string, destinataire: string, sujet: string, html: string): Promise<void>` (`POST https://graph.microsoft.com/v1.0/users/{expediteur}/sendMail`) et `obtenirJetonGraph(tenant: string, client: string, secret: string): Promise<string>` (client credentials, portée `https://graph.microsoft.com/.default`).
  - Fonction `recapitulatif-hebdo` : `POST` protégé par `CRON_SECRET` ; sort sans rien faire si `doitEnvoyer` est faux (envoi du jour déterminé par une ligne `journal_synchro` de nature `recapitulatif` datée d'aujourd'hui) ; sinon envoie à chaque destinataire, consigne chaque échec dans les anomalies (type `envoi_recapitulatif`, cle = e-mail) sans interrompre les autres envois, puis écrit la ligne de journal.

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
test('doitEnvoyer', () => {
  expect(doitEnvoyer(new Date('2026-11-16T06:30:00Z'), false)).toBe(true);   // lundi, 7 h 30 en hiver
  expect(doitEnvoyer(new Date('2026-11-16T05:30:00Z'), false)).toBe(false);  // 6 h 30
  expect(doitEnvoyer(new Date('2027-06-07T05:30:00Z'), false)).toBe(true);   // lundi, 7 h 30 en été
  expect(doitEnvoyer(new Date('2027-06-07T06:30:00Z'), false)).toBe(false);  // 8 h 30
  expect(doitEnvoyer(new Date('2026-11-16T06:30:00Z'), true)).toBe(false);
  expect(doitEnvoyer(new Date('2026-11-17T06:30:00Z'), false)).toBe(false);  // mardi
});
const m = construireRecapitulatif(donneesCsp, 'https://app.test');
expect(m.sujet).toBe('Suivi CPA & ABADIE : votre semaine du lundi 16 novembre 2026');
expect(m.html).toContain('https://app.test/dossiers/');
expect(m.html).not.toContain('—');
expect(construireRecapitulatif(donneesVides, 'https://app.test').html).toContain('Aucune échéance ni aucun retard cette semaine.');
expect(construireRecapitulatif(donneesManager, 'https://app.test').html).toContain('File de supervision');
```

  SQL : avec `recap_equipes = '{2}'`, `csp1` (équipe 1) n'est pas destinataire et `man1` l'est ; avec `recap_actif = false`, aucun destinataire ; `donnees_recapitulatif` de `csp1` contient une TVA de D1 due le 2026-11-12 dans `echeances7j` et aucune ligne de D2.
- [ ] **Step 2 : Lancer `npm test -- tests/recap` et `npm run test:db`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter la migration, les trois modules et la fonction serveur.**
- [ ] **Step 4 : Relancer les deux suites**, attendu : OK.
- [ ] **Step 5 : Commit** `feat: récapitulatif hebdomadaire par e-mail`.

---

### Task 16 : Planification et données initiales

**Files:**
- Create : `supabase/migrations/202611100011_donnees_initiales.sql`
- Test : `supabase/tests/11_donnees_initiales.test.sql`

**Interfaces:**
- Produces :
  - Formes juridiques : approbation et dépôt au greffe pour `SA`, `SAS`, `SASU`, `SARL`, `EURL`, `SELARL`, `SELAS`, `SNC` ; approbation seule pour `SCI`, `SCM`, `SC`, `SCP` ; ni l'une ni l'autre pour `ENTREPRISE INDIVIDUELLE`, `LMNP`, `MICRO`, `ASSOCIATION`.
  - Jours fériés 2026 à 2028 : 1er janvier, lundi de Pâques (2026-04-06, 2027-03-29, 2028-04-17), 1er mai, 8 mai, Ascension (2026-05-14, 2027-05-06, 2028-05-25), lundi de Pentecôte (2026-05-25, 2027-05-17, 2028-06-05), 14 juillet, 15 août, 1er novembre, 11 novembre, 25 décembre.
  - Aucun calendrier annuel n'est pré-rempli : il est saisi après validation par un manager (prérequis de la spec, section 14).
  - Planification, dans un bloc exécuté seulement si les extensions `pg_cron` et `pg_net` sont disponibles : `generer-echeances` chaque jour à `0 1 * * *` (UTC) ; `recapitulatif-hebdo` à `30 5,6 * * 1` (UTC, la fonction ne retient que 7 h 30 à Paris). L'URL des fonctions et `CRON_SECRET` sont lus dans `vault.decrypted_secrets` (noms `functions_url` et `cron_secret`).

- [ ] **Step 1 : Écrire le test** : `count(*) from formes_juridiques where code = 'SCI' and approbation and not depot_greffe` vaut 1 ; `'2027-05-17'` est dans `jours_feries` ; la migration s'applique sans erreur en l'absence de `pg_cron`.
- [ ] **Step 2 : Lancer `npm run test:db`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter la migration.**
- [ ] **Step 4 : Relancer**, attendu : OK.
- [ ] **Step 5 : Commit** `feat(db): données initiales et planification`.

---

### Task 17 : Connexion, droits d'affichage et cadre de l'application

**Files:**
- Create : `src/lib/supabase.ts`, `src/auth/SessionProvider.tsx`, `src/auth/permissions.ts`, `src/data/types.ts`, `src/data/synchro.ts`, `src/components/AppLayout.tsx`, `src/components/BandeauSynchro.tsx`, `src/components/StatutBadge.tsx`, `src/pages/Connexion.tsx`, `src/pages/AccesRefuse.tsx` ; modifier `src/App.tsx`
- Test : `src/auth/permissions.test.ts`, `src/components/AppLayout.test.tsx`, `src/components/BandeauSynchro.test.tsx`

**Interfaces:**
- Produces :
  - `Moi = { id: string; prenom: string; nom: string; trigramme: string; role: 'csp' | 'senior' | 'manager' | 'associe'; administrateur: boolean }` ; `useMoi(): { moi: Moi | null; chargement: boolean }` (lecture de `moi()` par RPC).
  - `permissions.ts` : `peutValiderEtape(role, etape: number): boolean` (même tableau que la Task 9) ; `peutRevenir(role): boolean` ; `peutAgirSurEcheance(moi: Moi, dossier: { csp_id; senior_id }): boolean` ; `peutModifierDossier(moi: Moi): boolean` ; `peutVoirIndicateurs(moi: Moi): boolean` ; `peutAdministrer(moi: Moi): boolean` (consultation : manager, associé ou administrateur) ; `peutModifierAdministration(moi: Moi): boolean` (administrateur).
  - `derniereSynchro(): Promise<string | null>` (colonne `fin` de la dernière ligne `journal_synchro` de nature `fiches` ou `declarations` dont `fin` est renseignée).
  - Routes : `/connexion`, `/` (Accueil), `/echeancier`, `/production`, `/dossiers/:id`, `/indicateurs`, `/administration` ; navigation latérale marine ; « Indicateurs » et « Administration » masqués selon les permissions.
  - Connexion : `supabase.auth.signInWithOAuth({ provider: 'azure', options: { scopes: 'email openid profile' } })` ; bouton « Se connecter avec Microsoft 365 ». Session ouverte mais `moi` nul : page `AccesRefuse` avec le texte `Votre compte n'est pas autorisé à accéder à l'outil. Contactez un administrateur.`

- [ ] **Step 1 : Écrire les tests qui échouent** : `peutValiderEtape('csp', 3)` vaut `false`, `peutValiderEtape('senior', 5)` vaut `true`, `peutValiderEtape('manager', 6)` vaut `false` ; `peutVoirIndicateurs` est faux pour un CSP et vrai pour un CSP administrateur ; `AppLayout` affiche le lien « Indicateurs » pour un manager et pas pour un Senior ; `BandeauSynchro` affiche `Dernière synchronisation Pennylane : 10/11/2026 à 02:15` et passe en alerte (classe `bg-red-600`, texte `Synchronisation Pennylane interrompue depuis plus de 48 heures`) quand l'horodatage date de plus de 48 heures (`vi.setSystemTime`).
- [ ] **Step 2 : Lancer `npm test -- src`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter les fichiers** (React Query pour les lectures ; les tests simulent `src/data/*` avec `vi.mock`).
- [ ] **Step 4 : Relancer**, attendu : OK ; `npm run build` sans erreur.
- [ ] **Step 5 : Commit** `feat(ui): connexion Microsoft 365, droits d'affichage et navigation`.

---

### Task 18 : Accueil et échéancier

**Files:**
- Create : `src/data/echeances.ts`, `src/components/ExportExcel.tsx`, `src/pages/Accueil.tsx`, `src/pages/Echeancier.tsx`
- Test : `src/pages/Echeancier.test.tsx`, `src/pages/Accueil.test.tsx`, `src/components/ExportExcel.test.tsx`

**Interfaces:**
- Consumes : vues et fonctions des Tasks 8, 10 ; permissions (Task 17).
- Produces :
  - `FiltresEcheances = { types?: TypeEcheance[]; statuts?: StatutEcheance[]; collaborateurId?: string; equipe?: number; du?: ISODate; au?: ISODate; mesDossiers: boolean }` ; `listerEcheances(f: FiltresEcheances): Promise<LigneEcheance[]>` (lecture de `v_echeances`) ; `marquerEcheance`, `confirmerPaiement`, `qualifierRetard` (appels RPC de la Task 10).
  - `exporterExcel(nomFichier: string, colonnes: { cle: string; libelle: string }[], lignes: Record<string, unknown>[]): void` (SheetJS `writeFile`), et composant `<ExportExcel>` qui l'appelle avec les lignes filtrées.
  - Code couleur (`StatutBadge`) : en retard rouge, sous 7 jours orange, à faire `primaire`, déposé ou payé vert, non applicable `gris`, « Paiement non constaté » violet.
  - Échéancier : filtres de `FiltresEcheances`, bascule liste / calendrier mensuel, actions « Marquer déposé », « Non applicable », « Confirmer le paiement », « Qualifier la cause du retard » visibles selon `peutAgirSurEcheance` et le type (mention « Pennylane » et aucune action de dépôt sur une échéance synchronisée).
  - Accueil : pour CSP et Senior, blocs « Mes échéances à 7 jours », « À 30 jours », « En retard », « Paiements de TVA non constatés », « Mes bilans par étape », « Bilans en retard » ; pour manager, associé et administrateur, en plus « Retards par collaborateur », « File de supervision » (exercices à l'étape 3), « Anomalies de synchronisation » et « Retards non qualifiés ».

- [ ] **Step 1 : Écrire les tests qui échouent** : avec une liste simulée, une `tva_mensuelle` affiche la mention « Pennylane » et aucun bouton « Marquer déposé » ; un `is_solde` du CSP connecté affiche « Marquer déposé », qui appelle `marquerEcheance(id, 'depose')` ; une ligne `alerte_paiement` affiche « Paiement non constaté » et « Confirmer le paiement » ; le filtre « Mes dossiers » est coché par défaut ; l'accueil d'un manager affiche « File de supervision », celui d'un CSP non ; `ExportExcel` appelle `exporterExcel` avec les lignes filtrées (simulation de `xlsx`).
- [ ] **Step 2 : Lancer `npm test -- src/pages src/components`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter les fichiers.**
- [ ] **Step 4 : Relancer**, attendu : OK.
- [ ] **Step 5 : Commit** `feat(ui): accueil, échéancier et export Excel`.

---

### Task 19 : Production des bilans et plan de charge

**Files:**
- Create : `src/data/exercices.ts`, `src/pages/Production.tsx`, `src/pages/PlanDeCharge.tsx`
- Test : `src/pages/Production.test.tsx`, `src/pages/PlanDeCharge.test.tsx`

**Interfaces:**
- Consumes : `v_exercices`, `valider_etape`, `revenir_etape`, `maj_exercice`, `plan_de_charge` ; permissions.
- Produces :
  - `FiltresExercices = { collaborateurId?: string; equipe?: number; managerId?: string; seniorId?: string; mesDossiers: boolean }` ; `listerExercices(f: FiltresExercices): Promise<LigneExercice[]>` (lecture de `v_exercices`), `validerEtape(id, etape, commentaire?)`, `revenirEtape(id, etape, commentaire)`, `majDateCible(id, date)`, `planDeCharge(debut: ISODate, semaines: number, f: FiltresExercices): Promise<LignePlan[]>` avec `LignePlan = { semaine: ISODate; senior_id: string | null; a_faire: number; supervises: number }`.
  - Libellés d'étapes : 0 `Non commencé`, 1 `Pièces demandées`, 2 `Saisie terminée`, 3 `Révision terminée`, 4 `Supervision validée`, 5 `Comptes présentés au client`, 6 `Liasse télétransmise`.
  - Production : onglets « Colonnes » (une colonne par étape, cartes avec dossier, clôture, date cible, intervenant attendu, pastille rouge si `en_retard`), « Tableau » et « Plan de charge ». Bouton « Valider : <libellé de l'étape suivante> » visible si `peutValiderEtape` ; action « Revenir à une étape » avec commentaire obligatoire si `peutRevenir`.
  - Plan de charge : histogramme recharts empilé par Senior sur 26 semaines à partir du lundi courant, deux tons (`primaire` pour « à faire », `gris` pour « supervisés »), filtres équipe, manager, Senior ; un clic sur une barre ouvre la liste des exercices de la semaine, avec modification de la date cible pour un manager.

- [ ] **Step 1 : Écrire les tests qui échouent** : un exercice à l'étape 2 affiche « Valider : Révision terminée » pour un Senior et pas pour un CSP ; le clic appelle `validerEtape(id, 3)` ; le formulaire de retour refuse l'envoi sans commentaire ; aucun bouton de validation n'apparaît sur une carte à l'étape 5 (l'étape 6 est automatique) ; le plan de charge regroupe les lignes simulées par semaine et ouvre la liste des dossiers au clic.
- [ ] **Step 2 : Lancer `npm test -- src/pages`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter les fichiers.**
- [ ] **Step 4 : Relancer**, attendu : OK.
- [ ] **Step 5 : Commit** `feat(ui): production des bilans et plan de charge`.

---

### Task 20 : Fiche dossier et indicateurs

**Files:**
- Create : `src/data/dossiers.ts`, `src/data/pilotage.ts`, `src/pages/FicheDossier.tsx`, `src/pages/Indicateurs.tsx`
- Test : `src/pages/FicheDossier.test.tsx`, `src/pages/Indicateurs.test.tsx`

**Interfaces:**
- Consumes : `dossiers`, `v_exercices`, `historique_etapes`, `v_echeances`, `maj_dossier_outil`, `maj_exercice`, `indicateurs`.
- Produces :
  - `lireDossier(id: string): Promise<FicheDossier>` ; `majDossierOutil(...)` ; `lireIndicateurs(saison: number, f: FiltresExercices): Promise<Indicateurs>` (type `Indicateurs` calqué sur le retour de la Task 13).
  - Fiche : identité, intervenants (trigrammes), lien `https://app.pennylane.com/companies/{pennylane_id}`, exercice en cours et historique des étapes (date, auteur ou « Pennylane », commentaire), échéances du dossier, commentaire ; champs outil modifiables si `peutModifierDossier`.
  - Indicateurs : sélecteur de saison (par défaut `saison_fiscale(aujourd'hui)`), filtres équipe, manager, Senior, quatre cartes (valeur, comparaison avec la saison précédente ou `Comparaison indisponible pour la première saison`), tableaux par équipe et par Senior, export Excel. Route protégée par `peutVoirIndicateurs`.

- [ ] **Step 1 : Écrire les tests qui échouent** : la fiche affiche le lien Pennylane du dossier 1001 (`https://app.pennylane.com/companies/1001`) et « Pennylane » comme auteur d'une étape 6 ; un Senior ne voit pas le bouton « Modifier » ; l'écran Indicateurs affiche `33.3 %` et `Comparaison indisponible pour la première saison` quand `precedente` est nul ; un CSP redirigé vers `/indicateurs` revient à l'accueil.
- [ ] **Step 2 : Lancer `npm test -- src/pages`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter les fichiers.**
- [ ] **Step 4 : Relancer**, attendu : OK.
- [ ] **Step 5 : Commit** `feat(ui): fiche dossier et indicateurs de pilotage`.

---

### Task 21 : Administration

**Files:**
- Create : `src/data/admin.ts`, `src/pages/Administration.tsx`
- Test : `src/pages/Administration.test.tsx`

**Interfaces:**
- Consumes : tables de paramètres (Task 3), `import_classeur`, `rapprocher_dossier`, `analyserClasseur` (Task 14), `journal_synchro`, `anomalies`.
- Produces : onglets « Collaborateurs » (rôle, e-mail, administrateur, actif), « Paramètres » (ligne `parametres`, calendriers annuels, formes juridiques, jours fériés), « Journal et anomalies » (journal de synchronisation et des envois du récapitulatif ; anomalies ouvertes avec action « Marquer résolue » qui renseigne `resolue_le`), « Import du classeur » (choix du fichier, rapport d'analyse, envoi, liste des non rapprochés avec choix d'une proposition). Consultation pour `peutAdministrer`, modification pour `peutModifierAdministration` (champs en lecture seule sinon). La résolution d'une anomalie requiert une politique `update` limitée à `resolue_le` pour les administrateurs, à ajouter dans `202611100002_securite.sql` avec son test dans `02_securite.test.sql`.

- [ ] **Step 1 : Écrire les tests qui échouent** : un manager non administrateur voit les onglets mais les champs sont désactivés ; un administrateur peut cocher « Administrateur » sur un collaborateur ; l'import d'un fichier simulé affiche les lignes du rapport puis le nombre de dossiers rapprochés ; un non-rapproché propose D2 et le choix appelle `rapprocher_dossier`. Côté SQL : `rca` renseigne `resolue_le` d'une anomalie ; `man1` ne le peut pas.
- [ ] **Step 2 : Lancer `npm test -- src/pages` et `npm run test:db`**, attendu : ÉCHEC.
- [ ] **Step 3 : Implémenter la page et la politique.**
- [ ] **Step 4 : Relancer les deux suites**, attendu : OK.
- [ ] **Step 5 : Commit** `feat(ui): administration, journal et import du classeur`.

---

### Task 22 : Mise en ligne dans Lovable et synchronisation de phase 1

Cette tâche agit sur des services externes (Lovable, Microsoft 365, Pennylane, Claude). Chaque étape est d'abord présentée à Robin CAPPAROS et exécutée seulement avec son accord.

**Files:**
- Create : `docs/exploitation/mise-en-service.md`, `docs/exploitation/synchro-claude.md`

**Interfaces:**
- Consumes : l'ensemble des tâches précédentes.
- Produces : application en ligne ; tâches planifiées Claude de synchronisation.

- [ ] **Step 1 : Vérifier la branche** : `npm test`, `npm run test:db` et `npm run build` passent ; attendu : aucun échec.
- [ ] **Step 2 : Créer le projet Lovable** avec Lovable Cloud activé, le relier à GitHub depuis Lovable, ajouter le dépôt créé comme remote et y pousser la branche principale. Vérification : l'aperçu Lovable affiche la page « Se connecter avec Microsoft 365 ».
- [ ] **Step 3 : Appliquer les migrations** `supabase/migrations` dans l'ordre sur la base Lovable Cloud et déployer les quatre fonctions serveur. Vérification : `select count(*) from formes_juridiques` renvoie 16 ; `pg_cron` présent (`select * from cron.job` liste 2 tâches), sinon signaler à Robin que la planification doit passer par une autre voie avant de continuer.
- [ ] **Step 4 : Robin enregistre l'application dans Microsoft Entra ID** (locataire unique, URI de redirection `<URL Supabase>/auth/v1/callback`), active le fournisseur Azure dans l'authentification Lovable Cloud avec l'URL `https://login.microsoftonline.com/<tenant-id>`, ajoute la permission applicative Microsoft Graph `Mail.Send` avec consentement administrateur, et la restreint à la boîte d'envoi partagée (Exchange Online, contrôle d'accès applicatif). Vérification : Robin se connecte et voit `AccesRefuse` tant qu'il n'est pas référencé.
- [ ] **Step 5 : Enregistrer les secrets** `SYNC_SECRET`, `CRON_SECRET` (valeurs aléatoires de 32 octets), `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` dans les secrets des fonctions, et `functions_url`, `cron_secret` dans Vault. Insérer Robin CAPPAROS comme collaborateur manager administrateur par requête SQL. Vérification : Robin accède à l'administration.
- [ ] **Step 6 : Rédiger `docs/exploitation/synchro-claude.md`** : la consigne exacte des deux tâches planifiées Claude.
  - Nuit (chaque jour à 2 h 13, heure de Paris) : appeler `GET <functions_url>/dossiers-a-verifier` ; pour chaque `pennylane_id`, lire `get_vat_returns` (période depuis aujourd'hui moins 120 jours) et `get_tax_returns` avec le connecteur Pennylane ; envoyer à `POST <functions_url>/sync-pennylane` par lots de 50 dossiers au format de la spec, section 9.2, avec `source: "mcp"` ; terminer par un compte rendu (dossiers traités, anomalies renvoyées).
  - Semaine (chaque dimanche à 3 h 17, heure de Paris) : parcourir `list_companies` de la firme 693 par pages de 100, lire pour chaque dossier les exercices avec `get_context` (et le SIREN s'il y figure), et envoyer les fiches par lots de 50.
  - La clé `SYNC_SECRET` est enregistrée comme secret réseau de l'environnement Claude pour l'hôte des fonctions, jamais dans le texte des consignes.
- [ ] **Step 7 : Robin reconnecte le connecteur Pennylane dans claude.ai**, puis créer les deux tâches planifiées à partir de `synchro-claude.md` et lancer une fois la tâche hebdomadaire à la main. Vérification : `select count(*) from dossiers` renvoie environ 799, et le journal contient une ligne `fiches` sans erreur.
- [ ] **Step 8 : Saisir le calendrier annuel 2027** validé par un manager, importer le classeur depuis l'administration, traiter les non rapprochés, attribuer rôles et e-mails des 22 collaborateurs, puis lancer `generer-echeances` à la main et la tâche de nuit Claude. Vérification : l'échéancier de Robin affiche les TVA de novembre 2026 ; les anomalies `calendrier_absent` ont disparu.
- [ ] **Step 9 : Recette métier** : comparer 20 dossiers tirés au hasard entre l'outil, Pennylane et le classeur (échéances, statuts, intervenants) et consigner les écarts dans `docs/exploitation/mise-en-service.md`. Vérification : aucun écart non expliqué.
- [ ] **Step 10 : Pilote** : régler `recap_equipes` sur l'équipe pilote choisie par Robin, et laisser fonctionner un mois en parallèle du classeur avant d'étendre à `{1,2,3}`.
- [ ] **Step 11 : Commit** `docs: procédure de mise en service et consignes de synchronisation`.
