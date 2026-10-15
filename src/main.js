import { Account, Client, Databases, Functions, Storage } from "appwrite";
import { createMarketplace } from "./market.js";
import "./style.css";

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const functionId = import.meta.env.VITE_APPWRITE_SIGNUP_FUNCTION_ID;
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const listingsCollectionId = import.meta.env.VITE_APPWRITE_LISTINGS_COLLECTION_ID;
const requestsCollectionId = import.meta.env.VITE_APPWRITE_REQUESTS_COLLECTION_ID;
const photosBucketId = import.meta.env.VITE_APPWRITE_LISTING_PHOTOS_BUCKET_ID;
const missingMarketplaceConfiguration = [
  ["VITE_APPWRITE_ENDPOINT", endpoint],
  ["VITE_APPWRITE_PROJECT_ID", projectId],
  ["VITE_APPWRITE_DATABASE_ID", databaseId],
  ["VITE_APPWRITE_LISTINGS_COLLECTION_ID", listingsCollectionId],
  ["VITE_APPWRITE_REQUESTS_COLLECTION_ID", requestsCollectionId],
  ["VITE_APPWRITE_LISTING_PHOTOS_BUCKET_ID", photosBucketId],
].filter(([, value]) => !value?.trim()).map(([name]) => name);
const signup = document.querySelector(".signup");
const marketRoot = document.querySelector("#market-root");
const signupDetails = document.querySelector("#signup-details");
const loginForm = document.querySelector("#login-form");
const loginSubmit = document.querySelector("#login-submit");
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
const databases = client ? new Databases(client) : null;
const storage = client ? new Storage(client) : null;
const marketplace = createMarketplace({
  root: marketRoot,
  databases,
  storage,
  databaseId,
  collectionId: listingsCollectionId,
  requestsCollectionId,
  photosBucketId,
  missingConfiguration: missingMarketplaceConfiguration,
  onLogout: logout,
});

function showMessage(text, kind = "") {
  message.textContent = text;
  if (kind) message.dataset.kind = kind;
  else delete message.dataset.kind;
}

function hideEmailForm() {
  emailForm.hidden = true;
  loginForm.hidden = true;
  signupDetails.open = false;
  eligibilityNote.hidden = true;
}

function showMarketplace(user, notice = "") {
  signup.hidden = true;
  marketRoot.hidden = false;
  void marketplace.open(user, notice);
}

async function logout() {
  try {
    await account.deleteSession("current");
  } catch (error) {
    console.error("Impossible de fermer la session Appwrite.", error);
    marketplace.showMessage("La déconnexion a échoué. Réessayez.", "error");
    return;
  }
  marketRoot.hidden = true;
  signup.hidden = false;
  loginForm.hidden = false;
  emailForm.hidden = true;
  passwordForm.hidden = true;
  signupDetails.open = false;
  eligibilityNote.hidden = false;
  showMessage("Vous êtes déconnecté.", "success");
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
  signupDetails.open = true;
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
      const user = await account.get();
      showMarketplace(user, "Votre compte personnel est créé et votre adresse est confirmée.");
    } catch (error) {
      console.error("Le compte a été créé, mais la session Appwrite n’a pas démarré.", error);
      showMessage("Votre compte est créé et l’adresse confirmée, mais la connexion n’a pas démarré. Connectez-vous avec vos identifiants.", "error");
      return;
    }
  } catch (error) {
    if (error.code === "invalid_verification") {
      pendingVerification = null;
      passwordForm.hidden = true;
      emailForm.hidden = false;
      loginForm.hidden = false;
      signupDetails.open = true;
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

async function signIn(event) {
  event.preventDefault();
  showMessage();
  if (!client || !account) {
    showMessage("Le service de connexion n’est pas encore configuré. Réessayez plus tard.", "error");
    return;
  }
  if (!loginForm.reportValidity()) return;

  const data = new FormData(loginForm);
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");
  loginSubmit.disabled = true;
  loginSubmit.textContent = "Connexion…";
  try {
    await account.createEmailPasswordSession({ email, password });
    const user = await account.get();
    showMarketplace(user);
  } catch (error) {
    console.error("La connexion au marché a échoué.", error);
    showMessage("Connexion impossible. Vérifiez votre adresse e-mail et votre mot de passe.", "error");
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = "Se connecter";
  }
}

async function restoreSession() {
  if (!account || pendingVerification) return;
  try {
    const user = await account.get();
    showMarketplace(user);
  } catch (error) {
    if (error.code === 401 || error.type === "user_unauthorized") return;
    console.error("Impossible de vérifier la session Appwrite.", error);
    showMessage("Impossible de vérifier votre connexion. Actualisez la page ou réessayez.", "error");
  }
}

loginForm.addEventListener("submit", signIn);
emailForm.addEventListener("submit", requestConfirmation);
passwordForm.addEventListener("submit", setAccountPassword);
handleEmailVerification();
void restoreSession();
