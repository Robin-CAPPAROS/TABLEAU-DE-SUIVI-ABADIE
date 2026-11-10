-- Application idempotente des donnees Pennylane (porte d'entree sync-pennylane).
-- Reservee a service_role.

create function normaliser_nom(t text) returns text
language sql
immutable
as $$
  select regexp_replace(
    lower(translate(btrim(t),
      'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸŒ',
      'aaaaaaceeeeiiiinooooouuuuyyoaaaaaaceeeeiiiinooooouuuuyyo')),
    '\s+', ' ', 'g')
$$;

-- Identifiant du collaborateur actif correspondant au nom Pennylane (null si zero ou plusieurs).
create function sync_collaborateur(p_nom text) returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when count(*) = 1 then (array_agg(id))[1] end
  from collaborateurs
  where actif and normaliser_nom(nom_pennylane) = normaliser_nom(p_nom)
$$;

create function sync_appliquer(p_payload jsonb, p_source text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_journal uuid;
  v_dossiers jsonb := coalesce(p_payload -> 'dossiers', '[]'::jsonb);
  v_decls jsonb := coalesce(p_payload -> 'declarations_tva', '[]'::jsonb);
  v_liasses jsonb := coalesce(p_payload -> 'liasses', '[]'::jsonb);
  v_nb_dossiers int := 0;
  v_nb_echeances int := 0;
  v_anoms jsonb := '[]'::jsonb;
  v_loc jsonb;
  v_loc_ech int;
  v_item jsonb;
  v_a jsonb;
  v_pid bigint;
  v_dossier dossiers;
  v_dossier_id uuid;
  v_raw text;
  v_regime regime_tva;
  v_regime_set boolean;
  v_nouveau boolean;
  v_nom text;
  v_csp uuid;
  v_senior uuid;
  v_manager uuid;
  v_ex jsonb;
  v_deb date;
  v_fin date;
  v_duree int;
  v_type type_echeance;
  v_regime_eff regime_tva;
  v_exercice uuid;
  v_etape int;
  v_statut_pl text;
  v_statut statut_echeance;
  v_source source_statut;
  v_limite date;
  v_limite_payload date;
  v_depot date;
  v_montant numeric;
  v_exist echeances;
  v_garde boolean;
  v_insere boolean;
begin
  insert into journal_synchro (source, nature)
  values (p_source, case when jsonb_array_length(v_decls) + jsonb_array_length(v_liasses) = 0
                         then 'fiches' else 'declarations' end)
  returning id into v_journal;

  -- Dossiers
  for v_item in select value from jsonb_array_elements(v_dossiers) loop
    v_loc := '[]'::jsonb;
    begin
      v_pid := (v_item ->> 'pennylane_id')::bigint;
      v_raw := v_item ->> 'regime_tva';
      v_regime_set := true;
      v_regime := null;
      if v_raw is null or lower(v_raw) = 'none' then
        v_regime := 'non_assujetti';
      elsif lower(v_raw) = 'monthly' then v_regime := 'mensuel';
      elsif lower(v_raw) = 'quarterly' then v_regime := 'trimestriel';
      elsif lower(v_raw) in ('yearly', 'annual', 'annually') then v_regime := 'annuel';
      else v_regime_set := false;
      end if;

      v_csp := null; v_senior := null; v_manager := null;
      v_nom := nullif(btrim(coalesce(v_item ->> 'comptable', '')), '');
      if v_nom is not null then
        v_csp := sync_collaborateur(v_nom);
      end if;
      v_nom := nullif(btrim(coalesce(v_item ->> 'superviseur', '')), '');
      if v_nom is not null then
        v_senior := sync_collaborateur(v_nom);
      end if;
      v_nom := nullif(btrim(coalesce(v_item ->> 'manager', '')), '');
      if v_nom is not null then
        v_manager := sync_collaborateur(v_nom);
      end if;

      insert into dossiers (pennylane_id, raison_sociale, siren, forme_juridique, regime_tva,
                            categorie_fiscale, regime_fiscal, csp_id, senior_id, manager_id, derniere_synchro)
      values (v_pid, v_item ->> 'raison_sociale', nullif(v_item ->> 'siren', ''), v_item ->> 'forme_juridique',
              case when v_regime_set then v_regime end,
              v_item ->> 'categorie_fiscale', v_item ->> 'regime_fiscal', v_csp, v_senior, v_manager, now())
      on conflict (pennylane_id) do update set
        raison_sociale = excluded.raison_sociale,
        siren = coalesce(excluded.siren, dossiers.siren),
        forme_juridique = excluded.forme_juridique,
        regime_tva = case when v_regime_set then excluded.regime_tva else dossiers.regime_tva end,
        categorie_fiscale = excluded.categorie_fiscale,
        regime_fiscal = excluded.regime_fiscal,
        csp_id = excluded.csp_id,
        senior_id = excluded.senior_id,
        manager_id = excluded.manager_id,
        derniere_synchro = now()
      returning id, (xmax = 0) into v_dossier_id, v_nouveau;

      if v_nouveau then
        v_loc := v_loc || jsonb_build_object('type', 'dossier_nouveau', 'dossier_id', v_dossier_id,
          'cle', v_pid::text, 'message', 'Nouveau dossier créé depuis Pennylane : ' || (v_item ->> 'raison_sociale'));
      end if;
      if not v_regime_set then
        v_loc := v_loc || jsonb_build_object('type', 'regime_tva_inconnu', 'dossier_id', v_dossier_id,
          'cle', v_raw, 'message', 'Régime de TVA Pennylane inconnu : ' || v_raw);
      end if;
      foreach v_nom in array array['comptable', 'superviseur', 'manager'] loop
        if nullif(btrim(coalesce(v_item ->> v_nom, '')), '') is not null
           and sync_collaborateur(v_item ->> v_nom) is null then
          v_loc := v_loc || jsonb_build_object('type', 'collaborateur_inconnu', 'dossier_id', v_dossier_id,
            'cle', v_item ->> v_nom, 'message', 'Intervenant Pennylane introuvable : ' || (v_item ->> v_nom));
        end if;
      end loop;

      for v_ex in select value from jsonb_array_elements(coalesce(v_item -> 'exercices', '[]'::jsonb)) loop
        insert into exercices (dossier_id, date_debut, date_fin)
        values (v_dossier_id, (v_ex ->> 'debut')::date, (v_ex ->> 'fin')::date)
        on conflict (dossier_id, date_fin) do update set date_debut = excluded.date_debut;
      end loop;

      v_nb_dossiers := v_nb_dossiers + 1;
    exception when others then
      v_loc := jsonb_build_array(jsonb_build_object('type', 'erreur_dossier',
        'dossier_id', (select id from dossiers where pennylane_id = (v_item ->> 'pennylane_id')::bigint),
        'cle', coalesce(v_item ->> 'pennylane_id', ''), 'message', sqlerrm));
    end;
    for v_a in select value from jsonb_array_elements(v_loc) loop
      v_anoms := v_anoms || sync_noter_anomalie(v_a, v_journal);
    end loop;
  end loop;

  -- Declarations de TVA
  for v_item in select value from jsonb_array_elements(v_decls) loop
    v_loc := '[]'::jsonb;
    v_loc_ech := 0;
    begin
      v_pid := (v_item ->> 'pennylane_id')::bigint;
      v_deb := (v_item ->> 'periode_debut')::date;
      v_fin := (v_item ->> 'periode_fin')::date;
      v_duree := v_fin - v_deb + 1;
      select * into v_dossier from dossiers where pennylane_id = v_pid;
      if not found then
        v_loc := v_loc || jsonb_build_object('type', 'dossier_inconnu', 'dossier_id', null,
          'cle', v_pid::text, 'message', 'Déclaration de TVA reçue pour un dossier inconnu : ' || v_pid);
      else
        v_regime_eff := v_dossier.regime_tva;
        if v_regime_eff is null or v_regime_eff = 'non_assujetti' then
          v_regime_eff := case when v_duree <= 31 then 'mensuel'
                               when v_duree <= 100 then 'trimestriel'
                               else 'annuel' end;
        end if;
        v_type := case v_regime_eff
          when 'mensuel' then 'tva_mensuelle'
          when 'trimestriel' then 'tva_trimestrielle'
          else case when v_duree > 62 then 'tva_ca12_annuelle'
                    when extract(month from v_fin) = 7 then 'tva_ca12_acompte_juillet'
                    when extract(month from v_fin) = 12 then 'tva_ca12_acompte_decembre'
                    else 'tva_ca12_annuelle' end
        end::type_echeance;

        v_exercice := null;
        if v_type = 'tva_ca12_annuelle' then
          select id into v_exercice from exercices where dossier_id = v_dossier.id and date_fin = v_fin;
        end if;

        v_statut_pl := v_item ->> 'statut';
        v_statut := case v_statut_pl when 'accepted_and_paid' then 'paye'
                                     when 'accepted' then 'depose'
                                     else 'a_faire' end;
        v_limite_payload := nullif(v_item ->> 'date_limite', '')::date;
        v_depot := nullif(v_item ->> 'date_depot', '')::date;
        v_montant := nullif(v_item ->> 'montant', '')::numeric;

        select * into v_exist from echeances
         where dossier_id = v_dossier.id and type = v_type and periode_debut = v_deb and periode_fin = v_fin;
        if found then
          v_garde := v_exist.statut = 'paye' and v_exist.source_statut = 'manuel' and v_statut <> 'paye';
          update echeances set
            statut = case when v_garde then statut else v_statut end,
            source_statut = case when v_garde then source_statut else 'pennylane' end,
            date_depot = case when v_garde then date_depot else coalesce(v_depot, date_depot) end,
            statut_pennylane = v_statut_pl,
            montant = coalesce(v_montant, montant),
            date_limite = coalesce(v_limite_payload, date_limite),
            date_limite_source = case when v_limite_payload is not null then 'pennylane' else date_limite_source end,
            exercice_id = coalesce(exercice_id, v_exercice)
          where id = v_exist.id;
        else
          insert into echeances (dossier_id, exercice_id, type, periode_debut, periode_fin, date_limite,
                                 date_limite_source, statut, statut_pennylane, source_statut, date_depot, montant)
          values (v_dossier.id, v_exercice, v_type, v_deb, v_fin,
                  coalesce(v_limite_payload, (v_fin + interval '1 month')::date),
                  case when v_limite_payload is not null then 'pennylane' else 'calcul' end,
                  v_statut, v_statut_pl, 'pennylane', v_depot, v_montant);
          v_loc := v_loc || jsonb_build_object('type', 'declaration_sans_echeance', 'dossier_id', v_dossier.id,
            'cle', v_type::text || ' ' || v_deb::text || ' ' || v_fin::text,
            'message', 'Déclaration de TVA sans échéance correspondante : ' || v_type::text
                       || ' du ' || v_deb::text || ' au ' || v_fin::text);
        end if;
        v_loc_ech := 1;
      end if;
    exception when others then
      v_loc_ech := 0;
      v_loc := jsonb_build_array(jsonb_build_object('type', 'erreur_dossier',
        'dossier_id', (select id from dossiers where pennylane_id = (v_item ->> 'pennylane_id')::bigint),
        'cle', coalesce(v_item ->> 'pennylane_id', ''), 'message', sqlerrm));
    end;
    v_nb_echeances := v_nb_echeances + v_loc_ech;
    for v_a in select value from jsonb_array_elements(v_loc) loop
      v_anoms := v_anoms || sync_noter_anomalie(v_a, v_journal);
    end loop;
  end loop;

  -- Liasses
  for v_item in select value from jsonb_array_elements(v_liasses) loop
    v_loc := '[]'::jsonb;
    v_loc_ech := 0;
    begin
      v_pid := (v_item ->> 'pennylane_id')::bigint;
      v_deb := (v_item ->> 'periode_debut')::date;
      v_fin := (v_item ->> 'periode_fin')::date;
      select * into v_dossier from dossiers where pennylane_id = v_pid;
      if not found then
        v_loc := v_loc || jsonb_build_object('type', 'dossier_inconnu', 'dossier_id', null,
          'cle', v_pid::text, 'message', 'Liasse reçue pour un dossier inconnu : ' || v_pid);
      else
        select id, etape_actuelle into v_exercice, v_etape from exercices
         where dossier_id = v_dossier.id and date_fin = v_fin;
        if not found then
          insert into exercices (dossier_id, date_debut, date_fin)
          values (v_dossier.id, v_deb, v_fin)
          returning id, etape_actuelle into v_exercice, v_etape;
        end if;

        v_statut_pl := v_item ->> 'statut';
        v_statut := case when v_statut_pl = 'accepted' then 'depose' else 'a_faire' end;
        v_depot := nullif(v_item ->> 'date_depot', '')::date;
        v_limite_payload := nullif(v_item ->> 'date_limite', '')::date;

        select * into v_exist from echeances
         where dossier_id = v_dossier.id and type = 'liasse' and periode_debut = v_deb and periode_fin = v_fin;
        if found then
          v_garde := v_exist.statut = 'paye' and v_exist.source_statut = 'manuel';
          update echeances set
            statut = case when v_garde then statut else v_statut end,
            source_statut = case when v_garde then source_statut else 'pennylane' end,
            date_depot = case when v_garde then date_depot
                              when v_statut = 'depose' then coalesce(v_depot, date_depot, aujourdhui())
                              else date_depot end,
            statut_pennylane = v_statut_pl,
            date_limite = coalesce(v_limite_payload, date_limite),
            date_limite_source = case when v_limite_payload is not null then 'pennylane' else date_limite_source end,
            exercice_id = coalesce(exercice_id, v_exercice)
          where id = v_exist.id;
        else
          insert into echeances (dossier_id, exercice_id, type, periode_debut, periode_fin, date_limite,
                                 date_limite_source, statut, statut_pennylane, source_statut, date_depot)
          values (v_dossier.id, v_exercice, 'liasse', v_deb, v_fin,
                  coalesce(v_limite_payload, (v_fin + interval '3 months' + interval '15 days')::date),
                  case when v_limite_payload is not null then 'pennylane' else 'calcul' end,
                  v_statut, v_statut_pl, 'pennylane',
                  case when v_statut = 'depose' then coalesce(v_depot, aujourdhui()) end);
        end if;
        v_loc_ech := 1;

        if v_statut_pl = 'accepted' and v_etape < 6 then
          if v_etape < 5 then
            v_loc := v_loc || jsonb_build_object('type', 'etapes_non_renseignees', 'dossier_id', v_dossier.id,
              'cle', v_fin::text,
              'message', 'Liasse acceptée alors que l''exercice clos le ' || v_fin::text
                         || ' était à l''étape ' || v_etape);
          end if;
          update exercices set etape_actuelle = 6 where id = v_exercice;
          insert into historique_etapes (exercice_id, etape, sens, date, auteur_id)
          values (v_exercice, 6, 'validation', now(), null);
        end if;
      end if;
    exception when others then
      v_loc_ech := 0;
      v_loc := jsonb_build_array(jsonb_build_object('type', 'erreur_dossier',
        'dossier_id', (select id from dossiers where pennylane_id = (v_item ->> 'pennylane_id')::bigint),
        'cle', coalesce(v_item ->> 'pennylane_id', ''), 'message', sqlerrm));
    end;
    v_nb_echeances := v_nb_echeances + v_loc_ech;
    for v_a in select value from jsonb_array_elements(v_loc) loop
      v_anoms := v_anoms || sync_noter_anomalie(v_a, v_journal);
    end loop;
  end loop;

  update journal_synchro
     set fin = now(), nb_dossiers = v_nb_dossiers, nb_echeances = v_nb_echeances
   where id = v_journal;

  return jsonb_build_object('journal_id', v_journal, 'dossiers', v_nb_dossiers,
                            'echeances', v_nb_echeances, 'anomalies', v_anoms);
end;
$$;

-- Enregistre une anomalie (ignoree si une identique est deja ouverte) et la renvoie pour le retour.
create function sync_noter_anomalie(p_a jsonb, p_journal uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into anomalies (type, dossier_id, cle, message, journal_id)
  values (p_a ->> 'type', nullif(p_a ->> 'dossier_id', '')::uuid, coalesce(p_a ->> 'cle', ''),
          p_a ->> 'message', p_journal)
  on conflict (type, coalesce(dossier_id, '00000000-0000-0000-0000-000000000000'), cle)
    where resolue_le is null do nothing;
  return jsonb_build_object('type', p_a ->> 'type', 'dossier_id', p_a -> 'dossier_id', 'message', p_a ->> 'message');
end;
$$;

create function dossiers_a_verifier() returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select distinct d.pennylane_id
  from dossiers d
  join echeances e on e.dossier_id = d.id
  where d.statut = 'actif'
    and e.statut = 'a_faire'
    and (e.type in ('tva_mensuelle', 'tva_trimestrielle', 'tva_ca12_acompte_juillet',
                    'tva_ca12_acompte_decembre', 'tva_ca12_annuelle', 'liasse'))
    and e.date_limite between aujourdhui() - 60 and aujourdhui() + 5
$$;

revoke execute on function normaliser_nom(text) from public, anon, authenticated;
revoke execute on function sync_collaborateur(text) from public, anon, authenticated;
revoke execute on function sync_noter_anomalie(jsonb, uuid) from public, anon, authenticated;
revoke execute on function sync_appliquer(jsonb, text) from public, anon, authenticated;
revoke execute on function dossiers_a_verifier() from public, anon, authenticated;
grant execute on function normaliser_nom(text) to service_role;
grant execute on function sync_collaborateur(text) to service_role;
grant execute on function sync_noter_anomalie(jsonb, uuid) to service_role;
grant execute on function sync_appliquer(jsonb, text) to service_role;
grant execute on function dossiers_a_verifier() to service_role;
