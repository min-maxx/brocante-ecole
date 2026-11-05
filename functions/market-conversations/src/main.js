import { Client, Databases, ID, Permission, Role, Users } from "node-appwrite";
import { createMarketplaceConversationHandler } from "./handler.js";

const REQUIRED_ENVIRONMENT = [
  "APPWRITE_FUNCTION_API_ENDPOINT",
  "APPWRITE_FUNCTION_PROJECT_ID",
  "APPWRITE_DATABASE_ID",
  "APPWRITE_LISTINGS_COLLECTION_ID",
  "APPWRITE_REQUESTS_COLLECTION_ID",
  "APPWRITE_MESSAGES_COLLECTION_ID",
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

  return {
    getListing: (listingId) => databases.getDocument({
      databaseId,
      collectionId: listingsCollectionId,
      documentId: listingId,
    }),
    getRequest: (requestId) => databases.getDocument({
      databaseId,
      collectionId: requestsCollectionId,
      documentId: requestId,
    }),
    getUserInitials: async (userId) => familyInitials(await users.get({ userId })),
    createRequest: ({ data, participants }) => databases.createDocument({
      databaseId,
      collectionId: requestsCollectionId,
      documentId: ID.unique(),
      data,
      permissions: participantPermissions(participants),
    }),
    createMessage: ({ requestId, senderId, content, participants }) => databases.createDocument({
      databaseId,
      collectionId: messagesCollectionId,
      documentId: ID.unique(),
      data: { requestId, senderId, content },
      permissions: participantPermissions(participants),
    }),
    updateRequestLastMessage: (requestId, lastMessage) => databases.updateDocument({
      databaseId,
      collectionId: requestsCollectionId,
      documentId: requestId,
      data: { lastMessage },
    }),
    deleteRequest: (requestId) => databases.deleteDocument({
      databaseId,
      collectionId: requestsCollectionId,
      documentId: requestId,
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
