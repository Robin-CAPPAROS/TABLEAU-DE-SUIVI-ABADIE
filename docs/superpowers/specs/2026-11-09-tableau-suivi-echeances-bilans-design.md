# Tableau de suivi des échéances fiscales et de la production des bilans

**Cabinet** : CPA & ABADIE ASSOCIES
**Commanditaire** : Robin CAPPAROS, expert-comptable, manager
**Date** : 9 novembre 2026
**Statut** : spécification de conception V1, en attente de validation

---

## 1. Contexte et objectifs

Le cabinet suit aujourd'hui ses échéances fiscales et l'avancement des bilans dans un classeur Excel (`TABLEAU DE SUIVI 2026`, onglet « Suivi compta » : 912 lignes, 142 colonnes). L'analyse de ce classeur fait ressortir trois limites :

- **Fiabilité** : nombreuses erreurs de formule (`#VALUE!`, `#REF!`), statuts et dates mélangés dans les mêmes colonnes, saisies hétérogènes (« À faire » et « a faire », « NON » et « NON » suivi d'un espace).
- **Mise à jour** : 697 dossiers sur 725 sont restés à l'étape « 1. Pièces non reçues », ce qui montre que l'avancement n'est plus renseigné.
- **Double saisie** : les dates de dépôt de TVA sont ressaisies à la main alors qu'elles existent déjà dans Pennylane.

**Objectif** : remplacer, pour le périmètre V1, le classeur par une application web hébergée, partagée par les 22 membres du cabinet, dont les statuts fiscaux sont alimentés automatiquement par Pennylane.

### Critères de succès

1. À l'issue du pilote, le classeur n'est plus utilisé pour le suivi de la TVA, des liasses, de l'IS, de l'approbation et du dépôt au greffe, ni pour l'avancement des bilans.
2. Les statuts de TVA et de liasse sont mis à jour sans aucune saisie manuelle.
3. Chaque collaborateur identifie en moins d'une minute ses échéances de la semaine et ses dossiers en retard.
4. Chaque manager voit en un écran les retards de son portefeuille et sa file de supervision.

## 2. Compréhension validée

**Exprimé par le commanditaire**

- Outil développé avec Lovable et hébergé.
- Utilisateurs : 9 collaborateurs CSP, 9 Seniors FR, 3 Managers, 1 Associé.
- Synchronisation des échéances avec Pennylane.
- Le classeur actuel est une source d'inspiration, pas un modèle à reproduire.

**Constaté lors de l'analyse**

- Le connecteur Pennylane donne accès aux 799 dossiers du cabinet (firme n° 693).
- Pour chaque dossier, Pennylane fournit : régime TVA, catégorie et régime fiscal, forme juridique, intervenants (comptable, superviseur comptable, manager), exercices.
- Pour chaque déclaration de TVA : période, date limite, date de dépôt, statut (`accepted`, `accepted_and_paid`), montant.
- Pour chaque liasse : exercice, catégorie fiscale, statut de télétransmission.
- Correspondance des rôles vérifiée sur un dossier : « Référent Maroc » du classeur = « Comptable » Pennylane (CSP) ; « Senior » = « Superviseur comptable » ; « Manager » = « Manager ».
- Pennylane ne liste une déclaration de TVA qu'une fois la période créée : la déclaration d'octobre 2026 d'un dossier mensuel, due le 19 novembre, n'y figurait pas encore.

## 3. Périmètre

### Inclus en V1

1. **Référentiel des dossiers et des affectations**.
2. **Échéances fiscales** : TVA, liasse fiscale, acomptes et solde d'IS, approbation des comptes, dépôt au greffe.
3. **Production des bilans** : circuit en 6 étapes, date cible, alertes de retard.

### Exclus de la V1 (évolutions envisagées)

- CVAE, CFE, DAS2, 2777 / IFU.
- Check-list de révision « Prépa PF » (24 points de contrôle).
- Pilotage de la charge et des écarts de temps par collaborateur.
- Suivi commercial (CIPP, ECF, accompagnement).
- Déclarations personnelles (mission IRPP).

Le modèle de données de la V1 est conçu pour accueillir ces évolutions sans restructuration : une nouvelle échéance est un nouveau type d'échéance et une nouvelle règle de calcul.

## 4. Utilisateurs et rôles

| Rôle | Effectif | Correspondance Pennylane | Usage principal |
|---|---|---|---|
| CSP | 9 | Comptable | Saisie, demande de pièces, suivi de ses échéances |
| Senior FR | 9 | Superviseur comptable | Révision, RDV bilan, échéances de ses dossiers |
| Manager | 3 | Manager | Supervision, pilotage des retards, affectations |
| Associé | 1 | Sans objet | Vision globale, administration |

**Droit administrateur** : indépendant du rôle métier, il donne accès à la gestion des collaborateurs, des paramètres et à l'import. Il est attribué à **Robin CAPPAROS** (Manager) et à l'Associé. Un administrateur peut l'accorder à un autre collaborateur ; l'outil interdit de retirer ce droit au dernier administrateur actif.

**Visibilité ouverte** : tout utilisateur consulte l'ensemble des dossiers ; le filtre « Mes dossiers » est actif par défaut. Les droits de modification dépendent du rôle (section 11).

**Authentification** : Microsoft 365. Seuls les comptes du domaine du cabinet présents dans la table des collaborateurs accèdent à l'outil.

## 5. Architecture

**Approche retenue : tout dans Lovable.**

```
┌──────────────────────────────────────────────────────────────┐
│ Application Lovable (React, TypeScript, Tailwind, shadcn/ui) │
│  Accueil · Échéancier · Production bilans · Fiche · Admin    │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│ Lovable Cloud (Supabase)                                     │
│  · Base PostgreSQL + règles de sécurité par ligne (RLS)      │
│  · Authentification Microsoft 365 (Entra ID)                 │
│  · Tâche planifiée nocturne : génération des échéances       │
│  · Fonction serveur « sync-pennylane » (porte d'entrée)      │
│  · Fonction serveur « dossiers-a-verifier » (lecture)        │
└──────────────▲───────────────────────────────────────────────┘
               │ format normalisé (section 9.2)
     ┌─────────┴──────────────┐
     │                        │
Phase 1 : tâche planifiée   Phase 2 : fonction planifiée
Claude + MCP Pennylane      de l'outil + API Pennylane cabinet
```

Les deux sources de synchronisation utilisent le même contrat d'entrée. Le passage de la phase 1 à la phase 2 ne modifie ni la base, ni les écrans, ni les règles.

## 6. Modèle de données

### 6.1 `collaborateurs`

| Champ | Type | Remarque |
|---|---|---|
| id | uuid | |
| prenom, nom | texte | |
| nom_pennylane | texte | Nom complet tel qu'il apparaît dans Pennylane, sert au rapprochement |
| trigramme | texte, unique | Ex. « AHO » |
| email | texte, unique | Adresse Microsoft 365 |
| role | énuméré | `csp`, `senior`, `manager`, `associe` |
| administrateur | booléen | Droit complémentaire au rôle (section 4) ; vrai pour Robin CAPPAROS et l'Associé à l'initialisation |
| actif | booléen | Un collaborateur inactif ne peut plus se connecter |

### 6.2 `dossiers`

| Champ | Type | Origine |
|---|---|---|
| id | uuid | |
| pennylane_id | entier, unique | Pennylane |
| raison_sociale | texte | Pennylane |
| siren | texte | Classeur à l'import initial, puis Pennylane si fourni |
| forme_juridique | texte | Pennylane |
| regime_tva | énuméré : `mensuel`, `trimestriel`, `annuel`, `non_assujetti` | Pennylane (`vat_frequency`) |
| categorie_fiscale | texte | Pennylane (`fiscal_category`, ex. `bic_is`) |
| regime_fiscal | texte | Pennylane (`fiscal_regime`, ex. `fr_rn`) |
| csp_id, senior_id, manager_id | référence `collaborateurs` | Pennylane (comptable, superviseur, manager) |
| equipe | entier (1, 2, 3) | Outil |
| mission | énuméré : `tenue`, `revision`, `micro_bnc`, `irpp` | Outil |
| statut | énuméré : `actif`, `sorti` | Outil ; un dossier sorti ne génère plus d'échéance |
| jour_echeance_tva | entier (15 à 24) | Outil ; jour d'échéance propre au dossier |
| is_n1_superieur_3000 | booléen | Outil ; conditionne les acomptes d'IS |
| commentaire | texte | Outil |
| derniere_synchro | horodatage | Automatique |

### 6.3 `exercices`

| Champ | Type | Remarque |
|---|---|---|
| id | uuid | |
| dossier_id | référence | |
| date_debut, date_fin | date | Pennylane |
| date_cible | date | Calculée (section 8.3), modifiable par un manager |
| etape_actuelle | entier 0 à 6 | 0 = non commencé |
| date_approbation | date, facultative | Saisie ; sert au calcul du dépôt au greffe |

Unicité : (dossier_id, date_fin).

### 6.4 `historique_etapes`

| Champ | Type |
|---|---|
| id | uuid |
| exercice_id | référence |
| etape | entier 1 à 6 |
| sens | énuméré : `validation`, `retour` |
| date | horodatage |
| auteur_id | référence `collaborateurs`, nul si automatique |
| commentaire | texte, obligatoire pour un retour |

### 6.5 `echeances`

| Champ | Type | Remarque |
|---|---|---|
| id | uuid | |
| dossier_id | référence | |
| exercice_id | référence, facultative | Renseignée pour liasse, IS, approbation, greffe |
| type | énuméré (section 8.1) | |
| periode_debut, periode_fin | date | |
| date_limite | date | Calculée, puis remplacée par la date Pennylane si elle est fournie |
| statut | énuméré : `a_faire`, `depose`, `paye`, `non_applicable` | |
| statut_pennylane | texte | Valeur brute reçue |
| source_statut | énuméré : `pennylane`, `manuel` | |
| date_depot | date | |
| montant | décimal | |
| auteur_id | référence, facultative | Auteur d'une saisie manuelle |

Unicité : (dossier_id, type, periode_debut, periode_fin). Toute écriture se fait par insertion ou mise à jour sur cette clé.

### 6.6 `journal_synchro`

Horodatage de début et de fin, source (`mcp` ou `api`), nature (`fiches` ou `declarations`), nombre de dossiers traités, nombre d'échéances mises à jour, liste des anomalies (type, dossier, message).

### 6.7 `parametres`

- Règles de date cible par mission (section 8.3).
- Calendrier annuel : date limite de la liasse et du solde d'IS pour les clôtures au 31 décembre, par année.
- Jours fériés.
- Formes juridiques soumises à l'approbation et au dépôt au greffe.
- Délai de dépôt au greffe après approbation.

## 7. Écrans

Charte graphique : #0E2A42 pour la navigation, #2784C6 pour les actions et informations mises en avant, #B2B2B1 pour les éléments secondaires ; Century Gothic Gras pour les titres et informations clés, Century Gothic pour le texte. Century Gothic étant une police sous licence Microsoft, elle est déclarée en priorité et complétée par une police de repli visuellement proche.

### 7.1 Accueil « Ma semaine »

- **CSP et Senior** : échéances à 7 et 30 jours, échéances en retard, bilans par étape, dossiers en retard sur leur date cible.
- **Manager et Associé** : mêmes indicateurs consolidés par équipe et par collaborateur, file des dossiers à superviser (étape 3 validée), anomalies de synchronisation.
- Bandeau permanent : « Dernière synchronisation Pennylane : date et heure ».

### 7.2 Échéancier

- Liste filtrable par type, statut, collaborateur, équipe, période ; vue calendrier mensuelle.
- Code couleur : à faire, échéance sous 7 jours, en retard, déposé ou payé, non applicable.
- Échéances à saisie manuelle : action « Marquer déposé » (date de dépôt, montant facultatif) et « Non applicable ».
- Échéances synchronisées : mention « Pennylane », non modifiables.

### 7.3 Production des bilans

- Vue en colonnes par étape (0 à 6). Chaque carte affiche le dossier, la clôture, la date cible, l'intervenant attendu et un indicateur de retard.
- Vue tableau alternative avec les mêmes filtres que l'échéancier.
- Action de validation de l'étape suivante, visible uniquement pour le rôle habilité ; action de retour pour les managers et l'associé.

### 7.4 Fiche dossier

Identité, intervenants, lien vers le dossier Pennylane (`https://app.pennylane.com/companies/{pennylane_id}`), exercice en cours et historique des étapes, échéances du dossier, commentaire.

### 7.5 Administration (Managers pour la consultation, administrateurs pour la modification)

Collaborateurs et rôles, paramètres, journal de synchronisation, import initial du classeur.

### 7.6 Export

Toute liste de l'échéancier et de la production est exportable au format Excel, selon les filtres appliqués.

## 8. Règles métier

### 8.1 Génération des échéances

Une tâche planifiée nocturne génère, pour chaque dossier actif, les échéances des 15 prochains mois. Les règles sont lues dans les paramètres.

| Type | Règle de date limite | Dossiers concernés | Source du statut |
|---|---|---|---|
| `tva_mensuelle` | Mois M+1, au `jour_echeance_tva` | `regime_tva = mensuel` | Pennylane |
| `tva_trimestrielle` | Mois suivant le trimestre, au `jour_echeance_tva` | `regime_tva = trimestriel` | Pennylane |
| `tva_ca12_acompte_juillet` | Juillet, au `jour_echeance_tva` | `regime_tva = annuel` | Pennylane si fourni, sinon manuel |
| `tva_ca12_acompte_decembre` | Décembre, au `jour_echeance_tva` | `regime_tva = annuel` | Pennylane si fourni, sinon manuel |
| `tva_ca12_annuelle` | Clôture au 31/12 : date du calendrier annuel ; autre clôture : clôture + 3 mois | `regime_tva = annuel` | Pennylane |
| `liasse` | Clôture au 31/12 : date du calendrier annuel ; autre clôture : clôture + 3 mois + 15 jours | Tous les dossiers actifs hors missions `irpp` et `micro_bnc` | Pennylane |
| `is_acompte_1` à `is_acompte_4` | 15 mars, 15 juin, 15 septembre, 15 décembre compris dans l'exercice | Catégorie fiscale IS et `is_n1_superieur_3000` | Manuel |
| `is_solde` | Clôture au 31/12 : date du calendrier annuel ; autre clôture : 15 du 4e mois suivant la clôture | Catégorie fiscale IS | Manuel |
| `approbation` | Clôture + 6 mois | Formes juridiques paramétrées comme sociétés | Manuel |
| `depot_greffe` | `date_approbation` (ou, à défaut, date limite d'approbation) + délai paramétré, 2 mois par défaut (dépôt électronique) | Formes juridiques paramétrées comme sociétés commerciales | Manuel |

**Jours non ouvrés** : une date limite tombant un samedi, un dimanche ou un jour férié est reportée au premier jour ouvré suivant.

**Prérequis** : ces règles et le calendrier annuel sont relus et validés par un manager avant la mise en service.

### 8.2 Circuit de production des bilans

| Étape | Libellé | Validée par |
|---|---|---|
| 0 | Non commencé | État initial |
| 1 | Pièces demandées | CSP, Senior, Manager, Associé |
| 2 | Saisie terminée | CSP, Manager, Associé |
| 3 | Révision terminée | Senior, Manager, Associé |
| 4 | Supervision validée | Manager, Associé |
| 5 | Comptes présentés au client (RDV bilan) | Senior, Manager, Associé |
| 6 | Liasse télétransmise | Automatique (liasse Pennylane au statut `accepted`) |

- Les étapes se valident dans l'ordre ; chaque validation est horodatée et attribuée.
- Un manager ou l'associé peut revenir à une étape antérieure, avec un commentaire obligatoire.
- Si la liasse est reçue de Pennylane avant l'étape 5, le dossier passe tout de même à l'étape 6 et une anomalie « étapes non renseignées » est signalée.

### 8.3 Date cible et retards

- **Date cible** : date à laquelle l'étape 4 (supervision) doit être validée. Valeur par défaut : clôture + 3 mois, paramétrable par mission, modifiable dossier par dossier par un manager.
- **Jalons intermédiaires** : étape 2 attendue à date cible − 30 jours, étape 3 à date cible − 15 jours (paramétrables).
- **Retard** : un exercice est en retard dès que la date du jour dépasse le jalon de l'étape attendue sans que celle-ci soit validée.
- **Échéance en retard** : statut `a_faire` et date limite dépassée.

## 9. Synchronisation Pennylane

### 9.1 Principe

Pennylane fait foi pour l'identité des dossiers, les régimes, les intervenants, les exercices et les statuts de TVA et de liasse. L'outil fait foi pour l'équipe, la mission, le statut actif / sorti, la date cible, l'avancement et les échéances à saisie manuelle.

### 9.2 Contrat de la porte d'entrée `sync-pennylane`

- Méthode : `POST`, authentifiée par une clé secrète dans l'en-tête `Authorization: Bearer`.
- Traitement idempotent : un même envoi traité deux fois produit le même état.
- Traitement par lots : au plus 50 dossiers par appel.

```json
{
  "source": "mcp",
  "dossiers": [
    {
      "pennylane_id": 22010195,
      "raison_sociale": "1D RELATIONS MEDIA",
      "forme_juridique": "Société à responsabilité limitée (SARL)",
      "regime_tva": "monthly",
      "categorie_fiscale": "bic_is",
      "regime_fiscal": "fr_rn",
      "comptable": "Hamza AGUERCHAL",
      "superviseur": "Azer HORRIGUE",
      "manager": "Robin CAPPAROS",
      "exercices": [{ "debut": "2026-01-01", "fin": "2026-12-31" }]
    }
  ],
  "declarations_tva": [
    {
      "pennylane_id": 22010195,
      "periode_debut": "2026-09-01",
      "periode_fin": "2026-09-30",
      "date_limite": "2026-10-19",
      "date_depot": "2026-10-19",
      "statut": "accepted",
      "montant": "-1512"
    }
  ],
  "liasses": [
    {
      "pennylane_id": 22010195,
      "periode_debut": "2025-01-01",
      "periode_fin": "2025-12-31",
      "categorie_fiscale": "bic_is",
      "statut": "accepted"
    }
  ]
}
```

Réponse : nombre de dossiers et d'échéances mis à jour, liste des anomalies.

### 9.3 Fonction de lecture `dossiers-a-verifier`

- Méthode : `GET`, même authentification.
- Renvoie les `pennylane_id` des dossiers ayant une échéance TVA ou liasse au statut `a_faire` dont la date limite est comprise entre J − 60 et J + 5.
- Permet à la synchronisation nocturne de n'interroger que les dossiers utiles.

### 9.4 Correspondance des statuts

| Statut Pennylane | Statut outil |
|---|---|
| `accepted` | `depose` |
| `accepted_and_paid` | `paye` |
| Tout autre statut | `a_faire`, valeur brute conservée dans `statut_pennylane` |

Une déclaration de TVA est rattachée à l'échéance de même dossier et de même période. Si aucune échéance ne correspond, elle est créée et une anomalie est signalée.

### 9.5 Phase 1 : tâche planifiée Claude et MCP Pennylane

- **Chaque nuit** : appel de `dossiers-a-verifier`, lecture des déclarations de TVA et des liasses de ces dossiers via le MCP Pennylane, envoi à `sync-pennylane`.
- **Chaque semaine** : lecture des fiches des 799 dossiers (`list_companies` par pages de 100) et des exercices, envoi à `sync-pennylane`.
- La clé secrète de la porte d'entrée est enregistrée comme secret réseau de l'environnement Claude, jamais dans le texte de la tâche.
- Limite assumée : la tâche utilise les droits Pennylane personnels de Robin CAPPAROS et dépend du maintien de la tâche planifiée.

### 9.6 Phase 2 : API Pennylane cabinet

- Prérequis : jeton API cabinet généré par un administrateur Pennylane et vérification que l'API expose les déclarations de TVA et les liasses avec le même niveau de détail que le MCP.
- Une fonction planifiée de l'outil reproduit la logique de la phase 1 et appelle la même porte d'entrée. La tâche Claude est alors désactivée.

### 9.7 Rapprochements

- **Dossiers** : à l'import initial, rapprochement par SIREN entre le classeur et Pennylane ; à défaut, par raison sociale avec validation manuelle dans l'écran d'administration. Ensuite, l'identifiant Pennylane fait foi.
- **Collaborateurs** : par `nom_pennylane`. Un nom inconnu laisse l'affectation vide et génère une anomalie.

## 10. Import initial

Import ponctuel du classeur, exécuté depuis l'écran d'administration :

| Colonne du classeur | Champ de l'outil |
|---|---|
| Siren | `dossiers.siren` (clé de rapprochement) |
| Equipe | `dossiers.equipe` |
| Mission | `dossiers.mission` ; « Sorti » donne `statut = sorti` ; toute autre valeur non prévue (ex. « Social ») est signalée |
| Date d'échéance | `dossiers.jour_echeance_tva` |
| IS N-1>3000 € | `dossiers.is_n1_superieur_3000` |
| Commentaire | `dossiers.commentaire` |
| Onglet « Source listes » : Prénom Nom, Trigramme | `collaborateurs` (rôle attribué ensuite par un administrateur) |

Les valeurs incohérentes (« NON » avec espace, cellules en erreur) sont normalisées ou signalées dans un rapport d'import.

## 11. Droits

| Action | CSP | Senior FR | Manager | Associé | Administrateur |
|---|---|---|---|---|---|
| Consulter dossiers, échéances, avancement | Oui | Oui | Oui | Oui | Oui |
| Valider les étapes | Selon section 8.2 | Selon section 8.2 | Selon section 8.2 | Selon section 8.2 | Selon son rôle |
| Revenir à une étape antérieure | Non | Non | Oui | Oui | Selon son rôle |
| Marquer une échéance manuelle déposée ou non applicable | Dossiers où il est CSP | Dossiers où il est Senior | Oui | Oui | Selon son rôle |
| Modifier équipe, mission, date cible, date d'approbation, jour d'échéance TVA, IS N-1 | Non | Non | Oui | Oui | Oui |
| Consulter l'administration | Non | Non | Oui | Oui | Oui |
| Modifier collaborateurs, rôles et paramètres, lancer l'import, consulter le journal détaillé | Non | Non | Non | Non | Oui |
| Modifier un champ issu de Pennylane | Non | Non | Non | Non | Non |

La colonne « Administrateur » s'ajoute aux droits du rôle : Robin CAPPAROS cumule les droits de Manager et d'administrateur.

Ces droits sont appliqués par des règles de sécurité au niveau de la base de données (RLS), et non uniquement dans l'interface.

## 12. Gestion des erreurs

| Situation | Comportement |
|---|---|
| Échec complet d'une synchronisation | Consigné au journal ; nouvelle tentative la nuit suivante ; bandeau d'alerte si la dernière synchronisation réussie date de plus de 48 heures |
| Erreur sur un dossier | Consignée au journal ; les autres dossiers sont traités |
| Appel à la porte d'entrée sans clé valide | Rejeté (401), consigné |
| Compte Microsoft 365 absent de `collaborateurs` ou inactif | Accès refusé, message invitant à contacter un administrateur |
| Validation d'étape hors ordre ou par un rôle non habilité | Refusée par la base, message explicite |
| Dossier Pennylane absent de l'outil | Créé automatiquement avec `equipe` et `mission` vides, anomalie signalée |

## 13. Tests et recette

1. **Règles de calcul** (tests automatisés) : clôtures au 31/12 et décalées, exercices courts et longs, présence ou absence de l'IS N-1 supérieur à 3 000 €, reports de jours non ouvrés, dossiers sortis.
2. **Synchronisation** (tests automatisés) : idempotence, correspondance des statuts, création d'échéance manquante, passage automatique à l'étape 6, rejet sans clé.
3. **Droits** (tests automatisés) : chaque ligne du tableau de la section 11 testée pour chaque rôle.
4. **Recette métier** : comparaison sur 20 dossiers entre l'outil, Pennylane et le classeur.
5. **Pilote** : un mois avec une équipe, en parallèle du classeur, avant le déploiement aux 22 collaborateurs.

## 14. Prérequis à lever par le cabinet

| Prérequis | Responsable | Bloquant pour |
|---|---|---|
| Enregistrement de l'application dans Microsoft Entra ID (identifiants pour la connexion Microsoft 365) | Robin CAPPAROS (droits administrateur) | Mise en service |
| Liste des 22 collaborateurs avec rôle et adresse e-mail | Robin CAPPAROS | Mise en service |
| Validation des règles de calcul et du calendrier annuel | Robin CAPPAROS ou un autre manager | Mise en service |
| Abonnement Lovable permettant l'hébergement et la base de données | Robin CAPPAROS (droits administrateur) | Démarrage du développement |
| Jeton API Pennylane cabinet | Robin CAPPAROS (droits administrateur) | Phase 2 uniquement |

Robin CAPPAROS disposant des droits administrateur sur Microsoft 365, Lovable et Pennylane, aucun prérequis ne dépend d'un intervenant extérieur au projet.
