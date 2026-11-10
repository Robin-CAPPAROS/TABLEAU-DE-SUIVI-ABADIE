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

insert into journal_synchro (debut, fin, nature) values
  ('2026-11-09 05:00+00', '2026-11-09 05:10+00', 'fiches'),
  ('2026-11-10 01:00+00', '2026-11-10 01:15+00', 'declarations'),
  ('2026-11-10 03:00+00', '2026-11-10 03:30+00', 'generation'),
  ('2026-11-10 04:00+00', null, 'fiches');

set local role authenticated;
set local request.jwt.claims = '{"email":"csp1@cabinet.test"}';
do $$
begin
  assert derniere_synchro() = '2026-11-10 01:15+00', 'derniere_synchro : max(fin) fiches/declarations';
end $$;
reset role;

set local role anon;
do $$
begin
  assert code_erreur($q$select derniere_synchro()$q$) = '42501', 'anon refuse (derniere_synchro)';
end $$;
reset role;

rollback;
