begin;

-- Donnees propres a ce test (inserees en superutilisateur, hors RLS).
insert into collaborateurs (prenom, nom, nom_pennylane, trigramme, email, role)
values ('Sans', 'Role', 'Sans ROLE', 'SRO', 'sansrole@cabinet.test', null);
insert into journal_synchro (source, nature) values ('outil', 'fiches');

-- connexion_insensible_casse
set local role authenticated;
set local request.jwt.claims = '{"email":"CSP1@Cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert (select count(*) from dossiers) = 2, 'connexion_insensible_casse : csp1 doit voir 2 dossiers';
end $$;

-- adresse inconnue
set local request.jwt.claims = '{"email":"inconnu@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert (select count(*) from dossiers) = 0, 'adresse inconnue : 0 dossier';
end $$;

-- collaborateur inactif
set local request.jwt.claims = '{"email":"inactif@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert (select count(*) from dossiers) = 0, 'collaborateur inactif : 0 dossier';
end $$;

-- role nul
set local request.jwt.claims = '{"email":"sansrole@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert (select count(*) from dossiers) = 0, 'role nul : 0 dossier';
end $$;

-- anon : aucun droit
reset role;
set local role anon;
do $$
declare ok boolean := false;
begin
  begin
    perform count(*) from dossiers;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'anon ne doit avoir aucun droit de lecture';
end $$;
reset role;

-- man1 : aucune modification de dossier (0 ligne ou refus), l'equipe reste 1
set local role authenticated;
set local request.jwt.claims = '{"email":"man1@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
declare n int;
begin
  begin
    update dossiers set equipe = 3;
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0;
  end;
  assert n = 0, 'man1 ne doit modifier aucun dossier';
end $$;
reset role;
do $$
begin
  assert (select equipe from dossiers where id = '00000000-0000-0000-0000-0000000000d1') = 1,
    'D1 doit garder l''equipe 1';
end $$;

-- man1 ne peut pas inserer de collaborateur (42501)
set local role authenticated;
set local request.jwt.claims = '{"email":"man1@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
declare ok boolean := false;
begin
  begin
    insert into collaborateurs (prenom, nom, nom_pennylane, trigramme, email, role)
    values ('Nouveau', 'Un', 'Nouveau UN', 'NU1', 'nu1@cabinet.test', 'csp');
  exception when sqlstate '42501' then ok := true;
  end;
  assert ok, 'man1 : insertion de collaborateur refusee (42501)';
end $$;

-- ass1 (administrateur) peut inserer
set local request.jwt.claims = '{"email":"ass1@cabinet.test","app_metadata":{"provider":"azure"}}';
insert into collaborateurs (prenom, nom, nom_pennylane, trigramme, email, role)
values ('Nouveau', 'Un', 'Nouveau UN', 'NU1', 'nu1@cabinet.test', 'csp');

-- ass1 retire le droit administrateur a rca
update collaborateurs set administrateur = false where email = 'rca@cabinet.test';
do $$
begin
  assert (select administrateur from collaborateurs where email = 'rca@cabinet.test') = false,
    'rca doit avoir perdu le droit administrateur';
end $$;

-- rca ne peut plus inserer (42501)
set local request.jwt.claims = '{"email":"rca@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
declare ok boolean := false;
begin
  begin
    insert into collaborateurs (prenom, nom, nom_pennylane, trigramme, email, role)
    values ('Nouveau', 'Deux', 'Nouveau DEUX', 'NU2', 'nu2@cabinet.test', 'csp');
  exception when sqlstate '42501' then ok := true;
  end;
  assert ok, 'rca sans droit administrateur : insertion refusee (42501)';
end $$;

-- ass1, seul administrateur actif : ne peut pas se retirer le droit (P0001)
set local request.jwt.claims = '{"email":"ass1@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
declare ok boolean := false; msg text;
begin
  begin
    update collaborateurs set administrateur = false where email = 'ass1@cabinet.test';
  exception when sqlstate 'P0001' then ok := true; get stacked diagnostics msg = message_text;
  end;
  assert ok, 'le dernier administrateur ne peut pas se retirer le droit';
  assert msg = 'Impossible de retirer le dernier administrateur actif.', 'message inattendu : ' || msg;
end $$;

-- desactivation et suppression comptent aussi
do $$
declare ok boolean := false;
begin
  begin
    update collaborateurs set actif = false where email = 'ass1@cabinet.test';
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'le dernier administrateur ne peut pas etre desactive';
end $$;
reset role;
do $$
declare ok boolean := false;
begin
  begin
    delete from collaborateurs where email = 'ass1@cabinet.test';
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'le dernier administrateur ne peut pas etre supprime';
end $$;

-- un administrateur non dernier peut etre desactive
update collaborateurs set administrateur = true where email = 'rca@cabinet.test';
update collaborateurs set actif = false where email = 'rca@cabinet.test';

-- journal_synchro : csp1 ne voit rien, man1 voit 1 ligne
set local role authenticated;
set local request.jwt.claims = '{"email":"csp1@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert (select count(*) from journal_synchro) = 0, 'csp1 ne voit pas le journal';
end $$;
set local request.jwt.claims = '{"email":"man1@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert (select count(*) from journal_synchro) = 1, 'man1 voit le journal';
end $$;
reset role;

rollback;
