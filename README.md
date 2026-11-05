# 🧺 Le petit marché

Le marché de petites annonces de l’école : les familles peuvent y proposer et obtenir des biens personnels dans les catégories **vêtements**, **livres**, **jeux et jouets** et **matériel scolaire**. Les ventes sont occasionnelles, entre particuliers. Les vendeurs professionnels et les annonces commerciales sont exclus.

> [!IMPORTANT]
> **Avant d’ouvrir le marché aux familles :** conformément à l’[ADR-0003](./docs/adr/0003-hebergement-mvp-appwrite-francfort.md), l’APEL doit vérifier les contrats, les sous-traitants et les traitements liés aux courriels système. N’importez aucune adresse réelle et n’ouvrez pas l’inscription tant que cette vérification n’est pas terminée.

## 🧭 Repères

- [Comment fonctionne l’inscription](#inscription)
- [Échanger dans une conversation](#conversations-marche)
- [Configurer Appwrite](#configuration-appwrite)
- [Configurer les annonces et les photos](#configuration-annonces-photos)
- [Développer et tester](#developpement-tests)
- [Vocabulaire du marché](#vocabulaire)

<a id="inscription"></a>
## 🔐 Comment fonctionne l’inscription

```text
Adresse e-mail
    │
    ▼
Fonction Appwrite ── vérifie l’adresse dans la liste privée de l’APEL
    │
    ├── Adresse absente ── refuse l’inscription
    │
    └── Adresse autorisée
          ├── crée un compte avec un mot de passe temporaire aléatoire
          ├── ouvre une session temporaire pour envoyer le lien de vérification
          └── révoque cette session
                    │
                    ▼
       Lien ouvert · secret vérifié · adresse revalidée
                    │
                    ▼
       La famille choisit son mot de passe et se connecte
```

Le navigateur envoie l’adresse à une Appwrite Function publique. Après ouverture du lien, il transmet à la fonction le secret de vérification et le mot de passe choisi. La fonction vérifie le secret, revalide l’adresse dans la liste de l’APEL, puis enregistre le mot de passe. La personne ne peut donc pas choisir son mot de passe avant que la boîte aux lettres autorisée soit vérifiée.

> **Réglages de sécurité Appwrite**
>
> - Désactivez l’inscription autonome : les comptes doivent être créés uniquement par cette fonction.
> - Activez la connexion par e-mail et mot de passe pour les sessions temporaires et la connexion après inscription.
> - Désactivez les méthodes qui créent automatiquement des comptes en dehors du contrôle d’autorisation, notamment Magic URL et les codes e-mail.
> - Une adresse autorisée correspond à un seul compte Appwrite. Une inscription non vérifiée peut demander un nouveau lien.
> - Le compte est individuel et ne doit pas être partagé au sein du foyer. L’interface le rappelle, mais ne peut pas empêcher le partage volontaire d’un mot de passe.

<a id="configuration-appwrite"></a>
## ⚙️ Configurer Appwrite

### 1. Créer le projet

Créez un projet Appwrite Cloud dans la région Frankfurt (`fra`). Le provisionnement enregistre automatiquement comme plateformes Web le hostname de `APPWRITE_SIGNUP_CALLBACK_URL` et `localhost`.

### 2. Configurer les méthodes de connexion

Désactivez l’inscription autonome et les méthodes qui créent automatiquement des comptes, dont Magic URL et les codes e-mail. Activez la connexion par e-mail et mot de passe.

### 3. Créer la liste privée des adresses autorisées

Créez une base de données et une table privée pour les adresses autorisées :

- ajoutez la colonne `email`, de type chaîne et obligatoire ;
- créez un index unique sur `email` ;
- n’accordez aucun accès public aux lignes ;
- importez les adresses en minuscules.

> Ne placez jamais d’adresses de familles dans le code source ni dans ce dépôt.

### 4. Provisionner les Functions Appwrite

Le script `npm run setup --prefix provisioning` crée et déploie automatiquement `create-family-account` et `market-conversations`. Il configure aussi leurs permissions d’exécution, leurs portées serveur, leurs variables et les plateformes Web nécessaires. Il attend que chaque déploiement soit actif.

Pour `create-family-account`, le script reprend `APPWRITE_ALLOWLIST_TABLE_ID` et `APPWRITE_SIGNUP_CALLBACK_URL` depuis la Function déjà présente si ces valeurs ne sont pas renseignées dans `provisioning/.env`. Pour une première installation, ajoutez-les à ce fichier. La table privée des adresses autorisées et ses données restent gérées séparément.

<a id="conversations-marche"></a>
## 💬 Échanger dans une conversation

`market-conversations` est réservé aux utilisateurs connectés. Le provisionnement configure ses portées serveur (`databases.read`, `documents.read`, `documents.write`, `users.read`) et les variables Appwrite nécessaires. La Function vérifie l’annonce et l’identité de l’appelant, puis crée les demandes et messages avec un accès de lecture réservé aux deux familles participantes.

<a id="configuration-annonces-photos"></a>
## 🗂️ Provisionner les annonces, les demandes, les conversations et les photos

Les ressources du marché et ses deux Functions se provisionnent depuis le répertoire isolé [`provisioning/`](./provisioning/), à l’écart du code de l’application. Le script utilise le Server SDK Appwrite, crée les ressources manquantes, ajoute les attributs facultatifs attendus et déploie les sources présentes dans `functions/`. Il migre également l’ancienne permission de création de `requests` vers une collection sans permission générale, sans modifier les ACL des documents existants. Si le schéma ou les permissions d’une autre ressource sont incompatibles, il s’arrête explicitement. Consultez le [guide détaillé du provisionnement](./provisioning/README.md).

```sh
cp provisioning/.env.example provisioning/.env
# Renseigner les valeurs ci-dessous dans provisioning/.env
npm install --prefix provisioning
npm run setup --prefix provisioning
```

`provisioning/.env` est ignoré par Git. Créez une clé API Appwrite temporaire avec les portées de lecture/écriture sur les bases, collections, attributs, index et buckets, ainsi que `functions.read`, `functions.write`, `platforms.read` et `platforms.write`. Le script a besoin des deux portées `platforms.*` pour vérifier et enregistrer les plateformes Web. Ce sont les seuls droits Appwrite à ajouter manuellement ; le script configure les droits d’exécution et les portées serveur des deux Functions. Ne mettez jamais cette clé dans `.env.local`, dans une variable `VITE_` ou dans le dépôt.

| Variable | Valeur |
| --- | --- |
| `APPWRITE_ENDPOINT` | Endpoint du projet, par défaut `https://fra.cloud.appwrite.io/v1` |
| `APPWRITE_PROJECT_ID` | Identifiant du projet Appwrite |
| `APPWRITE_API_KEY` | Clé de provisionnement secrète à durée de vie limitée |
| `APPWRITE_DATABASE_ID` | Identifiant de la base à créer ou réutiliser |
| `APPWRITE_LISTINGS_COLLECTION_ID` | Identifiant de la collection, prérempli à `listings` dans l’exemple |
| `APPWRITE_REQUESTS_COLLECTION_ID` | Identifiant de la collection des demandes, prérempli à `requests` dans l’exemple |
| `APPWRITE_MESSAGES_COLLECTION_ID` | Identifiant de la collection des messages, prérempli à `messages` dans l’exemple |
| `APPWRITE_LISTING_PHOTOS_BUCKET_ID` | Identifiant du bucket, prérempli à `listing-photos` dans l’exemple |

Les collections `requests` et `messages` sont sécurisées par document et n’accordent aucune permission au niveau collection. La Function crée chaque document avec un accès en lecture réservé aux deux familles participantes ; les modifications et l’envoi de messages passent par cette Function.

Le script crée la base si elle n’existe pas, puis la collection `listings` avec la **sécurité des documents activée** et le bucket `listing-photos` avec la **sécurité des fichiers activée**. Il configure la lecture et la création pour les utilisateurs connectés ; l’application donne ensuite les droits de mise à jour et de suppression au propriétaire de chaque annonce et de chaque photo. Si la base est déjà utilisée pour la liste privée d’adresses autorisées, renseignez exactement le même `APPWRITE_DATABASE_ID` que celui configuré dans la fonction d’inscription.

### Schéma de la collection `listings`

| Attribut | Type et limite | Requis |
| --- | --- | :---: |
| `title` | Chaîne, 70 caractères | Oui |
| `description` | Chaîne, 500 caractères | Oui |
| `category` | Chaîne, 30 caractères | Oui |
| `condition` | Chaîne, 20 caractères | Oui |
| `ageGroups` | Tableau d’entiers | Oui |
| `sizes` | Tableau de chaînes | Oui |
| `color` | Chaîne, 20 caractères | Oui |
| `brand` | Chaîne, 70 caractères | Oui |
| `price` | Entier | Oui |
| `photoIds` | Tableau de chaînes | Oui |
| `subcategory` | Chaîne, 30 caractères | Non |
| `shoeSize` | Entier | Non |
| `author` | Chaîne, 70 caractères | Non |
| `language` | Chaîne, 40 caractères | Non |
| `sellerId` | Chaîne, 36 caractères | Non |
| `sellerInitials` | Chaîne, 20 caractères | Non |

Le formulaire envoie toujours `description` et `brand`. Si leur valeur est facultative et omise, il envoie une chaîne vide afin que les attributs requis soient présents. `sellerId` identifie le compte vendeur pour limiter l’accès à ses demandes; le provisionnement ajoute cet attribut facultatif aux collections `listings` existantes. `sellerInitials` contient les initiales extraites de la partie locale de l’adresse e-mail du vendeur, sans enregistrer ni afficher son adresse complète. `subcategory` stocke le genre ou le type pour toutes les catégories; les listes sont regroupées par famille et triées alphabétiquement à l’intérieur de chaque groupe, avec « Autre » en dernier. Pour les types de chaussures, les âges sélectionnés limitent les pointures proposées; la pointure choisie est obligatoire et enregistrée dans `shoeSize`. Les autres vêtements conservent les équivalences de taille en centimètres. Les plages contiguës sont regroupées pour une lecture plus rapide dans les annonces. Les classes du matériel scolaire sont calculées à partir des âges et ne sont pas saisies ni enregistrées séparément.

### Schéma de la collection `requests`

| Attribut | Type et limite | Requis |
| --- | --- | :---: |
| `listingId` | Chaîne, 36 caractères | Oui |
| `listingTitle` | Chaîne, 70 caractères | Oui |
| `listingPrice` | Entier | Oui |
| `listingPhotoId` | Chaîne, 36 caractères | Non |
| `sellerInitials` | Chaîne, 20 caractères | Non |
| `buyerInitials` | Chaîne, 20 caractères | Non |
| `buyerId` | Chaîne, 36 caractères | Oui |
| `sellerId` | Chaîne, 36 caractères | Oui |
| `type` | Chaîne, 20 caractères (`offer` ou `donation`) | Oui |
| `amount` | Entier (0 pour une demande de don) | Oui |
| `status` | Chaîne, 20 caractères (`pending`, `accepted` ou `rejected`) | Oui |
| `lastMessage` | Chaîne, 1 000 caractères | Non |

Les demandes sont lues uniquement par les deux familles participantes. Les index `by_buyer` et `by_seller` alimentent respectivement « Mes achats » et « Mes ventes ».

### Schéma de la collection `messages`

| Attribut | Type et limite | Requis |
| --- | --- | :---: |
| `requestId` | Chaîne, 36 caractères | Oui |
| `senderId` | Chaîne, 36 caractères | Oui |
| `content` | Chaîne, 1 000 caractères | Oui |

Chaque message est lié à une demande de la conversation ; l’index `by_request` permet de charger le fil dans l’ordre chronologique. L’accès en lecture de chaque message est limité à l’acheteur et au vendeur concernés.

Pour les livres, la langue se choisit parmi Français, Anglais, Espagnol, Allemand, Italien, Bilingue et Autre. Le choix « Autre » requiert une précision dans la description.

Les champs des annonces et les photos sont accessibles aux familles connectées qui consultent le marché.

### Variables publiques du navigateur

Les identifiants Appwrite de la base, de la collection, du bucket et de la fonction sont des paramètres publics, pas des secrets. Le navigateur a besoin des variables suivantes dans `.env.local` :

| Variable | Valeur |
| --- | --- |
| `VITE_APPWRITE_ENDPOINT` | Endpoint Appwrite ; Frankfurt par défaut (`https://fra.cloud.appwrite.io/v1`) |
| `VITE_APPWRITE_PROJECT_ID` | Identifiant du projet |
| `VITE_APPWRITE_SIGNUP_FUNCTION_ID` | Identifiant de la fonction `create-family-account` |
| `VITE_APPWRITE_MARKET_FUNCTION_ID` | Identifiant de la fonction `market-conversations` |
| `VITE_APPWRITE_DATABASE_ID` | Même identifiant de base que `APPWRITE_DATABASE_ID` |
| `VITE_APPWRITE_LISTINGS_COLLECTION_ID` | Identifiant de la collection `listings` |
| `VITE_APPWRITE_REQUESTS_COLLECTION_ID` | Identifiant de la collection des demandes `requests` |
| `VITE_APPWRITE_MESSAGES_COLLECTION_ID` | Identifiant de la collection des messages `messages` |
| `VITE_APPWRITE_LISTING_PHOTOS_BUCKET_ID` | Identifiant du bucket `listing-photos` |

<a id="developpement-tests"></a>
## 🧪 Développer et tester

```sh
npm install
cp .env.example .env.local
# Renseigner les identifiants Appwrite publics dans .env.local
npm run dev
```

| Commande | Vérification |
| --- | --- |
| `npm test` | Tests des fonctions, de la liste d’adresses autorisées et du schéma de provisionnement |
| `npm run test:e2e` | Parcours navigateur des annonces et des conversations acheteur-vendeur, avec Appwrite simulé |
| `npm run test:e2e:config` | Affichage de la configuration manquante et masquage du bouton de nouvel essai inutile |
| `npm run build` | Compilation de production |

Le test navigateur nécessite une installation initiale de Chromium :

```sh
npx playwright install chromium
```

La GitHub Actions **CI** exécute ces tests ainsi que le build sur chaque pull request et chaque push sur `main`. Les appels Appwrite des tests e2e sont simulés : aucun secret Appwrite n’est requis dans les secrets GitHub.

### Vérifications avant l’ouverture aux familles

1. Importez une **liste de test**, jamais une liste réelle avant la vérification de conformité.
2. Vérifiez qu’une adresse absente de la liste est refusée.
3. Confirmez la réception et l’utilisation du lien de vérification.
4. Vérifiez qu’une seconde création avec la même adresse est refusée.

<a id="vocabulaire"></a>
## 📖 Vocabulaire du marché

| Terme | Définition |
| --- | --- |
| **Famille** | Famille de la communauté scolaire qui utilise le marché. |
| **Adresse autorisée** | Adresse e-mail inscrite par l’APEL comme pouvant accéder au marché. |
| **Compte personnel** | Compte individuel associé à une adresse autorisée, utilisé par une personne et non partagé avec les autres membres du foyer. Un changement d’adresse crée un nouveau compte. |
| **Annonce** | Proposition d’un objet à prix affiché ou donné. Une annonce peut être disponible, en pause, réservée, vendue ou retirée. |
| **Catégorie d’annonce** | Classe l’objet parmi les vêtements, livres, jeux et jouets ou le matériel scolaire. |
| **État de l’objet** | Description normalisée choisie parmi Neuf, Très bon état, Bon état, Satisfaisant, À réparer ou Autre ; avec Autre, la famille précise l’état dans la description. |
| **Conversation privée** | Échange entre deux familles pour poser des questions ou organiser la remise d’un objet. Elle ne constitue pas une demande d’achat et ne change pas la disponibilité de l’annonce. |
| **Demande d’achat** | Demande par laquelle une famille indique vouloir acheter l’objet au prix affiché. Le vendeur doit l’accepter pour réserver l’annonce. |
| **Offre de prix** | Proposition d’un acheteur inférieure au prix affiché. Le vendeur peut l’accepter, la refuser ou proposer un contre-montant. |
| **Demande de don** | Demande d’une famille pour recevoir un objet gratuit. Le vendeur peut l’accepter ou la refuser. |
| **Annonce disponible** | Annonce visible et ouverte aux nouvelles demandes. |
| **Annonce en pause** | Annonce masquée à la demande du vendeur, qui peut la rendre disponible à nouveau. |
| **Annonce retirée** | Annonce supprimée du marché par le vendeur avant l’échange. Elle ne peut pas être restaurée et reste consultable en lecture seule dans son historique privé. |
| **Réservation** | Période pendant laquelle une annonce est masquée après un accord sur le prix dans l’application ou après acceptation d’une demande de don. Elle ne conclut pas la vente et n’oblige pas les familles à la réaliser : elles conviennent ensuite d’un rendez-vous et effectuent l’échange hors application. Le vendeur termine la réservation en marquant l’objet vendu ou en rendant l’annonce disponible si la vente n’a pas lieu. Sans action du vendeur, l’annonce reste réservée et masquée. |
| **Annonce vendue** | Annonce que le vendeur marque comme terminée après l’échange. Elle disparaît du marché, ne peut pas être rendue disponible à nouveau et reste consultable en lecture seule dans l’historique privé du vendeur. |
| **Récapitulatif quotidien** | Courriel facultatif signalant les événements personnels et les nouvelles annonces disponibles, sans inclure le contenu privé des messages ou des offres. |
