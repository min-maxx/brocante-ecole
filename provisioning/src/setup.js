import { pathToFileURL } from "node:url";
import { provisionFunctions } from "./functions.js";

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
  { key: "buyerInitials", type: "string", size: 20, required: false },
  { key: "buyerId", type: "string", size: 36, required: true },
  { key: "sellerId", type: "string", size: 36, required: true },
  { key: "type", type: "string", size: 20, required: true },
  { key: "amount", type: "integer", required: true },
  { key: "status", type: "string", size: 20, required: true },
  { key: "lastMessage", type: "string", size: 1000, required: false },
];

export const CONVERSATION_MESSAGE_ATTRIBUTES = [
  { key: "requestId", type: "string", size: 36, required: true },
  { key: "senderId", type: "string", size: 36, required: true },
  { key: "content", type: "string", size: 1000, required: true },
];

const COLLECTION_PERMISSIONS = ['read("users")', 'create("users")'];
const PRIVATE_COLLECTION_PERMISSIONS = [];
const BUCKET_PERMISSIONS = ['read("users")', 'create("users")'];
const OPTIONAL_LISTING_ATTRIBUTES = new Set(["subcategory", "shoeSize", "author", "language", "sellerId", "sellerInitials"]);
const OPTIONAL_PURCHASE_REQUEST_ATTRIBUTES = new Set(["buyerInitials", "lastMessage"]);
const PURCHASE_REQUEST_INDEXES = [
  { key: "by_buyer", type: "key", attributes: ["buyerId"] },
  { key: "by_seller", type: "key", attributes: ["sellerId"] },
];
const CONVERSATION_MESSAGES_INDEX = { key: "by_request", type: "key", attributes: ["requestId"] };

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

async function verifyPrivateCollectionPermissions(collection, {
  databases,
  databaseId,
  collectionId,
  expectedPermissions,
  allowLegacyRequestPermissions = false,
  log,
}) {
  if (collection.documentSecurity !== true) {
    throw new Error(
      `La collection « ${collection.$id} » n’active pas la sécurité des documents. Aucune modification automatique n’a été appliquée.`,
    );
  }
  const actualPermissions = collection.$permissions ?? [];
  if (actualPermissions.length === expectedPermissions.length
    && expectedPermissions.every((permission) => actualPermissions.includes(permission))) return;

  const legacyRequestPermissions = ['create("users")'];
  if (allowLegacyRequestPermissions
    && actualPermissions.length === legacyRequestPermissions.length
    && legacyRequestPermissions.every((permission) => actualPermissions.includes(permission))) {
    await databases.updateCollection({
      databaseId,
      collectionId,
      name: collection.name || "Demandes d’achat et de don",
      permissions: expectedPermissions,
      documentSecurity: true,
    });
    log(`Permissions de collection restreintes : ${collectionId}`);
    return;
  }

  if (actualPermissions.length !== expectedPermissions.length
    || expectedPermissions.some((permission) => !actualPermissions.includes(permission))) {
    throw new Error(
      `La collection « ${collection.$id} » doit avoir exactement les permissions ${JSON.stringify(expectedPermissions)}. ` +
      "Aucune modification automatique n’a été appliquée.",
    );
  }
}

async function ensureIndexes(collection, {
  databases,
  databaseId,
  collectionId,
  expectedIndexes,
  resourceName,
  log,
}) {
  for (const expected of expectedIndexes) {
    const existing = (collection.indexes ?? []).find((index) => index.key === expected.key);
    if (!existing) {
      await databases.createIndex({ databaseId, collectionId, ...expected });
      log(`Index créé : ${expected.key}`);
      continue;
    }
    if (existing.type !== expected.type
      || existing.attributes?.length !== expected.attributes.length
      || !expected.attributes.every((attribute) => existing.attributes.includes(attribute))) {
      throw new Error(
        `L’index « ${expected.key} » de la collection ${resourceName} est incompatible. ` +
        "Aucune modification automatique n’a été appliquée.",
      );
    }
  }
}

async function verifyPurchaseRequestCollection(collection, { databases, databaseId, collectionId, log }) {
  await verifyPrivateCollectionPermissions(collection, {
    databases,
    databaseId,
    collectionId,
    expectedPermissions: PRIVATE_COLLECTION_PERMISSIONS,
    allowLegacyRequestPermissions: true,
    log,
  });
  const existingAttributes = new Map((collection.attributes ?? []).map((attribute) => [attribute.key, attribute]));
  for (const expected of PURCHASE_REQUEST_ATTRIBUTES) {
    const actual = existingAttributes.get(expected.key);
    if (!actual && OPTIONAL_PURCHASE_REQUEST_ATTRIBUTES.has(expected.key)) {
      await databases.createStringAttribute({
        databaseId,
        collectionId,
        key: expected.key,
        size: expected.size,
        required: false,
      });
      log(`Attribut facultatif ajouté : ${expected.key}`);
      continue;
    }
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

  await ensureIndexes(collection, {
    databases,
    databaseId,
    collectionId,
    expectedIndexes: PURCHASE_REQUEST_INDEXES,
    resourceName: "demandes",
    log,
  });
}

async function verifyConversationMessageCollection(collection, { databases, databaseId, collectionId, log }) {
  await verifyPrivateCollectionPermissions(collection, {
    databases,
    databaseId,
    collectionId,
    expectedPermissions: PRIVATE_COLLECTION_PERMISSIONS,
    log,
  });
  const existingAttributes = new Map((collection.attributes ?? []).map((attribute) => [attribute.key, attribute]));
  for (const expected of CONVERSATION_MESSAGE_ATTRIBUTES) {
    const actual = existingAttributes.get(expected.key);
    const matches = actual
      && actual.type === expected.type
      && actual.size === expected.size
      && actual.required === expected.required
      && Boolean(actual.array) === Boolean(expected.array);
    if (!matches) {
      throw new Error(
        `L’attribut « ${expected.key} » de la collection des messages « ${collection.$id} » manque ou ne correspond pas au schéma attendu. ` +
        "Aucune modification automatique n’a été appliquée.",
      );
    }
  }
  await ensureIndexes(collection, {
    databases,
    databaseId,
    collectionId,
    expectedIndexes: [CONVERSATION_MESSAGES_INDEX],
    resourceName: "messages",
    log,
  });
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

export async function provisionMarketplace({
  databases,
  storage,
  functions,
  project,
  inputFile,
  config,
  log = console.log,
}) {
  const { databaseId, collectionId, requestsCollectionId, messagesCollectionId, bucketId } = config;
  const shouldProvisionFunctions = functions || project || inputFile;
  if (shouldProvisionFunctions && (!functions || !project || typeof inputFile !== "function")) {
    throw new Error("Le provisionnement complet exige les services Functions, Project et InputFile d’Appwrite.");
  }

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
      permissions: PRIVATE_COLLECTION_PERMISSIONS,
      documentSecurity: true,
      enabled: true,
      attributes: PURCHASE_REQUEST_ATTRIBUTES,
      indexes: PURCHASE_REQUEST_INDEXES,
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
    get: () => databases.getCollection({ databaseId, collectionId: messagesCollectionId }),
    create: () => databases.createCollection({
      databaseId,
      collectionId: messagesCollectionId,
      name: "Messages privés",
      permissions: PRIVATE_COLLECTION_PERMISSIONS,
      documentSecurity: true,
      enabled: true,
      attributes: CONVERSATION_MESSAGE_ATTRIBUTES,
      indexes: [CONVERSATION_MESSAGES_INDEX],
    }),
    verify: (collection) => verifyConversationMessageCollection(collection, {
      databases,
      databaseId,
      collectionId: messagesCollectionId,
      log,
    }),
    description: `collection ${messagesCollectionId}`,
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

  if (shouldProvisionFunctions) {
    await provisionFunctions({ functions, project, inputFile, config, log });
  }
}

function readConfig(environment) {
  const required = [
    "APPWRITE_ENDPOINT",
    "APPWRITE_PROJECT_ID",
    "APPWRITE_API_KEY",
    "APPWRITE_DATABASE_ID",
    "APPWRITE_LISTINGS_COLLECTION_ID",
    "APPWRITE_REQUESTS_COLLECTION_ID",
    "APPWRITE_MESSAGES_COLLECTION_ID",
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
    messagesCollectionId: environment.APPWRITE_MESSAGES_COLLECTION_ID,
    bucketId: environment.APPWRITE_LISTING_PHOTOS_BUCKET_ID,
    signupFunctionId: environment.APPWRITE_SIGNUP_FUNCTION_ID?.trim() || "6ac8938f000181b4c7df",
    marketFunctionId: environment.APPWRITE_MARKET_FUNCTION_ID?.trim() || "market-conversations",
    webPlatformId: environment.APPWRITE_WEB_PLATFORM_ID?.trim() || "market-web",
    localWebPlatformId: environment.APPWRITE_LOCAL_WEB_PLATFORM_ID?.trim() || "market-web-localhost",
    allowlistTableId: environment.APPWRITE_ALLOWLIST_TABLE_ID?.trim() || "",
    signupCallbackUrl: environment.APPWRITE_SIGNUP_CALLBACK_URL?.trim() || "",
  };
}

async function main() {
  const { Client, Databases, Functions, Project, Storage } = await import("node-appwrite");
  const { InputFile } = await import("node-appwrite/file");
  const config = readConfig(process.env);
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  await provisionMarketplace({
    databases: new Databases(client),
    storage: new Storage(client),
    functions: new Functions(client),
    project: new Project(client),
    inputFile: (path, filename) => InputFile.fromPath(path, filename),
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
