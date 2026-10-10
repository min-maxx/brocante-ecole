# Le petit marché

Application web pour l’inscription au marché scolaire, avec création de compte Appwrite protégée par la liste des adresses autorisées gérée par l’APEL.

## Fonctionnement de l’inscription

Le navigateur envoie l’adresse à une Appwrite Function publique. La fonction normalise l’adresse, vérifie sa présence dans la table privée de l’APEL, puis crée un compte dont le mot de passe initial est aléatoire et temporaire. Elle ouvre une session temporaire côté serveur pour faire envoyer par Appwrite le lien de vérification d’adresse, puis révoque cette session. Après l’ouverture du lien, le navigateur transmet le secret de vérification et le mot de passe choisi à la fonction. Celle-ci vérifie le secret, revalide l’adresse sur la liste de l’APEL, puis enregistre le mot de passe. Ainsi, la personne qui demande l’inscription ne peut pas choisir le mot de passe avant que la boîte aux lettres autorisée soit vérifiée.

L’inscription native des utilisateurs doit rester désactivée dans les paramètres du projet Appwrite : les comptes ne doivent être créés que par cette fonction. Activez la connexion e-mail/mot de passe pour les sessions temporaires et futures; désactivez les méthodes comme Magic URL et les codes e-mail qui créent automatiquement des comptes hors de la fonction d’autorisation. Une adresse autorisée correspond à un seul compte Appwrite; une inscription non vérifiée peut redemander un lien. L’interface demande à la personne de reconnaître que son compte est individuel et ne doit pas être partagé. Cette règle ne peut pas empêcher techniquement le partage volontaire d’un mot de passe.

## Configuration Appwrite

Conformément à l’ADR-0003, ne chargez aucune adresse réelle et n’ouvrez pas l’inscription aux familles tant que les contrats, sous-traitants et traitements liés aux courriels système n’ont pas été vérifiés par l’APEL.

1. Créez un projet Appwrite Cloud dans la région Frankfurt (`fra`). Dans la console, ouvrez **Overview → Integrations → Add platform → Web App**. Dans le champ **Hostname**, ajoutez le domaine de production et `localhost` pour le développement, sans `https://`, sans port et sans chemin (par exemple `brocante-esmj.appwrite.network` et `localhost`).
2. Désactivez l’inscription autonome des utilisateurs et les méthodes de connexion qui créent automatiquement des comptes (notamment Magic URL et les codes e-mail). Activez e-mail/mot de passe, utilisé pour les sessions temporaires et la connexion après inscription.
3. Créez une base de données et une table privée pour les adresses autorisées. Ajoutez une colonne `email` de type chaîne, requise, et un index unique sur cette colonne. N’accordez aucun accès public aux lignes. Importez les adresses en minuscules; ne les placez jamais dans le code ou dans ce dépôt.
4. Créez une fonction Node.js 22 nommée `create-family-account`, avec `functions/create-family-account` comme répertoire racine, `src/main.js` comme point d’entrée et `npm install` comme commande de construction. Dans **Functions → `create-family-account` → Security → Permissions**, autorisez **All guests** afin que les visiteurs non connectés puissent l’appeler; la fonction applique elle-même la liste autorisée à chaque action. Après toute modification de cette permission, redéployez la fonction pour que le déploiement actif la prenne en compte.
5. Limitez les portées de la clé éphémère de la fonction à la lecture des lignes de la table et des comptes, ainsi qu’à la création et à la mise à jour des comptes utilisateurs (`rows.read`, `users.read`, `users.write`). Configurez `APPWRITE_DATABASE_ID`, `APPWRITE_ALLOWLIST_TABLE_ID` et `APPWRITE_SIGNUP_CALLBACK_URL` dans la fonction. Cette dernière est l’URL complète du site de retour, par exemple `https://brocante-esmj.appwrite.network/`; son hostname (`brocante-esmj.appwrite.network`) doit être enregistré comme plateforme Web à l’étape 1. `APPWRITE_FUNCTION_API_ENDPOINT`, `APPWRITE_FUNCTION_PROJECT_ID` et `APPWRITE_FUNCTION_API_KEY` sont fournies par Appwrite.
6. Vérifiez que le hostname utilisé par `APPWRITE_SIGNUP_CALLBACK_URL` est bien enregistré dans les plateformes Web du même projet Appwrite que la fonction; sinon Appwrite rejettera le lien de vérification.

Les identifiants de la base, de la table et de la fonction sont des paramètres Appwrite, non des secrets. Le navigateur a uniquement besoin des paramètres publics dans `.env.local`.

## Développement et vérification

```sh
npm install
cp .env.example .env.local
# Renseigner VITE_APPWRITE_PROJECT_ID et VITE_APPWRITE_SIGNUP_FUNCTION_ID
npm run dev
```

Le champ `VITE_APPWRITE_ENDPOINT` pointe par défaut vers la région Frankfurt. Lancez `npm test` pour les tests de validation et de contrôle de la liste, et `npm run build` pour vérifier la compilation du site.

Avant d’ouvrir l’inscription aux familles, importez une liste de test, vérifiez le refus d’une adresse absente, confirmez la réception et l’utilisation du lien de vérification, puis contrôlez qu’une seconde création avec la même adresse est refusée.
