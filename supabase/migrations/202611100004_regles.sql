-- Regles : date du jour, date cible, retards, alertes de paiement.

insert into parametres (id) values (1) on conflict do nothing;

create function aujourdhui() returns date
language sql stable
as $$
  select coalesce(nullif(current_setting('app.aujourdhui', true), '')::date,
                  (now() at time zone 'Europe/Paris')::date)
$$;

grant execute on function aujourdhui() to authenticated, service_role;

create function calculer_date_cible() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_mission mission;
  v_mois int;
begin
  if new.date_cible is not null then
    return new;
  end if;
  select d.mission into v_mission from dossiers d where d.id = new.dossier_id;
  select case coalesce(v_mission, 'tenue')
           when 'tenue' then p.date_cible_mois_tenue
           when 'revision' then p.date_cible_mois_revision
           when 'micro_bnc' then p.date_cible_mois_micro_bnc
           when 'irpp' then p.date_cible_mois_irpp
         end
    into v_mois from parametres p where p.id = 1;
  new.date_cible := (new.date_fin + make_interval(months => v_mois))::date;
  return new;
end
$$;

create trigger exercices_date_cible
before insert on exercices
for each row execute function calculer_date_cible();

create view v_echeances with (security_invoker = true) as
select
  e.*,
  d.raison_sociale, d.equipe, d.csp_id, d.senior_id, d.manager_id, d.pennylane_id,
  (e.statut = 'a_faire' and e.date_limite < aujourdhui()) as en_retard,
  (e.statut = 'a_faire' and e.date_limite between aujourdhui() and aujourdhui() + 7) as sous_7_jours,
  (e.type::text like 'tva\_%' and e.statut = 'depose' and coalesce(e.montant, 0) > 0
    and e.date_limite + p.delai_alerte_paiement_jours < aujourdhui()) as alerte_paiement,
  coalesce(e.date_depot > e.date_limite, false) as depot_tardif,
  (coalesce(e.date_depot > e.date_limite, false) and e.cause_retard is null) as retard_non_qualifie,
  (e.type in ('tva_mensuelle', 'tva_trimestrielle', 'tva_ca12_annuelle', 'liasse')
    or e.source_statut = 'pennylane') as synchronisee
from echeances e
join dossiers d on d.id = e.dossier_id
join parametres p on p.id = 1;

create view v_exercices with (security_invoker = true) as
select
  x.*,
  d.raison_sociale, d.equipe, d.csp_id, d.senior_id, d.manager_id, d.pennylane_id, d.mission,
  x.date_cible - p.jalon_etape2_jours as jalon_etape2,
  x.date_cible - p.jalon_etape3_jours as jalon_etape3,
  x.date_cible as jalon_etape4,
  a.etape_attendue,
  (a.etape_attendue is not null and x.etape_actuelle < a.etape_attendue) as en_retard
from exercices x
join dossiers d on d.id = x.dossier_id
join parametres p on p.id = 1
cross join lateral (
  select case
    when x.date_cible < aujourdhui() then 4
    when x.date_cible - p.jalon_etape3_jours < aujourdhui() then 3
    when x.date_cible - p.jalon_etape2_jours < aujourdhui() then 2
  end as etape_attendue
) a;

grant select on v_echeances, v_exercices to authenticated;
