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

-- echeances de test (inserees en superuser)
insert into echeances (id, dossier_id, type, periode_debut, periode_fin, date_limite, statut, date_depot, montant, source_statut) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000d1', 'is_solde', '2026-01-01', '2026-12-31', '2027-05-15', 'a_faire', null, null, null),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000d2', 'is_solde', '2026-01-01', '2026-12-31', '2027-05-15', 'a_faire', null, null, null),
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle', '2026-09-01', '2026-09-30', '2026-10-19', 'a_faire', null, null, null),
  ('00000000-0000-0000-0000-00000000f004', '00000000-0000-0000-0000-0000000000d1', 'tva_ca12_acompte_decembre', '2026-01-01', '2026-12-31', '2026-12-15', 'a_faire', null, null, null),
  ('00000000-0000-0000-0000-00000000f005', '00000000-0000-0000-0000-0000000000d1', 'tva_trimestrielle', '2026-07-01', '2026-09-30', '2026-10-19', 'depose', '2026-10-15', 500, 'manuel'),
  ('00000000-0000-0000-0000-00000000f006', '00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle', '2026-08-01', '2026-08-31', '2026-09-19', 'a_faire', null, null, null),
  ('00000000-0000-0000-0000-00000000f007', '00000000-0000-0000-0000-0000000000d1', 'is_acompte_1', '2026-01-01', '2026-12-31', '2026-03-15', 'depose', '2026-03-10', 100, 'manuel'),
  ('00000000-0000-0000-0000-00000000f008', '00000000-0000-0000-0000-0000000000d1', 'is_acompte_2', '2026-01-01', '2026-12-31', '2026-06-15', 'depose', '2026-06-20', 100, 'manuel'),
  ('00000000-0000-0000-0000-00000000f009', '00000000-0000-0000-0000-0000000000d1', 'is_acompte_3', '2026-01-01', '2026-12-31', '2026-09-15', 'a_faire', null, null, 'pennylane');

-- anon : aucun droit d'execution
set local role anon;
do $$
begin
  assert code_erreur($q$select marquer_echeance('00000000-0000-0000-0000-00000000f001', 'depose')$q$) = '42501', 'anon ne peut pas executer marquer_echeance';
end $$;

set local role authenticated;

-- csp1 : is_solde de D1
set local request.jwt.claims = '{"email":"csp1@cabinet.test"}';
do $$ begin perform marquer_echeance('00000000-0000-0000-0000-00000000f001', 'depose'); end $$;
do $$
declare r echeances;
begin
  select * into r from echeances where id = '00000000-0000-0000-0000-00000000f001';
  assert r.statut = 'depose', 'statut depose';
  assert r.date_depot = date '2026-11-10', 'date_depot = aujourdhui';
  assert r.source_statut = 'manuel', 'source manuel';
  assert r.auteur_id = '00000000-0000-0000-0000-0000000000c1', 'auteur csp1';
end $$;

-- annulation : retour a a_faire
do $$ begin perform marquer_echeance('00000000-0000-0000-0000-00000000f001', 'a_faire'); end $$;
do $$
declare r echeances;
begin
  select * into r from echeances where id = '00000000-0000-0000-0000-00000000f001';
  assert r.statut = 'a_faire' and r.date_depot is null and r.source_statut is null, 'annulation remet a zero';
end $$;

-- date et montant fournis
do $$ begin perform marquer_echeance('00000000-0000-0000-0000-00000000f001', 'depose', date '2026-11-05', 1234.5); end $$;
do $$
declare r echeances;
begin
  select * into r from echeances where id = '00000000-0000-0000-0000-00000000f001';
  assert r.date_depot = date '2026-11-05' and r.montant = 1234.5, 'date et montant fournis';
end $$;

-- non_applicable
do $$ begin perform marquer_echeance('00000000-0000-0000-0000-00000000f001', 'non_applicable'); end $$;
do $$
declare r echeances;
begin
  select * into r from echeances where id = '00000000-0000-0000-0000-00000000f001';
  assert r.statut = 'non_applicable' and r.date_depot is null and r.source_statut = 'manuel', 'non_applicable';
end $$;

do $$
begin
  assert code_erreur($q$select marquer_echeance('00000000-0000-0000-0000-00000000f002', 'depose')$q$) = '42501', 'csp1 sur D2 refuse';
  assert code_erreur($q$select marquer_echeance('00000000-0000-0000-0000-00000000f003', 'depose')$q$) = 'P0001', 'tva_mensuelle synchronisee';
  assert code_erreur($q$select marquer_echeance('00000000-0000-0000-0000-00000000f009', 'depose')$q$) = 'P0001', 'source pennylane synchronisee';
  assert code_erreur($q$select marquer_echeance('00000000-0000-0000-0000-00000000f001', 'paye')$q$) = 'P0001', 'paye refuse';
  assert code_erreur($q$select marquer_echeance('00000000-0000-0000-0000-0000000000ff', 'depose')$q$) = 'P0001', 'echeance inconnue';
end $$;

-- acompte CA12 sans source : saisissable
do $$ begin perform marquer_echeance('00000000-0000-0000-0000-00000000f004', 'depose'); end $$;
do $$
begin
  assert (select statut from echeances where id = '00000000-0000-0000-0000-00000000f004') = 'depose', 'acompte CA12 depose';
end $$;

-- confirmer_paiement
do $$ begin perform confirmer_paiement('00000000-0000-0000-0000-00000000f005'); end $$;
do $$
declare r echeances;
begin
  select * into r from echeances where id = '00000000-0000-0000-0000-00000000f005';
  assert r.statut = 'paye' and r.source_statut = 'manuel', 'paiement confirme';
end $$;
do $$
begin
  assert code_erreur($q$select confirmer_paiement('00000000-0000-0000-0000-00000000f003')$q$) = 'P0001', 'paiement sur tva a_faire';
  assert code_erreur($q$select confirmer_paiement('00000000-0000-0000-0000-00000000f007')$q$) = 'P0001', 'paiement sur non tva';
  assert code_erreur($q$select confirmer_paiement('00000000-0000-0000-0000-0000000000ff')$q$) = 'P0001', 'paiement inconnu';
end $$;

-- qualifier_retard
do $$
begin
  assert code_erreur($q$select qualifier_retard('00000000-0000-0000-0000-00000000f007', 'client')$q$) = 'P0001', 'pas de depot tardif';
  assert code_erreur($q$select qualifier_retard('00000000-0000-0000-0000-00000000f003', 'client')$q$) = 'P0001', 'pas de depot du tout';
  assert code_erreur($q$select qualifier_retard('00000000-0000-0000-0000-00000000f008', null)$q$) = 'P0001', 'cause obligatoire';
end $$;
do $$ begin perform qualifier_retard('00000000-0000-0000-0000-00000000f008', 'client'); end $$;
do $$
begin
  assert (select cause_retard from echeances where id = '00000000-0000-0000-0000-00000000f008') = 'client', 'cause enregistree';
end $$;

-- csp2 ne peut pas agir sur D1
set local request.jwt.claims = '{"email":"csp2@cabinet.test"}';
do $$
begin
  assert code_erreur($q$select qualifier_retard('00000000-0000-0000-0000-00000000f008', 'cabinet')$q$) = '42501', 'csp2 refuse qualifier';
  assert code_erreur($q$select confirmer_paiement('00000000-0000-0000-0000-00000000f005')$q$) = '42501', 'csp2 refuse confirmer';
end $$;

-- sen1 (senior du dossier) et man1 peuvent agir
set local request.jwt.claims = '{"email":"sen1@cabinet.test"}';
do $$ begin perform marquer_echeance('00000000-0000-0000-0000-00000000f002', 'depose'); end $$;
set local request.jwt.claims = '{"email":"man1@cabinet.test"}';
do $$ begin perform marquer_echeance('00000000-0000-0000-0000-00000000f002', 'a_faire'); end $$;

-- maj_dossier_outil
set local request.jwt.claims = '{"email":"sen1@cabinet.test"}';
do $$
begin
  assert code_erreur($q$select maj_dossier_outil('00000000-0000-0000-0000-0000000000d1', 2, 'revision', 'actif', 20, false, 'x')$q$) = '42501', 'sen1 refuse maj_dossier_outil';
  assert code_erreur($q$select maj_exercice('00000000-0000-0000-0000-0000000000e1', date '2027-06-30', null)$q$) = '42501', 'sen1 refuse maj_exercice';
end $$;

set local request.jwt.claims = '{"email":"man1@cabinet.test"}';
do $$
begin
  assert code_erreur($q$select maj_dossier_outil('00000000-0000-0000-0000-0000000000d1', 4, 'revision', 'actif', 20, false, 'x')$q$) = 'P0001', 'equipe 4';
  assert code_erreur($q$select maj_dossier_outil('00000000-0000-0000-0000-0000000000d1', 2, 'revision', 'actif', 25, false, 'x')$q$) = 'P0001', 'jour 25';
  assert code_erreur($q$select maj_dossier_outil('00000000-0000-0000-0000-0000000000d1', 2, 'revision', 'actif', 14, false, 'x')$q$) = 'P0001', 'jour 14';
  assert code_erreur($q$select maj_dossier_outil('00000000-0000-0000-0000-0000000000ff', 2, 'revision', 'actif', 20, false, 'x')$q$) = 'P0001', 'dossier inconnu';
  assert code_erreur($q$select maj_exercice('00000000-0000-0000-0000-0000000000e1', null, null)$q$) = 'P0001', 'date cible obligatoire';
  assert code_erreur($q$select maj_exercice('00000000-0000-0000-0000-0000000000ff', date '2027-06-30', null)$q$) = 'P0001', 'exercice inconnu';
end $$;
do $$ begin perform maj_dossier_outil('00000000-0000-0000-0000-0000000000d1', 2, 'revision', 'actif', 20, true, 'note'); end $$;
do $$
declare d dossiers;
begin
  select * into d from dossiers where id = '00000000-0000-0000-0000-0000000000d1';
  assert d.equipe = 2 and d.mission = 'revision' and d.jour_echeance_tva = 20 and d.is_n1_superieur_3000 and d.commentaire = 'note', 'dossier modifie';
end $$;
do $$ begin perform maj_dossier_outil('00000000-0000-0000-0000-0000000000d1', null, 'revision', 'actif', null, false, null); end $$;
do $$
begin
  assert (select equipe from dossiers where id = '00000000-0000-0000-0000-0000000000d1') is null, 'equipe nulle admise';
end $$;

-- rca modifie la date cible
set local request.jwt.claims = '{"email":"rca@cabinet.test"}';
do $$ begin perform maj_exercice('00000000-0000-0000-0000-0000000000e1', date '2027-06-30', date '2027-05-20'); end $$;
do $$
declare x exercices;
begin
  select * into x from exercices where id = '00000000-0000-0000-0000-0000000000e1';
  assert x.date_cible = date '2027-06-30' and x.date_approbation = date '2027-05-20', 'exercice modifie';
end $$;
do $$ begin perform maj_exercice('00000000-0000-0000-0000-0000000000e1', date '2027-06-30', null); end $$;
do $$
begin
  assert (select date_approbation from exercices where id = '00000000-0000-0000-0000-0000000000e1') is null, 'approbation effacee';
end $$;

-- inactif
set local request.jwt.claims = '{"email":"inactif@cabinet.test"}';
do $$
begin
  assert code_erreur($q$select marquer_echeance('00000000-0000-0000-0000-00000000f001', 'depose')$q$) = '42501', 'inactif refuse';
  assert code_erreur($q$select maj_exercice('00000000-0000-0000-0000-0000000000e1', date '2027-06-30', null)$q$) = '42501', 'inactif refuse maj_exercice';
end $$;

rollback;
