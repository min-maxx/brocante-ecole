# Provisionner les ressources Appwrite

Ce répertoire crée et vérifie les ressources dont le marché a besoin :

- la base de données DocumentsDB ;
- la collection `listings` avec ses attributs et permissions ;
- la collection `requests` avec ses attributs et ses index acheteur/vendeur ;
- la collection `messages` avec ses attributs, son index par conversation et ses permissions privées ;
- le bucket Storage `listing-photos` avec ses permissions.

Le script ne crée pas la table privée des adresses autorisées ni les fonctions `create-family-account` et `market-conversations`. Il n’importe aucune donnée familiale. Les ressources existantes sont conservées ; le script ajoute les attributs facultatifs attendus qui manquent dans `listings` et `requests`, dont `sellerId`, `buyerInitials` et `lastMessage`. Il retire également l’ancienne permission générale de création de `requests` quand elle correspond exactement à la configuration précédente. Les permissions des documents existants ne sont pas modifiées. Si un schéma ou une permission est inattendu, le script s’arrête explicitement.

## Prérequis

- Node.js 22 ou plus récent ;
- accès au projet Appwrite Cloud dans la région Frankfurt (`fra`) ;
- une clé API de provisionnement créée pour ce projet.

## Créer une clé API Appwrite

1. Connectez-vous à [Appwrite Cloud](https://cloud.appwrite.io/) et ouvrez le projet de l’application.
2. Dans la navigation du projet, ouvrez **API Keys**, puis cliquez sur **Create API key**.
3. Donnez-lui un nom explicite, par exemple `marketplace-provisioning-local`.
4. Choisissez une durée d’expiration courte : la clé n’est nécessaire que pour préparer les ressources.
5. Cochez uniquement les portées requises par le script :

   | Portée | Pourquoi le script en a besoin |
   | --- | --- |
   | `databases.read` | Vérifier si la base existe déjà |
   | `databases.write` | Créer la base si nécessaire |
   | `collections.read` | Vérifier la collection existante |
   | `collections.write` | Créer la collection |
   | `attributes.read` | Vérifier les attributs de la collection existante |
   | `attributes.write` | Créer les attributs de la collection |
   | `indexes.read` | Vérifier l’index de recherche des demandes |
   | `indexes.write` | Créer l’index de recherche des demandes |
   | `buckets.read` | Vérifier si le bucket existe déjà |
   | `buckets.write` | Créer le bucket |

6. Créez la clé et copiez sa valeur immédiatement. Appwrite ne l’affiche pas comme un identifiant public : c’est un secret.

Si la console affiche les portées regroupées par service plutôt que sous ces noms exacts, sélectionnez les autorisations de lecture et d’écriture correspondantes pour les bases de données, collections, attributs et buckets. N’ajoutez pas de portées pour les utilisateurs, les fonctions ou les fichiers : ce script n’en a pas besoin.

> **La clé est un secret de serveur.** Ne la mettez jamais dans `src/`, dans `.env.local`, dans une variable `VITE_`, dans un commit ou dans un message. Le dépôt ignore `provisioning/.env`; seul le modèle sans secret `provisioning/.env.example` est versionné. Après le provisionnement, supprimez la clé dans **API Keys** ou laissez-la expirer.

Pour les détails de l’interface et des portées, consultez la [documentation officielle des clés API Appwrite](https://appwrite.io/docs/partners/project/api-keys).

## Configurer le provisionnement

Depuis la racine du dépôt, copiez le modèle local :

```sh
cp provisioning/.env.example provisioning/.env
```

Complétez `provisioning/.env` :

| Variable | Valeur |
| --- | --- |
| `APPWRITE_ENDPOINT` | Endpoint du projet, par exemple `https://fra.cloud.appwrite.io/v1` |
| `APPWRITE_PROJECT_ID` | Identifiant du projet Appwrite ; il peut correspondre à `VITE_APPWRITE_PROJECT_ID` |
| `APPWRITE_API_KEY` | La clé secrète créée à l’étape précédente |
| `APPWRITE_DATABASE_ID` | Identifiant à utiliser pour la base du marché |
| `APPWRITE_LISTINGS_COLLECTION_ID` | Identifiant de la collection ; le modèle propose `listings` |
| `APPWRITE_REQUESTS_COLLECTION_ID` | Identifiant de la collection des demandes ; le modèle propose `requests` |
| `APPWRITE_MESSAGES_COLLECTION_ID` | Identifiant de la collection des messages ; le modèle propose `messages` |
| `APPWRITE_LISTING_PHOTOS_BUCKET_ID` | Identifiant du bucket ; le modèle propose `listing-photos` |

Si la base héberge déjà la table d’adresses autorisées, utilisez exactement le même `APPWRITE_DATABASE_ID` que celui configuré pour les fonctions. Après le provisionnement, la variable navigateur `VITE_APPWRITE_DATABASE_ID` doit également contenir cet identifiant. Les identifiants des collections et du bucket doivent correspondre à `VITE_APPWRITE_LISTINGS_COLLECTION_ID`, `VITE_APPWRITE_REQUESTS_COLLECTION_ID`, `VITE_APPWRITE_MESSAGES_COLLECTION_ID` et `VITE_APPWRITE_LISTING_PHOTOS_BUCKET_ID` dans `.env.local`.

## Lancer le provisionnement

Installez les dépendances isolées de cet outil, puis lancez-le :

```sh
npm install --prefix provisioning
npm run setup --prefix provisioning
```

Le script crée la base si nécessaire, puis les collections `listings`, `requests` et `messages` et le bucket. Il peut être relancé : il vérifie les ressources existantes, ajoute les attributs facultatifs attendus, crée les index `by_buyer`, `by_seller` et `by_request` manquants, et laisse en place les ressources déjà conformes. Pour `requests`, il retire la permission de création au niveau collection uniquement si elle correspond exactement à l’ancienne configuration `create("users")`; les ACL par document restent intactes. Le script échoue explicitement si une autre permission ou un schéma est incompatible.

La création de la base, de la collection et du bucket n’est pas une transaction. Si une étape échoue après la création d’une ressource, le script indique l’erreur ; corrigez le problème puis relancez-le pour terminer le provisionnement.

Le provisionnement **ne modifie pas** le fichier `.env.local` de l’application. Après le setup, reportez les identifiants publics vers les variables `VITE_APPWRITE_DATABASE_ID`, `VITE_APPWRITE_LISTINGS_COLLECTION_ID`, `VITE_APPWRITE_REQUESTS_COLLECTION_ID`, `VITE_APPWRITE_MESSAGES_COLLECTION_ID` et `VITE_APPWRITE_LISTING_PHOTOS_BUCKET_ID` dans le `.env.local` à la racine du dépôt. Redémarrez `npm run dev` pour que Vite recharge ces valeurs. Ne copiez jamais `APPWRITE_API_KEY` dans ce fichier.

## Tester sans accès Appwrite

Les tests utilisent des services Appwrite simulés et ne créent aucune ressource distante :

```sh
npm test
```
