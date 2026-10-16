import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEPLOYMENT_POLL_INTERVAL_MS = 5000;
const DEPLOYMENT_TIMEOUT_MS = 5 * 60 * 1000;

const FUNCTION_SOURCES = {
  signup: fileURLToPath(new URL("../../functions/create-family-account/", import.meta.url)),
  market: fileURLToPath(new URL("../../functions/market-conversations/", import.meta.url)),
};

function isNotFound(error) {
  return error?.code === 404;
}

async function getFunction(functions, functionId) {
  try {
    return await functions.get({ functionId });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function listFunctionVariables(functions, functionId) {
  const result = await functions.listVariables({ functionId, queries: [], total: false });
  return result.variables ?? [];
}

function existingVariableValue(variables, key) {
  return variables.find((variable) => variable.key === key)?.value?.trim() || "";
}

function resolveSignupVariables(config, existingVariables) {
  const allowlistTableId = config.allowlistTableId || existingVariableValue(existingVariables, "APPWRITE_ALLOWLIST_TABLE_ID");
  const signupCallbackUrl = config.signupCallbackUrl || existingVariableValue(existingVariables, "APPWRITE_SIGNUP_CALLBACK_URL");
  const missing = [];
  if (!allowlistTableId) missing.push("APPWRITE_ALLOWLIST_TABLE_ID");
  if (!signupCallbackUrl) missing.push("APPWRITE_SIGNUP_CALLBACK_URL");
  if (missing.length) {
    throw new Error(
      `Valeurs manquantes pour provisionner create-family-account : ${missing.join(", ")}. ` +
      "Renseignez-les dans provisioning/.env ou conservez leurs valeurs dans la Function Appwrite existante.",
    );
  }

  let callbackUrl;
  try {
    callbackUrl = new URL(signupCallbackUrl);
  } catch (cause) {
    throw new Error("APPWRITE_SIGNUP_CALLBACK_URL doit être une URL absolue valide.", { cause });
  }
  if (!["http:", "https:"].includes(callbackUrl.protocol) || !callbackUrl.hostname) {
    throw new Error("APPWRITE_SIGNUP_CALLBACK_URL doit utiliser HTTP ou HTTPS et contenir un hostname.");
  }

  return {
    allowlistTableId,
    signupCallbackUrl,
    callbackHostname: callbackUrl.hostname,
  };
}

async function ensureWebPlatforms(project, targets, log) {
  const result = await project.listPlatforms({ queries: [], total: false });
  const registeredHostnames = new Set(
    (result.platforms ?? []).map((platform) => platform.hostname?.toLowerCase()),
  );
  for (const target of targets) {
    if (registeredHostnames.has(target.hostname.toLowerCase())) {
      log(`Déjà configurée : plateforme web ${target.hostname}`);
      continue;
    }
    await project.createWebPlatform(target);
    registeredHostnames.add(target.hostname.toLowerCase());
    log(`Créée : plateforme web ${target.hostname}`);
  }
}

function functionSettings(definition) {
  return {
    functionId: definition.functionId,
    name: definition.name,
    runtime: "node-22",
    execute: definition.execute,
    entrypoint: "src/main.js",
    commands: "npm install",
    enabled: true,
    logging: true,
    scopes: definition.scopes,
  };
}

function settingsMatch(current, expected) {
  return Object.entries(expected).every(([key, value]) => {
    if (key === "functionId") return true;
    return Array.isArray(value)
      ? JSON.stringify(current[key] ?? []) === JSON.stringify(value)
      : current[key] === value;
  });
}

async function ensureFunction(functions, definition, existing, log) {
  const desired = functionSettings(definition);
  if (!existing) {
    await functions.create(desired);
    log(`Créée : Function ${definition.functionId}`);
    return;
  }
  if (settingsMatch(existing, desired)) {
    log(`Déjà configurée : Function ${definition.functionId}`);
    return;
  }
  await functions.update(desired);
  log(`Configuration mise à jour : Function ${definition.functionId}`);
}

async function synchronizeVariables(functions, functionId, variables, existingVariables, log) {
  const currentVariables = existingVariables ?? await listFunctionVariables(functions, functionId);
  for (const [key, value] of Object.entries(variables)) {
    const current = currentVariables.find((variable) => variable.key === key);
    if (current && current.value === value && current.secret === false) continue;

    const params = {
      functionId,
      key,
      value,
      secret: false,
    };
    if (current) {
      await functions.updateVariable({ ...params, variableId: current.$id });
      current.value = value;
      current.secret = false;
      log(`Variable mise à jour : ${functionId}/${key}`);
    } else {
      await functions.createVariable({ ...params, variableId: key });
      currentVariables.push({ ...params, $id: key });
      log(`Variable créée : ${functionId}/${key}`);
    }
  }
}

async function createFunctionArchive(sourceDirectory, functionId) {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "brocante-appwrite-function-"));
  const archivePath = join(temporaryDirectory, "code.tar.gz");
  try {
    await execFileAsync("tar", [
      "-czf",
      archivePath,
      "--exclude=node_modules",
      "--exclude=.git",
      "--exclude=.env",
      "--exclude=.env.*",
      "--exclude=.DS_Store",
      "-C",
      sourceDirectory,
      ".",
    ]);
    return { archivePath, temporaryDirectory };
  } catch (cause) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw new Error(`Impossible de préparer l’archive de la Function ${functionId}.`, { cause });
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForDeployment(functions, functionId, deploymentId) {
  const deadline = Date.now() + DEPLOYMENT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const deployment = await functions.getDeployment({ functionId, deploymentId });
    if (deployment.status === "ready") return;
    if (["failed", "canceled", "cancelled"].includes(deployment.status)) {
      throw new Error(
        `Le déploiement ${deploymentId} de la Function ${functionId} a échoué (${deployment.status}). ` +
        "Consultez les journaux de build Appwrite.",
      );
    }
    await wait(Math.min(DEPLOYMENT_POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
  }
  throw new Error(`Délai dépassé en attendant le déploiement actif de la Function ${functionId}.`);
}

async function deployFunction(functions, inputFile, definition, log) {
  const { archivePath, temporaryDirectory } = await createFunctionArchive(
    definition.sourceDirectory,
    definition.functionId,
  );
  try {
    const deployment = await functions.createDeployment({
      functionId: definition.functionId,
      code: inputFile(archivePath, `${definition.functionId}.tar.gz`),
      activate: true,
      entrypoint: "src/main.js",
      commands: "npm install",
    });
    if (!deployment.$id) {
      throw new Error(`Appwrite n’a pas renvoyé l’identifiant du déploiement de ${definition.functionId}.`);
    }
    await waitForDeployment(functions, definition.functionId, deployment.$id);
    log(`Déploiement actif : Function ${definition.functionId}`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function provisionFunctions({
  functions,
  project,
  inputFile,
  config,
  log = console.log,
}) {
  if (typeof inputFile !== "function") {
    throw new Error("Le provisionnement des Functions exige le convertisseur InputFile du SDK Appwrite.");
  }

  const signupFunctionId = config.signupFunctionId || "6ac8938f000181b4c7df";
  const marketFunctionId = config.marketFunctionId || "market-conversations";
  const webPlatformId = config.webPlatformId || "market-web";
  const localWebPlatformId = config.localWebPlatformId || "market-web-localhost";
  const signupExisting = await getFunction(functions, signupFunctionId);
  const signupExistingVariables = signupExisting
    ? await listFunctionVariables(functions, signupFunctionId)
    : [];
  const signupValues = resolveSignupVariables(config, signupExistingVariables);

  const definitions = [
    {
      functionId: signupFunctionId,
      name: "Création de compte famille",
      execute: ["any"],
      scopes: ["rows.read", "users.read", "users.write"],
      sourceDirectory: FUNCTION_SOURCES.signup,
      variables: {
        APPWRITE_DATABASE_ID: config.databaseId,
        APPWRITE_ALLOWLIST_TABLE_ID: signupValues.allowlistTableId,
        APPWRITE_SIGNUP_CALLBACK_URL: signupValues.signupCallbackUrl,
      },
      existing: signupExisting,
      existingVariables: signupExistingVariables,
    },
    {
      functionId: marketFunctionId,
      name: "Conversations du marché",
      execute: ["users"],
      scopes: ["databases.read", "documents.read", "documents.write", "users.read"],
      sourceDirectory: FUNCTION_SOURCES.market,
      variables: {
        APPWRITE_DATABASE_ID: config.databaseId,
        APPWRITE_LISTINGS_COLLECTION_ID: config.collectionId,
        APPWRITE_REQUESTS_COLLECTION_ID: config.requestsCollectionId,
        APPWRITE_MESSAGES_COLLECTION_ID: config.messagesCollectionId,
      },
    },
  ];

  await ensureWebPlatforms(project, [
    {
      platformId: webPlatformId,
      name: "Le petit marché",
      hostname: signupValues.callbackHostname,
    },
    {
      platformId: localWebPlatformId,
      name: "Le petit marché (développement local)",
      hostname: "localhost",
    },
  ], log);

  for (const definition of definitions) {
    const existing = definition.existing ?? await getFunction(functions, definition.functionId);
    await ensureFunction(functions, definition, existing, log);
    await synchronizeVariables(
      functions,
      definition.functionId,
      definition.variables,
      definition.existingVariables,
      log,
    );
    await deployFunction(functions, inputFile, definition, log);
  }

  log(`Identifiants frontend : VITE_APPWRITE_SIGNUP_FUNCTION_ID=${signupFunctionId}`);
  log(`Identifiants frontend : VITE_APPWRITE_MARKET_FUNCTION_ID=${marketFunctionId}`);
  return { signupFunctionId, marketFunctionId };
}
