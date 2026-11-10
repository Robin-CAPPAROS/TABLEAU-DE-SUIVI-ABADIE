begin;

set local app.aujourdhui = '2026-11-10';

insert into echeances (id, dossier_id, type, periode_debut, periode_fin, date_limite, statut, date_depot, montant, cause_retard) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle', '2026-09-01', '2026-09-30', '2026-11-05', 'a_faire', null, null, null),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle', '2026-10-01', '2026-10-31', '2026-11-15', 'a_faire', null, null, null),
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-0000000000d1', 'tva_trimestrielle', '2026-01-01', '2026-03-31', '2026-11-01', 'depose', '2026-10-30', 515, null),
  ('00000000-0000-0000-0000-00000000f004', '00000000-0000-0000-0000-0000000000d1', 'tva_trimestrielle', '2026-04-01', '2026-06-30', '2026-11-01', 'depose', '2026-10-30', -10, null),
  ('00000000-0000-0000-0000-00000000f005', '00000000-0000-0000-0000-0000000000d1', 'tva_trimestrielle', '2026-07-01', '2026-09-30', '2026-11-08', 'depose', '2026-11-07', 515, null),
  ('00000000-0000-0000-0000-00000000f006', '00000000-0000-0000-0000-0000000000d1', 'liasse', '2025-01-01', '2025-12-31', '2026-11-10', 'depose', '2026-11-12', null, null);

-- fixture E1 : date cible calculee par le declencheur
do $$
begin
  assert (select date_cible from exercices where id = '00000000-0000-0000-0000-0000000000e1') = date '2027-03-31',
    'E1 doit avoir une date cible au 2027-03-31';
end $$;

-- echeances
do $$
begin
  assert aujourdhui() = date '2026-11-10', 'aujourdhui lit app.aujourdhui';
  assert (select en_retard from v_echeances where id = '00000000-0000-0000-0000-00000000f001'), 'a_faire au 05/11 en retard';
  assert not (select sous_7_jours from v_echeances where id = '00000000-0000-0000-0000-00000000f001'), 'f001 pas sous 7 jours';
  assert (select sous_7_jours from v_echeances where id = '00000000-0000-0000-0000-00000000f002'), 'a_faire au 15/11 sous 7 jours';
  assert not (select en_retard from v_echeances where id = '00000000-0000-0000-0000-00000000f002'), 'f002 pas en retard';
  assert (select alerte_paiement from v_echeances where id = '00000000-0000-0000-0000-00000000f003'), 'alerte paiement 515 limite 01/11';
  assert not (select alerte_paiement from v_echeances where id = '00000000-0000-0000-0000-00000000f004'), 'pas d alerte montant negatif';
  assert not (select alerte_paiement from v_echeances where id = '00000000-0000-0000-0000-00000000f005'), 'pas d alerte limite 08/11';
  assert (select depot_tardif and retard_non_qualifie from v_echeances where id = '00000000-0000-0000-0000-00000000f006'), 'depot tardif non qualifie';
  assert (select synchronisee from v_echeances where id = '00000000-0000-0000-0000-00000000f006'), 'liasse synchronisee';
  assert (select raison_sociale from v_echeances where id = '00000000-0000-0000-0000-00000000f001') = 'Société Test Un', 'raison sociale';
end $$;

-- nouvel exercice sans date cible (D2, clos le 2026-12-31)
insert into exercices (id, dossier_id, date_debut, date_fin) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', '2026-01-01', '2026-12-31');
do $$
begin
  assert (select date_cible from exercices where id = '00000000-0000-0000-0000-0000000000e2') = date '2027-03-31',
    'date cible calculee 2027-03-31';
end $$;

-- retards d'exercice : date cible 2026-11-20 (jalon 2 = 21/10, jalon 3 = 05/11, jalon 4 = 20/11)
update exercices set date_cible = '2026-11-20', etape_actuelle = 1 where id = '00000000-0000-0000-0000-0000000000e2';
do $$
begin
  assert (select etape_attendue from v_exercices where id = '00000000-0000-0000-0000-0000000000e2') = 3, 'etape attendue 3';
  assert (select en_retard from v_exercices where id = '00000000-0000-0000-0000-0000000000e2'), 'etape 1 en retard';
end $$;
update exercices set etape_actuelle = 2 where id = '00000000-0000-0000-0000-0000000000e2';
do $$
begin
  assert (select en_retard from v_exercices where id = '00000000-0000-0000-0000-0000000000e2'), 'etape 2 en retard';
end $$;
update exercices set etape_actuelle = 3 where id = '00000000-0000-0000-0000-0000000000e2';
do $$
begin
  assert not (select en_retard from v_exercices where id = '00000000-0000-0000-0000-0000000000e2'), 'etape 3 pas en retard';
end $$;

-- date cible explicite preservee ; mission revision avec parametre a 4 mois
update dossiers set mission = 'revision' where id = '00000000-0000-0000-0000-0000000000d2';
update parametres set date_cible_mois_revision = 4 where id = 1;
insert into exercices (id, dossier_id, date_debut, date_fin, date_cible) values
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d2', '2025-01-01', '2025-12-31', '2026-02-02');
insert into exercices (id, dossier_id, date_debut, date_fin) values
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000d2', '2027-01-01', '2027-12-31');
do $$
begin
  assert (select date_cible from exercices where id = '00000000-0000-0000-0000-0000000000e3') = date '2026-02-02', 'date cible explicite preservee';
  assert (select date_cible from exercices where id = '00000000-0000-0000-0000-0000000000e4') = date '2028-04-30', 'mission revision : +4 mois';
end $$;

-- visibilite
set local role authenticated;
set local request.jwt.claims = '{"email":"sen1@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert (select count(*) from v_echeances) = 6, 'sen1 lit v_echeances';
  assert (select count(*) from v_exercices) = 4, 'sen1 lit v_exercices';
end $$;
set local request.jwt.claims = '{"email":"inconnu@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert (select count(*) from v_echeances) = 0, 'inconnu ne voit aucune echeance';
  assert (select count(*) from v_exercices) = 0, 'inconnu ne voit aucun exercice';
end $$;
reset role;

rollback;
