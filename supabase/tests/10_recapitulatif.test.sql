begin;

set local app.aujourdhui = '2026-11-10';

insert into echeances (dossier_id, type, periode_debut, periode_fin, date_limite) values
  ('00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle', '2026-10-01', '2026-10-31', '2026-11-12'),
  ('00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle', '2026-09-01', '2026-09-30', '2026-10-19'),
  ('00000000-0000-0000-0000-0000000000d2', 'tva_mensuelle', '2026-10-01', '2026-10-31', '2026-11-13');

-- droits : authenticated refuse
set local role authenticated;
set local request.jwt.claims = '{"email":"csp1@cabinet.test"}';
do $$
declare ok boolean := false;
begin
  begin
    perform destinataires_recapitulatif();
  exception when sqlstate '42501' then ok := true;
  end;
  assert ok, 'authenticated ne doit pas appeler destinataires_recapitulatif';
  ok := false;
  begin
    perform donnees_recapitulatif('00000000-0000-0000-0000-0000000000c1');
  exception when sqlstate '42501' then ok := true;
  end;
  assert ok, 'authenticated ne doit pas appeler donnees_recapitulatif';
end $$;
reset role;

set local role service_role;

-- destinataires : toutes equipes
do $$
declare emails text[];
begin
  select array_agg(email order by email) into emails from destinataires_recapitulatif();
  assert emails @> array['csp1@cabinet.test', 'csp2@cabinet.test', 'sen1@cabinet.test',
                         'man1@cabinet.test', 'ass1@cabinet.test', 'rca@cabinet.test'], 'tous les destinataires';
  assert not ('inactif@cabinet.test' = any (emails)), 'inactif exclu';
end $$;

-- limite a l'equipe 2 : csp1 (equipe 1) exclu, man1 inclus
reset role;
update parametres set recap_equipes = '{2}' where id = 1;
set local role service_role;
do $$
declare emails text[];
begin
  select array_agg(email) into emails from destinataires_recapitulatif();
  assert not ('csp1@cabinet.test' = any (emails)), 'csp1 hors equipe';
  assert 'man1@cabinet.test' = any (emails), 'man1 toujours inclus';
  assert 'ass1@cabinet.test' = any (emails), 'associe toujours inclus';
end $$;

-- recap_actif faux : aucun destinataire
reset role;
update parametres set recap_actif = false, recap_equipes = '{1,2,3}' where id = 1;
set local role service_role;
do $$
begin
  assert (select count(*) from destinataires_recapitulatif()) = 0, 'recap inactif';
end $$;

reset role;
update parametres set recap_actif = true where id = 1;
insert into anomalies (type, cle, message) values ('x', 'k', 'm');
set local role service_role;

-- donnees csp1
do $$
declare r jsonb;
begin
  r := donnees_recapitulatif('00000000-0000-0000-0000-0000000000c1');
  assert r->>'semaineDu' = '2026-11-10', 'semaineDu';
  assert r #>> '{collaborateur,prenom}' = 'Camille' and r #>> '{collaborateur,role}' = 'csp', 'collaborateur';
  assert jsonb_array_length(r->'echeances7j') = 1, 'une echeance a 7 jours';
  assert r #>> '{echeances7j,0,type}' = 'tva_mensuelle' and r #>> '{echeances7j,0,dateLimite}' = '2026-11-12', 'TVA D1';
  assert r #>> '{echeances7j,0,raisonSociale}' = 'Société Test Un', 'raison sociale';
  assert jsonb_array_length(r->'echeancesEnRetard') = 1, 'un retard';
  assert not (r::text like '%Société Test Deux%'), 'aucune ligne de D2';
  assert r->'synthese' = 'null'::jsonb and r->'fileSupervision' = 'null'::jsonb
    and r->'anomaliesOuvertes' = 'null'::jsonb, 'pas de supervision pour un CSP';
end $$;

-- donnees manager et associe
do $$
declare r jsonb;
begin
  r := donnees_recapitulatif('00000000-0000-0000-0000-000000000041');
  assert jsonb_array_length(r->'echeances7j') = 2, 'manager voit D1 et D2';
  assert jsonb_typeof(r->'synthese') = 'array' and jsonb_array_length(r->'synthese') = 2, 'synthese par collaborateur';
  assert r #>> '{synthese,0,trigramme}' = 'CDU' and (r #>> '{synthese,0,echeances}')::int = 1
    and (r #>> '{synthese,0,retards}')::int = 1, 'synthese CDU';
  assert jsonb_typeof(r->'fileSupervision') = 'array', 'file de supervision';
  assert (r->>'anomaliesOuvertes')::int = 1, 'anomalies ouvertes';
  r := donnees_recapitulatif('00000000-0000-0000-0000-0000000000a1');
  assert jsonb_array_length(r->'echeances7j') = 2, 'associe voit tout';
end $$;

rollback;
