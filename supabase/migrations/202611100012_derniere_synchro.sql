-- Horodatage de la derniere synchronisation Pennylane, lisible par tous les collaborateurs connectes.

create function derniere_synchro() returns timestamptz
language sql stable security definer set search_path = public
as $$
  select max(fin) from journal_synchro
  where nature in ('fiches', 'declarations') and fin is not null
$$;

revoke execute on function derniere_synchro() from public, anon;
grant execute on function derniere_synchro() to authenticated, service_role;
