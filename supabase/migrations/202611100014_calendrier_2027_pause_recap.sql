-- Calendrier annuel 2027 : valeurs PROVISOIRES issues de sources publiques.
--   date_ca12_3112     : 2e jour ouvre apres le 1er mai 2027 = 2027-05-04
--   date_liasse_3112   : +15 jours pour la teletransmission EDI = 2027-05-19
--   date_solde_is_3112 : le 15 mai 2027 est un samedi et le 17 mai est le lundi
--                        de Pentecote, donc report au 2027-05-18
-- A verifier avec le calendrier officiel de la DGFiP des sa publication.
insert into calendriers_annuels (annee, date_liasse_3112, date_solde_is_3112, date_ca12_3112)
values (2027, '2027-05-19', '2027-05-18', '2027-05-04')
on conflict (annee) do nothing;

-- Recapitulatif hebdomadaire mis en pause : l'expediteur sera plus tard l'adresse
-- de Robin CAPPAROS via le connecteur Microsoft Outlook de Lovable.
update parametres set recap_actif = false where id = 1;
