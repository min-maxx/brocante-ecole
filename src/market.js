import { ID, Permission, Query, Role } from "appwrite";

const AGE_SIZES = {
  3: "36 mois · 93 à 98 cm",
  4: "99 à 104 cm",
  5: "105 à 110 cm",
  6: "111 à 116 cm",
  7: "117 à 122 cm",
  8: "123 à 128 cm",
  9: "129 à 134 cm",
  10: "135 à 140 cm",
  11: "141 à 152 cm (indicatif)",
};
const COLORS = [
  "Blanc", "Noir", "Gris", "Beige", "Marron", "Rouge", "Rose",
  "Orange", "Jaune", "Vert", "Bleu", "Violet", "Multicolore", "Autre",
];
const CONDITIONS = ["Neuf", "Très bon", "Bon", "Satisfaisant", "À réparer", "Autre"];
const MAX_PHOTOS = 3;
const SUGGESTION_MAX_LENGTH = {
  brand: 70,
  author: 70,
  language: 40,
};
const CATEGORY_DETAILS = {
  "Vêtements": {
    icon: "👕",
    hint: "Hauts, pantalons, manteaux, chaussures…",
    titleLabel: "Nom du vêtement",
    titlePlaceholder: "Ex. Veste de pluie",
    photoCaptions: ["Devant · principale", "Étiquette taille/marque", "Détail / défaut"],
    photoGuidance: ["Le vêtement de devant", "L’étiquette de taille et de marque", "Les détails ou éventuels défauts"],
  },
  "Livres": {
    icon: "📚",
    hint: "Albums, romans, BD et manga, manuels…",
    titleLabel: "Titre du livre",
    titlePlaceholder: "Ex. Les albums de Claude Ponti",
    subcategories: ["Albums", "Romans jeunesse", "BD et Manga", "Documentaires", "Manuels scolaires", "Revues et magazines", "Autre"],
    photoCaptions: ["Couverture · principale", "Quatrième / ISBN", "Pages / défaut"],
    photoGuidance: ["La couverture", "La quatrième de couverture et l’ISBN", "Les pages ou défauts utiles à voir"],
  },
  "Jeux et jouets": {
    icon: "🧸",
    hint: "Dinette, puzzles, jeux de société…",
    titleLabel: "Nom du jeu ou du jouet",
    titlePlaceholder: "Ex. Circuit de train en bois",
    subcategories: ["Dinette", "Peluches", "Jeux de construction", "Jeux de société", "Jeux de cartes", "Jeux de rôle", "Jouets en bois", "Loisirs créatifs", "Poupées / figurines", "Puzzle", "Trains / voitures", "Sport/Plein air", "Musique", "Autre"],
    photoCaptions: ["Vue d’ensemble · principale", "Contenu complet", "Règle / accessoires"],
    photoGuidance: ["La boîte ou la vue d’ensemble", "Le contenu complet étalé", "La règle, les accessoires et les pièces manquantes"],
  },
  "Matériel scolaire": {
    icon: "🎒",
    hint: "Cartables, fournitures, papeterie…",
    titleLabel: "Nom de l’article",
    titlePlaceholder: "Ex. Cartable bleu",
    subcategories: ["Cartables", "Fournitures", "Papeterie", "Matériel spécialisé", "Autre"],
    photoCaptions: ["Vue d’ensemble · principale", "Étiquette / marque", "Contenu / défaut"],
    photoGuidance: ["La vue d’ensemble", "L’étiquette ou la marque si utile", "Le contenu, les accessoires ou défauts"],
  },
};
const SCHOOL_LEVELS = {
  3: "PS",
  4: "MS",
  5: "GS",
  6: "CP",
  7: "CE1",
  8: "CE2",
  9: "CM1",
  10: "CM2",
  11: "CM2",
};

function emptyDraft() {
  return {
    category: "",
    title: "",
    subcategory: "",
    description: "",
    condition: "",
    ageGroups: [],
    color: "",
    brand: "",
    author: "",
    language: "",
    price: "",
    photos: [],
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function sizesForAges(ageGroups) {
  return [...new Set(ageGroups.map((age) => AGE_SIZES[age]).filter(Boolean))];
}

function schoolLevelsForAges(ageGroups) {
  return [...new Set(ageGroups.map((age) => SCHOOL_LEVELS[age]).filter(Boolean))];
}

function derivedAgeDetails(category, ageGroups) {
  if (category === "Vêtements") {
    const sizes = sizesForAges(ageGroups);
    return sizes.length ? `Tailles correspondantes : ${sizes.join(" / ")}` : "Choisissez un ou plusieurs âges.";
  }
  if (category === "Matériel scolaire") {
    const levels = schoolLevelsForAges(ageGroups);
    return levels.length ? `Classes correspondantes : ${levels.join(" / ")}` : "Choisissez un ou plusieurs âges.";
  }
  return "";
}

function ageLabel(ageGroups) {
  if (!ageGroups.length) return "";
  if (ageGroups.length === 1) return `${ageGroups[0]} ans`;
  return `${ageGroups.slice(0, -1).join(", ")} et ${ageGroups.at(-1)} ans`;
}

function priceLabel(price) {
  return Number(price) === 0 ? "Don" : `${Number(price)} €`;
}

function titleCase(value) {
  return value.trim().toLocaleLowerCase("fr").replace(/(^|[-\s'’])([\p{L}\p{N}])/gu, (match, separator, firstLetter) =>
    separator + firstLetter.toLocaleUpperCase("fr")
  );
}

function descriptionRequired({ category, condition, color, subcategory }) {
  return condition === "Autre" || (category === "Vêtements" ? color === "Autre" : subcategory === "Autre");
}

function getListingPhotoUrl(storage, bucketId, fileId) {
  return String(storage.getFileView(bucketId, fileId));
}

function ownerPermissions(userId) {
  return [
    Permission.read(Role.users()),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

export function createMarketplace({
  root,
  databases,
  storage,
  databaseId,
  collectionId,
  photosBucketId,
  missingConfiguration = [],
  onLogout,
}) {
  let user = null;
  let listings = [];
  let view = "list";
  let step = 1;
  let draft = emptyDraft();
  let message = "";
  let messageKind = "info";
  let loading = false;
  let publishing = false;

  const configReady = missingConfiguration.length === 0
    && Boolean(databases && storage && databaseId && collectionId && photosBucketId);

  function setMessage(text, kind = "info") {
    message = text;
    messageKind = kind;
    render();
  }

  function headerMarkup() {
    return `<header class="market-header">
      <a class="market-brand" href="/" aria-label="Le petit marché, accueil"><span class="market-brand-mark" aria-hidden="true">p</span> le petit marché</a>
      <div class="market-account"><span>${escapeHtml(user?.name || user?.email || "Famille")}</span><button class="button-light" type="button" data-action="logout">Se déconnecter</button></div>
    </header>`;
  }

  function suggestionValues(key, query = "") {
    const category = key === "brand" ? draft.category : "Livres";
    const seen = new Set();
    return listings
      .filter((listing) => listing.category === category)
      .map((listing) => titleCase(listing[key] || ""))
      .filter((value) => {
        const normalized = value.toLocaleLowerCase("fr");
        if (!value || seen.has(normalized) || !normalized.includes(query.trim().toLocaleLowerCase("fr"))) return false;
        seen.add(normalized);
        return true;
      })
      .sort((left, right) => left.localeCompare(right, "fr"));
  }

  function suggestionOptionsMarkup(key, query = "") {
    return suggestionValues(key, query).map((value) =>
      `<li><button class="suggestion-option" role="option" type="button" data-action="select-suggestion" data-key="${escapeHtml(key)}" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button></li>`
    ).join("");
  }

  function suggestedInputMarkup(key, label, placeholder) {
    return `<div class="suggestion-field">
      <input id="draft-${escapeHtml(key)}" name="${escapeHtml(key)}" value="${escapeHtml(draft[key])}" maxlength="${SUGGESTION_MAX_LENGTH[key]}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" aria-label="${escapeHtml(label)}" aria-autocomplete="list" aria-controls="suggestions-${escapeHtml(key)}" data-suggestion-key="${escapeHtml(key)}">
      <button class="suggestion-toggle" type="button" data-action="toggle-suggestions" data-key="${escapeHtml(key)}" aria-label="Afficher les suggestions de ${escapeHtml(label.toLocaleLowerCase("fr"))}" aria-expanded="false">⌄</button>
      <ul class="suggestion-list" id="suggestions-${escapeHtml(key)}" role="listbox" hidden>${suggestionOptionsMarkup(key, draft[key])}</ul>
    </div>
    <span class="field-hint">Suggestions déjà utilisées ; la saisie reste libre.</span>`;
  }

  function listingDetails(listing) {
    const ages = Array.isArray(listing.ageGroups) ? listing.ageGroups : [];
    const details = [ageLabel(ages)];
    if (listing.category === "Vêtements") {
      const sizes = Array.isArray(listing.sizes) && listing.sizes.length
        ? listing.sizes
        : sizesForAges(ages);
      details.push(...sizes, listing.color, listing.brand);
    } else {
      details.push(listing.subcategory);
      if (listing.category === "Livres") details.push(listing.author, listing.language);
      else {
        if (listing.category === "Matériel scolaire") details.push(...schoolLevelsForAges(ages));
        details.push(listing.brand);
      }
    }
    return details.filter(Boolean);
  }

  function listingCardMarkup(listing) {
    const photoId = Array.isArray(listing.photoIds) ? listing.photoIds[0] : null;
    const photoMarkup = photoId
      ? `<img src="${escapeHtml(getListingPhotoUrl(storage, photosBucketId, photoId))}" alt="Photo principale de ${escapeHtml(listing.title)}">`
      : `<div class="listing-photo-placeholder" aria-hidden="true">${escapeHtml(CATEGORY_DETAILS[listing.category]?.icon || "📦")}</div>`;
    const details = listingDetails(listing);

    return `<article class="listing-card">
      <div class="listing-photo">${photoMarkup}</div>
      <div class="listing-card-content">
        <p class="listing-price">${escapeHtml(priceLabel(listing.price))}</p>
        <h2>${escapeHtml(listing.title)}</h2>
        <p class="listing-card-details">${details.map(escapeHtml).join(" · ")}</p>
        <p class="listing-condition">${escapeHtml(listing.condition)}</p>
      </div>
    </article>`;
  }

  function listMarkup() {
    const content = loading
      ? `<p class="market-empty" role="status">Chargement des annonces…</p>`
      : listings.length
        ? `<div class="listing-grid">${listings.map(listingCardMarkup).join("")}</div>`
        : `<section class="market-empty">
            <p class="market-empty-icon" aria-hidden="true">👕</p>
            <h2>Aucune annonce pour le moment</h2>
          <p>Déposez la première annonce du marché.</p>
          </section>`;

    return `<main class="market-main">
      <div class="market-heading">
        <div><p class="eyebrow">Le marché des familles de l’école</p><h1>Les annonces du marché</h1></div>
        <button class="button-primary" type="button" data-action="new-listing">Déposer une annonce</button>
      </div>
      ${message ? `<p class="market-message" data-kind="${escapeHtml(messageKind)}" role="${["error", "configuration"].includes(messageKind) ? "alert" : "status"}">${escapeHtml(message)}${messageKind === "error" && !loading ? `<button class="text-button" type="button" data-action="retry-list">Réessayer</button>` : ""}</p>` : ""}
      ${content}
    </main>`;
  }

  function progressMarkup() {
    const labels = ["Catégorie", "Photos", "Objet", "Aperçu"];
    return `<ol class="publish-progress" aria-label="Étapes de création de l’annonce">${labels.map((label, index) =>
      `<li class="${step === index + 1 ? "active" : ""}"${step === index + 1 ? ' aria-current="step"' : ""}><span>${index + 1}</span>${label}</li>`
    ).join("")}</ol>`;
  }

  function categoryStepMarkup() {
    return `<section class="wizard-panel" aria-labelledby="category-heading">
      <h2 id="category-heading">Choisissez une catégorie</h2>
      <p>La catégorie ne pourra plus être modifiée une fois choisie.</p>
      <div class="category-grid">${Object.entries(CATEGORY_DETAILS).map(([name, category]) =>
        `<button class="category-choice" type="button" data-action="choose-category" data-category="${escapeHtml(name)}"><span aria-hidden="true">${category.icon}</span><strong>${name}</strong><small>${category.hint}</small></button>`
      ).join("")}</div>
      <div class="wizard-actions"><button class="button-light" type="button" data-action="cancel">Annuler</button></div>
    </section>`;
  }

  function photoStepMarkup() {
    const category = CATEGORY_DETAILS[draft.category];
    return `<section class="wizard-panel" aria-labelledby="photos-heading">
      <p class="fixed-category">Catégorie choisie : ${escapeHtml(draft.category)}</p>
      <h2 id="photos-heading">Ajoutez des photos</h2>
      <p>Ajoutez de 1 à 3 photos pour présenter l’objet aux autres familles.</p>
      <div class="photo-drop-zone" id="photo-drop-zone">
        <div class="photo-grid">${draft.photos.map((photo, index) => `<figure class="photo-thumb">
          <img src="${escapeHtml(photo.url)}" alt="Photo ${index + 1}">
          <figcaption>${escapeHtml(CATEGORY_DETAILS[draft.category].photoCaptions[index])}</figcaption>
          <button class="photo-remove" type="button" data-action="remove-photo" data-index="${index}" aria-label="Retirer la photo ${index + 1}">×</button>
        </figure>`).join("")}${draft.photos.length < MAX_PHOTOS ? `<label class="photo-add" for="draft-photo"><span aria-hidden="true">＋</span>Ajouter une photo</label>` : ""}</div>
        <input id="draft-photo" type="file" accept="image/*" multiple aria-label="Ajouter des photos">
        <div class="photo-guidance"><strong>Pour cet objet, montrez si possible :</strong><ol>${category.photoGuidance.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}</ol></div>
        <p class="field-hint">Glissez vos photos ici ou utilisez « Ajouter une photo » · ${draft.photos.length}/${MAX_PHOTOS}</p>
      </div>
      <div class="wizard-actions"><button class="button-light" type="button" data-action="cancel">Annuler</button><button class="button-primary" type="button" data-action="continue">Continuer</button></div>
    </section>`;
  }

  function objectStepMarkup() {
    const ageChoices = Object.keys(AGE_SIZES).map(Number);
    const category = CATEGORY_DETAILS[draft.category];
    const needsDetail = descriptionRequired(draft);
    const ageHint = draft.category === "Vêtements" || draft.category === "Matériel scolaire"
      ? "Les âges sélectionnés déterminent automatiquement les indications correspondantes."
      : "Choisissez un ou plusieurs âges concernés par cet objet.";
    const derivedLabel = derivedAgeDetails(draft.category, draft.ageGroups);
    const subcategoryMarkup = category.subcategories
      ? `<div class="form-field">
          <label for="draft-subcategory">${draft.category === "Livres" ? "Genre" : "Type/Genre"}</label>
          <select id="draft-subcategory" name="subcategory" required><option value="">Choisir ${draft.category === "Livres" ? "un genre" : "un type/genre"}</option>${category.subcategories.map((subcategory) => `<option value="${escapeHtml(subcategory)}"${draft.subcategory === subcategory ? " selected" : ""}>${escapeHtml(subcategory)}</option>`).join("")}</select>
          <span class="field-hint other-hint"${draft.subcategory === "Autre" ? "" : " hidden"}>Précisez dans la description.</span>
        </div>`
      : `<div class="form-field">
          <label for="draft-color">Couleur</label>
          <select id="draft-color" name="color" required><option value="">Choisir une couleur</option>${COLORS.map((color) => `<option value="${escapeHtml(color)}"${draft.color === color ? " selected" : ""}>${escapeHtml(color)}</option>`).join("")}</select>
          <span class="field-hint other-hint"${draft.color === "Autre" ? "" : " hidden"}>Précisez la couleur dans la description.</span>
        </div>`;
    const extraFields = draft.category === "Livres"
      ? `<div class="form-field">
          <label for="draft-author">Auteur ou autrice <span class="optional">(facultatif)</span></label>
          ${suggestedInputMarkup("author", "Auteur ou autrice", "Ex. Claude Ponti")}
        </div>
        <div class="form-field">
          <label for="draft-language">Langue <span class="optional">(facultative)</span></label>
          ${suggestedInputMarkup("language", "Langue", "Ex. Français")}
        </div>`
      : `<div class="form-field">
          <label for="draft-brand">Marque <span class="optional">(facultative)</span></label>
          ${suggestedInputMarkup("brand", "Marque", draft.category === "Jeux et jouets" ? "Ex. Playmobil" : draft.category === "Matériel scolaire" ? "Ex. Eastpak" : "Ex. Okaïdi")}
        </div>`;
    return `<section class="wizard-panel" aria-labelledby="object-heading">
      <p class="fixed-category">Catégorie choisie : ${escapeHtml(draft.category)}</p>
      <h2 id="object-heading">Décrivez l’objet</h2>
      <p>Renseignez les précisions utiles aux autres familles.</p>
      <form id="object-form" novalidate>
        <div class="object-form-grid">
          <fieldset class="age-picker">
            <legend>Âges concernés (3 à 11 ans) <span aria-hidden="true">*</span></legend>
            <div class="age-options">${ageChoices.map((age) => `<label class="age-option"><input type="checkbox" name="ageGroup" value="${age}"${draft.ageGroups.includes(age) ? " checked" : ""}><span>${age} ans</span></label>`).join("")}</div>
            <p class="field-hint">${ageHint}</p>
            ${derivedLabel ? `<p class="derived-value" id="derived-sizes" aria-live="polite">${escapeHtml(derivedLabel)}</p>` : ""}
          </fieldset>
          <label class="form-field">${category.titleLabel}
            <input name="title" value="${escapeHtml(draft.title)}" maxlength="70" placeholder="${escapeHtml(category.titlePlaceholder)}" required>
          </label>
          <label class="form-field">État de l’objet
            <select name="condition" required><option value="">Choisir l’état</option>${CONDITIONS.map((condition) => `<option value="${escapeHtml(condition)}"${draft.condition === condition ? " selected" : ""}>${escapeHtml(condition)}</option>`).join("")}</select>
            <span class="field-hint condition-other-hint"${draft.condition === "Autre" ? "" : " hidden"}>Précisez l’état de l’objet dans la description.</span>
          </label>
          ${subcategoryMarkup}
          ${extraFields}
          <label class="form-field">Prix (€)
            <input name="price" type="number" min="0" step="1" value="${escapeHtml(draft.price)}" placeholder="0 pour donner" required>
            <span class="field-hint price-hint">${Number(draft.price || 0) === 0 ? "0 € sera affiché comme un don." : "Prix affiché aux autres familles."}</span>
          </label>
          <label class="form-field full">Description <span class="optional description-optionality">${needsDetail ? "(à préciser)" : "(facultative)"}</span>
            <textarea name="description" maxlength="500"${needsDetail ? " required" : ""} placeholder="${draft.condition === "Autre" ? "Précisez l’état de l’objet et décrivez-le…" : draft.category === "Vêtements" && draft.color === "Autre" ? "Précisez la couleur et décrivez le vêtement…" : needsDetail ? "Précisez la catégorie « Autre » et décrivez l’objet…" : "Détails utiles, contenu du lot, petites marques d’usage…"}">${escapeHtml(draft.description)}</textarea>
          </label>
        </div>
      </form>
      <div class="wizard-actions"><button class="button-light" type="button" data-action="back">← Retour aux photos</button><button class="button-primary" type="button" data-action="continue">Voir l’aperçu</button></div>
    </section>`;
  }

  function previewDetailValues() {
    if (draft.category === "Vêtements") {
      return [draft.color, draft.brand].filter(Boolean);
    }
    if (draft.category === "Livres") {
      return [draft.subcategory, draft.author, draft.language].filter(Boolean);
    }
    const values = [draft.subcategory];
    if (draft.category === "Matériel scolaire") values.push(...schoolLevelsForAges(draft.ageGroups));
    if (draft.brand) values.push(draft.brand);
    return values.filter(Boolean);
  }

  function previewStepMarkup() {
    const ages = ageLabel(draft.ageGroups);
    const derived = draft.category === "Vêtements"
      ? sizesForAges(draft.ageGroups).join(" / ")
      : draft.category === "Matériel scolaire"
        ? schoolLevelsForAges(draft.ageGroups).join(" / ")
        : "";
    const details = previewDetailValues();
    return `<section class="wizard-panel" aria-labelledby="preview-heading">
      <p class="fixed-category">Catégorie choisie : ${escapeHtml(draft.category)}</p>
      <h2 id="preview-heading">Vérifiez votre annonce</h2>
      <p>Voici ce que les autres familles verront dans les annonces du marché.</p>
      <article class="preview-card">
        <div class="preview-image"><img src="${escapeHtml(draft.photos[0]?.url || "")}" alt="Photo principale de ${escapeHtml(draft.title)}"></div>
        <div class="preview-details">
          <p class="listing-condition">${escapeHtml(draft.condition)}</p>
          <h3>${escapeHtml(draft.title)}</h3>
          <p>${escapeHtml(draft.category)}${details.length ? ` · ${details.map(escapeHtml).join(" · ")}` : ""}</p>
          <p>${escapeHtml(ages)}${derived ? ` · ${escapeHtml(derived)}` : ""}</p>
          <p class="listing-price">${escapeHtml(priceLabel(draft.price))}</p>
          <p>${escapeHtml(draft.description || "Aucune description ajoutée.")}</p>
        </div>
      </article>
      <div class="wizard-actions"><button class="button-light" type="button" data-action="back">← Modifier</button><button class="button-primary" type="button" data-action="publish"${publishing ? " disabled" : ""}>${publishing ? "Publication…" : "Publier"}</button></div>
    </section>`;
  }

  function wizardMarkup() {
    const content = step === 1 ? categoryStepMarkup()
      : step === 2 ? photoStepMarkup()
        : step === 3 ? objectStepMarkup()
          : previewStepMarkup();
    return `<main class="market-main">
      <div class="wizard-heading"><p class="eyebrow">Le marché des familles de l’école</p><h1>Déposer une annonce</h1></div>
      <div class="wizard-layout">${progressMarkup()}<div class="wizard-content">
        ${message ? `<p class="market-message" data-kind="${escapeHtml(messageKind)}" role="${messageKind === "error" ? "alert" : "status"}">${escapeHtml(message)}</p>` : ""}
        ${content}
      </div></div>
    </main>`;
  }

  function render() {
    root.innerHTML = `<div class="market-app">${headerMarkup()}${view === "wizard" ? wizardMarkup() : listMarkup()}</div>`;
  }

  function releasePhotoUrls() {
    draft.photos.forEach((photo) => URL.revokeObjectURL(photo.url));
  }

  function resetDraft() {
    releasePhotoUrls();
    draft = emptyDraft();
    step = 1;
  }

  function addPhotos(files) {
    const selected = Array.from(files);
    if (draft.photos.length + selected.length > MAX_PHOTOS) {
      setMessage("Vous pouvez ajouter trois photos au maximum. Aucune nouvelle photo n’a été ajoutée.", "error");
      return;
    }
    if (selected.some((file) => !file.type.startsWith("image/"))) {
      setMessage("Seules les photos au format image peuvent être ajoutées.", "error");
      return;
    }
    if (selected.length === 0) return;
    draft.photos.push(...selected.map((file) => ({ file, url: URL.createObjectURL(file) })));
    setMessage("");
  }

  function validateObjectForm() {
    const form = root.querySelector("#object-form");
    if (!form.reportValidity()) return false;
    if (!draft.ageGroups.length) {
      setMessage("Sélectionnez au moins un âge entre 3 et 11 ans.", "error");
      const agePicker = root.querySelector(".age-picker");
      agePicker.setAttribute("aria-invalid", "true");
      agePicker.querySelector('input[name="ageGroup"]').focus();
      return false;
    }
    if (draft.category === "Vêtements") {
      if (!COLORS.includes(draft.color)) {
        setMessage("Choisissez une couleur dans la liste.", "error");
        return false;
      }
    } else if (!CATEGORY_DETAILS[draft.category]?.subcategories?.includes(draft.subcategory)) {
      setMessage("Choisissez un type ou un genre dans la liste.", "error");
      return false;
    }
    return true;
  }

  async function loadListings() {
    if (!configReady) {
      loading = false;
      const missing = missingConfiguration.length
        ? missingConfiguration.map((name) => `« ${name} »`).join(", ")
        : "les identifiants de la base, de la collection et du bucket";
      setMessage(
        `Configuration du marché incomplète : renseignez ${missing} dans le fichier .env.local à la racine. ` +
        "Reprenez les identifiants correspondants dans provisioning/.env, sans copier la clé API. " +
        "Redémarrez le serveur Vite après la modification.",
        "configuration",
      );
      return;
    }
    loading = true;
    render();
    try {
      const result = await databases.listDocuments(databaseId, collectionId, [
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ]);
      listings = result.documents;
      message = "";
      loading = false;
      render();
    } catch (error) {
      console.error("Impossible de charger les annonces.", error);
      loading = false;
      setMessage("Impossible de charger les annonces. Vérifiez votre connexion et réessayez.", "error");
    }
  }

  async function deleteUploadedPhotos(fileIds) {
    for (const fileId of fileIds) {
      try {
        await storage.deleteFile(photosBucketId, fileId);
      } catch (error) {
        console.error(`Impossible de supprimer la photo Appwrite ${fileId} après l’échec de publication.`, error);
      }
    }
  }

  async function publishListing() {
    if (publishing) return;
    if (!configReady) {
      setMessage("La publication n’est pas configurée. Vérifiez les identifiants Appwrite des annonces et des photos.", "error");
      return;
    }
    publishing = true;
    message = "";
    render();
    const uploadedFileIds = [];
    try {
      for (const photo of draft.photos) {
        const file = await storage.createFile(
          photosBucketId,
          ID.unique(),
          photo.file,
          ownerPermissions(user.$id),
        );
        uploadedFileIds.push(file.$id);
      }
      const data = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        category: draft.category,
        condition: draft.condition,
        ageGroups: [...draft.ageGroups].sort((left, right) => left - right),
        sizes: draft.category === "Vêtements" ? sizesForAges(draft.ageGroups) : [],
        color: draft.category === "Vêtements" ? draft.color : "",
        brand: draft.brand.trim(),
        subcategory: draft.subcategory,
        author: draft.author.trim(),
        language: draft.language.trim(),
        price: Number(draft.price),
        photoIds: uploadedFileIds,
      };
      const listing = await databases.createDocument(
        databaseId,
        collectionId,
        ID.unique(),
        data,
        ownerPermissions(user.$id),
      );
      listings.unshift(listing);
      releasePhotoUrls();
      draft = emptyDraft();
      view = "list";
      step = 1;
      publishing = false;
      setMessage("Votre annonce est publiée et visible par les familles.", "success");
    } catch (error) {
      await deleteUploadedPhotos(uploadedFileIds);
      console.error("Impossible de publier l’annonce.", error);
      publishing = false;
      setMessage("La publication a échoué. Vérifiez votre connexion et réessayez.", "error");
    }
  }

  async function handleClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    switch (button.dataset.action) {
      case "new-listing":
        resetDraft();
        message = "";
        view = "wizard";
        render();
        break;
      case "choose-category":
        if (!CATEGORY_DETAILS[button.dataset.category]) return;
        draft.category = button.dataset.category;
        step = 2;
        message = "";
        render();
        break;
      case "toggle-suggestions": {
        const key = button.dataset.key;
        const input = root.querySelector(`[data-suggestion-key="${key}"]`);
        const list = root.querySelector(`#suggestions-${key}`);
        if (!input || !list) return;
        list.innerHTML = suggestionOptionsMarkup(key, input.value);
        list.hidden = !list.hidden;
        button.setAttribute("aria-expanded", String(!list.hidden));
        break;
      }
      case "select-suggestion": {
        const key = button.dataset.key;
        const input = root.querySelector(`[data-suggestion-key="${key}"]`);
        const list = root.querySelector(`#suggestions-${key}`);
        if (!input || !list) return;
        input.value = titleCase(button.dataset.value);
        draft[key] = input.value;
        list.hidden = true;
        root.querySelector(`[data-action="toggle-suggestions"][data-key="${key}"]`)
          ?.setAttribute("aria-expanded", "false");
        input.focus();
        break;
      }
      case "cancel":
        resetDraft();
        view = "list";
        message = "";
        render();
        break;
      case "continue":
        if (step === 2 && (draft.photos.length < 1 || draft.photos.length > MAX_PHOTOS)) {
          setMessage("Ajoutez au moins une photo et trois photos au maximum avant de continuer.", "error");
          return;
        }
        if (step === 3 && !validateObjectForm()) return;
        step += 1;
        message = "";
        render();
        break;
      case "back":
        if (step > 2) step -= 1;
        message = "";
        render();
        break;
      case "remove-photo": {
        const [photo] = draft.photos.splice(Number(button.dataset.index), 1);
        if (photo) URL.revokeObjectURL(photo.url);
        message = "";
        render();
        break;
      }
      case "publish":
        await publishListing();
        break;
      case "retry-list":
        message = "";
        await loadListings();
        break;
      case "logout":
        await onLogout();
        break;
      default:
        break;
    }
  }

  root.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    handleClick(event).catch((error) => {
      console.error("Une action du marché a échoué.", error);
      setMessage("Cette action n’a pas abouti. Réessayez.", "error");
    });
  });

  root.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Element && event.target.closest('[data-action="select-suggestion"]')) {
      event.preventDefault();
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    if (["title", "description", "condition", "color", "brand", "author", "language", "price", "subcategory"].includes(target.name)) {
      draft[target.name] = target.value;
    }
    if (target.dataset.suggestionKey) {
      const list = root.querySelector(`#suggestions-${target.dataset.suggestionKey}`);
      const toggle = root.querySelector(`[data-action="toggle-suggestions"][data-key="${target.dataset.suggestionKey}"]`);
      if (list) {
        list.innerHTML = suggestionOptionsMarkup(target.dataset.suggestionKey, target.value);
        list.hidden = false;
      }
      toggle?.setAttribute("aria-expanded", "true");
    }
    if (target.name === "color" || target.name === "subcategory" || target.name === "condition") {
      const isOther = target.value === "Autre";
      const description = root.querySelector('textarea[name="description"]');
      const hint = root.querySelector(".other-hint");
      const conditionHint = root.querySelector(".condition-other-hint");
      const optionality = root.querySelector(".description-optionality");
      if (description) {
        description.required = descriptionRequired(draft);
        description.placeholder = draft.condition === "Autre"
          ? "Précisez l’état de l’objet et décrivez-le…"
          : draft.category === "Vêtements" && draft.color === "Autre"
            ? "Précisez la couleur et décrivez le vêtement…"
            : draft.subcategory === "Autre"
              ? "Précisez la catégorie « Autre » et décrivez l’objet…"
              : "Détails utiles, contenu du lot, petites marques d’usage…";
      }
      if (hint && target.name !== "condition") hint.hidden = !isOther;
      if (conditionHint) conditionHint.hidden = draft.condition !== "Autre";
      if (optionality) optionality.textContent = description.required ? "(à préciser)" : "(facultative)";
    }
    if (target.name === "price") {
      const hint = root.querySelector(".price-hint");
      if (hint) hint.textContent = Number(target.value || 0) === 0 ? "0 € sera affiché comme un don." : "Prix affiché aux autres familles.";
    }
  });

  root.addEventListener("focusout", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.suggestionKey) return;
    target.value = titleCase(target.value);
    draft[target.dataset.suggestionKey] = target.value;
    const list = root.querySelector(`#suggestions-${target.dataset.suggestionKey}`);
    if (list) list.hidden = true;
    root.querySelector(`[data-action="toggle-suggestions"][data-key="${target.dataset.suggestionKey}"]`)
      ?.setAttribute("aria-expanded", "false");
  });

  root.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.name === "ageGroup") {
      draft.ageGroups = [...root.querySelectorAll('input[name="ageGroup"]:checked')]
        .map((input) => Number(input.value))
        .sort((left, right) => left - right);
      const derivedSizes = root.querySelector("#derived-sizes");
      if (derivedSizes) derivedSizes.textContent = derivedAgeDetails(draft.category, draft.ageGroups);
      root.querySelector(".age-picker")?.removeAttribute("aria-invalid");
      return;
    }
    if (target instanceof HTMLSelectElement) {
      draft[target.name] = target.value;
      if (target.name === "color" || target.name === "subcategory" || target.name === "condition") render();
    }
    if (target.id === "draft-photo") {
      addPhotos(target.files || []);
      target.value = "";
    }
  });

  root.addEventListener("dragover", (event) => {
    if (!(event.target instanceof Element)) return;
    const dropZone = event.target.closest("#photo-drop-zone");
    if (!dropZone) return;
    event.preventDefault();
    dropZone.classList.add("dragging");
  });

  root.addEventListener("dragleave", (event) => {
    if (!(event.target instanceof Element)) return;
    const dropZone = event.target.closest("#photo-drop-zone");
    if (dropZone && !dropZone.contains(event.relatedTarget)) dropZone.classList.remove("dragging");
  });

  root.addEventListener("drop", (event) => {
    if (!(event.target instanceof Element)) return;
    const dropZone = event.target.closest("#photo-drop-zone");
    if (!dropZone) return;
    event.preventDefault();
    dropZone.classList.remove("dragging");
    addPhotos(event.dataTransfer?.files || []);
  });

  return {
    async open(activeUser, initialMessage = "") {
      user = activeUser;
      view = "list";
      message = initialMessage;
      messageKind = "success";
      render();
      await loadListings();
    },
    showMessage(text, kind = "info") {
      setMessage(text, kind);
    },
  };
}
