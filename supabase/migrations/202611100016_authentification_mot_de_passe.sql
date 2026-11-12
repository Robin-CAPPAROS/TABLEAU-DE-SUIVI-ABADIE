-- ---------------------------------------------------------------------------
-- Authentification par e-mail et mot de passe : un collaborateur est lie a un
-- seul compte d'authentification (auth_user_id). Les comptes sont crees par les
-- administrateurs (route serveur, service_role). Remplace la verification du
-- fournisseur azure (R27) et l'identification par e-mail.
-- ---------------------------------------------------------------------------
alter table collaborateurs add column auth_user_id uuid unique;
alter table collaborateurs add column doit_changer_mdp boolean not null default false;

create or replace function moi() returns collaborateurs
language sql stable security definer set search_path = public
as $$
  select c.* from collaborateurs c
  where c.actif and c.role is not null
    and c.auth_user_id is not null
    and c.auth_user_id = auth.uid()
  limit 1
$$;

-- Le collaborateur indique avoir change son mot de passe provisoire.
create function marquer_mot_de_passe_change() returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  update collaborateurs set doit_changer_mdp = false
  where auth_user_id = auth.uid() and doit_changer_mdp;
end
$$;
revoke execute on function marquer_mot_de_passe_change() from public, anon;
grant execute on function marquer_mot_de_passe_change() to authenticated;

-- Seul service_role (ou une session SQL directe, hors roles anon/authenticated, sans JWT)
-- cree ou modifie le lien de compte et l'obligation de changer le mot de passe, sauf la
-- remise a faux par son titulaire.
create function garde_comptes_collaborateurs() returns trigger
language plpgsql set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.auth_user_id is null and not new.doit_changer_mdp then
      return new;
    end if;
  elsif new.auth_user_id is not distinct from old.auth_user_id
     and new.doit_changer_mdp is not distinct from old.doit_changer_mdp then
    return new;
  end if;
  if (coalesce(current_setting('request.jwt.claims', true), '') = ''
      and current_user not in ('anon', 'authenticated'))
     or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.auth_user_id is not distinct from old.auth_user_id
     and old.doit_changer_mdp and not new.doit_changer_mdp
     and old.auth_user_id is not null and old.auth_user_id = auth.uid() then
    return new;
  end if;
  raise exception 'Modification du compte de connexion refusée.' using errcode = '42501';
end
$$;

create trigger garde_comptes_collaborateurs
before insert or update on collaborateurs
for each row execute function garde_comptes_collaborateurs();
