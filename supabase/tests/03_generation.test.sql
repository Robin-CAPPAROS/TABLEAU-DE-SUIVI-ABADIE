begin;


-- appel par csp1 refuse
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-0000000000c1"}';
do $$
declare ok boolean := false;
begin
  begin
    perform upsert_echeances_generees('[]'::jsonb, '[]'::jsonb);
  exception when sqlstate '42501' then ok := true;
  end;
  assert ok, 'csp1 ne doit pas appeler upsert_echeances_generees';
  ok := false;
  begin
    perform donnees_generation();
  exception when sqlstate '42501' then ok := true;
  end;
  assert ok, 'csp1 ne doit pas appeler donnees_generation';
end $$;
reset role;

set local role service_role;

-- premiere ecriture
do $$
declare r jsonb;
begin
  r := upsert_echeances_generees(
    '[{"dossierId":"00000000-0000-0000-0000-0000000000d1","exerciceId":"00000000-0000-0000-0000-0000000000e1","type":"liasse","periodeDebut":"2026-01-01","periodeFin":"2026-12-31","dateLimite":"2027-05-03"},
      {"dossierId":"00000000-0000-0000-0000-0000000000d1","exerciceId":null,"type":"tva_mensuelle","periodeDebut":"2026-10-01","periodeFin":"2026-10-31","dateLimite":"2026-11-19"}]'::jsonb,
    '[{"dossierId":"00000000-0000-0000-0000-0000000000d1","type":"jour_tva_absent","cle":"k1","message":"m"}]'::jsonb);
  assert (r->>'inserees')::int = 2, 'inserees = 2';
  assert (r->>'mises_a_jour')::int = 0, 'mises_a_jour = 0';
  assert (r->>'anomalies')::int = 1, 'anomalies = 1';
end $$;

-- statut modifie, source pennylane sur la TVA
reset role;
update echeances set statut = 'depose', source_statut = 'manuel' where type = 'liasse';
update echeances set date_limite_source = 'pennylane', date_limite = '2026-11-24' where type = 'tva_mensuelle';
set local role service_role;

-- deuxieme appel avec dates differentes
do $$
declare r jsonb;
begin
  r := upsert_echeances_generees(
    '[{"dossierId":"00000000-0000-0000-0000-0000000000d1","exerciceId":"00000000-0000-0000-0000-0000000000e1","type":"liasse","periodeDebut":"2026-01-01","periodeFin":"2026-12-31","dateLimite":"2027-05-04"},
      {"dossierId":"00000000-0000-0000-0000-0000000000d1","exerciceId":null,"type":"tva_mensuelle","periodeDebut":"2026-10-01","periodeFin":"2026-10-31","dateLimite":"2026-11-19"}]'::jsonb,
    '[{"dossierId":"00000000-0000-0000-0000-0000000000d1","type":"jour_tva_absent","cle":"k1","message":"m"}]'::jsonb);
  assert (r->>'inserees')::int = 0, 'rien de nouveau';
  assert (r->>'mises_a_jour')::int = 1, 'une seule mise a jour (la liasse)';
  assert (r->>'anomalies')::int = 0, 'anomalie ouverte non dupliquee';
end $$;

reset role;
do $$
begin
  assert (select count(*) from echeances) = 2, 'pas de doublon';
  assert (select count(*) from anomalies) = 1, 'une seule anomalie';
  assert (select statut from echeances where type = 'liasse') = 'depose', 'statut conserve';
  assert (select source_statut from echeances where type = 'liasse') = 'manuel', 'source_statut conservee';
  assert (select date_limite from echeances where type = 'liasse') = '2027-05-04', 'date calcul mise a jour';
  assert (select date_limite from echeances where type = 'tva_mensuelle') = '2026-11-24', 'date pennylane conservee';
end $$;

-- donnees_generation
reset role;
insert into dossiers (id, pennylane_id, raison_sociale, statut) values
  ('00000000-0000-0000-0000-0000000000d9', 1009, 'Société Sortie', 'sorti');
insert into calendriers_annuels values (2026, '2027-05-03', '2027-03-15', '2027-05-05');
insert into formes_juridiques values ('SARL', true, true) on conflict do nothing;
set local role service_role;
do $$
declare d jsonb;
begin
  d := donnees_generation();
  assert jsonb_array_length(d->'dossiers') = 2, 'deux dossiers actifs';
  assert (d->'dossiers'->0) ? 'isN1Superieur3000' and (d->'dossiers'->0) ? 'jourEcheanceTva', 'cles camelCase';
  assert jsonb_array_length(d->'exercices') = 1, 'un exercice';
  assert (d->'exercices'->0) ? 'dossierId', 'dossierId present';
  assert (d->'parametres') ? 'feries' and (d->'parametres') ? 'calendriers' and (d->'parametres') ? 'formes', 'parametres';
  assert not exists (select 1 from jsonb_array_elements(d->'dossiers') x where x->>'id' like '%d9'), 'dossier sorti exclu';
  assert (d->'dossiers'->0->'isN1Superieur3000') = 'false'::jsonb, 'isN1Superieur3000 faux et non nul';
  assert (d->'parametres'->'calendriers'->0->>'dateCa12_3112') = '2027-05-05', 'cle dateCa12_3112';
  assert exists (select 1 from jsonb_array_elements(d->'parametres'->'formes') f where f->>'code' = 'SARL' and f->>'depotGreffe' = 'true'), 'cle depotGreffe';
  assert (d->'parametres'->>'delaiGreffeMois')::int = 2, 'delai greffe';
end $$;

reset role;
rollback;
