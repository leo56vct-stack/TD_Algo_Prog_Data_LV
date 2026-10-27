# Gestion des présences aux entraînements de triathlon

## Présentation

Cette application web permet aux adhérents d'un club de triathlon d'indiquer s'ils participeront aux entraînements. Les entraîneurs peuvent consulter les réponses afin d'estimer le nombre d'athlètes présents à chaque séance et d'adapter son organisation.

Le projet est réalisé dans le cadre d'un travail scolaire.

Les adhérents accèdent à l'application grâce à un lien partagé dans le groupe WhatsApp du club.

## Objectifs

- Centraliser les informations sur les entraînements de la semaine.
- Permettre à chaque adhérent de confirmer ou de décliner sa présence.
- Donner aux entraîneurs une vue fiable du nombre de participants par séance.
- Simplifier le suivi des présences au fil des semaines.

## Utilisateurs et fonctionnalités

### Adhérent

- Recevoir automatiquement un e-mail après validation de sa licence, puis activer son compte.
- Se connecter depuis le lien partagé dans le groupe WhatsApp avec son adresse e-mail et son mot de passe.
- Consulter les entraînements à venir.
- Indiquer sa présence ou son absence à une séance.
- Modifier sa réponse jusqu'à 24 heures avant le début de la séance.

### Entraîneur

- Accéder aux fonctionnalités réservées aux entraîneurs.
- Consulter les réponses pour chaque entraînement.
- Voir le nombre de présences confirmées et la liste des participants.
- Ajouter simplement les entraînements de la semaine en début de semaine.
- Modifier ou supprimer un entraînement si nécessaire.

## Règles de gestion

- Un adhérent ne peut avoir qu'une seule réponse par entraînement.
- L'adhérent peut modifier sa réponse jusqu'à 24 heures avant le début de l'entraînement.
- À partir de cette échéance, les réponses sont figées.
- Un adhérent sans réponse à l'échéance est comptabilisé comme absent.
- Une absence de réponse ne compte jamais comme une présence confirmée.

## Technologies

- **Front-end :** React
- **Back-end :** Node.js avec Express.js
- **Base de données :** PostgreSQL
- **Envoi d'e-mails :** Gmail via SMTP

## Architecture envisagée

L'application est organisée en deux parties :

- Le front-end React affiche les entraînements et permet aux utilisateurs de gérer leurs réponses.
- Le back-end Node.js et Express.js expose une API pour gérer les adhérents, les entraînements et les présences.
- PostgreSQL stocke les adhérents, les entraînements et leurs réponses.

## Données principales

- **Adhérent :** informations nécessaires pour identifier un membre du club.
- **Entraînement :** date, horaire, discipline et informations pratiques.
- **Réponse :** adhérent, entraînement et statut de présence. Une contrainte garantit une seule réponse par adhérent et par entraînement.

## Comptes et accès

Le lien partagé dans WhatsApp est commun à tous les adhérents. Lorsqu'une licence est validée, le club crée le compte de l'adhérent et l'application envoie automatiquement un e-mail à l'adresse enregistrée. Cet e-mail contient l'adresse de connexion et un lien personnel sécurisé permettant à l'adhérent de choisir son mot de passe. Aucun mot de passe n'est envoyé en clair par e-mail. L'inscription publique n'est pas prévue. Une procédure de réinitialisation du mot de passe par e-mail est prévue. Les entraîneurs disposent d'un accès leur permettant de gérer les entraînements.

Les identifiants Gmail utilisés par le serveur seront configurés dans des variables d'environnement et ne seront jamais enregistrés dans le code source.

## API disponible

Les routes privées nécessitent un jeton Bearer obtenu après connexion.

| Méthode | Route | Accès | Fonction |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Public | Ouvrir une session |
| `POST` | `/api/auth/activate` | Public | Activer un compte avec le lien reçu par e-mail |
| `POST` | `/api/auth/password-reset` | Public | Demander un lien de réinitialisation |
| `POST` | `/api/auth/password-reset/complete` | Public | Choisir un nouveau mot de passe |
| `GET` | `/api/me` | Utilisateur connecté | Consulter son profil |
| `POST` | `/api/members` | Entraîneur, administration | Créer un compte adhérent et envoyer son invitation |
| `GET` | `/api/trainings` | Utilisateur connecté | Consulter les entraînements |
| `POST` | `/api/trainings` | Entraîneur, administration | Ajouter un entraînement |
| `PUT` / `DELETE` | `/api/trainings/:id` | Entraîneur, administration | Modifier ou supprimer un entraînement |
| `PUT` | `/api/trainings/:id/attendance` | Adhérent | Créer ou modifier sa réponse avant l'échéance |
| `GET` | `/api/trainings/:id/attendance` | Entraîneur, administration | Consulter les réponses et les effectifs |

## Lancement de l'API

Prérequis : Node.js 20 ou supérieur et une base PostgreSQL accessible.

1. Créer une base PostgreSQL nommée `triathlon_attendance`.
2. Dans le dossier `backend`, copier `.env.example` vers `.env` et renseigner la connexion PostgreSQL, une clé secrète JWT, les paramètres SMTP Gmail et les informations du premier compte administrateur.
3. Installer les dépendances avec `npm install`.
4. Créer le premier compte administrateur avec `npm run create-admin`.
5. Démarrer l'API avec `npm run dev`.

L'API est alors disponible sur `http://localhost:3000`. Le schéma PostgreSQL est créé au démarrage. Pour lancer les tests automatisés, exécuter `npm test` dans `backend` ; ils utilisent PostgreSQL en mémoire et n'envoient pas de vrais e-mails.

## Lancement du front-end

Dans un autre terminal, depuis le dossier `frontend`, installer les dépendances avec `npm install`, puis démarrer le serveur avec `npm run dev`. Le front-end est disponible sur `http://localhost:5173` et transmet ses appels `/api` au serveur Express sur le port 3000.

Pour tester l'application complète, PostgreSQL et l'API doivent être démarrés. Les courriels d'invitation nécessitent également les paramètres Gmail configurés dans `backend/.env`.

## Pistes d'évolution

- Filtrer les entraînements par discipline ou par groupe.
- Consulter l'historique des présences.
