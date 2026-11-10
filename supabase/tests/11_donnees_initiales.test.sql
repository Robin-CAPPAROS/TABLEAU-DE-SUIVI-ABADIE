begin;

do $$
begin
  assert (select count(*) from formes_juridiques where code = 'SCI' and approbation and not depot_greffe) = 1,
    'SCI : approbation sans depot au greffe';
  assert (select count(*) from formes_juridiques where code = 'SAS' and approbation and depot_greffe) = 1,
    'SAS : approbation et depot';
  assert (select count(*) from formes_juridiques where code = 'LMNP' and not approbation and not depot_greffe) = 1,
    'LMNP : ni approbation ni depot';
  assert (select count(*) from formes_juridiques) = 16, 'formes_juridiques doit compter 16 lignes';
  assert exists (select 1 from jours_feries where jour = '2027-05-17'), 'lundi de Pentecote 2027 manquant';
  assert (select count(*) from jours_feries) = 33, 'jours_feries doit compter 33 lignes';
  assert not exists (select 1 from pg_namespace where nspname = 'cron'),
    'le schema cron ne doit pas exister localement (planification ignoree)';
end $$;

rollback;
