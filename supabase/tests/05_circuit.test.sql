begin;

-- Aide : appelle une expression SQL et renvoie le SQLSTATE obtenu ('ok' si aucune erreur).
create function code_erreur(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlstate;
end $$;
grant execute on function code_erreur(text) to authenticated;

set local role authenticated;

-- csp1 valide 1 puis 2
set local request.jwt.claims = '{"email":"csp1@cabinet.test"}';
do $$ begin perform valider_etape('00000000-0000-0000-0000-0000000000e1', 1); end $$;
do $$ begin perform valider_etape('00000000-0000-0000-0000-0000000000e1', 2, 'RAS'); end $$;
do $$
begin
  assert (select etape_actuelle from exercices where id = '00000000-0000-0000-0000-0000000000e1') = 2, 'csp1 : etape 2 atteinte';
  assert code_erreur($q$select valider_etape('00000000-0000-0000-0000-0000000000e1', 3)$q$) = '42501', 'csp1 ne valide pas 3';
end $$;

-- sen1 tente 4 depuis 2 : refus de role
set local request.jwt.claims = '{"email":"sen1@cabinet.test"}';
do $$
begin
  assert code_erreur($q$select valider_etape('00000000-0000-0000-0000-0000000000e1', 4)$q$) = '42501', 'sen1 tente 4 depuis 2';
end $$;
do $$ begin perform valider_etape('00000000-0000-0000-0000-0000000000e1', 3); end $$;
do $$
begin
  assert code_erreur($q$select valider_etape('00000000-0000-0000-0000-0000000000e1', 4)$q$) = '42501', 'sen1 tente 4 depuis 3';
end $$;

-- man1 : ordre et etape 6
set local request.jwt.claims = '{"email":"man1@cabinet.test"}';
do $$
begin
  assert code_erreur($q$select valider_etape('00000000-0000-0000-0000-0000000000e1', 5)$q$) = 'P0001', 'man1 tente 5 depuis 3';
end $$;
do $$ begin perform valider_etape('00000000-0000-0000-0000-0000000000e1', 4); end $$;
do $$
begin
  assert code_erreur($q$select valider_etape('00000000-0000-0000-0000-0000000000e1', 6)$q$) = 'P0001', 'personne ne valide 6';
end $$;

-- sen1 tente un retour
set local request.jwt.claims = '{"email":"sen1@cabinet.test"}';
do $$
begin
  assert code_erreur($q$select revenir_etape('00000000-0000-0000-0000-0000000000e1', 2, 'x')$q$) = '42501', 'sen1 ne peut pas revenir';
end $$;

-- man1 revient a 2
set local request.jwt.claims = '{"email":"man1@cabinet.test"}';
do $$
begin
  assert code_erreur($q$select revenir_etape('00000000-0000-0000-0000-0000000000e1', 2, null)$q$) = 'P0001', 'retour sans commentaire (null)';
  assert code_erreur($q$select revenir_etape('00000000-0000-0000-0000-0000000000e1', 2, '  ')$q$) = 'P0001', 'retour sans commentaire (blanc)';
  assert code_erreur($q$select revenir_etape('00000000-0000-0000-0000-0000000000e1', 4, 'x')$q$) = 'P0001', 'retour vers etape non inferieure';
end $$;
do $$ begin perform revenir_etape('00000000-0000-0000-0000-0000000000e1', 2, 'Pieces manquantes'); end $$;
do $$
begin
  assert (select etape_actuelle from exercices where id = '00000000-0000-0000-0000-0000000000e1') = 2, 'etape_actuelle = 2 apres retour';
  assert (select count(*) from historique_etapes where exercice_id = '00000000-0000-0000-0000-0000000000e1') = 5, '5 lignes d historique';
  assert (select count(*) from historique_etapes where exercice_id = '00000000-0000-0000-0000-0000000000e1' and sens = 'retour') = 1, 'une ligne retour';
  assert (select auteur_id from historique_etapes where sens = 'retour') = '00000000-0000-0000-0000-000000000041', 'auteur du retour';
end $$;

-- entrees invalides
do $$
begin
  assert code_erreur($q$select valider_etape('00000000-0000-0000-0000-0000000000e1', null)$q$) = 'P0001', 'etape nulle (valider)';
  assert code_erreur($q$select revenir_etape('00000000-0000-0000-0000-0000000000e1', null, 'x')$q$) = 'P0001', 'etape nulle (revenir)';
  assert code_erreur($q$select valider_etape('00000000-0000-0000-0000-0000000000ff', 1)$q$) = 'P0001', 'exercice inconnu (valider)';
  assert code_erreur($q$select revenir_etape('00000000-0000-0000-0000-0000000000ff', 0, 'x')$q$) = 'P0001', 'exercice inconnu (revenir)';
end $$;

-- retour a l'etape 0 : trace telle quelle
do $$ begin perform revenir_etape('00000000-0000-0000-0000-0000000000e1', 0, 'Reprise complete'); end $$;
do $$
begin
  assert (select etape_actuelle from exercices where id = '00000000-0000-0000-0000-0000000000e1') = 0, 'etape_actuelle = 0';
  assert exists (select 1 from historique_etapes where exercice_id = '00000000-0000-0000-0000-0000000000e1'
                 and etape = 0 and sens = 'retour'), 'historique etape 0 retour';
end $$;

-- inactif
set local request.jwt.claims = '{"email":"inactif@cabinet.test"}';
do $$
begin
  assert code_erreur($q$select valider_etape('00000000-0000-0000-0000-0000000000e1', 3)$q$) = '42501', 'inactif refuse (valider)';
  assert code_erreur($q$select revenir_etape('00000000-0000-0000-0000-0000000000e1', 1, 'x')$q$) = '42501', 'inactif refuse (revenir)';
end $$;

rollback;
