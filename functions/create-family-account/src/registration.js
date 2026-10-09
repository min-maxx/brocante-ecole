const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;

export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isDuplicateAccount(error) {
  return error?.code === 409 || error?.type === "user_already_exists";
}

export function createFamilyAccountHandler({
  isAuthorized,
  findUserByEmail,
  createUser,
  sendVerification,
  completeRegistration,
}) {
  return async ({ req, res, error }) => {
    if (req.method !== "POST") {
      return res.json({ code: "method_not_allowed", message: "Méthode non autorisée." }, 405);
    }

    let body;
    try {
      body = req.bodyJson ?? JSON.parse(req.bodyText || "{}");
    } catch {
      return res.json({ code: "invalid_input", message: "Les données envoyées sont invalides." }, 400);
    }

    if (body?.action === "complete-registration") {
      const { userId, secret, password } = body;
      if (
        typeof userId !== "string"
        || !USER_ID_PATTERN.test(userId)
        || typeof secret !== "string"
        || secret.length < 1
        || secret.length > 256
        || typeof password !== "string"
        || password.length < MIN_PASSWORD_LENGTH
        || password.length > MAX_PASSWORD_LENGTH
      ) {
        return res.json({
          code: "invalid_input",
          message: "Le lien ou le mot de passe est invalide.",
        }, 400);
      }
      try {
        const result = await completeRegistration(userId, secret, password);
        if (result === null) {
          return res.json({
            code: "email_not_allowed",
            message: "Cette adresse n’est pas autorisée. Contactez l’APEL pour vérifier votre inscription.",
          }, 403);
        }
        return res.json({ email: result.email });
      } catch (cause) {
        if (cause?.type === "user_invalid_token" || cause?.type === "user_not_found") {
          return res.json({
            code: "invalid_verification",
            message: "Ce lien de confirmation est invalide ou a expiré. Demandez-en un nouveau.",
          }, 400);
        }
        const reason = cause instanceof Error ? cause.name : "UnknownError";
        const appwriteStage = cause?.appwriteStage ? ` à l’étape "${cause.appwriteStage}"` : "";
        const appwriteDetail = cause?.type ? ` [${cause.code} ${cause.type}${appwriteStage}]` : "";
        error(`La finalisation du compte famille a échoué (${reason}${appwriteDetail}).`);
        return res.json({ code: "internal_error", message: "La création du compte a échoué." }, 500);
      }
    }

    const email = normalizeEmail(body?.email);
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return res.json({ code: "invalid_input", message: "Vérifiez votre adresse e-mail." }, 400);
    }

    try {
      if (!await isAuthorized(email)) {
        return res.json({
          code: "email_not_allowed",
          message: "Cette adresse n’est pas autorisée. Contactez l’APEL pour vérifier votre inscription.",
        }, 403);
      }

      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        if (existingUser.emailVerification) {
          return res.json({
            code: "account_exists",
            message: "Un compte personnel existe déjà pour cette adresse.",
          }, 409);
        }
        await sendVerification(existingUser.userId, email);
        return res.json({ sent: true });
      }

      try {
        const user = await createUser(email);
        await sendVerification(user.$id, email);
        return res.json({ sent: true }, 201);
      } catch (cause) {
        if (!isDuplicateAccount(cause)) throw cause;

        const concurrentUser = await findUserByEmail(email);
        if (!concurrentUser) throw cause;
        if (concurrentUser.emailVerification) {
          return res.json({
            code: "account_exists",
            message: "Un compte personnel existe déjà pour cette adresse.",
          }, 409);
        }
        await sendVerification(concurrentUser.userId, email);
        return res.json({ sent: true });
      }
    } catch (cause) {
      const reason = cause instanceof Error ? cause.name : "UnknownError";
      const scopeDetail = cause?.type === "general_unauthorized_scope" ? ` ${cause.message}` : "";
      const appwriteStage = cause?.appwriteStage ? ` à l’étape "${cause.appwriteStage}"` : "";
      const appwriteDetail = cause?.type ? ` [${cause.code} ${cause.type}${scopeDetail}${appwriteStage}]` : "";
      error(`La préparation du compte famille a échoué (${reason}${appwriteDetail}).`);
      return res.json({ code: "internal_error", message: "La création du compte a échoué." }, 500);
    }
  };
}
