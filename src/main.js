import { Account, Client, Functions } from "appwrite";
import "./style.css";

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const functionId = import.meta.env.VITE_APPWRITE_SIGNUP_FUNCTION_ID;
const emailForm = document.querySelector("#email-form");
const passwordForm = document.querySelector("#password-form");
const message = document.querySelector("#form-message");
const emailSubmit = document.querySelector("#email-submit");
const passwordSubmit = document.querySelector("#password-submit");
const eligibilityNote = document.querySelector(".eligibility-note");
let pendingVerification = null;

const client = endpoint && projectId
  ? new Client().setEndpoint(endpoint).setProject(projectId)
  : null;
const account = client ? new Account(client) : null;
const functions = client ? new Functions(client) : null;

function showMessage(text, kind = "") {
  message.textContent = text;
  if (kind) message.dataset.kind = kind;
  else delete message.dataset.kind;
}

function hideEmailForm() {
  emailForm.hidden = true;
  eligibilityNote.hidden = true;
}

function getExecutionResponse(execution) {
  let response;
  try {
    response = JSON.parse(execution.responseBody || "{}");
  } catch {
    throw new Error("La réponse du service d’inscription est invalide. Réessayez plus tard.");
  }

  if (execution.responseStatusCode < 200 || execution.responseStatusCode >= 300) {
    const error = new Error(response.message || "La création du compte a échoué.");
    error.code = response.code;
    throw error;
  }
  return response;
}

async function invokeFunction(body) {
  const execution = await functions.createExecution({
    functionId,
    body: JSON.stringify(body),
    async: false,
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return getExecutionResponse(execution);
}

function showEmailEligibilityMessage(error) {
  if (error.code === "email_not_allowed") {
    showMessage("Cette adresse n’est pas autorisée à accéder au marché. Contactez l’APEL pour vérifier votre inscription.", "error");
  } else if (error.code === "account_exists") {
    showMessage("Un compte personnel est déjà confirmé pour cette adresse. Si vous n’y avez plus accès, contactez l’APEL.", "error");
  } else if (error.code === "invalid_input") {
    showMessage(error.message, "error");
  } else {
    showMessage("L’envoi du lien de confirmation a échoué. Vérifiez votre connexion et réessayez.", "error");
  }
}

function handleEmailVerification() {
  const url = new URL(window.location.href);
  const userId = url.searchParams.get("userId");
  const secret = url.searchParams.get("secret");
  if (!userId || !secret) return;

  if (!account || !functions) {
    showMessage("Le service d’inscription n’est pas encore configuré. Contactez l’APEL pour obtenir de l’aide.", "error");
    return;
  }

  pendingVerification = { userId, secret };
  hideEmailForm();
  window.history.replaceState({}, "", window.location.pathname);
  passwordForm.hidden = false;
  showMessage("Choisissez un mot de passe pour terminer la création de votre compte.", "success");
}

async function requestConfirmation(event) {
  event.preventDefault();
  showMessage();

  if (!endpoint || !projectId || !functionId) {
    showMessage("Le service d’inscription n’est pas encore configuré. Réessayez plus tard.", "error");
    return;
  }

  const data = new FormData(emailForm);
  const email = String(data.get("email") || "").trim();
  if (!emailForm.reportValidity()) return;

  try {
    emailSubmit.disabled = true;
    emailSubmit.textContent = "Envoi en cours…";
    await invokeFunction({ email });
    showMessage("Consultez votre boîte e-mail et ouvrez le lien. Vous choisirez ensuite votre mot de passe.", "success");
  } catch (error) {
    showEmailEligibilityMessage(error);
  } finally {
    emailSubmit.disabled = false;
    emailSubmit.textContent = "Recevoir ou renvoyer un lien de confirmation";
  }
}

async function setAccountPassword(event) {
  event.preventDefault();
  showMessage();
  if (!passwordForm.reportValidity()) return;

  const data = new FormData(passwordForm);
  const password = String(data.get("password") || "");
  if (password !== String(data.get("passwordConfirmation") || "")) {
    showMessage("Les deux mots de passe ne correspondent pas.", "error");
    return;
  }
  if (!pendingVerification) {
    showMessage("Ouvrez d’abord le lien de confirmation reçu par e-mail.", "error");
    return;
  }

  passwordSubmit.disabled = true;
  passwordSubmit.textContent = "Création en cours…";
  try {
    const { email } = await invokeFunction({
      action: "complete-registration",
      userId: pendingVerification.userId,
      secret: pendingVerification.secret,
      password,
    });
    pendingVerification = null;
    hideEmailForm();
    passwordForm.hidden = true;
    try {
      await account.createEmailPasswordSession({ email, password });
    } catch {
      showMessage("Votre compte est créé et l’adresse confirmée, mais la connexion n’a pas démarré. Connectez-vous avec vos identifiants.", "error");
      return;
    }
    showMessage("Votre compte personnel est créé et votre adresse est confirmée.", "success");
  } catch (error) {
    if (error.code === "invalid_verification") {
      pendingVerification = null;
      passwordForm.hidden = true;
      emailForm.hidden = false;
      eligibilityNote.hidden = false;
      showMessage("Ce lien de confirmation est invalide ou a expiré. Demandez-en un nouveau.", "error");
    } else if (error.code === "email_not_allowed") {
      showMessage("Cette adresse n’est plus autorisée à accéder au marché. Contactez l’APEL.", "error");
    } else {
      showMessage("Le compte n’a pas pu être finalisé. Réessayez ou demandez un nouveau lien de confirmation.", "error");
    }
  } finally {
    passwordSubmit.disabled = false;
    passwordSubmit.textContent = "Finaliser la création du compte";
  }
}

emailForm.addEventListener("submit", requestConfirmation);
passwordForm.addEventListener("submit", setAccountPassword);
handleEmailVerification();
