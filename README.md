# 🧺 Le petit marché

Le marché de petites annonces de l’école : les familles peuvent y proposer et obtenir des biens personnels dans les catégories **vêtements**, **livres**, **jeux et jouets** et **matériel scolaire**. Les ventes sont occasionnelles, entre particuliers. Les vendeurs professionnels et les annonces commerciales sont exclus.

> [!IMPORTANT]
> **Avant d’ouvrir le marché aux familles :** conformément à l’[ADR-0003](./docs/adr/0003-hebergement-mvp-appwrite-francfort.md), l’APEL doit vérifier les contrats, les sous-traitants et les traitements liés aux courriels système. N’importez aucune adresse réelle et n’ouvrez pas l’inscription tant que cette vérification n’est pas terminée.

## 🧭 Repères

- [Comment fonctionne l’inscription](#inscription)
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

### 1. Créer le projet et enregistrer les plateformes Web

Créez un projet Appwrite Cloud dans la région Frankfurt (`fra`). Dans la console, ouvrez **Overview → Integrations → Add platform → Web App**. Dans le champ **Hostname**, ajoutez le domaine de production et `localhost` pour le développement. Saisissez le hostname sans `https://`, sans port et sans chemin, par exemple `brocante-esmj.appwrite.network` et `localhost`.

### 2. Configurer les méthodes de connexion

Désactivez l’inscription autonome et les méthodes qui créent automatiquement des comptes, dont Magic URL et les codes e-mail. Activez la connexion par e-mail et mot de passe.

### 3. Créer la liste privée des adresses autorisées

Créez une base de données et une table privée pour les adresses autorisées :

- ajoutez la colonne `email`, de type chaîne et obligatoire ;
- créez un index unique sur `email` ;
- n’accordez aucun accès public aux lignes ;
- importez les adresses en minuscules.

> Ne placez jamais d’adresses de familles dans le code source ni dans ce dépôt.

### 4. Déployer la fonction de création de compte

Créez une fonction **Node.js 22** nommée `create-family-account`, avec cette configuration :

| Réglage | Valeur |
| --- | --- |
| Répertoire racine | `functions/create-family-account` |
| Point d’entrée | `src/main.js` |
| Commande de construction | `npm install` |

Dans **Functions → `create-family-account` → Security → Permissions**, autorisez **All guests** afin que les visiteurs non connectés puissent appeler la fonction. Elle vérifie elle-même l’autorisation pour chaque action. **Après toute modification de cette permission, redéployez la fonction** pour appliquer le changement au déploiement actif.

### 5. Limiter les portées et configurer la fonction

Limitez les portées de la clé éphémère aux permissions suivantes :

| Portée | Utilisation |
| --- | --- |
| `rows.read` | Lire les lignes de la liste d’adresses autorisées |
| `users.read` | Vérifier les comptes |
| `users.write` | Créer et mettre à jour les comptes |

Configurez ces variables dans la fonction :

| Variable | Description |
| --- | --- |
| `APPWRITE_DATABASE_ID` | Identifiant de la base de données |
| `APPWRITE_ALLOWLIST_TABLE_ID` | Identifiant de la table privée des adresses autorisées |
| `APPWRITE_SIGNUP_CALLBACK_URL` | URL complète du site de retour, par exemple `https://brocante-esmj.appwrite.network/` |
| `APPWRITE_FUNCTION_API_ENDPOINT` | Fournie par Appwrite |
| `APPWRITE_FUNCTION_PROJECT_ID` | Fournie par Appwrite |
| `APPWRITE_FUNCTION_API_KEY` | Fournie par Appwrite |

Le hostname de `APPWRITE_SIGNUP_CALLBACK_URL` (par exemple `brocante-esmj.appwrite.network`) doit être enregistré comme plateforme Web à l’étape 1 **dans le même projet Appwrite que la fonction**. Sans cela, Appwrite rejettera le lien de vérification.

<a id="configuration-annonces-photos"></a>
## 🗂️ Provisionner les annonces et les photos

Les ressources du marché se créent depuis le répertoire isolé [`provisioning/`](./provisioning/), à l’écart du code de l’application. Le script utilise le Server SDK Appwrite, crée les ressources manquantes et ajoute les attributs facultatifs de catégorie manquants aux collections `listings` existantes. Si une ressource existante a un schéma incompatible ou des permissions incorrectes, il s’arrête avec une erreur plutôt que de la modifier ou supprimer. Consultez le [guide détaillé du provisionnement](./provisioning/README.md) pour créer la clé API et configurer l’outil.

```sh
cp provisioning/.env.example provisioning/.env
# Renseigner les valeurs ci-dessous dans provisioning/.env
npm install --prefix provisioning
npm run setup --prefix provisioning
```

`provisioning/.env` est ignoré par Git. Créez une clé API Appwrite temporaire avec les portées de lecture et d’écriture nécessaires sur les bases, collections, attributs et buckets ; ne mettez jamais cette clé dans `.env.local`, dans une variable `VITE_` ou dans le dépôt.

| Variable | Valeur |
| --- | --- |
| `APPWRITE_ENDPOINT` | Endpoint du projet, par défaut `https://fra.cloud.appwrite.io/v1` |
| `APPWRITE_PROJECT_ID` | Identifiant du projet Appwrite |
| `APPWRITE_API_KEY` | Clé de provisionnement secrète à durée de vie limitée |
| `APPWRITE_DATABASE_ID` | Identifiant de la base à créer ou réutiliser |
| `APPWRITE_LISTINGS_COLLECTION_ID` | Identifiant de la collection, prérempli à `listings` dans l’exemple |
| `APPWRITE_LISTING_PHOTOS_BUCKET_ID` | Identifiant du bucket, prérempli à `listing-photos` dans l’exemple |

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
| `author` | Chaîne, 70 caractères | Non |
| `language` | Chaîne, 40 caractères | Non |

Le formulaire envoie toujours `description` et `brand`. Si leur valeur est facultative et omise, il envoie une chaîne vide afin que les attributs requis soient présents. `subcategory` stocke le genre ou le type pour les livres, jeux et jouets et matériel scolaire ; les classes du matériel scolaire sont calculées à partir des âges et ne sont pas saisies ni enregistrées séparément.

Les champs des annonces et les photos sont accessibles aux familles connectées qui consultent le marché.

### Variables publiques du navigateur

Les identifiants Appwrite de la base, de la collection, du bucket et de la fonction sont des paramètres publics, pas des secrets. Le navigateur a besoin des variables suivantes dans `.env.local` :

| Variable | Valeur |
| --- | --- |
| `VITE_APPWRITE_ENDPOINT` | Endpoint Appwrite ; Frankfurt par défaut (`https://fra.cloud.appwrite.io/v1`) |
| `VITE_APPWRITE_PROJECT_ID` | Identifiant du projet |
| `VITE_APPWRITE_SIGNUP_FUNCTION_ID` | Identifiant de la fonction `create-family-account` |
| `VITE_APPWRITE_DATABASE_ID` | Même identifiant de base que `APPWRITE_DATABASE_ID` |
| `VITE_APPWRITE_LISTINGS_COLLECTION_ID` | Identifiant de la collection `listings` |
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
| `npm test` | Tests d’inscription, de la liste d’adresses autorisées et du schéma de provisionnement |
| `npm run test:e2e` | Parcours navigateur complet des annonces, avec Appwrite simulé |
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
| **État de l’objet** | Description normalisée choisie parmi Neuf, Très bon, Bon, Satisfaisant ou À réparer. |
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
