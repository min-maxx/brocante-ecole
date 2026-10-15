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
  { key: "subcategory", type: "string", size: 30, required: false },
  { key: "shoeSize", type: "integer", required: false },
  { key: "author", type: "string", size: 70, required: false },
  { key: "language", type: "string", size: 40, required: false },
  { key: "sellerId", type: "string", size: 36, required: false },
  { key: "sellerInitials", type: "string", size: 20, required: false },
];

export const PURCHASE_REQUEST_ATTRIBUTES = [
  { key: "listingId", type: "string", size: 36, required: true },
  { key: "listingTitle", type: "string", size: 70, required: true },
  { key: "listingPrice", type: "integer", required: true },
  { key: "listingPhotoId", type: "string", size: 36, required: false },
  { key: "sellerInitials", type: "string", size: 20, required: false },
  { key: "buyerId", type: "string", size: 36, required: true },
  { key: "sellerId", type: "string", size: 36, required: true },
  { key: "type", type: "string", size: 20, required: true },
  { key: "amount", type: "integer", required: true },
  { key: "status", type: "string", size: 20, required: true },
];

const COLLECTION_PERMISSIONS = ['read("users")', 'create("users")'];
const PURCHASE_REQUEST_COLLECTION_PERMISSIONS = ['create("users")'];
const BUCKET_PERMISSIONS = ['read("users")', 'create("users")'];
const OPTIONAL_LISTING_ATTRIBUTES = new Set(["subcategory", "shoeSize", "author", "language", "sellerId", "sellerInitials"]);
const PURCHASE_REQUESTS_INDEX = { key: "by_buyer", type: "key", attributes: ["buyerId"] };

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

async function verifyCollection(collection, { databases, databaseId, collectionId, log }) {
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
      if (OPTIONAL_LISTING_ATTRIBUTES.has(expected.key)) {
        if (expected.type === "string") {
          await databases.createStringAttribute({
            databaseId,
            collectionId,
            key: expected.key,
            size: expected.size,
            required: false,
          });
        } else if (expected.type === "integer") {
          await databases.createIntegerAttribute({
            databaseId,
            collectionId,
            key: expected.key,
            required: false,
          });
        } else {
          throw new Error(`Le type « ${expected.type} » de l’attribut facultatif « ${expected.key} » n’est pas pris en charge.`);
        }
        log(`Attribut facultatif ajouté : ${expected.key}`);
        continue;
      }
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

async function verifyPurchaseRequestCollection(collection, { databases, databaseId, collectionId, log }) {
  if (collection.documentSecurity !== true) {
    throw new Error(
      "La collection des demandes existante n’active pas la sécurité des documents. Aucune modification automatique n’a été appliquée.",
    );
  }
  const actualPermissions = collection.$permissions ?? [];
  if (actualPermissions.length !== PURCHASE_REQUEST_COLLECTION_PERMISSIONS.length
    || PURCHASE_REQUEST_COLLECTION_PERMISSIONS.some((permission) => !actualPermissions.includes(permission))) {
    throw new Error(
      `La collection des demandes « ${collection.$id} » doit autoriser uniquement la création par les familles connectées. ` +
      "Aucune modification automatique n’a été appliquée.",
    );
  }

  const existingAttributes = new Map((collection.attributes ?? []).map((attribute) => [attribute.key, attribute]));
  for (const expected of PURCHASE_REQUEST_ATTRIBUTES) {
    const actual = existingAttributes.get(expected.key);
    const matches = actual
      && actual.type === expected.type
      && actual.size === (expected.size ?? actual.size)
      && actual.required === expected.required
      && Boolean(actual.array) === Boolean(expected.array);
    if (!matches) {
      throw new Error(
        `L’attribut « ${expected.key} » de la collection des demandes « ${collection.$id} » manque ou ne correspond pas au schéma attendu. ` +
        "Aucune modification automatique n’a été appliquée.",
      );
    }
  }

  const buyerIndex = (collection.indexes ?? []).find((index) => index.key === PURCHASE_REQUESTS_INDEX.key);
  if (!buyerIndex) {
    await databases.createIndex({
      databaseId,
      collectionId,
      ...PURCHASE_REQUESTS_INDEX,
    });
    log(`Index créé : ${PURCHASE_REQUESTS_INDEX.key}`);
  } else if (buyerIndex.type !== PURCHASE_REQUESTS_INDEX.type
    || buyerIndex.attributes?.length !== PURCHASE_REQUESTS_INDEX.attributes.length
    || !PURCHASE_REQUESTS_INDEX.attributes.every((attribute) => buyerIndex.attributes.includes(attribute))) {
    throw new Error(
      `L’index « ${PURCHASE_REQUESTS_INDEX.key} » de la collection des demandes est incompatible. ` +
      "Aucune modification automatique n’a été appliquée.",
    );
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
    await verify?.(existing);
    log(`Déjà configuré : ${description}`);
    return;
  }

  await create();
  log(`Créé : ${description}`);
}

export async function provisionMarketplace({ databases, storage, config, log = console.log }) {
  const { databaseId, collectionId, requestsCollectionId, bucketId } = config;

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
    verify: (collection) => verifyCollection(collection, { databases, databaseId, collectionId, log }),
    description: `collection ${collectionId}`,
    log,
  });

  await ensureResource({
    get: () => databases.getCollection({ databaseId, collectionId: requestsCollectionId }),
    create: () => databases.createCollection({
      databaseId,
      collectionId: requestsCollectionId,
      name: "Demandes d’achat et de don",
      permissions: PURCHASE_REQUEST_COLLECTION_PERMISSIONS,
      documentSecurity: true,
      enabled: true,
      attributes: PURCHASE_REQUEST_ATTRIBUTES,
      indexes: [PURCHASE_REQUESTS_INDEX],
    }),
    verify: (collection) => verifyPurchaseRequestCollection(collection, {
      databases,
      databaseId,
      collectionId: requestsCollectionId,
      log,
    }),
    description: `collection ${requestsCollectionId}`,
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
    "APPWRITE_REQUESTS_COLLECTION_ID",
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
    requestsCollectionId: environment.APPWRITE_REQUESTS_COLLECTION_ID,
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
