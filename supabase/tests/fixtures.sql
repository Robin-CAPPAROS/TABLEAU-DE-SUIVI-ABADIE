-- Donnees fictives communes a tous les tests SQL (inserees dans la transaction du test).
insert into collaborateurs (id, prenom, nom, nom_pennylane, trigramme, email, role, administrateur, actif, auth_user_id) values
  ('00000000-0000-0000-0000-0000000000c1', 'Camille', 'Dupuis',   'Camille DUPUIS',   'CDU', 'csp1@cabinet.test',    'csp',     false, true, '10000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000c2', 'Clara',   'Moreau',   'Clara MOREAU',     'CMO', 'csp2@cabinet.test',    'csp',     false, true, '10000000-0000-0000-0000-0000000000c2'),
  ('00000000-0000-0000-0000-000000000051', 'Sophie',  'Lambert',  'Sophie LAMBERT',   'SLA', 'sen1@cabinet.test',    'senior',  false, true, '10000000-0000-0000-0000-000000000051'),
  ('00000000-0000-0000-0000-000000000041', 'Marc',    'Girard',   'Marc GIRARD',      'MGI', 'man1@cabinet.test',    'manager', false, true, '10000000-0000-0000-0000-000000000041'),
  ('00000000-0000-0000-0000-0000000000a1', 'Hélène',  'Rousseau', 'Hélène ROUSSEAU',  'HRO', 'ass1@cabinet.test',    'associe', true,  true, '10000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2', 'Paul',    'Fontaine', 'Paul FONTAINE',    'PFO', 'rca@cabinet.test',     'manager', true,  true, '10000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000099', 'Julien',  'Perrin',   'Julien PERRIN',    'JPE', 'inactif@cabinet.test', 'csp',     false, false, '10000000-0000-0000-0000-000000000099');

insert into dossiers (id, pennylane_id, raison_sociale, forme_juridique, regime_tva, categorie_fiscale,
                      csp_id, senior_id, manager_id, equipe, mission, jour_echeance_tva) values
  ('00000000-0000-0000-0000-0000000000d1', 1001, 'Société Test Un', 'SARL', 'mensuel', 'bic_is',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000041',
   1, 'tenue', 19);

insert into dossiers (id, pennylane_id, raison_sociale, forme_juridique, regime_tva, categorie_fiscale,
                      csp_id, senior_id, manager_id, equipe, mission, jour_echeance_tva) values
  ('00000000-0000-0000-0000-0000000000d2', 1002, 'Société Test Deux', 'SARL', 'mensuel', 'bic_is',
   '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000041',
   1, 'tenue', 19);

insert into exercices (id, dossier_id, date_debut, date_fin, etape_actuelle) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', '2026-01-01', '2026-12-31', 0);

insert into parametres (id) values (1) on conflict do nothing;
