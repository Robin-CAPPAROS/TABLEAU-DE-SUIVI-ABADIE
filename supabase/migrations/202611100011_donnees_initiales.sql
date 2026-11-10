-- Donnees initiales et planification.
-- Aucun calendrier annuel n'est pre-rempli : il est saisi apres validation par un manager.

insert into formes_juridiques (code, approbation, depot_greffe) values
  ('SA', true, true),
  ('SAS', true, true),
  ('SASU', true, true),
  ('SARL', true, true),
  ('EURL', true, true),
  ('SELARL', true, true),
  ('SELAS', true, true),
  ('SNC', true, true),
  ('SCI', true, false),
  ('SCM', true, false),
  ('SC', true, false),
  ('SCP', true, false),
  ('ENTREPRISE INDIVIDUELLE', false, false),
  ('LMNP', false, false),
  ('MICRO', false, false),
  ('ASSOCIATION', false, false)
on conflict do nothing;

insert into jours_feries (jour) values
  ('2026-01-01'), ('2026-04-06'), ('2026-05-01'), ('2026-05-08'), ('2026-05-14'), ('2026-05-25'),
  ('2026-07-14'), ('2026-08-15'), ('2026-11-01'), ('2026-11-11'), ('2026-12-25'),
  ('2027-01-01'), ('2027-03-29'), ('2027-05-01'), ('2027-05-08'), ('2027-05-06'), ('2027-05-17'),
  ('2027-07-14'), ('2027-08-15'), ('2027-11-01'), ('2027-11-11'), ('2027-12-25'),
  ('2028-01-01'), ('2028-04-17'), ('2028-05-01'), ('2028-05-08'), ('2028-05-25'), ('2028-06-05'),
  ('2028-07-14'), ('2028-08-15'), ('2028-11-01'), ('2028-11-11'), ('2028-12-25')
on conflict do nothing;

-- Planification : uniquement si pg_cron et pg_net sont disponibles.
-- L'URL des fonctions et CRON_SECRET sont lus dans le vault a chaque execution du job.
do $planif$
declare
  nom text;
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_cron';
    execute 'create extension if not exists pg_net';

    foreach nom in array array['generer-echeances', 'recapitulatif-hebdo'] loop
      execute format(
        'select cron.unschedule(jobid) from cron.job where jobname = %L', nom);
    end loop;

    execute $s$select cron.schedule('generer-echeances', '0 1 * * *', $cmd$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_url') || '/generer-echeances',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
        body := '{}'::jsonb)
    $cmd$)$s$;

    execute $s$select cron.schedule('recapitulatif-hebdo', '30 5,6 * * 1', $cmd$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_url') || '/recapitulatif-hebdo',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
        body := '{}'::jsonb)
    $cmd$)$s$;
  end if;
end
$planif$;
