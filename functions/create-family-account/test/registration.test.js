import assert from "node:assert/strict";
import test from "node:test";
import {
  createFamilyAccountHandler,
  normalizeEmail,
} from "../src/registration.js";

function createContext({ method = "POST", body, bodyText } = {}) {
  const response = { body: undefined, statusCode: undefined };
  return {
    response,
    context: {
      req: { method, bodyJson: body, bodyText },
      res: {
        json(value, statusCode = 200) {
          response.body = value;
          response.statusCode = statusCode;
          return response;
        },
      },
      error() {},
    },
  };
}

function createHandler(overrides = {}) {
  return createFamilyAccountHandler({
    isAuthorized: async () => true,
    findUserByEmail: async () => null,
    createUser: async () => ({ $id: "new-user-id" }),
    sendVerification: async () => {},
    completeRegistration: async () => ({ email: "famille@ecole.fr" }),
    ...overrides,
  });
}

test("normalizes email addresses before allowlist lookup", () => {
  assert.equal(normalizeEmail("  Famille@Ecole.FR "), "famille@ecole.fr");
  assert.equal(normalizeEmail(null), "");
});

test("creates a passwordless account and sends verification after allowlist match", async () => {
  const created = [];
  const verificationEmails = [];
  const handler = createHandler({
    isAuthorized: async (email) => email === "famille@ecole.fr",
    createUser: async (...args) => {
      created.push(args);
      return { $id: "new-user-id" };
    },
    sendVerification: async (...args) => verificationEmails.push(args),
  });
  const { context, response } = createContext({
    body: { email: " Famille@Ecole.FR " },
  });

  await handler(context);

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body, { sent: true });
  assert.deepEqual(created, [["famille@ecole.fr"]]);
  assert.deepEqual(verificationEmails, [["new-user-id", "famille@ecole.fr"]]);
});

test("rejects unauthorized addresses without creating accounts or sending email", async () => {
  let lookupAttempted = false;
  let creationAttempted = false;
  let emailAttempted = false;
  const handler = createHandler({
    isAuthorized: async () => false,
    findUserByEmail: async () => { lookupAttempted = true; return null; },
    createUser: async () => { creationAttempted = true; },
    sendVerification: async () => { emailAttempted = true; },
  });
  const { context, response } = createContext({
    body: { email: "outside@example.net" },
  });

  await handler(context);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, "email_not_allowed");
  assert.match(response.body.message, /Contactez l’APEL/);
  assert.equal(lookupAttempted, false);
  assert.equal(creationAttempted, false);
  assert.equal(emailAttempted, false);
});

test("rejects malformed requests and non-POST methods", async () => {
  const handler = createHandler({
    createUser: async () => assert.fail("invalid requests must not create an account"),
  });
  const malformed = createContext({ bodyText: "{" });
  const wrongMethod = createContext({ method: "GET" });

  await handler(malformed.context);
  await handler(wrongMethod.context);

  assert.equal(malformed.response.statusCode, 400);
  assert.equal(wrongMethod.response.statusCode, 405);
});

test("rejects invalid email before querying the allowlist", async () => {
  let lookupAttempted = false;
  const handler = createHandler({
    isAuthorized: async () => { lookupAttempted = true; return true; },
    createUser: async () => assert.fail("invalid input must not create an account"),
  });
  const { context, response } = createContext({
    body: { email: "not-an-email" },
  });

  await handler(context);

  assert.equal(response.statusCode, 400);
  assert.equal(lookupAttempted, false);
});

test("resends a verification link for an existing pending account", async () => {
  let createAttempted = false;
  const verificationEmails = [];
  const handler = createHandler({
    findUserByEmail: async () => ({ userId: "pending-user-id", emailVerification: false }),
    createUser: async () => { createAttempted = true; },
    sendVerification: async (...args) => verificationEmails.push(args),
  });
  const { context, response } = createContext({
    body: { email: "famille@ecole.fr" },
  });

  await handler(context);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { sent: true });
  assert.equal(createAttempted, false);
  assert.deepEqual(verificationEmails, [["pending-user-id", "famille@ecole.fr"]]);
});

test("does not create a second account for an already-confirmed email", async () => {
  let createAttempted = false;
  let emailAttempted = false;
  const handler = createHandler({
    findUserByEmail: async () => ({ userId: "existing-user-id", emailVerification: true }),
    createUser: async () => { createAttempted = true; },
    sendVerification: async () => { emailAttempted = true; },
  });
  const { context, response } = createContext({
    body: { email: "famille@ecole.fr" },
  });

  await handler(context);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, "account_exists");
  assert.equal(createAttempted, false);
  assert.equal(emailAttempted, false);
});

test("sets a password only after the email verification secret is submitted", async () => {
  let completionRequest;
  const handler = createHandler({
    completeRegistration: async (...args) => {
      completionRequest = args;
      return { email: "famille@ecole.fr" };
    },
  });
  const { context, response } = createContext({
    body: {
      action: "complete-registration",
      userId: "user-123",
      secret: "verification-secret",
      password: "correct-horse",
    },
  });

  await handler(context);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { email: "famille@ecole.fr" });
  assert.deepEqual(completionRequest, ["user-123", "verification-secret", "correct-horse"]);
});

test("rejects password setup without valid verification credentials", async () => {
  let completionAttempted = false;
  const handler = createHandler({
    completeRegistration: async () => { completionAttempted = true; },
  });
  const { context, response } = createContext({
    body: {
      action: "complete-registration",
      userId: "user-123",
      secret: "",
      password: "short",
    },
  });

  await handler(context);

  assert.equal(response.statusCode, 400);
  assert.equal(completionAttempted, false);
});

test("does not complete registration if the address is no longer authorized", async () => {
  const handler = createHandler({
    completeRegistration: async () => null,
  });
  const { context, response } = createContext({
    body: {
      action: "complete-registration",
      userId: "user-123",
      secret: "verification-secret",
      password: "correct-horse",
    },
  });

  await handler(context);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, "email_not_allowed");
});

test("rejects an expired email verification link", async () => {
  const handler = createHandler({
    completeRegistration: async () => {
      throw Object.assign(new Error("Invalid token"), { type: "user_invalid_token" });
    },
  });
  const { context, response } = createContext({
    body: {
      action: "complete-registration",
      userId: "user-123",
      secret: "expired-secret",
      password: "correct-horse",
    },
  });

  await handler(context);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.code, "invalid_verification");
});
