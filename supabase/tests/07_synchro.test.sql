begin;

create function code_erreur(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlstate;
end $$;
grant execute on function code_erreur(text) to authenticated, anon;

set local app.aujourdhui = '2026-11-10';

-- csp1 ne peut pas appeler sync_appliquer
set local role authenticated;
set local request.jwt.claims = '{"email":"csp1@cabinet.test"}';
do $$
begin
  assert code_erreur($q$select sync_appliquer('{}'::jsonb, 'mcp')$q$) = '42501', 'csp1 refuse';
  assert code_erreur($q$select * from dossiers_a_verifier()$q$) = '42501', 'csp1 refuse dossiers_a_verifier';
end $$;
reset role;

-- Supabase accorde par defaut les droits sur les tables a service_role.
grant all on all tables in schema public to service_role;
alter role service_role bypassrls;
set local role service_role;

-- normaliser_nom
do $$
begin
  assert normaliser_nom('  Hélène   ROUSSEAU ') = 'helene rousseau', 'normalisation';
end $$;

-- idempotence : charge utile type, deux fois
create temp table payload (p jsonb);
grant all on payload to service_role;
insert into payload values ($j$
{
  "source": "mcp",
  "dossiers": [{
    "pennylane_id": 1001, "raison_sociale": "SOCIETE TEST UN SYNCHRO", "forme_juridique": "SARL",
    "regime_tva": "monthly", "categorie_fiscale": "bic_is", "regime_fiscal": "fr_rn",
    "comptable": "camille dupuis", "superviseur": "Sophie LAMBERT", "manager": "Marc GIRARD",
    "exercices": [{"debut": "2026-01-01", "fin": "2026-12-31"}]
  }],
  "declarations_tva": [{
    "pennylane_id": 1001, "periode_debut": "2026-09-01", "periode_fin": "2026-09-30",
    "date_limite": "2026-10-19", "date_depot": "2026-10-19", "statut": "accepted", "montant": "-1512"
  }]
}
$j$::jsonb);

do $$
declare r1 jsonb; r2 jsonb; n1 int; n2 int; e echeances; d dossiers;
begin
  r1 := sync_appliquer((select p from payload), 'mcp');
  select count(*) into n1 from echeances where dossier_id = '00000000-0000-0000-0000-0000000000d1';
  r2 := sync_appliquer((select p from payload), 'mcp');
  select count(*) into n2 from echeances where dossier_id = '00000000-0000-0000-0000-0000000000d1';
  assert n1 = n2 and n1 = 1, 'meme nombre d echeances: ' || n1 || ' / ' || n2;
  assert (r1->>'journal_id') is not null and (r2->>'dossiers')::int = 1 and (r2->>'echeances')::int = 1, 'retour ' || r2;
  select * into e from echeances where dossier_id = '00000000-0000-0000-0000-0000000000d1' and type = 'tva_mensuelle';
  assert e.statut = 'depose' and e.source_statut = 'pennylane' and e.statut_pennylane = 'accepted', 'depose';
  assert e.montant = -1512 and e.date_depot = date '2026-10-19' and e.date_limite = date '2026-10-19'
         and e.date_limite_source = 'pennylane', 'champs echeance';
  select * into d from dossiers where id = '00000000-0000-0000-0000-0000000000d1';
  assert d.raison_sociale = 'SOCIETE TEST UN SYNCHRO' and d.derniere_synchro is not null, 'dossier mis a jour';
  assert d.equipe = 1 and d.mission = 'tenue' and d.jour_echeance_tva = 19, 'champs outil intacts';
  assert d.csp_id = '00000000-0000-0000-0000-0000000000c1', 'csp rapproche (casse)';
  assert (select count(*) from exercices where dossier_id = d.id) = 1, 'exercice non duplique';
  assert (select nb_dossiers from journal_synchro where id = (r1->>'journal_id')::uuid) = 1, 'journal nb_dossiers';
  assert (select fin from journal_synchro where id = (r1->>'journal_id')::uuid) is not null, 'journal fin';
  assert (select nature from journal_synchro where id = (r1->>'journal_id')::uuid) = 'declarations', 'nature';
end $$;

-- accepted_and_paid
do $$
declare e echeances;
begin
  perform sync_appliquer($j$ {"declarations_tva": [{"pennylane_id": 1001, "periode_debut": "2026-09-01",
    "periode_fin": "2026-09-30", "statut": "accepted_and_paid"}]} $j$::jsonb, 'mcp');
  select * into e from echeances where dossier_id = '00000000-0000-0000-0000-0000000000d1' and type = 'tva_mensuelle';
  assert e.statut = 'paye' and e.source_statut = 'pennylane', 'paye pennylane';
end $$;

-- manuel puis accepted : reste paye manuel
do $$
declare e echeances;
begin
  update echeances set statut = 'paye', source_statut = 'manuel'
   where dossier_id = '00000000-0000-0000-0000-0000000000d1' and type = 'tva_mensuelle';
  perform sync_appliquer($j$ {"declarations_tva": [{"pennylane_id": 1001, "periode_debut": "2026-09-01",
    "periode_fin": "2026-09-30", "statut": "accepted"}]} $j$::jsonb, 'mcp');
  select * into e from echeances where dossier_id = '00000000-0000-0000-0000-0000000000d1' and type = 'tva_mensuelle';
  assert e.statut = 'paye' and e.source_statut = 'manuel', 'manuel conserve';
  -- statut inconnu sur paye manuel : conserve aussi
  perform sync_appliquer($j$ {"declarations_tva": [{"pennylane_id": 1001, "periode_debut": "2026-09-01",
    "periode_fin": "2026-09-30", "statut": "rejected"}]} $j$::jsonb, 'mcp');
  select * into e from echeances where dossier_id = '00000000-0000-0000-0000-0000000000d1' and type = 'tva_mensuelle';
  assert e.statut = 'paye' and e.source_statut = 'manuel', 'manuel conserve (rejected)';
end $$;

-- statut inconnu : a_faire
do $$
declare e echeances;
begin
  update echeances set statut = 'depose', source_statut = 'pennylane'
   where dossier_id = '00000000-0000-0000-0000-0000000000d1' and type = 'tva_mensuelle';
  perform sync_appliquer($j$ {"declarations_tva": [{"pennylane_id": 1001, "periode_debut": "2026-09-01",
    "periode_fin": "2026-09-30", "statut": "rejected"}]} $j$::jsonb, 'mcp');
  select * into e from echeances where dossier_id = '00000000-0000-0000-0000-0000000000d1' and type = 'tva_mensuelle';
  assert e.statut = 'a_faire' and e.statut_pennylane = 'rejected', 'rejected a_faire';
end $$;

-- regime inconnu / trimestriel
do $$
declare r jsonb;
begin
  r := sync_appliquer($j$ {"dossiers": [{"pennylane_id": 1001, "raison_sociale": "X", "regime_tva": "weird"}]} $j$::jsonb, 'mcp');
  assert (select regime_tva from dossiers where pennylane_id = 1001) = 'mensuel', 'regime inchange';
  assert exists (select 1 from anomalies where type = 'regime_tva_inconnu' and dossier_id = '00000000-0000-0000-0000-0000000000d1'), 'anomalie regime';
  assert r->'anomalies'->0->>'type' = 'regime_tva_inconnu', 'anomalie dans le retour';
  assert (select nature from journal_synchro where id = (r->>'journal_id')::uuid) = 'fiches', 'nature fiches';
  perform sync_appliquer($j$ {"dossiers": [{"pennylane_id": 1001, "raison_sociale": "X", "regime_tva": "quarterly"}]} $j$::jsonb, 'mcp');
  assert (select regime_tva from dossiers where pennylane_id = 1001) = 'trimestriel', 'trimestriel';
  perform sync_appliquer($j$ {"dossiers": [{"pennylane_id": 1001, "raison_sociale": "X", "regime_tva": "monthly"}]} $j$::jsonb, 'mcp');
  assert (select regime_tva from dossiers where pennylane_id = 1001) = 'mensuel', 'retour mensuel';
end $$;

-- declaration sans echeance
do $$
declare r jsonb;
begin
  r := sync_appliquer($j$ {"declarations_tva": [{"pennylane_id": 1001, "periode_debut": "2026-08-01",
    "periode_fin": "2026-08-31", "statut": "accepted"}]} $j$::jsonb, 'mcp');
  assert exists (select 1 from echeances where dossier_id = '00000000-0000-0000-0000-0000000000d1'
                 and type = 'tva_mensuelle' and periode_fin = date '2026-08-31' and statut = 'depose'), 'echeance creee';
  assert exists (select 1 from anomalies where type = 'declaration_sans_echeance'
                 and dossier_id = '00000000-0000-0000-0000-0000000000d1'), 'anomalie sans echeance';
  -- dossier inconnu
  r := sync_appliquer($j$ {"declarations_tva": [{"pennylane_id": 999999, "periode_debut": "2026-08-01",
    "periode_fin": "2026-08-31", "statut": "accepted"}]} $j$::jsonb, 'mcp');
  assert exists (select 1 from anomalies where type = 'dossier_inconnu' and cle = '999999'), 'dossier_inconnu';
  assert (r->>'echeances')::int = 0, 'ligne ignoree';
end $$;

-- liasse acceptee, exercice a l'etape 2
do $$
declare r jsonb; x exercices;
begin
  update exercices set etape_actuelle = 2 where id = '00000000-0000-0000-0000-0000000000e1';
  insert into echeances (dossier_id, exercice_id, type, periode_debut, periode_fin, date_limite)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'liasse',
          '2026-01-01', '2026-12-31', '2027-05-15');
  r := sync_appliquer($j$ {"liasses": [{"pennylane_id": 1001, "periode_debut": "2026-01-01",
    "periode_fin": "2026-12-31", "statut": "accepted"}]} $j$::jsonb, 'mcp');
  select * into x from exercices where id = '00000000-0000-0000-0000-0000000000e1';
  assert x.etape_actuelle = 6, 'etape 6';
  assert (select count(*) from historique_etapes where exercice_id = x.id and etape = 6 and sens = 'validation'
            and auteur_id is null) = 1, 'historique etape 6 sans auteur';
  assert exists (select 1 from anomalies where type = 'etapes_non_renseignees' and cle = '2026-12-31'), 'anomalie etapes';
  assert (select date_depot from echeances where type = 'liasse' and dossier_id = x.dossier_id) = date '2026-11-10', 'date_depot';
  assert (select statut from echeances where type = 'liasse' and dossier_id = x.dossier_id) = 'depose', 'liasse depose';
  -- idempotence : pas de seconde ligne d'historique
  perform sync_appliquer($j$ {"liasses": [{"pennylane_id": 1001, "periode_debut": "2026-01-01",
    "periode_fin": "2026-12-31", "statut": "accepted"}]} $j$::jsonb, 'mcp');
  assert (select count(*) from historique_etapes where exercice_id = x.id and etape = 6) = 1, 'pas de second historique';
end $$;

-- collaborateur inconnu et dossier nouveau
do $$
declare r jsonb; d dossiers;
begin
  r := sync_appliquer($j$ {"dossiers": [{"pennylane_id": 2000, "raison_sociale": "NOUVEAU", "regime_tva": "yearly",
    "comptable": "Inconnu TOTAL", "superviseur": null, "exercices": [{"debut": "2026-01-01", "fin": "2026-12-31"}]}]} $j$::jsonb, 'mcp');
  select * into d from dossiers where pennylane_id = 2000;
  assert d.csp_id is null and d.senior_id is null and d.statut = 'actif' and d.regime_tva = 'annuel', 'nouveau dossier';
  assert exists (select 1 from anomalies where type = 'collaborateur_inconnu' and cle = 'Inconnu TOTAL' and dossier_id = d.id), 'collab inconnu';
  assert exists (select 1 from anomalies where type = 'dossier_nouveau' and cle = '2000' and dossier_id = d.id), 'dossier nouveau';
  assert not exists (select 1 from anomalies where type = 'collaborateur_inconnu' and cle is null), 'pas d anomalie sur nom nul';
  assert jsonb_array_length(r->'anomalies') = 2, 'anomalies du retour ' || (r->'anomalies');
end $$;

-- date limite Pennylane conservee face au generateur
do $$
declare e echeances;
begin
  perform sync_appliquer($j$ {"declarations_tva": [{"pennylane_id": 1001, "periode_debut": "2026-10-01",
    "periode_fin": "2026-10-31", "date_limite": "2026-11-12", "statut": "pending"}]} $j$::jsonb, 'mcp');
  perform upsert_echeances_generees(jsonb_build_array(jsonb_build_object(
    'dossierId', '00000000-0000-0000-0000-0000000000d1', 'type', 'tva_mensuelle',
    'periodeDebut', '2026-10-01', 'periodeFin', '2026-10-31', 'dateLimite', '2026-11-19')), '[]'::jsonb);
  select * into e from echeances where dossier_id = '00000000-0000-0000-0000-0000000000d1'
    and type = 'tva_mensuelle' and periode_fin = date '2026-10-31';
  assert e.date_limite = date '2026-11-12' and e.date_limite_source = 'pennylane', 'date Pennylane conservee';
  -- dossiers_a_verifier
  assert 1001 in (select dossiers_a_verifier()), 'dossiers_a_verifier contient 1001';
  assert 1002 not in (select dossiers_a_verifier()), 'dossiers_a_verifier sans 1002';
end $$;

-- isolation : date invalide au milieu
do $$
declare r jsonb;
begin
  r := sync_appliquer($j$ {"declarations_tva": [
    {"pennylane_id": 1002, "periode_debut": "2026-06-01", "periode_fin": "2026-06-30", "statut": "accepted"},
    {"pennylane_id": 1002, "periode_debut": "2026-13-01", "periode_fin": "2026-13-30", "statut": "accepted"},
    {"pennylane_id": 1002, "periode_debut": "2026-07-01", "periode_fin": "2026-07-31", "statut": "accepted"}]} $j$::jsonb, 'mcp');
  assert (select count(*) from echeances where dossier_id = '00000000-0000-0000-0000-0000000000d2' and statut = 'depose') = 2, 'deux valides appliquees';
  assert exists (select 1 from anomalies where type = 'erreur_dossier' and cle = '1002'), 'erreur_dossier';
  assert (select fin from journal_synchro where id = (r->>'journal_id')::uuid) is not null, 'fin renseignee';
  assert (r->>'echeances')::int = 2, 'compte echeances';
end $$;

reset role;
rollback;
