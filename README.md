# Présences — Triathlé Vannes Agglo

## Présentation

Cette application web permet aux adhérents du Triathlé Vannes Agglo d'indiquer leur participation aux entraînements et aux compétitions. Pour une course, plusieurs adhérents peuvent s'inscrire au même événement. Les entraîneurs consultent les participants et les effectifs par rendez-vous.

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
- Consulter les entraînements et compétitions à venir.
- Confirmer ou décliner sa participation à chaque événement.
- S'inscrire à une compétition avec les autres adhérents intéressés.
- Modifier sa réponse jusqu'à 24 heures avant l'événement.

### Entraîneur

- Accéder aux fonctionnalités réservées aux entraîneurs.
- Consulter les effectifs et les participants de chaque entraînement ou compétition.
- Ajouter les entraînements de la semaine et publier les courses auxquelles le club souhaite participer.
- Modifier ou supprimer un événement si nécessaire.

## Règles de gestion

- Un adhérent ne peut avoir qu'une seule réponse par événement, entraînement ou compétition.
- Plusieurs adhérents peuvent répondre à la même compétition ; l'entraîneur voit la liste du groupe inscrit.
- L'adhérent peut modifier sa réponse jusqu'à 24 heures avant le début de l'événement.
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

- Le front-end React affiche les entraînements et compétitions et permet aux adhérents de gérer leurs réponses.
- Le back-end Node.js et Express.js expose une API pour gérer les adhérents, les événements et les participations.
- PostgreSQL stocke les adhérents, les événements typés (`training` ou `competition`) et les réponses individuelles.

## Données principales

- **Adhérent :** informations nécessaires pour identifier un membre du club.
- **Événement :** type, nom de la séance ou de la course, date, discipline, lieu et informations pratiques.
- **Réponse :** adhérent, événement et statut de participation. Une contrainte garantit une réponse par adhérent et par événement.

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
| `POST` | `/api/trainings` | Entraîneur, administration | Ajouter un entraînement (`kind: training`) ou une compétition (`kind: competition`) |
| `PUT` / `DELETE` | `/api/trainings/:id` | Entraîneur, administration | Modifier ou supprimer un événement |
| `PUT` | `/api/trainings/:id/attendance` | Adhérent | S'inscrire/se désinscrire d'un événement avant l'échéance |
| `GET` | `/api/trainings/:id/attendance` | Entraîneur, administration | Consulter les inscrits et les effectifs de l'événement |

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

## Déploiement de la démonstration du cours

Le projet est référencé dans la galerie de la promotion sous l'identifiant `P20`. Le serveur du cours partage son origine entre plusieurs applications : cette version utilise donc uniquement des comptes et des données fictifs. Ne pas y importer de vrais adhérents, adresses e-mail ou présences du club.

Les fichiers `Dockerfile`, `.dockerignore`, `.github/workflows/publish.yml` et `deploy/request.py` préparent la construction et le déploiement selon le kit étudiant. L'image Docker sert le front React et l'API Express sur le port 3000. Le chemin Vite est injecté au build par `IHME_BASE_PATH`.

Après réception du dossier privé remis par l'enseignant, configurer dans **Settings > Secrets and variables > Actions** du dépôt GitHub :

- Secret `IHME_DEPLOY_TOKEN` : jeton de déploiement individuel fourni par l'enseignant.
- Variable `IHME_DEPLOY_URL` : URL de déploiement complète fournie par l'enseignant, se terminant par `/__deploy/p20`.
- Variable `IHME_BASE_PATH` : chemin de l'application, normalement `/presences-aux-seances-de-triathlon/`.

Ne jamais commiter ni partager le jeton, et ne pas reprendre les identifiants d'un autre projet. Après un push sur `main`, GitHub Actions construit et publie l'image dans GHCR sans changer automatiquement le site. Pour déployer, ouvrir **Actions > Construire et publier l’image > Run workflow**, sélectionner `main`, cocher **Déployer cette version après construction**, puis lancer le workflow.

Les identifiants de démonstration sont affichés sur la page de connexion lorsque le mode de cours est activé :

- Adhérent : `membre.demo@example.invalid` / `TriathlonDemo2026!`
- Entraîneur : `coach.demo@example.invalid` / `CoachDemo2026!`

Pour une première construction locale, Docker Desktop doit être démarré. Depuis la racine du dépôt :

```powershell
docker build --platform linux/amd64 --build-arg BASE_PATH=/presences-aux-seances-de-triathlon/ -t triathlon-presences:local .
```

Le dépôt étudiant fournit une démonstration, pas l'hébergement de production du club. Avant tout usage réel, il faudra un hébergement isolé approuvé et une configuration distincte pour les comptes, la base de données et Gmail.

## Pistes d'évolution

- Filtrer les entraînements par discipline ou par groupe.
- Consulter l'historique des présences.
