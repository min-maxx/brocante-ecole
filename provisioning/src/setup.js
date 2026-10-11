import { pathToFileURL } from "node:url";

export const LISTING_ATTRIBUTES = [
  { key: "title", type: "string", size: 70, required: true },
  { key: "description", type: "string", size: 500, required: true },
  { key: "category", type: "string", size: 30, required: true },
  { key: "condition", type: "string", size: 20, required: true },
  { key: "ageGroups", type: "integer", required: true, array: true },
  { key: "sizes", type: "string", size: 64, required: true, array: true },
  { key: "color", type: "string", size: 20, required: true },
  { key: "brand", type: "string", size: 70, required: true },
  { key: "price", type: "integer", required: true },
  { key: "photoIds", type: "string", size: 36, required: true, array: true },
];

const COLLECTION_PERMISSIONS = ['read("users")', 'create("users")'];
const BUCKET_PERMISSIONS = ['read("users")', 'create("users")'];

function isNotFound(error) {
  return error?.code === 404;
}

function verifyPermissions(actual, expected, resource) {
  const actualPermissions = actual?.$permissions ?? [];
  if (expected.some((permission) => !actualPermissions.includes(permission))) {
    throw new Error(
      `La ressource Appwrite existante « ${resource} » n’a pas les permissions attendues. ` +
      "Aucune modification automatique n’a été appliquée.",
    );
  }
}

function verifyCollection(collection) {
  if (collection.documentSecurity !== true) {
    throw new Error(
      "La collection existante n’active pas la sécurité des documents. Aucune modification automatique n’a été appliquée.",
    );
  }
  verifyPermissions(collection, COLLECTION_PERMISSIONS, collection.$id);

  const existingAttributes = new Map((collection.attributes ?? []).map((attribute) => [attribute.key, attribute]));
  for (const expected of LISTING_ATTRIBUTES) {
    const actual = existingAttributes.get(expected.key);
    if (!actual) {
      throw new Error(
        `L’attribut requis « ${expected.key} » manque dans la collection existante. ` +
        "Aucune modification automatique n’a été appliquée.",
      );
    }
    const matches = actual.type === expected.type
      && actual.size === (expected.size ?? actual.size)
      && actual.required === expected.required
      && Boolean(actual.array) === Boolean(expected.array);
    if (!matches) {
      throw new Error(
        `L’attribut « ${expected.key} » de la collection existante ne correspond pas au schéma attendu. ` +
        "Aucune modification automatique n’a été appliquée.",
      );
    }
  }
}

function verifyBucket(bucket) {
  if (bucket.fileSecurity !== true) {
    throw new Error(
      "Le bucket existant n’active pas la sécurité des fichiers. Aucune modification automatique n’a été appliquée.",
    );
  }
  verifyPermissions(bucket, BUCKET_PERMISSIONS, bucket.$id);
}

async function ensureResource({ get, create, verify, description, log }) {
  let existing;
  try {
    existing = await get();
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  if (existing) {
    verify?.(existing);
    log(`Déjà configuré : ${description}`);
    return;
  }

  await create();
  log(`Créé : ${description}`);
}

export async function provisionMarketplace({ databases, storage, config, log = console.log }) {
  const { databaseId, collectionId, bucketId } = config;

  await ensureResource({
    get: () => databases.get({ databaseId }),
    create: () => databases.create({
      databaseId,
      name: "Le petit marché",
      enabled: true,
    }),
    description: `base ${databaseId}`,
    log,
  });

  await ensureResource({
    get: () => databases.getCollection({ databaseId, collectionId }),
    create: () => databases.createCollection({
      databaseId,
      collectionId,
      name: "Annonces",
      permissions: COLLECTION_PERMISSIONS,
      documentSecurity: true,
      enabled: true,
      attributes: LISTING_ATTRIBUTES,
      indexes: [],
    }),
    verify: verifyCollection,
    description: `collection ${collectionId}`,
    log,
  });

  await ensureResource({
    get: () => storage.getBucket({ bucketId }),
    create: () => storage.createBucket({
      bucketId,
      name: "Photos des annonces",
      permissions: BUCKET_PERMISSIONS,
      fileSecurity: true,
      enabled: true,
    }),
    verify: verifyBucket,
    description: `bucket ${bucketId}`,
    log,
  });
}

function readConfig(environment) {
  const required = [
    "APPWRITE_ENDPOINT",
    "APPWRITE_PROJECT_ID",
    "APPWRITE_API_KEY",
    "APPWRITE_DATABASE_ID",
    "APPWRITE_LISTINGS_COLLECTION_ID",
    "APPWRITE_LISTING_PHOTOS_BUCKET_ID",
  ];
  const missing = required.filter((name) => !environment[name]?.trim());
  if (missing.length) {
    throw new Error(`Variables manquantes dans provisioning/.env : ${missing.join(", ")}`);
  }
  return {
    endpoint: environment.APPWRITE_ENDPOINT,
    projectId: environment.APPWRITE_PROJECT_ID,
    apiKey: environment.APPWRITE_API_KEY,
    databaseId: environment.APPWRITE_DATABASE_ID,
    collectionId: environment.APPWRITE_LISTINGS_COLLECTION_ID,
    bucketId: environment.APPWRITE_LISTING_PHOTOS_BUCKET_ID,
  };
}

async function main() {
  const { Client, Databases, Storage } = await import("node-appwrite");
  const config = readConfig(process.env);
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  await provisionMarketplace({
    databases: new Databases(client),
    storage: new Storage(client),
    config,
  });
  console.log("Le provisionnement Appwrite est terminé.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Échec du provisionnement Appwrite :", error);
    process.exitCode = 1;
  });
}
