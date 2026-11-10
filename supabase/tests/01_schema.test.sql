begin;

do $$
declare ok boolean;
begin
  insert into echeances (dossier_id, type, periode_debut, periode_fin, date_limite)
  values ('00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle', '2026-10-01', '2026-10-31', '2026-11-19');
  ok := false;
  begin
    insert into echeances (dossier_id, type, periode_debut, periode_fin, date_limite)
    values ('00000000-0000-0000-0000-0000000000d1', 'tva_mensuelle', '2026-10-01', '2026-10-31', '2026-11-19');
  exception when unique_violation then ok := true;
  end;
  assert ok, 'une echeance en double doit lever unique_violation';
end $$;

do $$
declare ok boolean := false;
begin
  begin
    insert into collaborateurs (prenom, nom, nom_pennylane, trigramme, email, role)
    values ('Test', 'DOUBLON', 'Test DOUBLON', 'ZZZ', 'CSP1@cabinet.test', 'csp');
  exception when unique_violation then ok := true;
  end;
  assert ok, 'un email identique a la casse pres doit lever unique_violation';
end $$;

do $$
declare ok boolean := false;
begin
  begin
    update exercices set etape_actuelle = 7 where id = '00000000-0000-0000-0000-0000000000e1';
  exception when check_violation then ok := true;
  end;
  assert ok, 'etape_actuelle = 7 doit lever check_violation';
end $$;

do $$
begin
  assert (select count(*) from parametres) = 1, 'parametres doit contenir une seule ligne apres les fixtures';
end $$;

rollback;
