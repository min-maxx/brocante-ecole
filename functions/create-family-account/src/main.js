import { randomBytes } from "node:crypto";
import { Account, Client, ID, Query, TablesDB, Users } from "node-appwrite";
import { createFamilyAccountHandler, normalizeEmail } from "./registration.js";

const requiredEnvironment = [
  "APPWRITE_FUNCTION_API_ENDPOINT",
  "APPWRITE_FUNCTION_PROJECT_ID",
  "APPWRITE_FUNCTION_API_KEY",
  "APPWRITE_DATABASE_ID",
  "APPWRITE_ALLOWLIST_TABLE_ID",
  "APPWRITE_SIGNUP_CALLBACK_URL",
];

function getAppwriteServices() {
  const missing = requiredEnvironment.filter((name) => !process.env[name]);
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
    .setKey(process.env.APPWRITE_FUNCTION_API_KEY);
  const tablesDB = new TablesDB(client);
  const users = new Users(client);

  const isAuthorized = async (email) => {
    const result = await tablesDB.listRows({
      databaseId: process.env.APPWRITE_DATABASE_ID,
      tableId: process.env.APPWRITE_ALLOWLIST_TABLE_ID,
      queries: [Query.equal("email", [email]), Query.limit(1)],
    });
    return result.rows.length > 0;
  };

  const createSessionClient = () => new Client()
    .setEndpoint(endpoint)
    .setProject(projectId);

  return {
    isAuthorized,
    findUserByEmail: async (email) => {
      const result = await users.list({
        queries: [Query.equal("email", [email]), Query.limit(1)],
        total: false,
      });
      const user = result.users[0];
      return user ? { userId: user.$id, emailVerification: user.emailVerification } : null;
    },
    createUser: (email) => users.create({
      userId: ID.unique(),
      email,
    }),
    sendVerification: async (userId, email) => {
      const temporaryPassword = randomBytes(32).toString("base64url");
      await users.updatePassword({ userId, password: temporaryPassword });

      const session = await new Account(createSessionClient()).createEmailPasswordSession({
        email,
        password: temporaryPassword,
      });
      const sessionAccount = new Account(createSessionClient().setSession(session.secret));
      try {
        await sessionAccount.createEmailVerification({
          url: process.env.APPWRITE_SIGNUP_CALLBACK_URL,
        });
      } finally {
        await sessionAccount.deleteSession({ sessionId: "current" });
      }
    },
    completeRegistration: async (userId, secret, password) => {
      const user = await users.get({ userId });
      if (!await isAuthorized(normalizeEmail(user.email))) return null;

      await new Account(createSessionClient()).updateEmailVerification({ userId, secret });
      await users.updatePassword({ userId, password });
      return { email: user.email };
    },
  };
}

export default async function ({ req, res, error }) {
  try {
    return await createFamilyAccountHandler(getAppwriteServices())({ req, res, error });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.name : "UnknownError";
    const detail = reason === "ConfigurationError" ? `: ${cause.message}` : "";
    error(`La fonction de création de compte est indisponible (${reason}${detail}).`);
    return res.json({ code: "internal_error", message: "Le service d’inscription est indisponible." }, 500);
  }
}
