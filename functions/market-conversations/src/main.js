import { Client, Databases, ID, Permission, Query, Role, Users } from "node-appwrite";
import { createMarketplaceConversationHandler } from "./handler.js";

const REQUIRED_ENVIRONMENT = [
  "APPWRITE_FUNCTION_API_ENDPOINT",
  "APPWRITE_FUNCTION_PROJECT_ID",
  "APPWRITE_DATABASE_ID",
  "APPWRITE_LISTINGS_COLLECTION_ID",
  "APPWRITE_REQUESTS_COLLECTION_ID",
  "APPWRITE_MESSAGES_COLLECTION_ID",
  "APPWRITE_VISIBILITY_COLLECTION_ID",
];

function familyInitials(user) {
  const source = user.name?.trim() || user.email?.split("@", 1)[0]?.split("+", 1)[0] || "";
  const parts = source.match(/[\p{L}\p{N}]+/gu) || [];
  return parts.slice(0, 2)
    .map((part) => `${Array.from(part)[0].toLocaleUpperCase("fr")}.`)
    .join(" ");
}

function participantPermissions(participants) {
  return [...new Set(participants)].map((userId) => Permission.read(Role.user(userId)));
}

function createServices(req) {
  const apiKey = req.headers?.["x-appwrite-key"] || process.env.APPWRITE_FUNCTION_API_KEY;
  const missing = REQUIRED_ENVIRONMENT.filter((name) => !process.env[name]);
  if (!apiKey) missing.push("x-appwrite-key (activez les portées de la fonction)");
  if (missing.length) {
    const configurationError = new Error(`Configuration manquante : ${missing.join(", ")}`);
    configurationError.name = "ConfigurationError";
    throw configurationError;
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(apiKey);
  const databases = new Databases(client);
  const users = new Users(client);
  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const listingsCollectionId = process.env.APPWRITE_LISTINGS_COLLECTION_ID;
  const requestsCollectionId = process.env.APPWRITE_REQUESTS_COLLECTION_ID;
  const messagesCollectionId = process.env.APPWRITE_MESSAGES_COLLECTION_ID;
  const visibilityCollectionId = process.env.APPWRITE_VISIBILITY_COLLECTION_ID;

  async function listDocuments(collectionId, filters) {
    const documents = [];
    let cursor;
    do {
      const queries = [...filters, Query.limit(100)];
      if (cursor) queries.push(Query.cursorAfter(cursor));
      const result = await databases.listDocuments({
        databaseId,
        collectionId,
        queries,
      });
      documents.push(...result.documents);
      cursor = result.documents.length === 100 ? result.documents.at(-1).$id : "";
    } while (cursor);
    return documents;
  }

  return {
    createTransaction: () => databases.createTransaction(),
    commitTransaction: (transactionId) => databases.updateTransaction({ transactionId, commit: true }),
    rollbackTransaction: (transactionId) => databases.updateTransaction({ transactionId, rollback: true }),
    getListing: (listingId) => databases.getDocument({
      databaseId,
      collectionId: listingsCollectionId,
      documentId: listingId,
    }),
    getBuyerRequestForListing: async (listingId, buyerId) => {
      const result = await databases.listDocuments({
        databaseId,
        collectionId: requestsCollectionId,
        queries: [
          Query.equal("listingId", listingId),
          Query.equal("buyerId", buyerId),
          Query.limit(1),
        ],
      });
      return result.documents[0] || null;
    },
    getRequest: (requestId) => databases.getDocument({
      databaseId,
      collectionId: requestsCollectionId,
      documentId: requestId,
    }),
    listRequestsByListing: (listingId) => listDocuments(
      requestsCollectionId,
      [Query.equal("listingId", listingId)],
    ),
    listMessagesByRequest: (requestId) => listDocuments(
      messagesCollectionId,
      [Query.equal("requestId", requestId)],
    ),
    getUserInitials: async (userId) => familyInitials(await users.get({ userId })),
    createRequest: ({ data, participants, transactionId }) => databases.createDocument({
      databaseId,
      collectionId: requestsCollectionId,
      documentId: ID.unique(),
      data,
      permissions: participantPermissions(participants),
      ...(transactionId ? { transactionId } : {}),
    }),
    createMessage: ({ requestId, senderId, content, kind = "message", amount, status, participants, transactionId }) => {
      const data = { requestId, senderId, content, kind };
      if (amount !== undefined) data.amount = amount;
      if (status !== undefined) data.status = status;
      return databases.createDocument({
        databaseId,
        collectionId: messagesCollectionId,
        documentId: ID.unique(),
        data,
        permissions: participantPermissions(participants),
        ...(transactionId ? { transactionId } : {}),
      });
    },
    deleteMessage: (messageId) => databases.deleteDocument({
      databaseId,
      collectionId: messagesCollectionId,
      documentId: messageId,
    }),
    updateRequestLastMessage: (requestId, lastMessage) => databases.updateDocument({
      databaseId,
      collectionId: requestsCollectionId,
      documentId: requestId,
      data: { lastMessage },
    }),
    updateRequestStatus: (requestId, status, transactionId) => databases.updateDocument({
      databaseId,
      collectionId: requestsCollectionId,
      documentId: requestId,
      data: { status },
      ...(transactionId ? { transactionId } : {}),
    }),
    updateRequestOffer: (requestId, data, transactionId) => databases.updateDocument({
      databaseId,
      collectionId: requestsCollectionId,
      documentId: requestId,
      data,
      ...(transactionId ? { transactionId } : {}),
    }),
    updateMessageStatus: (messageId, status, transactionId) => databases.updateDocument({
      databaseId,
      collectionId: messagesCollectionId,
      documentId: messageId,
      data: { status },
      ...(transactionId ? { transactionId } : {}),
    }),
    updateListingStatus: (listingId, status, transactionId) => databases.updateDocument({
      databaseId,
      collectionId: listingsCollectionId,
      documentId: listingId,
      data: { status },
      ...(transactionId ? { transactionId } : {}),
    }),
    deleteRequest: (requestId) => databases.deleteDocument({
      databaseId,
      collectionId: requestsCollectionId,
      documentId: requestId,
    }),
    getVisibilityByRequestAndUser: async (requestId, userId) => {
      const result = await databases.listDocuments({
        databaseId,
        collectionId: visibilityCollectionId,
        queries: [
          Query.equal("requestId", requestId),
          Query.equal("userId", userId),
          Query.limit(1),
        ],
      });
      return result.documents[0] || null;
    },
    createVisibility: ({ requestId, userId, hiddenActivityAt }) => databases.createDocument({
      databaseId,
      collectionId: visibilityCollectionId,
      documentId: ID.unique(),
      data: { requestId, userId, hiddenActivityAt },
      permissions: [Permission.read(Role.user(userId))],
    }),
    updateVisibility: (visibilityId, data) => databases.updateDocument({
      databaseId,
      collectionId: visibilityCollectionId,
      documentId: visibilityId,
      data,
    }),
    deleteVisibility: (visibilityId) => databases.deleteDocument({
      databaseId,
      collectionId: visibilityCollectionId,
      documentId: visibilityId,
    }),
  };
}

export default async function ({ req, res, error }) {
  try {
    return await createMarketplaceConversationHandler(createServices(req))({ req, res, error });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.name : "UnknownError";
    const detail = reason === "ConfigurationError" ? ` : ${cause.message}` : "";
    error(`La fonction de conversation est indisponible (${reason}${detail}).`);
    return res.json({
      code: "internal_error",
      message: "Le service de conversation est indisponible.",
    }, 500);
  }
}
