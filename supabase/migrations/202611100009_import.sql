-- Import initial du classeur : champs outil des dossiers (rapproches par SIREN) et collaborateurs.
-- Reserve aux administrateurs.

create function import_classeur(p jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_siren text;
  v_nb int;
  v_rapproches int := 0;
  v_collab int := 0;
  v_non jsonb := '[]'::jsonb;
  v_props jsonb;
begin
  if not est_admin() then
    raise exception 'droit insuffisant' using errcode = '42501';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p -> 'dossiers', '[]'::jsonb)) loop
    v_siren := nullif(btrim(v_item ->> 'siren'), '');
    if v_siren is null then
      continue;
    end if;
    update dossiers set
      equipe = (v_item ->> 'equipe')::int,
      mission = (v_item ->> 'mission')::mission,
      statut = coalesce(v_item ->> 'statut', 'actif')::statut_dossier,
      jour_echeance_tva = (v_item ->> 'jourEcheanceTva')::int,
      is_n1_superieur_3000 = coalesce((v_item ->> 'isN1Superieur3000')::boolean, is_n1_superieur_3000),
      commentaire = v_item ->> 'commentaire'
    where siren = v_siren;
    get diagnostics v_nb = row_count;
    if v_nb > 0 then
      v_rapproches := v_rapproches + 1;
    else
      select coalesce(jsonb_agg(jsonb_build_object('dossier_id', d.id, 'raison_sociale', d.raison_sociale)
                                order by d.raison_sociale), '[]'::jsonb)
        into v_props
        from dossiers d
       where d.siren is null
         and normaliser_nom(d.raison_sociale) = normaliser_nom(v_item ->> 'raisonSociale');
      v_non := v_non || jsonb_build_object('siren', v_siren, 'raison_sociale', v_item ->> 'raisonSociale',
                                           'propositions', v_props);
    end if;
  end loop;

  -- Collaborateurs : role, e-mail, actif et administrateur ne sont jamais modifies pour un existant.
  -- Un nouveau collaborateur n'a pas de role ; son e-mail provisoire reste a renseigner.
  for v_item in select value from jsonb_array_elements(coalesce(p -> 'collaborateurs', '[]'::jsonb)) loop
    if nullif(btrim(v_item ->> 'trigramme'), '') is null then
      continue;
    end if;
    insert into collaborateurs (prenom, nom, nom_pennylane, trigramme, email, role, actif)
    values (v_item ->> 'prenom', v_item ->> 'nom', v_item ->> 'nomPennylane', v_item ->> 'trigramme',
            lower(v_item ->> 'trigramme') || '@a-renseigner.invalid', null, true)
    on conflict (trigramme) do update set
      prenom = excluded.prenom, nom = excluded.nom, nom_pennylane = excluded.nom_pennylane;
    v_collab := v_collab + 1;
  end loop;

  return jsonb_build_object('rapproches', v_rapproches, 'non_rapproches', v_non, 'collaborateurs', v_collab);
end;
$$;

create function rapprocher_dossier(p_dossier uuid, p_import jsonb) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not est_admin() then
    raise exception 'droit insuffisant' using errcode = '42501';
  end if;
  update dossiers set
    siren = nullif(btrim(p_import ->> 'siren'), ''),
    equipe = (p_import ->> 'equipe')::int,
    mission = (p_import ->> 'mission')::mission,
    statut = coalesce(p_import ->> 'statut', 'actif')::statut_dossier,
    jour_echeance_tva = (p_import ->> 'jourEcheanceTva')::int,
    is_n1_superieur_3000 = coalesce((p_import ->> 'isN1Superieur3000')::boolean, is_n1_superieur_3000),
    commentaire = p_import ->> 'commentaire'
  where id = p_dossier;
  if not found then
    raise exception 'dossier introuvable' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function import_classeur(jsonb) from public, anon;
revoke execute on function rapprocher_dossier(uuid, jsonb) from public, anon;
grant execute on function import_classeur(jsonb) to authenticated;
grant execute on function rapprocher_dossier(uuid, jsonb) to authenticated;
