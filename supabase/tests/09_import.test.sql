begin;

create function code_erreur(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlstate;
end $$;
grant execute on function code_erreur(text) to authenticated, anon;

-- D1 recoit un SIREN ; D2 n'en a pas.
update dossiers set siren = '123456789' where id = '00000000-0000-0000-0000-0000000000d1';

set local role anon;
do $$
begin
  assert code_erreur($q$select import_classeur('{}'::jsonb)$q$) = '42501', 'anon refuse';
end $$;

-- non administrateur
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000041"}';
do $$
begin
  assert code_erreur($q$select import_classeur('{}'::jsonb)$q$) = '42501', 'man1 refuse import';
  assert code_erreur($q$select rapprocher_dossier('00000000-0000-0000-0000-0000000000d2', '{}'::jsonb)$q$) = '42501', 'man1 refuse rapprochement';
end $$;

-- administrateur
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-0000000000a2"}';
do $$
declare
  r jsonb;
  d dossiers;
  c collaborateurs;
begin
  r := import_classeur($j$
    {"dossiers": [
      {"siren": "123456789", "raisonSociale": "Societe Test Un", "equipe": 2, "mission": "revision", "statut": "actif",
       "jourEcheanceTva": 22, "isN1Superieur3000": null, "commentaire": "note"},
      {"siren": "999999999", "raisonSociale": "SOCIÉTÉ  test deux", "equipe": 3, "mission": null, "statut": "sorti",
       "jourEcheanceTva": null, "isN1Superieur3000": true, "commentaire": null}],
     "collaborateurs": [
      {"prenom": "Amina", "nom": "OUIHAKA", "trigramme": "AOU", "nomPennylane": "Amina OUIHAKA"},
      {"prenom": "Marcus", "nom": "GIRARD", "trigramme": "MGI", "nomPennylane": "Marcus GIRARD"}]}
  $j$::jsonb);

  assert (r ->> 'rapproches')::int = 1, 'rapproches';
  assert (r ->> 'collaborateurs')::int = 2, 'collaborateurs';
  assert jsonb_array_length(r -> 'non_rapproches') = 1, 'non rapproches';
  assert r -> 'non_rapproches' -> 0 ->> 'siren' = '999999999', 'siren non rapproche';
  assert r -> 'non_rapproches' -> 0 -> 'propositions' -> 0 ->> 'dossier_id' = '00000000-0000-0000-0000-0000000000d2', 'proposition D2';
  assert jsonb_array_length(r -> 'non_rapproches' -> 0 -> 'propositions') = 1, 'une seule proposition';

  select * into d from dossiers where id = '00000000-0000-0000-0000-0000000000d1';
  assert d.equipe = 2 and d.mission = 'revision' and d.jour_echeance_tva = 22 and d.commentaire = 'note', 'champs outil D1';
  assert d.is_n1_superieur_3000 = false, 'IS inchange quand null';

  select * into c from collaborateurs where trigramme = 'AOU';
  assert c.role is null and c.actif and c.prenom = 'Amina', 'nouveau collaborateur';
  select * into c from collaborateurs where trigramme = 'MGI';
  assert c.prenom = 'Marcus' and c.role = 'manager' and c.email = 'man1@cabinet.test' and not c.administrateur, 'existant : role et email conserves';

  perform rapprocher_dossier('00000000-0000-0000-0000-0000000000d2',
    '{"siren": "999999999", "equipe": 3, "mission": null, "statut": "sorti", "jourEcheanceTva": null, "isN1Superieur3000": true, "commentaire": null}'::jsonb);
  select * into d from dossiers where id = '00000000-0000-0000-0000-0000000000d2';
  assert d.siren = '999999999' and d.statut = 'sorti' and d.equipe = 3 and d.is_n1_superieur_3000, 'rapprochement D2';
  assert code_erreur($q$select rapprocher_dossier('00000000-0000-0000-0000-00000000ffff', '{}'::jsonb)$q$) = 'P0001', 'dossier introuvable';
end $$;

rollback;
