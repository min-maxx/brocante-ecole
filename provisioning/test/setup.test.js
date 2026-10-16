import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";
import {
  CONVERSATION_MESSAGE_ATTRIBUTES,
  LISTING_ATTRIBUTES,
  PURCHASE_REQUEST_ATTRIBUTES,
  provisionMarketplace,
} from "../src/setup.js";

const execFileAsync = promisify(execFile);

function createServices({ existing = {} } = {}) {
  const calls = [];
  const notFound = () => Object.assign(new Error("Not found"), { code: 404 });
  const databases = {
    async get({ databaseId }) {
      calls.push(["getDatabase", databaseId]);
      if (!existing.database) throw notFound();
      return existing.database;
    },
    async create(params) {
      calls.push(["createDatabase", params]);
    },
    async getCollection({ collectionId }) {
      calls.push(["getCollection", collectionId]);
      const collections = existing.collections ?? {
        listings: existing.collection,
        requests: existing.requests,
        messages: existing.messages,
      };
      if (!collections[collectionId]) throw notFound();
      return collections[collectionId];
    },
    async createCollection(params) {
      calls.push(["createCollection", params]);
    },
    async updateCollection(params) {
      calls.push(["updateCollection", params]);
    },
    async createStringAttribute(params) {
      calls.push(["createStringAttribute", params]);
    },
    async createIntegerAttribute(params) {
      calls.push(["createIntegerAttribute", params]);
    },
    async createIndex(params) {
      calls.push(["createIndex", params]);
    },
  };
  const storage = {
    async getBucket({ bucketId }) {
      calls.push(["getBucket", bucketId]);
      if (!existing.bucket) throw notFound();
      return existing.bucket;
    },
    async createBucket(params) {
      calls.push(["createBucket", params]);
    },
  };
  const functionResources = new Map(Object.entries(existing.functions ?? {}));
  const functionVariables = new Map(
    Object.entries(existing.functionVariables ?? {}).map(([functionId, variables]) => [
      functionId,
      variables.map((variable) => ({ ...variable })),
    ]),
  );
  const functions = {
    async get({ functionId }) {
      calls.push(["getFunction", functionId]);
      if (!functionResources.has(functionId)) throw notFound();
      return functionResources.get(functionId);
    },
    async create(params) {
      calls.push(["createFunction", params]);
      const resource = { ...params, $id: params.functionId };
      functionResources.set(params.functionId, resource);
      return resource;
    },
    async update(params) {
      calls.push(["updateFunction", params]);
      const resource = { ...functionResources.get(params.functionId), ...params };
      functionResources.set(params.functionId, resource);
      return resource;
    },
    async listVariables({ functionId }) {
      calls.push(["listFunctionVariables", functionId]);
      return { variables: functionVariables.get(functionId) ?? [] };
    },
    async createVariable(params) {
      calls.push(["createFunctionVariable", params]);
      const variables = functionVariables.get(params.functionId) ?? [];
      variables.push({ ...params, $id: params.variableId });
      functionVariables.set(params.functionId, variables);
    },
    async updateVariable(params) {
      calls.push(["updateFunctionVariable", params]);
      const variables = functionVariables.get(params.functionId) ?? [];
      const index = variables.findIndex((variable) => variable.$id === params.variableId);
      variables[index] = { ...variables[index], ...params };
      functionVariables.set(params.functionId, variables);
    },
    async createDeployment(params) {
      const { stdout } = await execFileAsync("tar", ["-tzf", params.code.path]);
      calls.push(["createFunctionDeployment", params, stdout.split("\n").filter(Boolean)]);
      return { $id: `deployment-${calls.length}`, status: "processing" };
    },
    async getDeployment({ functionId, deploymentId }) {
      calls.push(["getFunctionDeployment", functionId, deploymentId]);
      return { $id: deploymentId, status: "ready" };
    },
  };
  const platforms = [...(existing.platforms ?? [])];
  const project = {
    async listPlatforms() {
      calls.push(["listPlatforms"]);
      return { platforms };
    },
    async createWebPlatform(params) {
      calls.push(["createWebPlatform", params]);
      const platform = { ...params, $id: params.platformId, type: "web" };
      platforms.push(platform);
      return platform;
    },
  };
  return { calls, databases, storage, functions, project };
}

test("creates the database, listing collection schema, and private photo bucket", async () => {
  const { calls, databases, storage } = createServices();
  const messages = [];

  await provisionMarketplace({
    databases,
    storage,
    config: {
      databaseId: "market-db",
      collectionId: "listings",
      requestsCollectionId: "requests",
      messagesCollectionId: "messages",
      bucketId: "listing-photos",
    },
    log: (message) => messages.push(message),
  });

  const collection = calls.find(([name]) => name === "createCollection")[1];
  assert.equal(collection.documentSecurity, true);
  assert.deepEqual(collection.attributes, LISTING_ATTRIBUTES);
  assert.deepEqual(collection.permissions, ['read("users")', 'create("users")']);

  const requests = calls.find(([name, params]) => name === "createCollection" && params.collectionId === "requests")[1];
  assert.equal(requests.documentSecurity, true);
  assert.deepEqual(requests.attributes, PURCHASE_REQUEST_ATTRIBUTES);
  assert.deepEqual(requests.permissions, []);
  assert.deepEqual(requests.indexes, [
    { key: "by_buyer", type: "key", attributes: ["buyerId"] },
    { key: "by_seller", type: "key", attributes: ["sellerId"] },
  ]);

  const messagesCollection = calls.find(([name, params]) => name === "createCollection" && params.collectionId === "messages")[1];
  assert.equal(messagesCollection.documentSecurity, true);
  assert.deepEqual(messagesCollection.attributes, CONVERSATION_MESSAGE_ATTRIBUTES);
  assert.deepEqual(messagesCollection.permissions, []);
  assert.deepEqual(messagesCollection.indexes, [{ key: "by_request", type: "key", attributes: ["requestId"] }]);

  const bucket = calls.find(([name]) => name === "createBucket")[1];
  assert.equal(bucket.fileSecurity, true);
  assert.deepEqual(bucket.permissions, ['read("users")', 'create("users")']);
  assert.equal(calls.filter(([name]) => ["createDatabase", "createCollection", "createBucket"].includes(name)).length, 5);
  assert.deepEqual(messages, [
    "Créé : base market-db",
    "Créé : collection listings",
    "Créé : collection requests",
    "Créé : collection messages",
    "Créé : bucket listing-photos",
  ]);
});

test("validates complete Function services before creating marketplace resources", async () => {
  const { calls, databases, storage, functions } = createServices();

  await assert.rejects(
    provisionMarketplace({
      databases,
      storage,
      functions,
      config: {
        databaseId: "market-db",
        collectionId: "listings",
        requestsCollectionId: "requests",
        messagesCollectionId: "messages",
        bucketId: "listing-photos",
      },
      log() {},
    }),
    /provisionnement complet exige/,
  );

  assert.equal(calls.some(([name]) => name.startsWith("create")), false);
});

test("leaves existing resources untouched when their schema matches", async () => {
  const { calls, databases, storage } = createServices({
    existing: {
      database: { $id: "market-db" },
      collection: {
        $id: "listings",
        documentSecurity: true,
        $permissions: ['read("users")', 'create("users")'],
        attributes: LISTING_ATTRIBUTES.map((attribute) => ({
          ...attribute,
          status: "available",
        })),
      },
      requests: {
        $id: "requests",
        documentSecurity: true,
        $permissions: [],
        attributes: PURCHASE_REQUEST_ATTRIBUTES.map((attribute) => ({
          ...attribute,
          status: "available",
        })),
        indexes: [
          { key: "by_buyer", type: "key", attributes: ["buyerId"], status: "available" },
          { key: "by_seller", type: "key", attributes: ["sellerId"], status: "available" },
        ],
      },
      messages: {
        $id: "messages",
        documentSecurity: true,
        $permissions: [],
        attributes: CONVERSATION_MESSAGE_ATTRIBUTES.map((attribute) => ({
          ...attribute,
          status: "available",
        })),
        indexes: [{ key: "by_request", type: "key", attributes: ["requestId"], status: "available" }],
      },
      bucket: {
        $id: "listing-photos",
        fileSecurity: true,
        $permissions: ['read("users")', 'create("users")'],
      },
    },
  });

  await provisionMarketplace({
    databases,
    storage,
    config: {
      databaseId: "market-db",
      collectionId: "listings",
      requestsCollectionId: "requests",
      messagesCollectionId: "messages",
      bucketId: "listing-photos",
    },
    log() {},
  });

  assert.equal(calls.filter(([name]) => name.startsWith("create")).length, 0);
});

test("adds the optional seller metadata fields to an existing collection", async () => {
  const { calls, databases, storage } = createServices({
    existing: {
      database: { $id: "market-db" },
      collection: {
        $id: "listings",
        documentSecurity: true,
        $permissions: ['read("users")', 'create("users")'],
        attributes: LISTING_ATTRIBUTES
          .filter((attribute) => !["sellerId", "sellerInitials"].includes(attribute.key))
          .map((attribute) => ({ ...attribute, status: "available" })),
      },
      bucket: {
        $id: "listing-photos",
        fileSecurity: true,
        $permissions: ['read("users")', 'create("users")'],
      },
    },
  });

  await provisionMarketplace({
    databases,
    storage,
    config: {
      databaseId: "market-db",
      collectionId: "listings",
      requestsCollectionId: "requests",
      messagesCollectionId: "messages",
      bucketId: "listing-photos",
    },
    log() {},
  });

  assert.deepEqual(
    calls.filter(([name]) => name === "createStringAttribute"),
    [
      ["createStringAttribute", {
        databaseId: "market-db",
        collectionId: "listings",
        key: "sellerId",
        size: 36,
        required: false,
      }],
      ["createStringAttribute", {
        databaseId: "market-db",
        collectionId: "listings",
        key: "sellerInitials",
        size: 20,
        required: false,
      }],
    ],
  );
});

test("adds the buyer index to an existing purchase-request collection", async () => {
  const { calls, databases, storage } = createServices({
    existing: {
      database: { $id: "market-db" },
      collection: {
        $id: "listings",
        documentSecurity: true,
        $permissions: ['read("users")', 'create("users")'],
        attributes: LISTING_ATTRIBUTES.map((attribute) => ({ ...attribute, status: "available" })),
      },
      requests: {
        $id: "requests",
        documentSecurity: true,
        $permissions: ['create("users")'],
        attributes: PURCHASE_REQUEST_ATTRIBUTES.map((attribute) => ({ ...attribute, status: "available" })),
        indexes: [],
      },
      bucket: {
        $id: "listing-photos",
        fileSecurity: true,
        $permissions: ['read("users")', 'create("users")'],
      },
    },
  });

  await provisionMarketplace({
    databases,
    storage,
    config: {
      databaseId: "market-db",
      collectionId: "listings",
      requestsCollectionId: "requests",
      messagesCollectionId: "messages",
      bucketId: "listing-photos",
    },
    log() {},
  });

  assert.deepEqual(
    calls.filter(([name, params]) => name === "createIndex" && params.collectionId === "requests"),
    [
      ["createIndex", {
        databaseId: "market-db",
        collectionId: "requests",
        key: "by_buyer",
        type: "key",
        attributes: ["buyerId"],
      }],
      ["createIndex", {
        databaseId: "market-db",
        collectionId: "requests",
        key: "by_seller",
        type: "key",
        attributes: ["sellerId"],
      }],
    ],
  );
  assert.deepEqual(
    calls.find(([name]) => name === "updateCollection"),
    ["updateCollection", {
      databaseId: "market-db",
      collectionId: "requests",
      name: "Demandes d’achat et de don",
      permissions: [],
      documentSecurity: true,
    }],
  );
});

test("stops rather than silently accepting a collection with missing attributes", async () => {
  const { calls, databases, storage } = createServices({
    existing: {
      database: { $id: "market-db" },
      collection: {
        $id: "listings",
        documentSecurity: true,
        $permissions: ['read("users")', 'create("users")'],
        attributes: [],
      },
    },
  });

  await assert.rejects(
    provisionMarketplace({
      databases,
      storage,
      config: {
        databaseId: "market-db",
        collectionId: "listings",
        requestsCollectionId: "requests",
        messagesCollectionId: "messages",
        bucketId: "listing-photos",
      },
      log() {},
    }),
    /attribut requis « title » manque/,
  );
  assert.equal(calls.some(([name]) => name === "createCollection"), false);
  assert.equal(calls.some(([name]) => name === "createBucket"), false);
});

test("provisions both Appwrite functions, their runtime settings, and active deployments", async () => {
  const { calls, databases, storage, functions, project } = createServices();

  await provisionMarketplace({
    databases,
    storage,
    functions,
    project,
    inputFile: (path, filename) => ({ path, filename }),
    config: {
      databaseId: "market-db",
      collectionId: "listings",
      requestsCollectionId: "requests",
      messagesCollectionId: "messages",
      bucketId: "listing-photos",
      signupFunctionId: "signup-family",
      marketFunctionId: "market-conversations",
      allowlistTableId: "allowed-families",
      signupCallbackUrl: "https://brocante.example.test/",
      webPlatformId: "market-web",
    },
    log() {},
  });

  const createdFunctions = calls
    .filter(([name]) => name === "createFunction")
    .map(([, params]) => params);
  assert.deepEqual(createdFunctions, [
    {
      functionId: "signup-family",
      name: "Création de compte famille",
      runtime: "node-22",
      execute: ["any"],
      entrypoint: "src/main.js",
      commands: "npm install",
      enabled: true,
      logging: true,
      scopes: ["rows.read", "users.read", "users.write"],
    },
    {
      functionId: "market-conversations",
      name: "Conversations du marché",
      runtime: "node-22",
      execute: ["users"],
      entrypoint: "src/main.js",
      commands: "npm install",
      enabled: true,
      logging: true,
      scopes: ["databases.read", "documents.read", "documents.write", "users.read"],
    },
  ]);

  const variables = calls
    .filter(([name]) => name === "createFunctionVariable")
    .map(([, { functionId, key, value, secret }]) => ({ functionId, key, value, secret }));
  assert.deepEqual(variables, [
    { functionId: "signup-family", key: "APPWRITE_DATABASE_ID", value: "market-db", secret: false },
    { functionId: "signup-family", key: "APPWRITE_ALLOWLIST_TABLE_ID", value: "allowed-families", secret: false },
    { functionId: "signup-family", key: "APPWRITE_SIGNUP_CALLBACK_URL", value: "https://brocante.example.test/", secret: false },
    { functionId: "market-conversations", key: "APPWRITE_DATABASE_ID", value: "market-db", secret: false },
    { functionId: "market-conversations", key: "APPWRITE_LISTINGS_COLLECTION_ID", value: "listings", secret: false },
    { functionId: "market-conversations", key: "APPWRITE_REQUESTS_COLLECTION_ID", value: "requests", secret: false },
    { functionId: "market-conversations", key: "APPWRITE_MESSAGES_COLLECTION_ID", value: "messages", secret: false },
  ]);

  const deployments = calls
    .filter(([name]) => name === "createFunctionDeployment")
    .map(([, params, files]) => ({
      functionId: params.functionId,
      entrypoint: params.entrypoint,
      commands: params.commands,
      activate: params.activate,
      hasPackageManifest: files.includes("./package.json"),
      hasEntrypoint: files.includes("./src/main.js"),
    }));
  assert.deepEqual(deployments, [
    {
      functionId: "signup-family",
      entrypoint: "src/main.js",
      commands: "npm install",
      activate: true,
      hasPackageManifest: true,
      hasEntrypoint: true,
    },
    {
      functionId: "market-conversations",
      entrypoint: "src/main.js",
      commands: "npm install",
      activate: true,
      hasPackageManifest: true,
      hasEntrypoint: true,
    },
  ]);

  assert.deepEqual(
    calls.filter(([name]) => name === "createWebPlatform"),
    [
      ["createWebPlatform", {
        platformId: "market-web",
        name: "Le petit marché",
        hostname: "brocante.example.test",
      }],
      ["createWebPlatform", {
        platformId: "market-web-localhost",
        name: "Le petit marché (développement local)",
        hostname: "localhost",
      }],
    ],
  );
  assert.equal(calls.filter(([name]) => name === "getFunctionDeployment").length, 2);
});

test("reuses the existing signup Function configuration and repairs its settings", async () => {
  const { calls, databases, storage, functions, project } = createServices({
    existing: {
      functions: {
        "signup-family": {
          functionId: "signup-family",
          name: "Ancienne fonction d’inscription",
          runtime: "node-18",
          execute: ["users"],
          entrypoint: "src/main.js",
          commands: "npm install",
          enabled: true,
          logging: true,
          scopes: ["users.read"],
        },
      },
      functionVariables: {
        "signup-family": [
          { $id: "db", key: "APPWRITE_DATABASE_ID", value: "market-db", secret: false },
          { $id: "allowlist", key: "APPWRITE_ALLOWLIST_TABLE_ID", value: "allowed-families", secret: false },
          { $id: "callback", key: "APPWRITE_SIGNUP_CALLBACK_URL", value: "https://brocante.example.test/", secret: false },
        ],
      },
      platforms: [
        { $id: "existing-web", type: "web", hostname: "brocante.example.test" },
        { $id: "existing-localhost", type: "web", hostname: "localhost" },
      ],
    },
  });

  await provisionMarketplace({
    databases,
    storage,
    functions,
    project,
    inputFile: (path, filename) => ({ path, filename }),
    config: {
      databaseId: "market-db",
      collectionId: "listings",
      requestsCollectionId: "requests",
      messagesCollectionId: "messages",
      bucketId: "listing-photos",
      signupFunctionId: "signup-family",
      marketFunctionId: "market-conversations",
      webPlatformId: "market-web",
    },
    log() {},
  });

  assert.deepEqual(
    calls.find(([name, params]) => name === "updateFunction" && params.functionId === "signup-family"),
    ["updateFunction", {
      functionId: "signup-family",
      name: "Création de compte famille",
      runtime: "node-22",
      execute: ["any"],
      entrypoint: "src/main.js",
      commands: "npm install",
      enabled: true,
      logging: true,
      scopes: ["rows.read", "users.read", "users.write"],
    }],
  );
  assert.equal(
    calls.some(([name, params]) => name === "createFunction" && params.functionId === "signup-family"),
    false,
  );
  assert.equal(
    calls.some(([name, params]) => name === "createFunctionVariable" && params.functionId === "signup-family"),
    false,
  );
  assert.equal(calls.some(([name]) => name === "createWebPlatform"), false);
});
