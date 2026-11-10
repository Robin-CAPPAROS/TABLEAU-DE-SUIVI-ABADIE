-- Recapitulatif hebdomadaire (spec 8.5) : destinataires et donnees par collaborateur.

create function destinataires_recapitulatif() returns setof collaborateurs
language sql stable security definer set search_path = public
as $$
  select c.*
  from collaborateurs c
  join parametres p on p.id = 1
  where p.recap_actif
    and c.actif
    and c.email is not null
    and (
      c.role in ('manager', 'associe')
      or (
        c.role in ('csp', 'senior')
        and exists (
          select 1 from dossiers d
          where (d.csp_id = c.id or d.senior_id = c.id)
            and d.statut = 'actif'
            and d.equipe = any (p.recap_equipes)
        )
      )
    )
  order by c.nom, c.prenom
$$;

create function donnees_recapitulatif(p_collaborateur uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_col collaborateurs;
  v_dossiers uuid[];
  v_supervision boolean;
  v_synthese jsonb := null;
  v_file jsonb := null;
  v_anomalies int := null;
begin
  select * into v_col from collaborateurs where id = p_collaborateur;
  if not found then
    raise exception 'collaborateur inconnu' using errcode = 'P0001';
  end if;

  v_supervision := v_col.role in ('manager', 'associe');

  select coalesce(array_agg(d.id), '{}') into v_dossiers
  from dossiers d
  where d.statut = 'actif'
    and case v_col.role
      when 'associe' then true
      when 'manager' then d.manager_id = v_col.id
      else d.csp_id = v_col.id or d.senior_id = v_col.id
    end;

  if v_supervision then
    -- Un dossier compte pour son CSP et pour son Senior ; sans CSP, il va dans 'Non affecté'.
    select coalesce(jsonb_agg(jsonb_build_object(
             'trigramme', q.trigramme, 'echeances', q.echeances, 'retards', q.retards, 'alertes', q.alertes)
           order by q.non_affecte, q.trigramme), '[]'::jsonb)
      into v_synthese
    from (
      select r.trigramme, r.non_affecte,
             count(*) filter (where e.sous_7_jours) as echeances,
             count(*) filter (where e.en_retard) as retards,
             count(*) filter (where e.alerte_paiement) as alertes
      from (
        select d.id as dossier_id, c.trigramme, false as non_affecte
        from dossiers d
        join collaborateurs c on c.id = d.csp_id or c.id = d.senior_id
        where d.id = any (v_dossiers)
        union all
        select d.id, 'Non affecté', true
        from dossiers d
        where d.id = any (v_dossiers) and d.csp_id is null
      ) r
      left join v_echeances e on e.dossier_id = r.dossier_id
      group by r.trigramme, r.non_affecte
      having not r.non_affecte
          or count(*) filter (where e.sous_7_jours or e.en_retard or e.alerte_paiement) > 0
    ) q;

    select coalesce(jsonb_agg(jsonb_build_object(
             'dossierId', x.dossier_id, 'raisonSociale', x.raison_sociale,
             'dateCible', x.date_cible, 'etapeActuelle', x.etape_actuelle)
           order by x.date_cible, x.raison_sociale), '[]'::jsonb)
      into v_file
    from v_exercices x
    where x.dossier_id = any (v_dossiers) and x.etape_actuelle = 3;

    select count(*)::int into v_anomalies from anomalies where resolue_le is null;
  end if;

  return jsonb_build_object(
    'collaborateur', jsonb_build_object('prenom', v_col.prenom, 'role', v_col.role),
    'semaineDu', aujourdhui(),
    'echeances7j', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'dossierId', e.dossier_id, 'raisonSociale', e.raison_sociale,
               'type', e.type, 'dateLimite', e.date_limite)
             order by e.date_limite, e.raison_sociale), '[]'::jsonb)
      from v_echeances e where e.dossier_id = any (v_dossiers) and e.sous_7_jours),
    'echeancesEnRetard', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'dossierId', e.dossier_id, 'raisonSociale', e.raison_sociale,
               'type', e.type, 'dateLimite', e.date_limite)
             order by e.date_limite, e.raison_sociale), '[]'::jsonb)
      from v_echeances e where e.dossier_id = any (v_dossiers) and e.en_retard),
    'alertesPaiement', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'dossierId', e.dossier_id, 'raisonSociale', e.raison_sociale,
               'type', e.type, 'dateLimite', e.date_limite)
             order by e.date_limite, e.raison_sociale), '[]'::jsonb)
      from v_echeances e where e.dossier_id = any (v_dossiers) and e.alerte_paiement),
    'exercicesEnRetard', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'dossierId', x.dossier_id, 'raisonSociale', x.raison_sociale,
               'dateCible', x.date_cible, 'etapeActuelle', x.etape_actuelle)
             order by x.date_cible, x.raison_sociale), '[]'::jsonb)
      from v_exercices x where x.dossier_id = any (v_dossiers) and x.en_retard),
    'synthese', v_synthese,
    'fileSupervision', v_file,
    'anomaliesOuvertes', v_anomalies
  );
end
$$;

revoke execute on function destinataires_recapitulatif() from public, anon, authenticated;
revoke execute on function donnees_recapitulatif(uuid) from public, anon, authenticated;
grant execute on function destinataires_recapitulatif() to service_role;
grant execute on function donnees_recapitulatif(uuid) to service_role;
