-- Lecture des donnees de generation et ecriture idempotente des echeances generees.
-- Reservees a service_role (fonction serveur nocturne).

create function donnees_generation() returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'dossiers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'regimeTva', d.regime_tva,
        'categorieFiscale', d.categorie_fiscale,
        'formeJuridique', d.forme_juridique,
        'mission', d.mission,
        'statut', d.statut,
        'jourEcheanceTva', d.jour_echeance_tva,
        'isN1Superieur3000', coalesce(d.is_n1_superieur_3000, false)
      ) order by d.id)
      from dossiers d where d.statut = 'actif'), '[]'::jsonb),
    'exercices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'dossierId', e.dossier_id,
        'dateDebut', e.date_debut,
        'dateFin', e.date_fin,
        'dateApprobation', e.date_approbation
      ) order by e.id)
      from exercices e join dossiers d on d.id = e.dossier_id
      where d.statut = 'actif'), '[]'::jsonb),
    'parametres', jsonb_build_object(
      'feries', coalesce((select jsonb_agg(f.jour order by f.jour) from jours_feries f), '[]'::jsonb),
      'calendriers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'annee', c.annee,
          'dateLiasse3112', c.date_liasse_3112,
          'dateSoldeIs3112', c.date_solde_is_3112,
          'dateCa12_3112', c.date_ca12_3112
        ) order by c.annee)
        from calendriers_annuels c), '[]'::jsonb),
      'formes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', fj.code,
          'approbation', fj.approbation,
          'depotGreffe', fj.depot_greffe
        ) order by fj.code)
        from formes_juridiques fj), '[]'::jsonb),
      'delaiGreffeMois', coalesce((select delai_greffe_mois from parametres where id = 1), 2)
    )
  );
$$;

create function upsert_echeances_generees(p_echeances jsonb, p_anomalies jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserees int;
  v_maj int;
  v_anomalies int;
begin
  with ecritures as (
    insert into echeances (dossier_id, exercice_id, type, periode_debut, periode_fin, date_limite,
                           date_limite_source, statut)
    select x."dossierId", x."exerciceId", x.type::type_echeance, x."periodeDebut", x."periodeFin",
           x."dateLimite", 'calcul', 'a_faire'
    from jsonb_to_recordset(coalesce(p_echeances, '[]'::jsonb)) as x(
      "dossierId" uuid, "exerciceId" uuid, type text,
      "periodeDebut" date, "periodeFin" date, "dateLimite" date)
    on conflict (dossier_id, type, periode_debut, periode_fin) do update
      set date_limite = excluded.date_limite
      where echeances.date_limite_source = 'calcul'
        and echeances.date_limite is distinct from excluded.date_limite
    returning (xmax = 0) as insere
  )
  select count(*) filter (where insere), count(*) filter (where not insere)
  into v_inserees, v_maj from ecritures;

  with ecritures as (
    insert into anomalies (type, dossier_id, cle, message, journal_id)
    select x.type, x."dossierId", x.cle, x.message, null
    from jsonb_to_recordset(coalesce(p_anomalies, '[]'::jsonb)) as x(
      "dossierId" uuid, type text, cle text, message text)
    on conflict (type, coalesce(dossier_id, '00000000-0000-0000-0000-000000000000'), cle)
      where resolue_le is null do nothing
    returning 1
  )
  select count(*) into v_anomalies from ecritures;

  return jsonb_build_object('inserees', v_inserees, 'mises_a_jour', v_maj, 'anomalies', v_anomalies);
end;
$$;

revoke execute on function donnees_generation() from public, anon, authenticated;
revoke execute on function upsert_echeances_generees(jsonb, jsonb) from public, anon, authenticated;
grant execute on function donnees_generation() to service_role;
grant execute on function upsert_echeances_generees(jsonb, jsonb) to service_role;
