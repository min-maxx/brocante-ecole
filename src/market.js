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
const FOOTWEAR_SIZES = {
  3: [25, 26],
  4: [26, 28],
  5: [28, 29],
  6: [29, 31],
  7: [31, 32],
  8: [32, 34],
  9: [34, 35],
  10: [35, 36],
  11: [37, 38],
};
const FOOTWEAR_SUBCATEGORIES = new Set(["Baskets", "Bottes de pluie", "Chaussures", "Sandales"]);
const COLORS = [
  "Blanc", "Noir", "Gris", "Beige", "Marron", "Rouge", "Rose",
  "Orange", "Jaune", "Vert", "Bleu", "Violet", "Multicolore", "Autre",
];
const LANGUAGES = ["Français", "Anglais", "Espagnol", "Allemand", "Italien", "Bilingue", "Autre"];
const CONDITIONS = ["Neuf", "Très bon", "Bon", "Satisfaisant", "À réparer", "Autre"];
const CONDITION_LABELS = {
  "Très bon": "Très bon état",
  Bon: "Bon état",
};
const MAX_PHOTOS = 3;
const SUGGESTION_MAX_LENGTH = {
  brand: 70,
  author: 70,
};
const CATEGORY_DETAILS = {
  "Vêtements": {
    icon: "👕",
    hint: "Hauts, pantalons, manteaux, chaussures…",
    titlePlaceholder: "Ex. Veste de pluie",
    subcategoryGroups: [
      { label: "Manteaux et vestes", options: ["Anorak", "Blouson", "Ciré", "Doudoune", "Imperméable", "Manteau"] },
      { label: "Hauts", options: ["Blouse", "Camisole", "Chemise", "Débardeur", "Gilet", "Maillot de corps", "Pull", "Sweat", "Sweat à capuche", "T-shirt manches courtes", "T-shirt manches longues", "Tunique"] },
      { label: "Bas et tenues", options: ["Bermuda", "Jean", "Jogging", "Jupe", "Legging", "Maillot de bain", "Pantalon", "Pyjama", "Robe", "Salopette", "Short"] },
      { label: "Chaussures", options: ["Baskets", "Bottes de pluie", "Chaussures", "Sandales"] },
      { label: "Accessoires", options: ["Bonnet", "Casquette", "Écharpe", "Gants", "Moufles"] },
    ],
    photoCaptions: ["Devant · principale", "Étiquette taille/marque", "Détail / défaut"],
    photoGuidance: ["Le vêtement de devant", "L’étiquette de taille et de marque", "Les détails ou éventuels défauts"],
  },
  "Livres": {
    icon: "📚",
    hint: "Albums, romans, BD et manga, manuels…",
    titlePlaceholder: "Ex. Les albums de Claude Ponti",
    subcategoryGroups: [
      { label: "Albums et récits", options: ["Album illustré", "Bande dessinée", "Manga", "Recueil de contes", "Roman jeunesse"] },
      { label: "Découverte et apprentissage", options: ["Dictionnaire enfant", "Documentaire jeunesse", "Encyclopédie jeunesse"] },
      { label: "Éveil et activités", options: ["Imagier", "Livre d’activités", "Livre d’énigmes", "Livre de coloriage", "Livre de comptines", "Livre interactif", "Livre sonore"] },
    ],
    photoCaptions: ["Couverture · principale", "Quatrième / ISBN", "Pages / défaut"],
    photoGuidance: ["La couverture", "La quatrième de couverture et l’ISBN", "Les pages ou défauts utiles à voir"],
  },
  "Jeux et jouets": {
    icon: "🧸",
    hint: "Dinette, puzzles, jeux de société…",
    titlePlaceholder: "Ex. Circuit de train en bois",
    subcategoryGroups: [
      { label: "Jeux de société et construction", options: ["Briques de construction", "Jeu de cartes", "Jeu de construction", "Jeu de société", "Puzzle"] },
      { label: "Imitation et figurines", options: ["Circuit de voitures", "Cuisine pour enfant", "Déguisement", "Dînette", "Figurine", "Jeu d’imitation", "Peluche", "Poupée", "Voiture miniature"] },
      { label: "Jeux créatifs et éducatifs", options: ["Coffret créatif", "Instrument de musique", "Jeu éducatif", "Jeu électronique", "Loisir créatif"] },
      { label: "Plein air et mobilité", options: ["Ballon", "Draisienne", "Jeu de plein air", "Trottinette", "Vélo enfant"] },
    ],
    photoCaptions: ["Vue d’ensemble · principale", "Contenu complet", "Règle / accessoires"],
    photoGuidance: ["La boîte ou la vue d’ensemble", "Le contenu complet étalé", "La règle, les accessoires et les pièces manquantes"],
  },
  "Matériel scolaire": {
    icon: "🎒",
    hint: "Cartables, fournitures, papeterie…",
    titlePlaceholder: "Ex. Cartable bleu",
    subcategoryGroups: [
      { label: "Papeterie et organisation", options: ["Agenda scolaire", "Cahier", "Cahier de texte", "Classeur", "Pochette de rangement", "Protège-cahier"] },
      { label: "Sacs et équipement", options: ["Cartable", "Sac à dos scolaire", "Trousse"] },
      { label: "Écriture et dessin", options: ["Crayon à papier", "Crayon de couleur", "Critérium", "Feutre", "Gomme", "Palette de peinture", "Peinture", "Stylo", "Tablier de peinture", "Taille-crayon"] },
      { label: "Mesure et découpage", options: ["Ciseaux scolaires", "Compas", "Équerre", "Rapporteur", "Règle"] },
      { label: "Matériel de classe", options: ["Ardoise effaçable"] },
    ],
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
    shoeSize: "",
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

function subcategoriesFor(category) {
  return [...category.subcategoryGroups.flatMap((group) => group.options), "Autre"];
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

function conditionLabel(condition) {
  return CONDITION_LABELS[condition] || condition;
}

function sizesForAges(ageGroups) {
  return [...new Set(ageGroups.map((age) => AGE_SIZES[age]).filter(Boolean))];
}

function footwearSizesForAges(ageGroups) {
  return [...new Set(ageGroups
    .map((age) => FOOTWEAR_SIZES[age])
    .filter(Boolean)
    .map(([start, end]) => `${start}–${end} EU`))];
}

function footwearSizeOptionsForAges(ageGroups) {
  return [...new Set(ageGroups.flatMap((age) => {
    const range = FOOTWEAR_SIZES[age];
    return range ? Array.from({ length: range[1] - range[0] + 1 }, (_, index) => range[0] + index) : [];
  }))].sort((left, right) => left - right);
}

function sizesForSubcategory(subcategory, ageGroups) {
  return FOOTWEAR_SUBCATEGORIES.has(subcategory)
    ? footwearSizesForAges(ageGroups)
    : sizesForAges(ageGroups);
}

function compactSizes(sizes) {
  const ranges = [];
  const otherLabels = [];
  for (const size of sizes) {
    const match = size.match(/(\d+)\s*(?:à|[-–])\s*(\d+)\s*(cm|EU)\b/i);
    if (match) ranges.push([match[3].toUpperCase(), Number(match[1]), Number(match[2])]);
    else otherLabels.push(size);
  }
  ranges.sort(([leftUnit, left], [rightUnit, right]) => leftUnit.localeCompare(rightUnit) || left - right);
  const mergedRanges = [];
  for (const [unit, start, end] of ranges) {
    const previous = mergedRanges.at(-1);
    if (previous && unit === previous[0] && start <= previous[2] + 1) previous[2] = Math.max(previous[2], end);
    else mergedRanges.push([unit, start, end]);
  }
  return [...otherLabels, ...mergedRanges.map(([unit, start, end]) => `${start}–${end} ${unit === "CM" ? "cm" : unit}`)].join(", ");
}

function schoolLevelsForAges(ageGroups) {
  return [...new Set(ageGroups.map((age) => SCHOOL_LEVELS[age]).filter(Boolean))];
}

function derivedAgeDetails(category, ageGroups, subcategory) {
  if (category === "Vêtements") {
    const footwear = FOOTWEAR_SUBCATEGORIES.has(subcategory);
    const sizes = compactSizes(sizesForSubcategory(subcategory, ageGroups));
    const label = footwear ? "Pointures correspondantes" : "Tailles correspondantes";
    return sizes ? `${label} : ${sizes}` : "Choisissez un ou plusieurs âges.";
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

function relativeTimeLabel(value) {
  const createdAt = Date.parse(value || "");
  if (Number.isNaN(createdAt)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 1440) return `il y a ${Math.round(minutes / 60)} h`;
  return `il y a ${Math.round(minutes / 1440)} j`;
}

function titleCase(value) {
  return value.trim().toLocaleLowerCase("fr").replace(/(^|[-\s'’])([\p{L}\p{N}])/gu, (match, separator, firstLetter) =>
    separator + firstLetter.toLocaleUpperCase("fr")
  );
}

function descriptionRequired({ category, condition, color, subcategory, language }) {
  return condition === "Autre"
    || subcategory === "Autre"
    || (category === "Vêtements" && color === "Autre")
    || (category === "Livres" && language === "Autre");
}

function descriptionPlaceholder(draft) {
  if (draft.condition === "Autre") return "Précisez l’état de l’objet et décrivez-le…";
  if (draft.category === "Vêtements" && draft.color === "Autre") return "Précisez la couleur et décrivez le vêtement…";
  if (draft.category === "Livres" && draft.language === "Autre") return "Précisez la langue du livre et décrivez-le…";
  if (draft.subcategory === "Autre") return "Précisez la catégorie « Autre » et décrivez l’objet…";
  return "Détails utiles, contenu du lot, petites marques d’usage…";
}

function getListingPhotoUrl(storage, bucketId, fileId) {
  return String(storage.getFileView(bucketId, fileId));
}

function sellerInitialsFromEmail(email) {
  const localPart = email.split("@", 1)[0].split("+", 1)[0];
  const nameParts = localPart.match(/[\p{L}\p{N}]+/gu) || [];
  return nameParts.slice(0, 2)
    .map((part) => `${Array.from(part)[0].toLocaleUpperCase("fr")}.`)
    .join(" ");
}

function ownerPermissions(userId) {
  return [
    Permission.read(Role.users()),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

function listingSellerId(listing) {
  if (listing.sellerId) return listing.sellerId;
  const permission = (listing.$permissions || []).find((value) => /^update\("user:[^"]+"\)$/.test(value));
  return permission?.match(/^update\("user:([^"]+)"\)$/)?.[1] || "";
}

export function createMarketplace({
  root,
  databases,
  storage,
  functions,
  databaseId,
  collectionId,
  requestsCollectionId,
  messagesCollectionId,
  marketFunctionId,
  photosBucketId,
  missingConfiguration = [],
  onLogout,
}) {
  let user = null;
  let listings = [];
  let purchaseRequests = [];
  let conversationMessages = [];
  let view = "list";
  let selectedListingId = "";
  let selectedConversationId = "";
  let detailPhotoIndex = 0;
  let step = 1;
  let draft = emptyDraft();
  let message = "";
  let messageKind = "info";
  let loading = false;
  let publishing = false;
  let submittingRequest = false;
  let submittingMessage = false;
  let loadingPurchaseRequests = false;
  let selectedCategory = "";
  let selectedConditions = [];
  let selectedItemFilters = {};
  let loadingConversationMessages = false;

  const configReady = missingConfiguration.length === 0
    && Boolean(
      databases
      && storage
      && functions
      && databaseId
      && collectionId
      && requestsCollectionId
      && messagesCollectionId
      && marketFunctionId
      && photosBucketId,
    );

  function setMessage(text, kind = "info") {
    message = text;
    messageKind = kind;
    render();
  }

  function headerMarkup() {
    return `<header class="market-header">
      <a class="market-brand" href="/" aria-label="Le petit marché, accueil"><span class="market-brand-mark" aria-hidden="true">p</span> le petit marché</a>
      <nav class="market-nav" aria-label="Navigation du marché">
        <button class="button-light${view !== "purchases" && view !== "sales" ? " active" : ""}" type="button" data-action="show-list"${view !== "purchases" && view !== "sales" ? ' aria-current="page"' : ""}>Annonces</button>
        <button class="button-light${view === "purchases" ? " active" : ""}" type="button" data-action="show-purchases"${view === "purchases" ? ' aria-current="page"' : ""}>Mes achats</button>
        <button class="button-light${view === "sales" ? " active" : ""}" type="button" data-action="show-sales"${view === "sales" ? ' aria-current="page"' : ""}>Mes ventes</button>
      </nav>
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
    const itemDetails = [listing.subcategory];
    const ageDetails = [ageLabel(ages)];
    if (listing.category === "Vêtements") {
      const footwear = FOOTWEAR_SUBCATEGORIES.has(listing.subcategory);
      const sizes = footwear
        ? footwearSizesForAges(ages)
        : Array.isArray(listing.sizes) && listing.sizes.length
          ? listing.sizes
          : sizesForAges(ages);
      itemDetails.push(listing.brand, listing.color);
      if (footwear && Number.isInteger(listing.shoeSize) && listing.shoeSize > 0) {
        ageDetails.push(`Pointure ${listing.shoeSize} EU`);
      } else {
        const compactSize = compactSizes(sizes);
        if (compactSize) ageDetails.push(compactSize);
      }
    } else {
      if (listing.category === "Livres") itemDetails.push(listing.author, listing.language);
      else itemDetails.push(listing.brand);
      if (listing.category === "Matériel scolaire") ageDetails.push(...schoolLevelsForAges(ages));
    }
    return {
      item: itemDetails.filter(Boolean),
      ages: ageDetails.filter(Boolean),
    };
  }

  function listingCardMarkup(listing) {
    const photoId = Array.isArray(listing.photoIds) ? listing.photoIds[0] : null;
    const photoMarkup = photoId
      ? `<img src="${escapeHtml(getListingPhotoUrl(storage, photosBucketId, photoId))}" alt="Photo principale de ${escapeHtml(listing.title)}">`
      : `<div class="listing-photo-placeholder" aria-hidden="true">${escapeHtml(CATEGORY_DETAILS[listing.category]?.icon || "📦")}</div>`;
    const details = listingDetails(listing);
    const itemDetailsMarkup = details.item.map(escapeHtml).join(" · ");

    return `<a class="listing-card" href="#listing-${escapeHtml(listing.$id)}" data-action="open-listing" data-listing-id="${escapeHtml(listing.$id)}" aria-label="Consulter l’annonce : ${escapeHtml(listing.title)}">
      <div class="listing-photo">${photoMarkup}</div>
      <div class="listing-card-content">
        <p class="listing-price">${escapeHtml(priceLabel(listing.price))}</p>
        <h2>${escapeHtml(listing.title)}</h2>
        <p class="listing-card-details">${itemDetailsMarkup}</p>
        <p class="listing-card-age-details">${details.ages.map(escapeHtml).join(" · ")}</p>
        <div class="listing-card-footer">
          <span class="listing-card-tag listing-category-tag">${escapeHtml(listing.category)}</span>
          <span class="listing-card-tag listing-condition-tag">${escapeHtml(conditionLabel(listing.condition))}</span>
        </div>
      </div>
    </a>`;
  }

  function uniqueListingValues(categoryListings, key) {
    return [...new Set(categoryListings
      .map((listing) => listing[key])
      .filter((value) => typeof value === "string" && value.trim()))]
      .sort((left, right) => left.localeCompare(right, "fr"));
  }

  function ageFilterOptions(categoryListings) {
    const ages = [...new Set(categoryListings.flatMap((listing) =>
      Array.isArray(listing.ageGroups) ? listing.ageGroups.map(Number) : []
    ))]
      .filter((age) => Number.isInteger(age) && AGE_SIZES[age])
      .sort((left, right) => left - right);

    return ages.map((age) => {
      let detail = "";
      if (selectedCategory === "Vêtements") {
        const sizes = new Set(categoryListings
          .filter((listing) => Array.isArray(listing.ageGroups) && listing.ageGroups.some((listingAge) => Number(listingAge) === age))
          .flatMap((listing) => sizesForSubcategory(listing.subcategory, [age])));
        detail = [...sizes].join(" / ") || AGE_SIZES[age];
      } else if (selectedCategory === "Matériel scolaire") {
        detail = schoolLevelsForAges([age]).join(" / ");
      }
      return {
        value: String(age),
        label: `${age} ans${detail ? ` · ${detail}` : ""}`,
      };
    });
  }

  function categoryFilterSpecs(categoryListings) {
    const specs = [{
      key: "subcategory",
      label: "Type / genre",
      options: uniqueListingValues(categoryListings, "subcategory").map((value) => ({ value, label: value })),
    }];

    if (selectedCategory === "Vêtements" || selectedCategory === "Jeux et jouets" || selectedCategory === "Matériel scolaire") {
      specs.push({
        key: "brand",
        label: "Marque",
        options: uniqueListingValues(categoryListings, "brand").map((value) => ({ value, label: value })),
      });
    }
    if (selectedCategory === "Livres") {
      specs.push({
        key: "author",
        label: "Auteur / autrice",
        options: uniqueListingValues(categoryListings, "author").map((value) => ({ value, label: value })),
      }, {
        key: "language",
        label: "Langue",
        options: uniqueListingValues(categoryListings, "language").map((value) => ({ value, label: value })),
      });
    }

    specs.push({
      key: "ageGroup",
      label: selectedCategory === "Vêtements"
        ? "Âge – taille"
        : selectedCategory === "Matériel scolaire"
          ? "Âge – classe"
          : "Âge",
      options: ageFilterOptions(categoryListings),
    });
    return specs;
  }

  function filterSelectMarkup({ key, label, options }) {
    return `<label class="listing-filter" for="listing-filter-${escapeHtml(key)}">
      <span>${escapeHtml(label)}</span>
      <select id="listing-filter-${escapeHtml(key)}" data-item-filter="${escapeHtml(key)}"${options.length ? "" : " disabled"}>
        <option value="">Tous</option>
        ${options.map(({ value, label: optionLabel }) =>
          `<option value="${escapeHtml(value)}"${selectedItemFilters[key] === value ? " selected" : ""}>${escapeHtml(optionLabel)}</option>`
        ).join("")}
      </select>
    </label>`;
  }

  function listingFiltersMarkup() {
    const categoryListings = selectedCategory
      ? listings.filter((listing) => listing.category === selectedCategory)
      : [];
    const categoryOptions = Object.keys(CATEGORY_DETAILS).map((category) =>
      `<option value="${escapeHtml(category)}"${selectedCategory === category ? " selected" : ""}>${escapeHtml(category)}</option>`
    ).join("");
    const categoryFilters = selectedCategory
      ? categoryFilterSpecs(categoryListings).map(filterSelectMarkup).join("")
      : "";

    return `<section class="listing-filters" aria-labelledby="listing-filter-heading">
      <div class="listing-filters-header">
        <h2 id="listing-filter-heading">Filtrer les annonces</h2>
        <button class="text-button" type="button" data-action="reset-filters">Tout effacer</button>
      </div>
      <div class="listing-filter-grid">
        <label class="listing-filter" for="listing-filter-category">
          <span>Catégorie</span>
          <select id="listing-filter-category" data-listing-filter="category">
            <option value=""${selectedCategory ? "" : " selected"}>Toutes les catégories</option>
            ${categoryOptions}
          </select>
        </label>
        <fieldset class="listing-condition-filter">
          <legend>État de l’objet</legend>
          <div class="listing-condition-options">${CONDITIONS.map((condition, index) =>
            `<label class="listing-condition-option" for="listing-condition-${index}">
              <input id="listing-condition-${index}" type="checkbox" data-condition-filter="${escapeHtml(condition)}"${selectedConditions.includes(condition) ? " checked" : ""}>
              <span>${escapeHtml(condition)}</span>
            </label>`
          ).join("")}</div>
        </fieldset>
        ${categoryFilters}
      </div>
    </section>`;
  }

  function matchesListingFilters(listing) {
    if (selectedCategory && listing.category !== selectedCategory) return false;
    if (selectedConditions.length && !selectedConditions.includes(listing.condition)) return false;
    return Object.entries(selectedItemFilters).every(([key, value]) => {
      if (!value) return true;
      if (key === "ageGroup") {
        return Array.isArray(listing.ageGroups) && listing.ageGroups.some((age) => Number(age) === Number(value));
      }
      return listing[key] === value;
    });
  }

  function listMarkup() {
    const matchingListings = listings.filter(matchesListingFilters);
    const content = loading
      ? `<p class="market-empty" role="status">Chargement des annonces…</p>`
      : !listings.length
        ? `<section class="market-empty">
            <p class="market-empty-icon" aria-hidden="true">👕</p>
            <h2>Aucune annonce pour le moment</h2>
          <p>Déposez la première annonce du marché.</p>
          </section>`
      : matchingListings.length
        ? `<div class="listing-grid">${matchingListings.map(listingCardMarkup).join("")}</div>`
        : `<section class="market-empty" role="status">
            <h2>Aucune annonce ne correspond à ces filtres</h2>
            <p>Modifiez vos critères ou effacez les filtres pour retrouver toutes les annonces.</p>
            <button class="button-light" type="button" data-action="reset-filters">Tout effacer</button>
          </section>`;
    const resultCount = loading ? "" : `<p class="listing-result-count" role="status" aria-live="polite">${matchingListings.length} annonce${matchingListings.length === 1 ? "" : "s"}</p>`;

    return `<main class="market-main">
      <div class="market-heading">
        <div><p class="eyebrow">Le marché des familles de l’école</p><h1>Les annonces du marché</h1></div>
        <button class="button-primary" type="button" data-action="new-listing">Déposer une annonce</button>
      </div>
      ${message ? `<p class="market-message" data-kind="${escapeHtml(messageKind)}" role="${["error", "configuration"].includes(messageKind) ? "alert" : "status"}">${escapeHtml(message)}${messageKind === "error" && !loading ? `<button class="text-button" type="button" data-action="retry-list">Réessayer</button>` : ""}</p>` : ""}
      ${listingFiltersMarkup()}
      ${resultCount}
      ${content}
    </main>`;
  }

  function listingDetailMarkup() {
    const listing = listings.find((item) => item.$id === selectedListingId);
    if (!listing) {
      return `<main class="market-main">
        <button class="button-light listing-detail-back" type="button" data-action="back-to-list">← Retour aux annonces</button>
        <section class="market-empty"><h2>Cette annonce n’est plus disponible.</h2></section>
      </main>`;
    }

    const photoIds = Array.isArray(listing.photoIds) ? listing.photoIds.slice(0, MAX_PHOTOS) : [];
    const photoIndex = photoIds.length ? Math.min(detailPhotoIndex, photoIds.length - 1) : 0;
    const photoId = photoIds[photoIndex];
    const photoMarkup = photoId
      ? `<img src="${escapeHtml(getListingPhotoUrl(storage, photosBucketId, photoId))}" alt="Photo ${photoIndex + 1} sur ${photoIds.length} de ${escapeHtml(listing.title)}">`
      : `<div class="listing-gallery-placeholder" aria-hidden="true">${escapeHtml(CATEGORY_DETAILS[listing.category]?.icon || "📦")}</div>`;
    const counterMarkup = photoIds.length
      ? `<span class="listing-gallery-count" aria-live="polite">${photoIndex + 1} / ${photoIds.length}</span>`
      : "";
    const navigationMarkup = photoIds.length > 1
      ? `<button class="listing-gallery-nav previous" type="button" data-action="gallery-previous" aria-label="Photo précédente">‹</button>
        <button class="listing-gallery-nav next" type="button" data-action="gallery-next" aria-label="Photo suivante">›</button>`
      : "";
    const thumbnailsMarkup = photoIds.length > 1
      ? `<div class="listing-gallery-thumbnails" aria-label="Choisir une photo">${photoIds.map((id, index) =>
        `<button type="button" data-action="select-detail-photo" data-photo-index="${index}" aria-label="Afficher la photo ${index + 1}" aria-pressed="${index === photoIndex}">
          <img src="${escapeHtml(getListingPhotoUrl(storage, photosBucketId, id))}" alt="">
        </button>`
      ).join("")}</div>`
      : "";
    const details = listingDetails(listing);
    const sellerInitials = listing.sellerInitials || "";
    const sellerLabel = sellerInitials || "Famille";
    const rows = [
      ["Catégorie", listing.category],
      ["Type / genre", listing.subcategory],
      ["État", conditionLabel(listing.condition)],
      ["Âge", details.ages.join(" · ")],
      ["Détails", details.item.slice(1).join(" · ")],
    ].filter(([, value]) => value);
    const sellerId = listingSellerId(listing);
    const requestMarkup = sellerId === user?.$id
      ? `<div class="purchase-request-own"><p class="purchase-request-note">C’est votre annonce.</p><button class="button-light" type="button" data-action="show-sales">Voir mes ventes</button></div>`
      : sellerId
        ? `<form class="purchase-request-form${Number(listing.price) === 0 ? " donation-request-form" : ""}" id="purchase-request-form" data-request-type="${Number(listing.price) === 0 ? "donation" : "offer"}" aria-label="${Number(listing.price) === 0 ? "Demander ce don" : "Faire une offre"}">
            <h2>${Number(listing.price) === 0 ? "Demander ce don" : "Faire une offre"}</h2>
            ${Number(listing.price) === 0 ? "" : `<label class="form-field" for="purchase-offer-amount">Votre offre
              <input id="purchase-offer-amount" name="amount" type="number" min="1" step="1" value="${escapeHtml(listing.price)}" required${submittingRequest ? " disabled" : ""}>
            </label>`}
            <label class="form-field purchase-request-message-field" for="purchase-request-message">Message <span>(facultatif)</span>
              <textarea id="purchase-request-message" name="message" rows="3" maxlength="1000" placeholder="Bonjour, je suis intéressé·e…"${submittingRequest ? " disabled" : ""}></textarea>
            </label>
            <button class="button-primary" type="submit"${submittingRequest ? " disabled" : ""}>${submittingRequest ? "Envoi en cours…" : Number(listing.price) === 0 ? "Envoyer ma demande" : "Envoyer une offre"}</button>
          </form>`
        : `<p class="purchase-request-note">Cette annonce ne peut pas recevoir de demande pour le moment.</p>`;

    return `<main class="market-main">
      <button class="button-light listing-detail-back" type="button" data-action="back-to-list">← Retour aux annonces</button>
      ${message ? `<p class="market-message" data-kind="${escapeHtml(messageKind)}" role="${messageKind === "error" ? "alert" : "status"}">${escapeHtml(message)}</p>` : ""}
      <article class="listing-detail">
        <section class="listing-detail-gallery" aria-label="Galerie de photos">
          <div class="listing-gallery-main">
            ${photoMarkup}
            ${navigationMarkup}
            ${counterMarkup}
          </div>
          ${thumbnailsMarkup}
        </section>
        <div class="listing-detail-content">
          <span class="listing-detail-condition">${escapeHtml(conditionLabel(listing.condition))}</span>
          <h1>${escapeHtml(listing.title)}</h1>
          <p class="listing-price">${escapeHtml(priceLabel(listing.price))}</p>
          <p class="listing-detail-seller">Proposé par <strong>${escapeHtml(sellerLabel)}</strong> · ${escapeHtml(details.ages.join(" · "))}</p>
          <dl class="listing-detail-rows">${rows.map(([label, value]) =>
            `<div class="listing-detail-row${label === "Âge" ? " listing-detail-age" : ""}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
          ).join("")}</dl>
          <p class="listing-detail-description">${escapeHtml(listing.description || "Aucune description ajoutée.")}</p>
          <section class="purchase-request" aria-label="Demande d’achat ou de don">
            ${requestMarkup}
          </section>
        </div>
      </article>
    </main>`;
  }

  function requestPriceMarkup(request) {
    return request.type === "donation"
      ? `<span class="purchase-card-prices">Demande de don</span>`
      : `<span class="purchase-card-prices"><strong>${Number(request.amount)} € proposés</strong><s>${escapeHtml(priceLabel(request.listingPrice))}</s></span>`;
  }

  function requestStatusLabel(request) {
    const statusLabels = {
      pending: "En attente",
      accepted: "Acceptée",
      rejected: "Refusée",
    };
    return statusLabels[request.status] || "Statut inconnu";
  }

  function purchaseRequestCardMarkup(request, role) {
    const photoMarkup = request.listingPhotoId
      ? `<img src="${escapeHtml(getListingPhotoUrl(storage, photosBucketId, request.listingPhotoId))}" alt="">`
      : `<span aria-hidden="true">📦</span>`;
    const otherFamily = role === "sales"
      ? request.buyerInitials || "Famille acheteuse"
      : request.sellerInitials || "Famille vendeuse";
    const fallbackPreview = request.type === "donation" ? "Demande de don" : `Offre : ${Number(request.amount)} €`;
    const requestLabel = request.type === "donation" ? "Demande de don" : "Offre de prix";

    return `<button class="purchase-card" type="button" data-action="open-conversation" data-request-id="${escapeHtml(request.$id)}" aria-label="Ouvrir la conversation avec ${escapeHtml(otherFamily)} pour ${escapeHtml(request.listingTitle)}">
      <span class="purchase-card-photo">${photoMarkup}</span>
      <span class="purchase-card-content">
        <span class="eyebrow">${escapeHtml(otherFamily)}</span>
        <span class="purchase-card-preview">${escapeHtml(request.lastMessage || fallbackPreview)}</span>
        <span class="purchase-card-kind">${requestLabel}</span>
        <span class="purchase-card-title">${escapeHtml(request.listingTitle)}</span>
        ${requestPriceMarkup(request)}
        <span class="purchase-card-status" data-status="${escapeHtml(request.status)}">Statut : ${escapeHtml(requestStatusLabel(request))}</span>
      </span>
    </button>`;
  }

  function conversationThreadMarkup(role) {
    const request = purchaseRequests.find((item) => item.$id === selectedConversationId);
    if (!request) return `<section class="market-empty"><h2>Cette conversation n’est plus disponible.</h2></section>`;

    const otherFamily = role === "sales"
      ? request.buyerInitials || "Famille acheteuse"
      : request.sellerInitials || "Famille vendeuse";
    const offerLabel = request.type === "donation" ? "Demande de don" : `Offre : ${Number(request.amount)} €`;
    const offerIsMine = request.buyerId === user?.$id;
    const offerTime = Date.parse(request.$createdAt);
    const listing = listings.find((item) => item.$id === request.listingId);
    const listingPreview = [
      priceLabel(request.listingPrice),
      listing ? conditionLabel(listing.condition) : "",
    ].filter(Boolean).join(" · ");
    const events = [
      {
        kind: "offer",
        createdAt: Number.isNaN(offerTime) ? 0 : offerTime,
        markup: `<article class="conversation-message conversation-offer${offerIsMine ? " mine" : ""}">
          <strong class="offer-amount">${escapeHtml(offerLabel)}</strong>
          <span class="offer-state">${escapeHtml(requestStatusLabel(request))}</span>
          ${Number.isNaN(offerTime) ? "" : `<small><time datetime="${new Date(offerTime).toISOString()}">${escapeHtml(relativeTimeLabel(request.$createdAt))}</time></small>`}
        </article>`,
      },
      ...conversationMessages.map((item) => ({
        kind: "message",
        createdAt: Date.parse(item.$createdAt) || 0,
        markup: `<article class="conversation-message${item.senderId === user?.$id ? " mine" : ""}">
          <span>${item.senderId === user?.$id ? "Vous" : escapeHtml(otherFamily)}</span>
          <p>${escapeHtml(item.content)}</p>
        </article>`,
      })),
    ];
    const eventsMarkup = events
      .sort((left, right) => left.createdAt - right.createdAt)
      .map((item) => item.markup)
      .join("");
    const photoMarkup = request.listingPhotoId
      ? `<img src="${escapeHtml(getListingPhotoUrl(storage, photosBucketId, request.listingPhotoId))}" alt="">`
      : `<span aria-hidden="true">📦</span>`;

    return `<section class="conversation-view">
      <button class="button-light conversation-back" type="button" data-action="close-conversation">← ${role === "sales" ? "Mes ventes" : "Mes achats"}</button>
      <article class="conversation-thread">
        <header class="conversation-thread-header">
          <h1>Conversation avec ${escapeHtml(otherFamily)}</h1>
          <p>${role === "sales" ? "Acheteur" : "Vendeur"}</p>
        </header>
        <div class="conversation-listing-preview">
          <span class="purchase-card-photo">${photoMarkup}</span>
          <span class="conversation-listing-details">
            <strong>${escapeHtml(request.listingTitle)}</strong>
            <span>${escapeHtml(listingPreview)}</span>
          </span>
          <button class="conversation-listing-link" type="button" data-action="open-listing" data-listing-id="${escapeHtml(request.listingId)}" aria-label="Voir l’annonce : ${escapeHtml(request.listingTitle)}">Voir l’annonce</button>
        </div>
        ${message && messageKind === "error" ? `<p class="market-message" data-kind="error" role="alert">${escapeHtml(message)}${loadingConversationMessages ? "" : `<button class="text-button" type="button" data-action="retry-conversation">Réessayer</button>`}</p>` : ""}
        <div class="conversation-events" aria-label="Messages et offres de la conversation" aria-live="polite">
          ${loadingConversationMessages ? `<p role="status">Chargement de la conversation…</p>` : eventsMarkup}
        </div>
        <form class="conversation-message-form" id="conversation-message-form">
          <label class="form-field" for="conversation-message-input">Votre message
            <textarea id="conversation-message-input" name="content" rows="3" maxlength="1000" required${submittingMessage ? " disabled" : ""}></textarea>
          </label>
          <button class="button-primary" type="submit"${submittingMessage ? " disabled" : ""}>${submittingMessage ? "Envoi…" : "Envoyer"}</button>
        </form>
      </article>
    </section>`;
  }

  function purchasesMarkup(role) {
    const isSale = role === "sales";
    const heading = isSale ? "Mes ventes" : "Mes achats";
    const description = isSale
      ? "Vos conversations avec les acheteurs, de la plus récente à la plus ancienne."
      : "Vos conversations avec les vendeurs, de la plus récente à la plus ancienne.";
    const content = selectedConversationId
      ? conversationThreadMarkup(role)
      : loadingPurchaseRequests
        ? `<p class="market-empty" role="status">Chargement de vos conversations…</p>`
        : purchaseRequests.length
          ? `<div class="purchase-list">${purchaseRequests.map((request) => purchaseRequestCardMarkup(request, role)).join("")}</div>`
          : `<section class="market-empty">
              <p class="market-empty-icon" aria-hidden="true">${isSale ? "🏷️" : "🛍️"}</p>
              <h2>${isSale ? "Aucune vente pour le moment" : "Aucun achat pour le moment"}</h2>
              <p>${isSale ? "Les conversations avec les acheteurs apparaîtront ici." : "Vos offres et demandes de don apparaîtront ici."}</p>
            </section>`;

    return `<main class="market-main">
      <div class="market-heading">
        <div><p class="eyebrow">${escapeHtml(description)}</p><h1>${heading}</h1></div>
        <button class="button-light" type="button" data-action="show-list">← Voir les annonces</button>
      </div>
      ${message && !(selectedConversationId && messageKind === "error") ? `<p class="market-message" data-kind="${escapeHtml(messageKind)}" role="${messageKind === "error" ? "alert" : "status"}">${escapeHtml(message)}${messageKind === "error" ? `<button class="text-button" type="button" data-action="retry-purchases">Réessayer</button>` : ""}</p>` : ""}
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
    const derivedLabel = derivedAgeDetails(draft.category, draft.ageGroups, draft.subcategory);
    const footwear = FOOTWEAR_SUBCATEGORIES.has(draft.subcategory);
    const shoeSizeOptions = footwearSizeOptionsForAges(draft.ageGroups);
    const shoeSizeField = footwear
      ? `<div class="form-field">
          <label for="draft-shoe-size">Pointure</label>
          <select id="draft-shoe-size" name="shoeSize" required${shoeSizeOptions.length ? "" : " disabled"}><option value="">Choisir une pointure</option>${shoeSizeOptions.map((size) => `<option value="${size}"${draft.shoeSize === String(size) ? " selected" : ""}>${size}</option>`).join("")}</select>
          <span class="field-hint shoe-size-hint">Les pointures proposées dépendent des âges sélectionnés.</span>
        </div>`
      : "";
    const subcategoryMarkup = `<div class="form-field">
      <label for="draft-subcategory">Genre/Type</label>
      <select id="draft-subcategory" name="subcategory" required><option value="">Choisir un genre/type</option>${category.subcategoryGroups.map((group) => `<optgroup label="${escapeHtml(group.label)}">${group.options.map((subcategory) => `<option value="${escapeHtml(subcategory)}"${draft.subcategory === subcategory ? " selected" : ""}>${escapeHtml(subcategory)}</option>`).join("")}</optgroup>`).join("")}<option value="Autre"${draft.subcategory === "Autre" ? " selected" : ""}>Autre</option></select>
      <span class="field-hint">Les types sont regroupés par famille et classés par ordre alphabétique.</span>
      <span class="field-hint subcategory-other-hint"${draft.subcategory === "Autre" ? "" : " hidden"}>Précisez dans la description.</span>
    </div>`;
    const brandField = `<div class="form-field">
      <label for="draft-brand">Marque <span class="optional">(facultative)</span></label>
      ${suggestedInputMarkup("brand", "Marque", draft.category === "Jeux et jouets" ? "Ex. Playmobil" : draft.category === "Matériel scolaire" ? "Ex. Eastpak" : "Ex. Okaïdi")}
    </div>`;
    const colorField = `<div class="form-field">
      <label for="draft-color">Couleur</label>
      <select id="draft-color" name="color" required><option value="">Choisir une couleur</option>${COLORS.map((color) => `<option value="${escapeHtml(color)}"${draft.color === color ? " selected" : ""}>${escapeHtml(color)}</option>`).join("")}</select>
      <span class="field-hint color-other-hint"${draft.color === "Autre" ? "" : " hidden"}>Précisez la couleur dans la description.</span>
    </div>`;
    const extraFields = draft.category === "Vêtements"
      ? `${brandField}${colorField}`
      : draft.category === "Livres"
        ? `<div class="form-field">
            <label for="draft-author">Auteur <span class="optional">(facultatif)</span></label>
            ${suggestedInputMarkup("author", "Auteur", "Ex. Claude Ponti")}
          </div>
          <div class="form-field">
            <label for="draft-language">Langue</label>
            <select id="draft-language" name="language"><option value="">Choisir une langue (facultatif)</option>${LANGUAGES.map((language) => `<option value="${escapeHtml(language)}"${draft.language === language ? " selected" : ""}>${escapeHtml(language)}</option>`).join("")}</select>
            <span class="field-hint language-other-hint"${draft.language === "Autre" ? "" : " hidden"}>Précisez la langue dans la description.</span>
          </div>`
        : brandField;
    return `<section class="wizard-panel" aria-labelledby="object-heading">
      <p class="fixed-category">Catégorie choisie : ${escapeHtml(draft.category)}</p>
      <h2 id="object-heading">Décrivez l’objet</h2>
      <p>Renseignez les précisions utiles aux autres familles.</p>
      <form id="object-form" novalidate>
        <div class="object-form-grid">
          ${subcategoryMarkup}
          <label class="form-field">État
            <select name="condition" required><option value="">Choisir l’état</option>${CONDITIONS.map((condition) => `<option value="${escapeHtml(condition)}"${draft.condition === condition ? " selected" : ""}>${escapeHtml(conditionLabel(condition))}</option>`).join("")}</select>
            <span class="field-hint condition-other-hint"${draft.condition === "Autre" ? "" : " hidden"}>Précisez l’état de l’objet dans la description.</span>
          </label>
          <fieldset class="age-picker">
            <legend>Âges concernés (3 à 11 ans) <span aria-hidden="true">*</span></legend>
            <div class="age-options">${ageChoices.map((age) => `<label class="age-option"><input type="checkbox" name="ageGroup" value="${age}"${draft.ageGroups.includes(age) ? " checked" : ""}><span>${age} ans</span></label>`).join("")}</div>
            <p class="field-hint">${ageHint}</p>
            ${derivedLabel ? `<p class="derived-value" id="derived-sizes" aria-live="polite">${escapeHtml(derivedLabel)}</p>` : ""}
          </fieldset>
          <label class="form-field">Titre
            <input name="title" value="${escapeHtml(draft.title)}" maxlength="70" placeholder="${escapeHtml(category.titlePlaceholder)}" required>
          </label>
          ${extraFields}
          ${shoeSizeField}
          <label class="form-field">Prix (€)
            <input name="price" type="number" min="0" step="1" value="${escapeHtml(draft.price)}" placeholder="0 pour donner" required>
            <span class="field-hint price-hint">${Number(draft.price || 0) === 0 ? "0 € sera affiché comme un don." : "Prix affiché aux autres familles."}</span>
          </label>
          <label class="form-field full">Description <span class="optional description-optionality">${needsDetail ? "(à préciser)" : "(facultative)"}</span>
            <textarea name="description" maxlength="500"${needsDetail ? " required" : ""} placeholder="${escapeHtml(descriptionPlaceholder(draft))}">${escapeHtml(draft.description)}</textarea>
          </label>
        </div>
      </form>
      <div class="wizard-actions"><button class="button-light" type="button" data-action="back">← Retour aux photos</button><button class="button-primary" type="button" data-action="continue">Voir l’aperçu</button></div>
    </section>`;
  }

  function previewDetailValues() {
    if (draft.category === "Vêtements") {
      return [draft.subcategory, draft.brand, draft.color].filter(Boolean);
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
    const footwear = FOOTWEAR_SUBCATEGORIES.has(draft.subcategory);
    const derived = draft.category === "Vêtements" && !footwear
      ? compactSizes(sizesForAges(draft.ageGroups))
      : draft.category === "Matériel scolaire"
        ? schoolLevelsForAges(draft.ageGroups).join(" / ")
        : "";
    const ageDetails = footwear
      ? `${ages} · Pointure ${draft.shoeSize} EU`
      : `${ages}${derived ? ` · ${derived}` : ""}`;
    const details = previewDetailValues();
    return `<section class="wizard-panel" aria-labelledby="preview-heading">
      <p class="fixed-category">Catégorie choisie : ${escapeHtml(draft.category)}</p>
      <h2 id="preview-heading">Vérifiez votre annonce</h2>
      <p>Voici ce que les autres familles verront dans les annonces du marché.</p>
      <article class="preview-card">
        <div class="preview-image"><img src="${escapeHtml(draft.photos[0]?.url || "")}" alt="Photo principale de ${escapeHtml(draft.title)}"></div>
        <div class="preview-details">
          <p class="listing-condition">${escapeHtml(conditionLabel(draft.condition))}</p>
          <h3>${escapeHtml(draft.title)}</h3>
          <p>${details.map(escapeHtml).join(" · ")}</p>
          <p>${escapeHtml(ageDetails)}</p>
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
    const content = view === "wizard" ? wizardMarkup()
      : view === "detail" ? listingDetailMarkup()
        : view === "purchases" || view === "sales" ? purchasesMarkup(view)
        : listMarkup();
    root.innerHTML = `<div class="market-app">${headerMarkup()}${content}</div>`;
  }

  function updateFootwearSizeOptions() {
    const select = root.querySelector("#draft-shoe-size");
    if (!select) return;
    const options = footwearSizeOptionsForAges(draft.ageGroups);
    if (!options.includes(Number(draft.shoeSize))) draft.shoeSize = "";
    select.disabled = options.length === 0;
    select.innerHTML = `<option value="">Choisir une pointure</option>${options.map((size) => `<option value="${size}"${draft.shoeSize === String(size) ? " selected" : ""}>${size}</option>`).join("")}`;
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
    if (FOOTWEAR_SUBCATEGORIES.has(draft.subcategory)
      && !footwearSizeOptionsForAges(draft.ageGroups).includes(Number(draft.shoeSize))) {
      setMessage("Choisissez une pointure correspondant aux âges sélectionnés.", "error");
      root.querySelector("#draft-shoe-size")?.focus();
      return false;
    }
    if (!CATEGORY_DETAILS[draft.category] || !subcategoriesFor(CATEGORY_DETAILS[draft.category]).includes(draft.subcategory)) {
      setMessage("Choisissez un type ou un genre dans la liste.", "error");
      return false;
    }
    if (draft.category === "Vêtements" && !COLORS.includes(draft.color)) {
      setMessage("Choisissez une couleur dans la liste.", "error");
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

  async function executeMarketFunction(body) {
    const execution = await functions.createExecution({
      functionId: marketFunctionId,
      body: JSON.stringify(body),
      async: false,
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    let response;
    try {
      response = JSON.parse(execution.responseBody || "{}");
    } catch {
      throw new Error("La réponse du service de conversation est invalide.");
    }
    if (execution.responseStatusCode < 200 || execution.responseStatusCode >= 300) {
      const error = new Error(response.message || "Le service de conversation a refusé la demande.");
      error.code = response.code;
      throw error;
    }
    return response;
  }

  async function loadPurchaseRequests(role = view) {
    if (!configReady) {
      setMessage("La configuration des demandes d’achat et de don est incomplète.", "configuration");
      return;
    }
    selectedConversationId = "";
    conversationMessages = [];
    loadingPurchaseRequests = true;
    render();
    try {
      const result = await databases.listDocuments(databaseId, requestsCollectionId, [
        Query.equal(role === "sales" ? "sellerId" : "buyerId", user.$id),
        Query.orderDesc("$updatedAt"),
        Query.limit(100),
      ]);
      purchaseRequests = result.documents.sort((left, right) =>
        String(right.$updatedAt || right.$createdAt || "").localeCompare(String(left.$updatedAt || left.$createdAt || ""))
      );
      message = "";
      loadingPurchaseRequests = false;
      render();
    } catch (error) {
      console.error("Impossible de charger les conversations.", error);
      loadingPurchaseRequests = false;
      setMessage("Impossible de charger vos conversations. Vérifiez votre connexion et réessayez.", "error");
    }
  }

  async function loadConversationMessages(requestId = selectedConversationId) {
    if (!configReady || !requestId) return;
    loadingConversationMessages = true;
    message = "";
    render();
    try {
      const result = await databases.listDocuments(databaseId, messagesCollectionId, [
        Query.equal("requestId", requestId),
        Query.orderAsc("$createdAt"),
        Query.limit(100),
      ]);
      conversationMessages = result.documents.sort((left, right) =>
        String(left.$createdAt || "").localeCompare(String(right.$createdAt || ""))
      );
      loadingConversationMessages = false;
      render();
    } catch (error) {
      console.error("Impossible de charger les messages de la conversation.", error);
      loadingConversationMessages = false;
      message = "Impossible de charger les messages. Vérifiez votre connexion et réessayez.";
      messageKind = "error";
      render();
    }
  }

  async function openConversation(requestId) {
    if (!purchaseRequests.some((request) => request.$id === requestId)) return;
    selectedConversationId = requestId;
    conversationMessages = [];
    await loadConversationMessages(requestId);
  }

  async function createPurchaseRequest(listingId, type, amount, initialMessage = "") {
    if (submittingRequest) return;
    const listing = listings.find((item) => item.$id === listingId);
    const sellerId = listing && listingSellerId(listing);
    if (!listing || !sellerId || sellerId === user?.$id || !configReady) {
      setMessage("Cette annonce ne peut pas recevoir votre demande pour le moment.", "error");
      return;
    }
    if (typeof initialMessage !== "string" || initialMessage.trim().length > 1000) {
      setMessage("Votre message ne peut pas dépasser 1 000 caractères.", "error");
      return;
    }
    if (type === "donation" && Number(listing.price) !== 0) {
      setMessage("Cette annonce n’est pas proposée gratuitement.", "error");
      return;
    }
    if (type === "offer" && (!Number.isSafeInteger(amount) || amount < 1)) {
      setMessage("Saisissez une offre en euros sous la forme d’un nombre entier supérieur à zéro.", "error");
      return;
    }

    submittingRequest = true;
    message = "";
    render();
    try {
      const result = await executeMarketFunction({
        action: "create-request",
        listingId: listing.$id,
        type,
        amount,
        message: initialMessage.trim(),
      });
      if (!result.request?.$id || !Array.isArray(result.messages)) {
        throw new Error("La réponse du service de conversation est incomplète.");
      }
      const request = result.request;
      purchaseRequests = [request, ...purchaseRequests.filter((item) => item.$id !== request.$id)];
      view = "purchases";
      selectedConversationId = request.$id;
      conversationMessages = result.messages;
      message = type === "donation" ? "Votre demande de don a été envoyée." : "Votre offre a été envoyée.";
      messageKind = "success";
    } catch (error) {
      console.error("Impossible d’envoyer la demande d’achat ou de don.", error);
      message = type === "donation"
        ? "L’envoi de votre demande de don a échoué. Vérifiez votre connexion et réessayez."
        : "L’envoi de votre offre a échoué. Vérifiez votre connexion et réessayez.";
      messageKind = "error";
    } finally {
      submittingRequest = false;
      render();
    }
  }

  async function sendConversationMessage(content) {
    if (submittingMessage || !selectedConversationId) return;
    const text = typeof content === "string" ? content.trim() : "";
    if (!text || text.length > 1000) return;

    submittingMessage = true;
    message = "";
    render();
    try {
      const result = await executeMarketFunction({
        action: "send-message",
        requestId: selectedConversationId,
        content: text,
      });
      if (!result.message?.$id || !result.request?.$id) {
        throw new Error("La réponse du service de conversation est incomplète.");
      }
      conversationMessages = [...conversationMessages, result.message];
      purchaseRequests = purchaseRequests.map((request) =>
        request.$id === result.request.$id ? result.request : request
      );
      message = "";
    } catch (error) {
      console.error("Impossible d’envoyer le message.", error);
      message = "L’envoi du message a échoué. Vérifiez votre connexion et réessayez.";
      messageKind = "error";
    } finally {
      submittingMessage = false;
      render();
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
        sizes: draft.category === "Vêtements" ? sizesForSubcategory(draft.subcategory, draft.ageGroups) : [],
        color: draft.category === "Vêtements" ? draft.color : "",
        brand: draft.brand.trim(),
        subcategory: draft.subcategory,
        ...(FOOTWEAR_SUBCATEGORIES.has(draft.subcategory) ? { shoeSize: Number(draft.shoeSize) } : {}),
        author: draft.author.trim(),
        language: draft.language.trim(),
        price: Number(draft.price),
        sellerId: user.$id,
        sellerInitials: sellerInitialsFromEmail(user.email),
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
    const button = event.target.closest("button[data-action], a[data-action]");
    if (!button) return;
    switch (button.dataset.action) {
      case "open-listing":
        event.preventDefault();
        if (!button.dataset.listingId) return;
        selectedListingId = button.dataset.listingId;
        detailPhotoIndex = 0;
        view = "detail";
        message = "";
        render();
        break;
      case "back-to-list":
        selectedListingId = "";
        detailPhotoIndex = 0;
        view = "list";
        message = "";
        render();
        break;
      case "show-list":
        view = "list";
        message = "";
        render();
        break;
      case "show-purchases":
        view = "purchases";
        message = "";
        await loadPurchaseRequests("purchases");
        break;
      case "show-sales":
        view = "sales";
        message = "";
        await loadPurchaseRequests("sales");
        break;
      case "retry-purchases":
        message = "";
        await loadPurchaseRequests(view);
        break;
      case "open-conversation":
        await openConversation(button.dataset.requestId);
        break;
      case "close-conversation":
        selectedConversationId = "";
        conversationMessages = [];
        message = "";
        render();
        break;
      case "retry-conversation":
        await loadConversationMessages();
        break;
      case "gallery-previous":
      case "gallery-next": {
        const listing = listings.find((item) => item.$id === selectedListingId);
        const photoCount = Array.isArray(listing?.photoIds) ? Math.min(listing.photoIds.length, MAX_PHOTOS) : 0;
        if (photoCount < 2) return;
        const direction = button.dataset.action === "gallery-next" ? 1 : -1;
        detailPhotoIndex = (detailPhotoIndex + direction + photoCount) % photoCount;
        render();
        break;
      }
      case "select-detail-photo": {
        const listing = listings.find((item) => item.$id === selectedListingId);
        const photoCount = Array.isArray(listing?.photoIds) ? Math.min(listing.photoIds.length, MAX_PHOTOS) : 0;
        const photoIndex = Number(button.dataset.photoIndex);
        if (!Number.isInteger(photoIndex) || photoIndex < 0 || photoIndex >= photoCount) return;
        detailPhotoIndex = photoIndex;
        render();
        break;
      }
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
      case "reset-filters":
        selectedCategory = "";
        selectedConditions = [];
        selectedItemFilters = {};
        render();
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

  root.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    if (form.id === "purchase-request-form") {
      const type = form.dataset.requestType;
      const amount = type === "donation" ? 0 : Number(data.get("amount"));
      createPurchaseRequest(selectedListingId, type, amount, String(data.get("message") || "")).catch((error) => {
        console.error("Une offre ou une demande de don n’a pas pu être envoyée.", error);
        setMessage("L’envoi de votre demande a échoué. Vérifiez votre connexion et réessayez.", "error");
      });
      return;
    }
    if (form.id === "conversation-message-form") {
      sendConversationMessage(String(data.get("content") || "")).catch((error) => {
        console.error("Un message n’a pas pu être envoyé.", error);
        setMessage("L’envoi du message a échoué. Vérifiez votre connexion et réessayez.", "error");
      });
    }
  });

  root.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Element && event.target.closest('[data-action="select-suggestion"]')) {
      event.preventDefault();
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    if (["title", "description", "condition", "color", "brand", "author", "language", "price", "subcategory", "shoeSize"].includes(target.name)) {
      draft[target.name] = target.value;
    }
    if (target.name === "subcategory" && !FOOTWEAR_SUBCATEGORIES.has(draft.subcategory)) draft.shoeSize = "";
    if (target.dataset.suggestionKey) {
      const list = root.querySelector(`#suggestions-${target.dataset.suggestionKey}`);
      const toggle = root.querySelector(`[data-action="toggle-suggestions"][data-key="${target.dataset.suggestionKey}"]`);
      if (list) {
        list.innerHTML = suggestionOptionsMarkup(target.dataset.suggestionKey, target.value);
        list.hidden = false;
      }
      toggle?.setAttribute("aria-expanded", "true");
    }
    if (target.name === "color" || target.name === "subcategory" || target.name === "condition" || target.name === "language") {
      const description = root.querySelector('textarea[name="description"]');
      const conditionHint = root.querySelector(".condition-other-hint");
      const optionality = root.querySelector(".description-optionality");
      if (description) {
        description.required = descriptionRequired(draft);
        description.placeholder = descriptionPlaceholder(draft);
      }
      const colorHint = root.querySelector(".color-other-hint");
      const subcategoryHint = root.querySelector(".subcategory-other-hint");
      const languageHint = root.querySelector(".language-other-hint");
      if (colorHint) colorHint.hidden = draft.color !== "Autre";
      if (subcategoryHint) subcategoryHint.hidden = draft.subcategory !== "Autre";
      if (languageHint) languageHint.hidden = draft.language !== "Autre";
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
    if (target instanceof HTMLSelectElement && (target.dataset.listingFilter || target.dataset.itemFilter)) {
      if (target.dataset.listingFilter === "category") {
        selectedCategory = target.value;
        selectedItemFilters = {};
      } else if (target.dataset.itemFilter) {
        if (target.value) selectedItemFilters[target.dataset.itemFilter] = target.value;
        else delete selectedItemFilters[target.dataset.itemFilter];
      }
      render();
      if (target.id) root.querySelector(`#${target.id}`)?.focus();
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.conditionFilter !== undefined) {
      const condition = target.dataset.conditionFilter;
      selectedConditions = target.checked
        ? [...new Set([...selectedConditions, condition])]
        : selectedConditions.filter((selected) => selected !== condition);
      render();
      if (target.id) root.querySelector(`#${target.id}`)?.focus();
      return;
    }
    if (target instanceof HTMLInputElement && target.name === "ageGroup") {
      draft.ageGroups = [...root.querySelectorAll('input[name="ageGroup"]:checked')]
        .map((input) => Number(input.value))
        .sort((left, right) => left - right);
      const derivedSizes = root.querySelector("#derived-sizes");
      if (derivedSizes) derivedSizes.textContent = derivedAgeDetails(draft.category, draft.ageGroups, draft.subcategory);
      updateFootwearSizeOptions();
      root.querySelector(".age-picker")?.removeAttribute("aria-invalid");
      return;
    }
    if (target instanceof HTMLSelectElement) {
      draft[target.name] = target.value;
      if (target.name === "color" || target.name === "subcategory" || target.name === "condition" || target.name === "language") render();
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
      selectedCategory = "";
      selectedConditions = [];
      selectedItemFilters = {};
      purchaseRequests = [];
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
