-- Administration : seul un administrateur peut marquer une anomalie comme resolue (colonne resolue_le uniquement).
grant update (resolue_le) on anomalies to authenticated;
create policy resolution_admin on anomalies for update to authenticated
  using (est_admin()) with check (est_admin());
