import assert from "node:assert/strict";
import test from "node:test";
import { LISTING_ATTRIBUTES, PURCHASE_REQUEST_ATTRIBUTES, provisionMarketplace } from "../src/setup.js";

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
      const collections = existing.collections ?? { listings: existing.collection, requests: existing.requests };
      if (!collections[collectionId]) throw notFound();
      return collections[collectionId];
    },
    async createCollection(params) {
      calls.push(["createCollection", params]);
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
  return { calls, databases, storage };
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
  assert.deepEqual(requests.permissions, ['create("users")']);
  assert.deepEqual(requests.indexes, [{ key: "by_buyer", type: "key", attributes: ["buyerId"] }]);

  const bucket = calls.find(([name]) => name === "createBucket")[1];
  assert.equal(bucket.fileSecurity, true);
  assert.deepEqual(bucket.permissions, ['read("users")', 'create("users")']);
  assert.equal(calls.filter(([name]) => name.startsWith("create")).length, 4);
  assert.deepEqual(messages, [
    "Créé : base market-db",
    "Créé : collection listings",
    "Créé : collection requests",
    "Créé : bucket listing-photos",
  ]);
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
        $permissions: ['create("users")'],
        attributes: PURCHASE_REQUEST_ATTRIBUTES.map((attribute) => ({
          ...attribute,
          status: "available",
        })),
        indexes: [{ key: "by_buyer", type: "key", attributes: ["buyerId"], status: "available" }],
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
      bucketId: "listing-photos",
    },
    log() {},
  });

  assert.deepEqual(calls.find(([name]) => name === "createIndex"), [
    "createIndex",
    {
      databaseId: "market-db",
      collectionId: "requests",
      key: "by_buyer",
      type: "key",
      attributes: ["buyerId"],
    },
  ]);
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
        bucketId: "listing-photos",
      },
      log() {},
    }),
    /attribut requis « title » manque/,
  );
  assert.equal(calls.some(([name]) => name === "createCollection"), false);
  assert.equal(calls.some(([name]) => name === "createBucket"), false);
});
