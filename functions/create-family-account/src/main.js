import { randomBytes } from "node:crypto";
import { Account, Client, ID, Query, TablesDB, Users } from "node-appwrite";
import { createFamilyAccountHandler, normalizeEmail } from "./registration.js";

const requiredEnvironment = [
  "APPWRITE_FUNCTION_API_ENDPOINT",
  "APPWRITE_FUNCTION_PROJECT_ID",
  "APPWRITE_DATABASE_ID",
  "APPWRITE_ALLOWLIST_TABLE_ID",
  "APPWRITE_SIGNUP_CALLBACK_URL",
];

async function withAppwriteStage(stage, operation) {
  try {
    return await operation();
  } catch (cause) {
    const wrapped = new Error("Appwrite request failed", { cause });
    wrapped.name = cause instanceof Error ? cause.name : "Error";
    wrapped.code = cause?.code;
    wrapped.type = cause?.type;
    wrapped.appwriteStage = stage;
    throw wrapped;
  }
}

function getAppwriteServices(req) {
  // Appwrite fournit la clé dynamique à l’exécution dans cet en-tête.
  const apiKey = req.headers?.["x-appwrite-key"] || process.env.APPWRITE_FUNCTION_API_KEY;
  const missing = requiredEnvironment.filter((name) => !process.env[name]);
  if (!apiKey) missing.push("x-appwrite-key (activez des scopes sur la fonction)");
  if (missing.length) {
    const configurationError = new Error(`Missing function configuration: ${missing.join(", ")}`);
    configurationError.name = "ConfigurationError";
    throw configurationError;
  }

  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);
  const tablesDB = new TablesDB(client);
  const users = new Users(client);

  const isAuthorized = async (email) => {
    const result = await withAppwriteStage("allowlist lookup", () => tablesDB.listRows({
      databaseId: process.env.APPWRITE_DATABASE_ID,
      tableId: process.env.APPWRITE_ALLOWLIST_TABLE_ID,
      queries: [Query.equal("email", [email]), Query.limit(1)],
    }));
    return result.rows.length > 0;
  };

  const createSessionClient = () => new Client()
    .setEndpoint(endpoint)
    .setProject(projectId);

  return {
    isAuthorized,
    findUserByEmail: async (email) => {
      const result = await withAppwriteStage("existing account lookup", () => users.list({
        queries: [Query.equal("email", [email]), Query.limit(1)],
        total: false,
      }));
      const user = result.users[0];
      return user ? { userId: user.$id, emailVerification: user.emailVerification } : null;
    },
    createUser: (email) => withAppwriteStage("account creation", () => users.create({
      userId: ID.unique(),
      email,
    })),
    sendVerification: async (userId, email) => {
      const temporaryPassword = randomBytes(32).toString("base64url");
      await withAppwriteStage("temporary password update", () => users.updatePassword({ userId, password: temporaryPassword }));

      const session = await withAppwriteStage("temporary session creation", () => users.createSession({ userId }));
      try {
        const sessionAccount = new Account(createSessionClient().setSession(session.secret));
        await withAppwriteStage("verification email request", () => sessionAccount.createEmailVerification({
          url: process.env.APPWRITE_SIGNUP_CALLBACK_URL,
        }));
      } finally {
        await withAppwriteStage("temporary session cleanup", () => users.deleteSession({ userId, sessionId: session.$id }));
      }
    },
    completeRegistration: async (userId, secret, password) => {
      const user = await withAppwriteStage("account lookup during verification", () => users.get({ userId }));
      if (!await isAuthorized(normalizeEmail(user.email))) return null;

      const session = await withAppwriteStage("verification session creation", () => users.createSession({ userId }));
      try {
        const sessionAccount = new Account(createSessionClient().setSession(session.secret));
        await withAppwriteStage("email verification", () => sessionAccount.updateEmailVerification({ userId, secret }));
      } finally {
        await withAppwriteStage("verification session cleanup", () => users.deleteSession({ userId, sessionId: session.$id }));
      }
      await withAppwriteStage("final password update", () => users.updatePassword({ userId, password }));
      return { email: user.email };
    },
  };
}

export default async function ({ req, res, error }) {
  try {
    return await createFamilyAccountHandler(getAppwriteServices(req))({ req, res, error });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.name : "UnknownError";
    const detail = reason === "ConfigurationError" ? `: ${cause.message}` : "";
    error(`La fonction de création de compte est indisponible (${reason}${detail}).`);
    return res.json({ code: "internal_error", message: "Le service d’inscription est indisponible." }, 500);
  }
}
