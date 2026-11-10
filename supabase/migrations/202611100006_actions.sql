-- Actions : saisie manuelle des echeances, edition des dossiers et des exercices.

-- Regle unique du droit d'agir sur les echeances d'un dossier : CSP ou Senior du dossier, manager ou associe.
create function peut_agir_sur_dossier(p_dossier uuid) returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_moi collaborateurs := moi();
begin
  if v_moi.id is null then
    return false;
  end if;
  if v_moi.role in ('manager', 'associe') then
    return true;
  end if;
  return exists (
    select 1 from dossiers d
    where d.id = p_dossier and v_moi.id in (d.csp_id, d.senior_id)
  );
end
$$;

create function marquer_echeance(
  p_echeance uuid, p_statut statut_echeance,
  p_date_depot date default null, p_montant numeric default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_moi collaborateurs := moi();
  v_dossier uuid;
  v_synchronisee boolean;
begin
  if v_moi.id is null then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;

  select e.dossier_id, e.synchronisee into v_dossier, v_synchronisee
  from v_echeances e where e.id = p_echeance;
  if not found then
    raise exception 'Échéance introuvable.' using errcode = 'P0001';
  end if;

  if not peut_agir_sur_dossier(v_dossier) then
    raise exception 'Votre rôle ne permet pas de modifier cette échéance.' using errcode = '42501';
  end if;

  if v_synchronisee then
    raise exception 'Échéance synchronisée par Pennylane.' using errcode = 'P0001';
  end if;

  if p_statut is null or p_statut = 'paye' then
    raise exception 'Le paiement se confirme avec la confirmation de paiement ou via Pennylane.' using errcode = 'P0001';
  end if;

  if p_statut = 'depose' then
    update echeances
       set statut = 'depose', date_depot = coalesce(p_date_depot, aujourdhui()),
           montant = coalesce(p_montant, montant), source_statut = 'manuel', auteur_id = v_moi.id
     where id = p_echeance;
  elsif p_statut = 'a_faire' then
    update echeances
       set statut = 'a_faire', date_depot = null, source_statut = null, auteur_id = v_moi.id
     where id = p_echeance;
  else
    update echeances
       set statut = 'non_applicable', date_depot = null, source_statut = 'manuel', auteur_id = v_moi.id
     where id = p_echeance;
  end if;
end
$$;

create function confirmer_paiement(p_echeance uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_moi collaborateurs := moi();
  v_ech echeances;
begin
  if v_moi.id is null then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;

  select * into v_ech from echeances where id = p_echeance;
  if not found then
    raise exception 'Échéance introuvable.' using errcode = 'P0001';
  end if;

  if not peut_agir_sur_dossier(v_ech.dossier_id) then
    raise exception 'Votre rôle ne permet pas de modifier cette échéance.' using errcode = '42501';
  end if;

  if v_ech.type::text not like 'tva\_%' or v_ech.statut <> 'depose' then
    raise exception 'Seule une échéance de TVA déposée peut être confirmée payée.' using errcode = 'P0001';
  end if;

  update echeances set statut = 'paye', source_statut = 'manuel', auteur_id = v_moi.id
   where id = p_echeance;
end
$$;

create function qualifier_retard(p_echeance uuid, p_cause cause_retard)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_moi collaborateurs := moi();
  v_ech echeances;
begin
  if v_moi.id is null then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;

  select * into v_ech from echeances where id = p_echeance;
  if not found then
    raise exception 'Échéance introuvable.' using errcode = 'P0001';
  end if;

  if not peut_agir_sur_dossier(v_ech.dossier_id) then
    raise exception 'Votre rôle ne permet pas de modifier cette échéance.' using errcode = '42501';
  end if;

  if not coalesce(v_ech.date_depot > v_ech.date_limite, false) then
    raise exception 'Cette échéance n''a pas été déposée en retard.' using errcode = 'P0001';
  end if;

  if p_cause is null then
    raise exception 'La cause du retard est obligatoire.' using errcode = 'P0001';
  end if;

  update echeances set cause_retard = p_cause where id = p_echeance;
end
$$;

create function maj_dossier_outil(
  p_dossier uuid, p_equipe int, p_mission mission, p_statut statut_dossier,
  p_jour_tva int, p_is_n1 boolean, p_commentaire text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_moi collaborateurs := moi();
begin
  if v_moi.id is null then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;

  if not (v_moi.role in ('manager', 'associe') or est_admin()) then
    raise exception 'Votre rôle ne permet pas de modifier ce dossier.' using errcode = '42501';
  end if;

  if not exists (select 1 from dossiers where id = p_dossier) then
    raise exception 'Dossier introuvable.' using errcode = 'P0001';
  end if;

  if p_equipe is not null and p_equipe not between 1 and 3 then
    raise exception 'L''équipe doit être 1, 2 ou 3.' using errcode = 'P0001';
  end if;

  if p_jour_tva is not null and p_jour_tva not between 15 and 24 then
    raise exception 'Le jour de TVA doit être compris entre 15 et 24.' using errcode = 'P0001';
  end if;

  update dossiers
     set equipe = p_equipe, mission = p_mission, statut = coalesce(p_statut, statut),
         jour_echeance_tva = p_jour_tva, is_n1_superieur_3000 = coalesce(p_is_n1, is_n1_superieur_3000),
         commentaire = p_commentaire
   where id = p_dossier;
end
$$;

create function maj_exercice(p_exercice uuid, p_date_cible date, p_date_approbation date)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_moi collaborateurs := moi();
begin
  if v_moi.id is null then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;

  if not (v_moi.role in ('manager', 'associe') or est_admin()) then
    raise exception 'Votre rôle ne permet pas de modifier cet exercice.' using errcode = '42501';
  end if;

  if not exists (select 1 from exercices where id = p_exercice) then
    raise exception 'Exercice introuvable.' using errcode = 'P0001';
  end if;

  if p_date_cible is null then
    raise exception 'La date cible est obligatoire.' using errcode = 'P0001';
  end if;

  update exercices set date_cible = p_date_cible, date_approbation = p_date_approbation
   where id = p_exercice;
end
$$;

revoke execute on function peut_agir_sur_dossier(uuid) from public, anon, authenticated;
revoke execute on function marquer_echeance(uuid, statut_echeance, date, numeric) from public, anon;
revoke execute on function confirmer_paiement(uuid) from public, anon;
revoke execute on function qualifier_retard(uuid, cause_retard) from public, anon;
revoke execute on function maj_dossier_outil(uuid, int, mission, statut_dossier, int, boolean, text) from public, anon;
revoke execute on function maj_exercice(uuid, date, date) from public, anon;
grant execute on function marquer_echeance(uuid, statut_echeance, date, numeric) to authenticated;
grant execute on function confirmer_paiement(uuid) to authenticated;
grant execute on function qualifier_retard(uuid, cause_retard) to authenticated;
grant execute on function maj_dossier_outil(uuid, int, mission, statut_dossier, int, boolean, text) to authenticated;
grant execute on function maj_exercice(uuid, date, date) to authenticated;
