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

insert into anomalies (id, type, cle, message) values
  ('00000000-0000-0000-0000-0000000000a1', 'test', 'k1', 'anomalie un'),
  ('00000000-0000-0000-0000-0000000000a2', 'test', 'k2', 'anomalie deux');

-- manager non administrateur : aucune ligne modifiee
set local role authenticated;
set local request.jwt.claims = '{"email":"man1@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
declare v_code text;
begin
  v_code := code_erreur($q$update anomalies set resolue_le = now() where id = '00000000-0000-0000-0000-0000000000a1'$q$);
  assert v_code in ('ok', '42501'), 'man1 : code inattendu ' || v_code;
end $$;
reset role;
do $$
begin
  assert (select resolue_le from anomalies where id = '00000000-0000-0000-0000-0000000000a1') is null, 'man1 ne resout pas';
end $$;

-- administrateur
set local role authenticated;
set local request.jwt.claims = '{"email":"rca@cabinet.test","app_metadata":{"provider":"azure"}}';
do $$
begin
  assert code_erreur($q$update anomalies set resolue_le = now() where id = '00000000-0000-0000-0000-0000000000a1'$q$) = 'ok', 'rca resout';
  assert code_erreur($q$update anomalies set message = 'x' where id = '00000000-0000-0000-0000-0000000000a2'$q$) = '42501', 'autre colonne refusee';
end $$;
reset role;
do $$
begin
  assert (select resolue_le from anomalies where id = '00000000-0000-0000-0000-0000000000a1') is not null, 'resolue_le renseigne';
  assert (select resolue_le from anomalies where id = '00000000-0000-0000-0000-0000000000a2') is null, 'a2 intacte';
end $$;

rollback;
