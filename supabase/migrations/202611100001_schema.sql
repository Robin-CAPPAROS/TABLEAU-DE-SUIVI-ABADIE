-- Schema de donnees : tableau de suivi des echeances et des bilans.
create type role_collaborateur as enum ('csp', 'senior', 'manager', 'associe');
create type regime_tva as enum ('mensuel', 'trimestriel', 'annuel', 'non_assujetti');
create type mission as enum ('tenue', 'revision', 'micro_bnc', 'irpp');
create type statut_dossier as enum ('actif', 'sorti');
create type type_echeance as enum (
  'tva_mensuelle', 'tva_trimestrielle',
  'tva_ca12_acompte_juillet', 'tva_ca12_acompte_decembre', 'tva_ca12_annuelle',
  'liasse',
  'is_acompte_1', 'is_acompte_2', 'is_acompte_3', 'is_acompte_4', 'is_solde',
  'approbation', 'depot_greffe'
);
create type statut_echeance as enum ('a_faire', 'depose', 'paye', 'non_applicable');
create type source_statut as enum ('pennylane', 'manuel');
create type cause_retard as enum ('cabinet', 'client', 'administration', 'autre');
create type sens_etape as enum ('validation', 'retour');

create table collaborateurs (
  id uuid primary key default gen_random_uuid(),
  prenom text not null,
  nom text not null,
  nom_pennylane text not null,
  trigramme text not null,
  email text not null,
  role role_collaborateur,
  administrateur boolean not null default false,
  actif boolean not null default true
);
create unique index collaborateurs_email_uniq on collaborateurs (lower(email));
create unique index collaborateurs_trigramme_uniq on collaborateurs (trigramme);

create table dossiers (
  id uuid primary key default gen_random_uuid(),
  pennylane_id bigint not null unique,
  raison_sociale text not null,
  siren text,
  forme_juridique text,
  regime_tva regime_tva,
  categorie_fiscale text,
  regime_fiscal text,
  csp_id uuid references collaborateurs (id),
  senior_id uuid references collaborateurs (id),
  manager_id uuid references collaborateurs (id),
  equipe int check (equipe in (1, 2, 3)),
  mission mission,
  statut statut_dossier not null default 'actif',
  jour_echeance_tva int check (jour_echeance_tva between 15 and 24),
  is_n1_superieur_3000 boolean not null default false,
  commentaire text,
  derniere_synchro timestamptz
);

create table exercices (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers (id),
  date_debut date not null,
  date_fin date not null,
  date_cible date,
  etape_actuelle int not null default 0 check (etape_actuelle between 0 and 6),
  date_approbation date,
  unique (dossier_id, date_fin)
);

create table historique_etapes (
  id uuid primary key default gen_random_uuid(),
  exercice_id uuid not null references exercices (id),
  etape int not null check (etape between 1 and 6),
  sens sens_etape not null,
  date timestamptz not null default now(),
  auteur_id uuid references collaborateurs (id),
  commentaire text,
  check (sens <> 'retour' or coalesce(btrim(commentaire), '') <> '')
);

create table echeances (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers (id),
  exercice_id uuid references exercices (id),
  type type_echeance not null,
  periode_debut date not null,
  periode_fin date not null,
  date_limite date not null,
  date_limite_source text not null default 'calcul' check (date_limite_source in ('calcul', 'pennylane')),
  statut statut_echeance not null default 'a_faire',
  statut_pennylane text,
  source_statut source_statut,
  date_depot date,
  montant numeric,
  auteur_id uuid references collaborateurs (id),
  cause_retard cause_retard,
  unique (dossier_id, type, periode_debut, periode_fin)
);

create table journal_synchro (
  id uuid primary key default gen_random_uuid(),
  debut timestamptz not null default now(),
  fin timestamptz,
  source text check (source in ('mcp', 'api', 'outil')),
  nature text check (nature in ('fiches', 'declarations', 'generation', 'recapitulatif')),
  nb_dossiers int default 0,
  nb_echeances int default 0
);

create table anomalies (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  dossier_id uuid references dossiers (id),
  cle text not null default '',
  message text not null,
  journal_id uuid references journal_synchro (id),
  cree_le timestamptz default now(),
  resolue_le timestamptz
);
create unique index anomalies_ouvertes_uniq
  on anomalies (type, coalesce(dossier_id, '00000000-0000-0000-0000-000000000000'), cle)
  where resolue_le is null;

create table calendriers_annuels (
  annee int primary key,
  date_liasse_3112 date not null,
  date_solde_is_3112 date not null,
  date_ca12_3112 date not null
);

create table formes_juridiques (
  code text primary key,
  approbation boolean not null,
  depot_greffe boolean not null
);

create table jours_feries (
  jour date primary key
);

create table parametres (
  id int primary key check (id = 1),
  date_cible_mois_tenue int not null default 3,
  date_cible_mois_revision int not null default 3,
  date_cible_mois_micro_bnc int not null default 3,
  date_cible_mois_irpp int not null default 3,
  jalon_etape2_jours int not null default 30,
  jalon_etape3_jours int not null default 15,
  delai_greffe_mois int not null default 2,
  delai_alerte_paiement_jours int not null default 5,
  recap_actif boolean not null default true,
  recap_equipes int[] not null default '{1,2,3}',
  recap_expediteur text
);

alter table collaborateurs enable row level security;
alter table dossiers enable row level security;
alter table exercices enable row level security;
alter table historique_etapes enable row level security;
alter table echeances enable row level security;
alter table journal_synchro enable row level security;
alter table anomalies enable row level security;
alter table calendriers_annuels enable row level security;
alter table formes_juridiques enable row level security;
alter table jours_feries enable row level security;
alter table parametres enable row level security;
