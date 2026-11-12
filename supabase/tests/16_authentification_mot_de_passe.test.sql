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

-- (a) compte auto-cree avec l'e-mail de csp1 mais un autre identifiant : aucun acces
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-0000-0000-000000000001","email":"csp1@cabinet.test","role":"authenticated"}';
do $$
begin
  assert (moi()).id is null, 'auto-inscription : moi() nul';
  assert (select count(*) from dossiers) = 0, 'auto-inscription : aucun dossier visible';
end $$;

-- (b) identifiant de csp1 : acces, meme sans e-mail ni fournisseur
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
do $$
begin
  assert (moi()).id = '00000000-0000-0000-0000-0000000000c1', 'csp1 reconnu par identifiant';
  assert (select count(*) from dossiers) = 2, 'csp1 voit 2 dossiers';
end $$;
reset role;

-- (c) inactif ou sans role, avec un identifiant valide : aucun acces
set local request.jwt.claims = '';
insert into collaborateurs (prenom, nom, nom_pennylane, trigramme, email, role, auth_user_id)
values ('Sans', 'Role', 'Sans ROLE', 'SRO', 'sansrole@cabinet.test', null, '10000000-0000-0000-0000-000000000005');
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000099","role":"authenticated"}';
do $$
begin
  assert (moi()).id is null, 'inactif : moi() nul';
  assert (select count(*) from dossiers) = 0, 'inactif : aucun dossier';
end $$;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}';
do $$
begin
  assert (moi()).id is null, 'role nul : moi() nul';
  assert (select count(*) from dossiers) = 0, 'role nul : aucun dossier';
end $$;
reset role;

-- (d) marquer_mot_de_passe_change : uniquement la ligne de l'appelant
set local request.jwt.claims = '';
update collaborateurs set doit_changer_mdp = true
where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
do $$
begin
  assert (moi()).doit_changer_mdp, 'csp1 doit encore changer son mot de passe';
  perform marquer_mot_de_passe_change();
  assert not (moi()).doit_changer_mdp, 'csp1 : indicateur remis a faux';
end $$;
reset role;
do $$
begin
  assert (select doit_changer_mdp from collaborateurs where id = '00000000-0000-0000-0000-0000000000c2'),
    'csp2 non modifie';
end $$;
-- sans identifiant : refus
set local role authenticated;
set local request.jwt.claims = '{}';
do $$
begin
  assert code_erreur('select marquer_mot_de_passe_change()') = '42501', 'sans identifiant : 42501';
end $$;
reset role;
-- anon : aucun droit d'execution
set local role anon;
do $$
begin
  assert code_erreur('select marquer_mot_de_passe_change()') = '42501', 'anon : refus';
end $$;
reset role;

-- (e) administrateur (non service_role) : pas de changement de compte, mais e-mail et role oui
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$
begin
  assert code_erreur($q$update collaborateurs set auth_user_id = '30000000-0000-0000-0000-000000000001'
                        where id = '00000000-0000-0000-0000-0000000000c2'$q$) = '42501', 'auth_user_id : 42501';
  assert code_erreur($q$update collaborateurs set doit_changer_mdp = false
                        where id = '00000000-0000-0000-0000-0000000000c2'$q$) = '42501', 'doit_changer_mdp : 42501';
  assert code_erreur($q$update collaborateurs set doit_changer_mdp = true
                        where id = '00000000-0000-0000-0000-0000000000c1'$q$) = '42501', 'forcer le changement : 42501';
  assert code_erreur($q$update collaborateurs set email = 'csp2.nouveau@cabinet.test', role = 'senior'
                        where id = '00000000-0000-0000-0000-0000000000c2'$q$) = 'ok', 'e-mail et role modifiables';
end $$;
reset role;
do $$
begin
  assert (select email from collaborateurs where id = '00000000-0000-0000-0000-0000000000c2') = 'csp2.nouveau@cabinet.test',
    'e-mail modifie';
  assert (select auth_user_id from collaborateurs where id = '00000000-0000-0000-0000-0000000000c2')
    = '10000000-0000-0000-0000-0000000000c2', 'auth_user_id inchange';
end $$;

-- (f) service_role : peut modifier auth_user_id
grant all on all tables in schema public to service_role;
alter role service_role bypassrls;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
update collaborateurs set auth_user_id = '30000000-0000-0000-0000-000000000002'
where id = '00000000-0000-0000-0000-0000000000c2';
reset role;
do $$
begin
  assert (select auth_user_id from collaborateurs where id = '00000000-0000-0000-0000-0000000000c2')
    = '30000000-0000-0000-0000-000000000002', 'service_role modifie auth_user_id';
end $$;

rollback;
