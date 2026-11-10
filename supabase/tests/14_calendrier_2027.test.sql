begin;

do $$
begin
  assert (select count(*) from calendriers_annuels where annee = 2027) = 1, 'ligne 2027 presente';
  assert (select date_liasse_3112 from calendriers_annuels where annee = 2027) = date '2027-05-19', 'liasse 2027';
  assert (select date_solde_is_3112 from calendriers_annuels where annee = 2027) = date '2027-05-18', 'solde IS 2027';
  assert (select date_ca12_3112 from calendriers_annuels where annee = 2027) = date '2027-05-04', 'CA12 2027';
  assert (select recap_actif from parametres where id = 1) is false, 'recapitulatif en pause';
end $$;

set local role service_role;
do $$
begin
  assert (select count(*) from destinataires_recapitulatif()) = 0, 'aucun destinataire tant que le recapitulatif est en pause';
end $$;
reset role;

rollback;
