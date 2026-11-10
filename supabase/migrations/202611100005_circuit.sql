-- Circuit de production des bilans : validation des etapes 1 a 5 et retours en arriere.

-- Un retour a l'etape 0 doit etre trace tel quel dans l'historique.
alter table historique_etapes drop constraint historique_etapes_etape_check;
alter table historique_etapes add check (etape between 0 and 6);

create function valider_etape(p_exercice uuid, p_etape int, p_commentaire text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_moi collaborateurs := moi();
  v_actuelle int;
begin
  if v_moi.id is null then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;

  select etape_actuelle into v_actuelle from exercices where id = p_exercice for update;
  if not found then
    raise exception 'Exercice introuvable.' using errcode = 'P0001';
  end if;

  if p_etape is null then
    raise exception 'L''étape à valider est obligatoire.' using errcode = 'P0001';
  end if;

  if p_etape = 6 then
    raise exception 'L''étape 6 est validée automatiquement par Pennylane.' using errcode = 'P0001';
  end if;

  if not (case p_etape
            when 1 then v_moi.role in ('csp', 'senior', 'manager', 'associe')
            when 2 then v_moi.role in ('csp', 'manager', 'associe')
            when 3 then v_moi.role in ('senior', 'manager', 'associe')
            when 4 then v_moi.role in ('manager', 'associe')
            when 5 then v_moi.role in ('senior', 'manager', 'associe')
            else false
          end) then
    raise exception 'Votre rôle ne permet pas de valider cette étape.' using errcode = '42501';
  end if;

  if p_etape <> v_actuelle + 1 then
    raise exception 'Les étapes se valident dans l''ordre.' using errcode = 'P0001';
  end if;

  insert into historique_etapes (exercice_id, etape, sens, date, auteur_id, commentaire)
  values (p_exercice, p_etape, 'validation', now(), v_moi.id, p_commentaire);

  update exercices set etape_actuelle = p_etape where id = p_exercice;
end
$$;

create function revenir_etape(p_exercice uuid, p_etape int, p_commentaire text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_moi collaborateurs := moi();
  v_actuelle int;
begin
  if v_moi.id is null then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;

  select etape_actuelle into v_actuelle from exercices where id = p_exercice for update;
  if not found then
    raise exception 'Exercice introuvable.' using errcode = 'P0001';
  end if;

  if v_moi.role not in ('manager', 'associe') then
    raise exception 'Votre rôle ne permet pas de revenir en arrière.' using errcode = '42501';
  end if;

  if coalesce(btrim(p_commentaire), '') = '' then
    raise exception 'Un commentaire est obligatoire pour revenir en arrière.' using errcode = 'P0001';
  end if;

  if p_etape is null or p_etape < 0 or p_etape >= v_actuelle then
    raise exception 'Le retour doit viser une étape antérieure à l''étape actuelle.' using errcode = 'P0001';
  end if;

  insert into historique_etapes (exercice_id, etape, sens, date, auteur_id, commentaire)
  values (p_exercice, p_etape, 'retour', now(), v_moi.id, p_commentaire);

  update exercices set etape_actuelle = p_etape where id = p_exercice;
end
$$;

revoke execute on function valider_etape(uuid, int, text) from public, anon;
revoke execute on function revenir_etape(uuid, int, text) from public, anon;
grant execute on function valider_etape(uuid, int, text) to authenticated;
grant execute on function revenir_etape(uuid, int, text) to authenticated;
