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

-- saison fiscale
do $$
begin
  assert saison_fiscale(date '2025-10-01') = 2026, 'saison 2025-10-01';
  assert saison_fiscale(date '2026-09-30') = 2026, 'saison 2026-09-30';
  assert saison_fiscale(date '2026-10-01') = 2027, 'saison 2026-10-01';
end $$;

-- trois dossiers distincts (unique dossier_id, date_fin) : D1, D2 et D3
insert into dossiers (id, pennylane_id, raison_sociale, forme_juridique, regime_tva, categorie_fiscale,
                      csp_id, senior_id, manager_id, equipe, mission, jour_echeance_tva) values
  ('00000000-0000-0000-0000-0000000000d3', 1003, 'Société Test Trois', 'SARL', 'mensuel', 'bic_is',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000041',
   1, 'tenue', 19);

insert into exercices (id, dossier_id, date_debut, date_fin, date_cible, etape_actuelle) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d1', '2025-01-01', '2025-12-31', '2026-03-31', 4),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d2', '2025-01-01', '2025-12-31', '2026-03-31', 4),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000d3', '2025-01-01', '2025-12-31', '2026-03-31', 3);

insert into historique_etapes (exercice_id, etape, sens, date, auteur_id) values
  ('00000000-0000-0000-0000-0000000000e2', 4, 'validation', '2026-03-20 10:00+01', '00000000-0000-0000-0000-000000000041'),
  ('00000000-0000-0000-0000-0000000000e3', 4, 'validation', '2026-04-10 10:00+02', '00000000-0000-0000-0000-000000000041');

insert into echeances (dossier_id, type, periode_debut, periode_fin, date_limite, statut, date_depot) values
  ('00000000-0000-0000-0000-0000000000d1', 'liasse', '2025-01-01', '2025-12-31', '2026-05-19', 'depose', '2026-05-04'),
  ('00000000-0000-0000-0000-0000000000d2', 'liasse', '2025-01-01', '2025-12-31', '2026-05-19', 'depose', '2026-05-21');
insert into echeances (dossier_id, type, periode_debut, periode_fin, date_limite, statut, date_depot, cause_retard) values
  ('00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle', '2026-02-01', '2026-02-28', '2026-03-19', 'depose', '2026-03-25', 'cabinet');

-- plan de charge : deux exercices a date cible 2027-03-31 du meme Senior (e1 a l'etape 0 ; un autre a l'etape 4)
insert into exercices (id, dossier_id, date_debut, date_fin, date_cible, etape_actuelle) values
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000d2', '2026-01-01', '2026-12-31', '2027-03-31', 4);

-- anon : aucun droit
set local role anon;
do $$
begin
  assert code_erreur($q$select indicateurs(2026)$q$) = '42501', 'anon refuse (indicateurs)';
  assert code_erreur($q$select * from plan_de_charge(date '2027-03-01')$q$) = '42501', 'anon refuse (plan_de_charge)';
end $$;

-- csp1 : indicateurs refuses, plan de charge permis
set local role authenticated;
set local request.jwt.claims = '{"email":"csp1@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert code_erreur($q$select indicateurs(2026)$q$) = '42501', 'csp refuse';
  assert code_erreur($q$select * from plan_de_charge(date '2027-03-01', 8)$q$) = 'ok', 'csp peut lire le plan de charge';
end $$;

-- man1
set local request.jwt.claims = '{"email":"man1@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
declare r jsonb; g jsonb; l record;
begin
  r := indicateurs(2026);
  g := r -> 'global';
  assert (r ->> 'saison')::int = 2026, 'saison';
  assert (g #>> '{bilans_supervises_avant_cible,numerateur}')::int = 1, 'numerateur';
  assert (g #>> '{bilans_supervises_avant_cible,denominateur}')::int = 3, 'denominateur';
  assert (g #>> '{bilans_supervises_avant_cible,pourcentage}') = '33.3', 'pourcentage';
  assert (g #>> '{delai_cloture_supervision,moyenne_jours}') = '89.5', 'delai moyen';
  assert (g #>> '{marge_liasse,moyenne_jours}') = '6.5', 'marge moyenne';
  assert (g #>> '{marge_liasse,repartition,de_7_a_30}')::int = 1, 'bucket 7 a 30';
  assert (g #>> '{marge_liasse,repartition,en_retard}')::int = 1, 'bucket en retard';
  assert (g #>> '{marge_liasse,repartition,moins_7}')::int = 0, 'bucket moins 7';
  assert (g #>> '{marge_liasse,repartition,plus_30}')::int = 0, 'bucket plus 30';
  assert (g #>> '{depots_en_retard,total}')::int = 2, 'total retards';
  assert (g #>> '{depots_en_retard,par_cause,cabinet}')::int = 1, 'cause cabinet';
  assert (g #>> '{depots_en_retard,par_cause,non_qualifie}')::int = 1, 'non qualifie';
  assert (g #>> '{depots_en_retard,par_cause,client}')::int = 0, 'cause client a 0';
  assert (g #>> '{depots_en_retard,par_type,liasse}')::int = 1, 'type liasse';
  assert (g #>> '{depots_en_retard,par_type,tva_mensuelle}')::int = 1, 'type tva';
  assert r -> 'precedente' = 'null'::jsonb, 'precedente nulle pour 2026';
  assert jsonb_array_length(r -> 'par_equipe') = 1 and (r #>> '{par_equipe,0,equipe}')::int = 1, 'par_equipe';
  assert (r #>> '{par_equipe,0,bilans_supervises_avant_cible,denominateur}')::int = 3, 'bloc equipe';
  assert jsonb_array_length(r -> 'par_senior') = 1
    and (r #>> '{par_senior,0,senior_id}') = '00000000-0000-0000-0000-000000000051', 'par_senior';

  -- filtre sans resultat : blocs a zero, moyennes nulles
  r := indicateurs(2026, 2);
  assert (r #>> '{global,bilans_supervises_avant_cible,denominateur}')::int = 0, 'filtre equipe 2 vide';
  assert r #> '{global,bilans_supervises_avant_cible,pourcentage}' = 'null'::jsonb, 'pourcentage nul';
  assert r #> '{global,delai_cloture_supervision,moyenne_jours}' = 'null'::jsonb, 'moyenne nulle';

  -- saison 2027 : la precedente (2026) existe
  r := indicateurs(2027);
  assert (r #>> '{precedente,bilans_supervises_avant_cible,denominateur}')::int = 3, 'precedente 2026';

  -- plan de charge
  select * into l from plan_de_charge(date '2027-03-01', 8);
  assert l.semaine = date '2027-03-29' and l.senior_id = '00000000-0000-0000-0000-000000000051'
    and l.a_faire = 1 and l.supervises = 1, 'ligne plan de charge';
  assert (select count(*) from plan_de_charge(date '2027-03-01', 8)) = 1, 'une seule ligne';
end $$;

rollback;
