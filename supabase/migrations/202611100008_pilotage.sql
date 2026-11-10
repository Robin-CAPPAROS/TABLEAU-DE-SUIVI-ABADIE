-- Indicateurs de pilotage (spec 8.6) et plan de charge (spec 7.3).

create function saison_fiscale(d date) returns int
language sql immutable
as $$ select extract(year from d + interval '3 months')::int $$;

-- Calcul d'un Bloc d'indicateurs pour une saison et des filtres (fonction interne, reutilisee partout).
create function bloc_indicateurs(p_saison int, p_equipe int, p_manager uuid, p_senior uuid) returns jsonb
language sql stable security definer set search_path = public
as $$
  with dos as (
    select d.id from dossiers d
    where (p_equipe is null or d.equipe = p_equipe)
      and (p_manager is null or d.manager_id = p_manager)
      and (p_senior is null or d.senior_id = p_senior)
  ),
  ex as (
    select x.id, x.date_fin, x.date_cible, s.date_sup
    from exercices x
    join dos on dos.id = x.dossier_id
    left join lateral (
      select h.date::date as date_sup
      from historique_etapes h
      where h.exercice_id = x.id and h.etape = 4 and h.sens = 'validation'
      order by h.date desc
      limit 1
    ) s on true
    where saison_fiscale(x.date_fin) = p_saison
  ),
  ech as (
    select e.type, e.date_limite, e.date_depot, e.cause_retard
    from echeances e
    join dos on dos.id = e.dossier_id
    where saison_fiscale(e.date_limite) = p_saison
  ),
  retards as (select * from ech where date_depot > date_limite),
  liasses as (select (date_limite - date_depot) as marge from ech where type = 'liasse' and date_depot is not null),
  echues as (select * from ex where date_cible <= aujourdhui())
  select jsonb_build_object(
    'depots_en_retard', jsonb_build_object(
      'total', (select count(*) from retards),
      'par_cause', jsonb_build_object(
        'cabinet', (select count(*) from retards where cause_retard = 'cabinet'),
        'client', (select count(*) from retards where cause_retard = 'client'),
        'administration', (select count(*) from retards where cause_retard = 'administration'),
        'autre', (select count(*) from retards where cause_retard = 'autre'),
        'non_qualifie', (select count(*) from retards where cause_retard is null)),
      'par_type', coalesce((select jsonb_object_agg(t, n) from (
          select type::text as t, count(*) as n from retards group by type) q), '{}'::jsonb)),
    'bilans_supervises_avant_cible', jsonb_build_object(
      'numerateur', (select count(*) from echues where date_sup <= date_cible),
      'denominateur', (select count(*) from echues),
      'pourcentage', (select round(100.0 * count(*) filter (where date_sup <= date_cible) / nullif(count(*), 0), 1) from echues)),
    'marge_liasse', jsonb_build_object(
      'moyenne_jours', (select round(avg(marge), 1) from liasses),
      'repartition', jsonb_build_object(
        'en_retard', (select count(*) from liasses where marge < 0),
        'moins_7', (select count(*) from liasses where marge between 0 and 6),
        'de_7_a_30', (select count(*) from liasses where marge between 7 and 30),
        'plus_30', (select count(*) from liasses where marge > 30))),
    'delai_cloture_supervision', jsonb_build_object(
      'moyenne_jours', (select round(avg(date_sup - date_fin), 1) from ex where date_sup is not null))
  )
$$;

create function indicateurs(
  p_saison int, p_equipe int default null, p_manager uuid default null, p_senior uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_precedente jsonb;
  v_equipes jsonb;
  v_seniors jsonb;
begin
  if not (a_role('manager', 'associe') or est_admin()) then
    raise exception 'Les indicateurs sont réservés aux managers, à l''associé et aux administrateurs.' using errcode = '42501';
  end if;

  if exists (
    select 1 from exercices x join dossiers d on d.id = x.dossier_id
    where saison_fiscale(x.date_fin) = p_saison - 1
      and (p_equipe is null or d.equipe = p_equipe)
      and (p_manager is null or d.manager_id = p_manager)
      and (p_senior is null or d.senior_id = p_senior)
  ) then
    v_precedente := bloc_indicateurs(p_saison - 1, p_equipe, p_manager, p_senior);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('equipe', q.equipe) || bloc_indicateurs(p_saison, q.equipe, p_manager, p_senior)
                            order by q.equipe), '[]'::jsonb)
    into v_equipes
  from (
    select distinct d.equipe from dossiers d
    where d.equipe is not null
      and (p_equipe is null or d.equipe = p_equipe)
      and (p_manager is null or d.manager_id = p_manager)
      and (p_senior is null or d.senior_id = p_senior)
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object('senior_id', q.senior_id) || bloc_indicateurs(p_saison, p_equipe, p_manager, q.senior_id)
                            order by q.senior_id), '[]'::jsonb)
    into v_seniors
  from (
    select distinct d.senior_id from dossiers d
    where d.senior_id is not null
      and (p_equipe is null or d.equipe = p_equipe)
      and (p_manager is null or d.manager_id = p_manager)
      and (p_senior is null or d.senior_id = p_senior)
  ) q;

  return jsonb_build_object(
    'saison', p_saison,
    'global', bloc_indicateurs(p_saison, p_equipe, p_manager, p_senior),
    'precedente', v_precedente,
    'par_equipe', v_equipes,
    'par_senior', v_seniors
  );
end
$$;

create function plan_de_charge(
  p_debut date, p_semaines int default 26,
  p_equipe int default null, p_manager uuid default null, p_senior uuid default null
) returns table (semaine date, senior_id uuid, a_faire int, supervises int)
language plpgsql stable security definer set search_path = public
as $$
begin
  if (moi()).id is null then
    raise exception 'Accès réservé aux collaborateurs identifiés.' using errcode = '42501';
  end if;
  return query
  select date_trunc('week', x.date_cible)::date,
         d.senior_id,
         (count(*) filter (where x.etape_actuelle < 4))::int,
         (count(*) filter (where x.etape_actuelle >= 4))::int
  from exercices x
  join dossiers d on d.id = x.dossier_id
  where x.date_cible >= p_debut and x.date_cible < p_debut + 7 * p_semaines
    and (p_equipe is null or d.equipe = p_equipe)
    and (p_manager is null or d.manager_id = p_manager)
    and (p_senior is null or d.senior_id = p_senior)
  group by 1, 2
  order by 1, 2;
end
$$;

revoke execute on function bloc_indicateurs(int, int, uuid, uuid) from public, anon, authenticated;
revoke execute on function indicateurs(int, int, uuid, uuid) from public, anon;
revoke execute on function plan_de_charge(date, int, int, uuid, uuid) from public, anon;
revoke execute on function saison_fiscale(date) from public;
grant execute on function saison_fiscale(date) to authenticated, service_role;
grant execute on function indicateurs(int, int, uuid, uuid) to authenticated;
grant execute on function plan_de_charge(date, int, int, uuid, uuid) to authenticated;
