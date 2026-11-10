-- Identification du collaborateur (e-mail Microsoft 365) et regles de securite.

create function moi() returns collaborateurs
language sql stable security definer set search_path = public
as $$
  select c.* from collaborateurs c
  where c.actif and c.role is not null
    and lower(c.email) = lower(auth.jwt() ->> 'email')
  limit 1
$$;

create function est_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((moi()).administrateur, false) $$;

create function a_role(variadic roles role_collaborateur[]) returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((moi()).role = any (roles), false) $$;

create function est_intervenant(p_dossier uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from dossiers d
    where d.id = p_dossier
      and (moi()).id is not null
      and (moi()).id in (d.csp_id, d.senior_id, d.manager_id)
  )
$$;

-- Garde-fou : au moins un administrateur actif doit toujours subsister.
create function garde_dernier_admin() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.administrateur and old.actif
     and (tg_op = 'DELETE' or not (new.administrateur and new.actif))
     and not exists (
       select 1 from collaborateurs c
       where c.administrateur and c.actif and c.id <> old.id
     ) then
    raise exception 'Impossible de retirer le dernier administrateur actif.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create trigger garde_dernier_admin
before update or delete on collaborateurs
for each row execute function garde_dernier_admin();

-- Lecture : tout collaborateur identifie voit les tables metier et de parametres.
create policy lecture on collaborateurs for select to authenticated using ((moi()).id is not null);
create policy lecture on dossiers for select to authenticated using ((moi()).id is not null);
create policy lecture on exercices for select to authenticated using ((moi()).id is not null);
create policy lecture on historique_etapes for select to authenticated using ((moi()).id is not null);
create policy lecture on echeances for select to authenticated using ((moi()).id is not null);
create policy lecture on calendriers_annuels for select to authenticated using ((moi()).id is not null);
create policy lecture on formes_juridiques for select to authenticated using ((moi()).id is not null);
create policy lecture on jours_feries for select to authenticated using ((moi()).id is not null);
create policy lecture on parametres for select to authenticated using ((moi()).id is not null);

-- Journal et anomalies : managers, associes et administrateurs.
create policy lecture on journal_synchro for select to authenticated
  using (a_role('manager', 'associe') or est_admin());
create policy lecture on anomalies for select to authenticated
  using (a_role('manager', 'associe') or est_admin());

-- Ecriture : administrateurs sur les tables d'administration.
create policy ecriture_admin_insert on collaborateurs for insert to authenticated with check (est_admin());
create policy ecriture_admin_update on collaborateurs for update to authenticated using (est_admin()) with check (est_admin());
create policy ecriture_admin_insert on parametres for insert to authenticated with check (est_admin());
create policy ecriture_admin_update on parametres for update to authenticated using (est_admin()) with check (est_admin());
create policy ecriture_admin_insert on calendriers_annuels for insert to authenticated with check (est_admin());
create policy ecriture_admin_update on calendriers_annuels for update to authenticated using (est_admin()) with check (est_admin());
create policy ecriture_admin_insert on formes_juridiques for insert to authenticated with check (est_admin());
create policy ecriture_admin_update on formes_juridiques for update to authenticated using (est_admin()) with check (est_admin());
create policy ecriture_admin_insert on jours_feries for insert to authenticated with check (est_admin());
create policy ecriture_admin_update on jours_feries for update to authenticated using (est_admin()) with check (est_admin());

-- Droits de table.
revoke all on all tables in schema public from anon;
grant select on all tables in schema public to authenticated;
grant insert, update on collaborateurs, parametres, calendriers_annuels, formes_juridiques, jours_feries to authenticated;

revoke execute on function moi(), est_admin(), a_role(role_collaborateur[]), est_intervenant(uuid) from public, anon;
grant execute on function moi(), est_admin(), a_role(role_collaborateur[]), est_intervenant(uuid) to authenticated;
