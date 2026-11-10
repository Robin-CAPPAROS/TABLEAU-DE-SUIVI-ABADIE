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

-- ---------------------------------------------------------------------------
-- R27 : moi() exige une connexion Microsoft (fournisseur azure)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"email":"csp1@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert (moi()).id = '00000000-0000-0000-0000-0000000000c1', 'azure : collaborateur reconnu';
  assert (select count(*) from dossiers) = 2, 'azure : dossiers visibles';
end $$;

set local request.jwt.claims = '{"email":"csp1@cabinet.test","app_metadata":{"provider":"email"}}';
do $$
begin
  assert (moi()).id is null, 'fournisseur email : moi() nul';
  assert (select count(*) from dossiers) = 0, 'fournisseur email : aucun dossier visible';
end $$;

set local request.jwt.claims = '{"email":"csp1@cabinet.test"}';
do $$
begin
  assert (moi()).id is null, 'sans fournisseur : moi() nul';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- R28 : echeances generees obsoletes (changement de regime)
-- ---------------------------------------------------------------------------
update dossiers set regime_tva = 'trimestriel' where id = '00000000-0000-0000-0000-0000000000d1';

insert into echeances (id, dossier_id, type, periode_debut, periode_fin, date_limite, date_limite_source,
                       statut, source_statut, genere_le) values
  -- TVA mensuelle future generee la veille, plus regeneree : devient non applicable
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle',
   '2026-12-01', '2026-12-31', '2027-01-19', 'calcul', 'a_faire', null, now() - interval '1 day'),
  -- TVA mensuelle future sans marque (generee avant la migration) : devient non applicable
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle',
   '2027-01-01', '2027-01-31', '2027-02-19', 'calcul', 'a_faire', null, null),
  -- statut Pennylane : intacte
  ('00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle',
   '2026-11-01', '2026-11-30', '2026-12-19', 'calcul', 'a_faire', 'pennylane', null),
  -- date limite avant la fenetre (2026-09-11) : intacte
  ('00000000-0000-0000-0000-00000000a004', '00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle',
   '2026-07-01', '2026-07-31', '2026-08-19', 'calcul', 'a_faire', null, null),
  -- date limite Pennylane : intacte
  ('00000000-0000-0000-0000-00000000a005', '00000000-0000-0000-0000-0000000000d1', 'tva_trimestrielle',
   '2026-04-01', '2026-06-30', '2026-12-20', 'pennylane', 'a_faire', null, null),
  -- non applicable manuel : intacte
  ('00000000-0000-0000-0000-00000000a006', '00000000-0000-0000-0000-0000000000d1', 'is_acompte_4',
   '2026-01-01', '2026-12-31', '2026-12-15', 'calcul', 'non_applicable', 'manuel', null),
  -- regeneree a l'identique : reste a faire et marquee
  ('00000000-0000-0000-0000-00000000a007', '00000000-0000-0000-0000-0000000000d1', 'tva_trimestrielle',
   '2026-10-01', '2026-12-31', '2027-01-19', 'calcul', 'a_faire', null, null),
  -- rendue non applicable par une generation precedente puis regeneree : redevient a faire
  ('00000000-0000-0000-0000-00000000a008', '00000000-0000-0000-0000-0000000000d1', 'is_solde',
   '2026-01-01', '2026-12-31', '2027-05-18', 'calcul', 'non_applicable', null, now() - interval '1 day');

-- finaliser_generation est reservee a service_role
set local role authenticated;
set local request.jwt.claims = '{"email":"man1@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert code_erreur($q$select finaliser_generation(now(), '2026-09-11')$q$) = '42501', 'man1 refuse finaliser_generation';
end $$;
reset role;

grant all on all tables in schema public to service_role;
alter role service_role bypassrls;
set local role service_role;

do $$
declare r jsonb; n int;
begin
  r := upsert_echeances_generees(
    '[{"dossierId":"00000000-0000-0000-0000-0000000000d1","exerciceId":null,"type":"tva_trimestrielle","periodeDebut":"2026-10-01","periodeFin":"2026-12-31","dateLimite":"2027-01-19"},
      {"dossierId":"00000000-0000-0000-0000-0000000000d1","exerciceId":null,"type":"is_solde","periodeDebut":"2026-01-01","periodeFin":"2026-12-31","dateLimite":"2027-05-18"},
      {"dossierId":"00000000-0000-0000-0000-0000000000d1","exerciceId":null,"type":"tva_trimestrielle","periodeDebut":"2027-01-01","periodeFin":"2027-03-31","dateLimite":"2027-04-19"}]'::jsonb,
    '[]'::jsonb);
  assert (r->>'inserees')::int = 1, 'une insertion : ' || r::text;
  assert (r->>'mises_a_jour')::int = 0, 'aucune date modifiee : ' || r::text;

  n := finaliser_generation(now(), '2026-09-11');
  assert n = 2, 'deux echeances obsoletes : ' || n;
end $$;
reset role;

do $$
begin
  assert (select statut from echeances where id = '00000000-0000-0000-0000-00000000a001') = 'non_applicable', 'a001 obsolete';
  assert (select source_statut from echeances where id = '00000000-0000-0000-0000-00000000a001') is null, 'a001 source nulle';
  assert (select statut from echeances where id = '00000000-0000-0000-0000-00000000a002') = 'non_applicable', 'a002 obsolete';
  assert (select statut from echeances where id = '00000000-0000-0000-0000-00000000a003') = 'a_faire', 'a003 pennylane intacte';
  assert (select statut from echeances where id = '00000000-0000-0000-0000-00000000a004') = 'a_faire', 'a004 passee intacte';
  assert (select statut from echeances where id = '00000000-0000-0000-0000-00000000a005') = 'a_faire', 'a005 date pennylane intacte';
  assert (select source_statut from echeances where id = '00000000-0000-0000-0000-00000000a006') = 'manuel', 'a006 manuel intacte';
  assert (select statut from echeances where id = '00000000-0000-0000-0000-00000000a007') = 'a_faire', 'a007 regeneree';
  assert (select genere_le from echeances where id = '00000000-0000-0000-0000-00000000a007') = now(), 'a007 marquee meme sans changement';
  assert (select statut from echeances where id = '00000000-0000-0000-0000-00000000a008') = 'a_faire', 'a008 redevient a faire';
  assert (select genere_le from echeances
          where dossier_id = '00000000-0000-0000-0000-0000000000d1' and type = 'tva_trimestrielle'
            and periode_debut = '2027-01-01') = now(), 'insertion marquee';
end $$;

-- ---------------------------------------------------------------------------
-- R28 : un manager ou un associe peut rendre non applicable une echeance synchronisee a faire
-- ---------------------------------------------------------------------------
insert into echeances (id, dossier_id, type, periode_debut, periode_fin, date_limite, statut, source_statut) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle',
   '2026-10-01', '2026-10-31', '2026-11-19', 'a_faire', null),
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle',
   '2026-09-01', '2026-09-30', '2026-10-19', 'depose', 'pennylane'),
  ('00000000-0000-0000-0000-00000000b003', '00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle',
   '2026-08-01', '2026-08-31', '2026-09-19', 'non_applicable', null);

set local role authenticated;
set local request.jwt.claims = '{"email":"csp1@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert code_erreur($q$select marquer_echeance('00000000-0000-0000-0000-00000000b001', 'non_applicable')$q$) = 'P0001', 'csp1 refuse sur synchronisee';
end $$;

set local request.jwt.claims = '{"email":"man1@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert code_erreur($q$select marquer_echeance('00000000-0000-0000-0000-00000000b001', 'depose')$q$) = 'P0001', 'depose refuse sur synchronisee';
  assert code_erreur($q$select marquer_echeance('00000000-0000-0000-0000-00000000b001', 'non_applicable')$q$) = 'ok', 'man1 non applicable';
  assert code_erreur($q$select marquer_echeance('00000000-0000-0000-0000-00000000b002', 'non_applicable')$q$) = 'P0001', 'depose pennylane : refuse';
  assert code_erreur($q$select marquer_echeance('00000000-0000-0000-0000-00000000b003', 'a_faire')$q$) = 'P0001', 'non applicable automatique : refuse';
end $$;
reset role;
do $$
declare e echeances;
begin
  select * into e from echeances where id = '00000000-0000-0000-0000-00000000b001';
  assert e.statut = 'non_applicable' and e.source_statut = 'manuel'
         and e.auteur_id = '00000000-0000-0000-0000-000000000041', 'b001 non applicable manuel';
end $$;

set local role authenticated;
set local request.jwt.claims = '{"email":"ass1@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert code_erreur($q$select marquer_echeance('00000000-0000-0000-0000-00000000b001', 'a_faire')$q$) = 'ok', 'ass1 remet a faire';
end $$;
reset role;
do $$
declare e echeances;
begin
  select * into e from echeances where id = '00000000-0000-0000-0000-00000000b001';
  assert e.statut = 'a_faire' and e.source_statut is null, 'b001 remise a faire';
end $$;

-- ---------------------------------------------------------------------------
-- R28 : les vues exposent le statut du dossier
-- ---------------------------------------------------------------------------
update dossiers set statut = 'sorti' where id = '00000000-0000-0000-0000-0000000000d2';
insert into exercices (id, dossier_id, date_debut, date_fin) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', '2026-01-01', '2026-12-31');
insert into echeances (dossier_id, type, periode_debut, periode_fin, date_limite) values
  ('00000000-0000-0000-0000-0000000000d2', 'is_solde', '2026-01-01', '2026-12-31', '2027-05-18');
do $$
begin
  assert (select bool_and(dossier_statut = 'sorti') from v_echeances where dossier_id = '00000000-0000-0000-0000-0000000000d2'), 'v_echeances sorti';
  assert (select bool_and(dossier_statut = 'actif') from v_echeances where dossier_id = '00000000-0000-0000-0000-0000000000d1'), 'v_echeances actif';
  assert (select dossier_statut from v_exercices where id = '00000000-0000-0000-0000-0000000000e2') = 'sorti', 'v_exercices sorti';
  assert (select attname from pg_attribute where attrelid = 'v_echeances'::regclass and attnum > 0
          order by attnum desc limit 1) = 'dossier_statut', 'dossier_statut en derniere colonne';
end $$;
update dossiers set statut = 'actif' where id = '00000000-0000-0000-0000-0000000000d2';

-- ---------------------------------------------------------------------------
-- R30 : liasses historiques (date limite avant la fenetre)
-- R32 : exercices et raison_sociale nuls acceptes
-- R33 : dossiers_a_verifier inclut les exercices a l'etape 5
-- ---------------------------------------------------------------------------
insert into exercices (id, dossier_id, date_debut, date_fin, etape_actuelle) values
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d2', '2025-01-01', '2025-06-30', 2);
insert into echeances (id, dossier_id, exercice_id, type, periode_debut, periode_fin, date_limite, statut) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e3',
   'liasse', '2025-01-01', '2025-06-30', '2025-09-30', 'a_faire');

set local role service_role;
do $$
declare r jsonb;
begin
  r := sync_appliquer($j$ {
    "dossiers": [{"pennylane_id": 1001, "raison_sociale": null, "exercices": null}],
    "liasses": [
      {"pennylane_id": 1001, "periode_debut": "2024-01-01", "periode_fin": "2024-12-31", "statut": "accepted"},
      {"pennylane_id": 1002, "periode_debut": "2025-01-01", "periode_fin": "2025-06-30", "statut": "accepted"}
    ]} $j$::jsonb, 'mcp');
  assert (r->>'dossiers')::int = 1, 'dossier avec exercices nuls traite : ' || r::text;
  assert (r->>'echeances')::int = 2, 'deux liasses : ' || r::text;
end $$;
reset role;

do $$
declare x exercices;
begin
  assert (select raison_sociale from dossiers where id = '00000000-0000-0000-0000-0000000000d1') = 'Société Test Un', 'raison sociale conservee';
  assert not exists (select 1 from anomalies where type = 'erreur_dossier'), 'aucune erreur_dossier';

  -- liasse creee par la synchro, date limite provisoire 2025-04-15 avant la fenetre
  select * into x from exercices where dossier_id = '00000000-0000-0000-0000-0000000000d1' and date_fin = '2024-12-31';
  assert x.etape_actuelle = 6, 'exercice 2024 a l etape 6';
  assert exists (select 1 from historique_etapes where exercice_id = x.id and etape = 6 and sens = 'validation'), 'historique 2024';
  assert (select statut from echeances where exercice_id = x.id and type = 'liasse') = 'depose', 'liasse 2024 deposee';
  assert (select date_depot from echeances where exercice_id = x.id and type = 'liasse') is null, 'liasse 2024 sans date de depot inventee';
  assert not exists (select 1 from anomalies where type = 'etapes_non_renseignees' and cle = '2024-12-31'), 'pas d anomalie etapes 2024';

  -- liasse existante, date limite 2025-09-30 avant la fenetre
  assert (select etape_actuelle from exercices where id = '00000000-0000-0000-0000-0000000000e3') = 6, 'exercice e3 a l etape 6';
  assert exists (select 1 from historique_etapes where exercice_id = '00000000-0000-0000-0000-0000000000e3' and etape = 6), 'historique e3';
  assert (select statut from echeances where id = '00000000-0000-0000-0000-00000000c001') = 'depose', 'c001 deposee';
  assert (select date_depot from echeances where id = '00000000-0000-0000-0000-00000000c001') is null, 'c001 sans date de depot inventee';
  assert not exists (select 1 from anomalies where type = 'etapes_non_renseignees' and cle = '2025-06-30'), 'pas d anomalie etapes e3';
end $$;

-- une liasse historique avec une date de depot Pennylane la conserve
set local role service_role;
do $$
begin
  perform sync_appliquer($j$ {"liasses": [{"pennylane_id": 1002, "periode_debut": "2025-01-01", "periode_fin": "2025-06-30",
    "statut": "accepted", "date_depot": "2025-09-25"}]} $j$::jsonb, 'mcp');
end $$;
reset role;
do $$
begin
  assert (select date_depot from echeances where id = '00000000-0000-0000-0000-00000000c001') = '2025-09-25', 'date de depot Pennylane conservee';
end $$;

-- dossiers_a_verifier : etape 5, dossiers actifs seulement
delete from echeances;
update exercices set etape_actuelle = 5 where id = '00000000-0000-0000-0000-0000000000e2';
set local role service_role;
do $$
begin
  assert 1002 in (select dossiers_a_verifier()), 'etape 5 : 1002 a verifier';
  assert 1001 not in (select dossiers_a_verifier()), '1001 sans echeance ni etape 5';
end $$;
reset role;
update dossiers set statut = 'sorti' where id = '00000000-0000-0000-0000-0000000000d2';
set local role service_role;
do $$
begin
  assert 1002 not in (select dossiers_a_verifier()), 'dossier sorti exclu';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Mineurs : search_path fige, droit de mise a jour des anomalies limite a resolue_le
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['aujourdhui', 'saison_fiscale', 'normaliser_nom'] loop
    assert (select 'search_path=public' = any (proconfig) from pg_proc where proname = f), 'search_path de ' || f;
  end loop;
  assert not has_table_privilege('authenticated', 'anomalies', 'UPDATE'), 'pas de mise a jour globale des anomalies';
  assert has_column_privilege('authenticated', 'anomalies', 'resolue_le', 'UPDATE'), 'mise a jour de resolue_le';
end $$;

rollback;
