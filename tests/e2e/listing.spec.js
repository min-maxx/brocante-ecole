import { expect, test } from "@playwright/test";

const photoBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jpWQAAAAASUVORK5CYII=",
  "base64",
);

function existingListing() {
  return {
    $id: "existing-listing",
    $createdAt: "2026-10-01T10:00:00.000Z",
    title: "Pull en laine",
    description: "Très bon état.",
    category: "Vêtements",
    condition: "Bon",
    ageGroups: [5],
    subcategory: "Pull",
    sizes: ["105 à 110 cm"],
    color: "Rouge",
    brand: "Kiabi",
    price: 4,
    sellerId: "seller-2",
    sellerInitials: "S. V.",
    photoIds: ["existing-photo"],
  };
}

async function installMarketplaceApi(page, initialListings = []) {
  const listings = [...initialListings];
  const requests = [];
  const conversationMessages = [];
  const published = [];
  const createdRequests = [];
  const createdMessages = [];
  let uploadedPhotos = 0;
  let currentUserId = "family-1";
  let nextEvent = 1;

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const collectionId = path.split("/collections/")[1]?.split("/")[0];

    if (path.endsWith("/account") && request.method() === "GET") {
      await route.fulfill({
        json: {
          $id: currentUserId,
          name: currentUserId === "family-1" ? "Famille Test" : "Famille Vendeuse",
          email: currentUserId === "family-1" ? "famille@example.test" : "vendeuse@example.test",
        },
      });
      return;
    }

    if (path.includes("/functions/e2e-market/executions") && request.method() === "POST") {
      const input = JSON.parse(request.postDataJSON().body);
      const execute = () => {
        if (input.action === "create-request") {
          const listing = listings.find((item) => item.$id === input.listingId);
          const { action, message, ...requestData } = input;
          const purchaseRequest = {
            ...requestData,
            listingId: listing.$id,
            listingTitle: listing.title,
            listingPrice: listing.price,
            listingPhotoId: listing.photoIds?.[0] || "",
            sellerInitials: listing.sellerInitials,
            buyerInitials: "F. T.",
            buyerId: currentUserId,
            sellerId: listing.sellerId,
            status: "pending",
            lastMessage: message || (input.type === "donation" ? "Demande de don" : `Offre : ${input.amount} €`),
            $id: `request-${requests.length + 1}`,
            $createdAt: `2026-10-10T10:00:0${nextEvent}.000Z`,
            $updatedAt: `2026-10-10T10:00:0${nextEvent}.000Z`,
            $permissions: [`read("user:${currentUserId}")`, `read("user:${listing.sellerId}")`],
          };
          nextEvent += 1;
          createdRequests.push(purchaseRequest);
          requests.unshift(purchaseRequest);
          if (message) {
            const conversationMessage = {
              $id: `message-${conversationMessages.length + 1}`,
              requestId: purchaseRequest.$id,
              senderId: currentUserId,
              content: message,
              $createdAt: `2026-10-10T10:00:0${nextEvent}.000Z`,
            };
            nextEvent += 1;
            conversationMessages.push(conversationMessage);
            createdMessages.push(conversationMessage);
          }
          return { request: purchaseRequest, messages: conversationMessages.filter((item) => item.requestId === purchaseRequest.$id) };
        }
        if (input.action === "send-message") {
          const purchaseRequest = requests.find((item) => item.$id === input.requestId);
          if (!purchaseRequest || ![purchaseRequest.buyerId, purchaseRequest.sellerId].includes(currentUserId)) {
            return { error: { code: "not_participant", message: "Vous ne participez pas à cette conversation." }, status: 403 };
          }
          const conversationMessage = {
            $id: `message-${conversationMessages.length + 1}`,
            requestId: purchaseRequest.$id,
            senderId: currentUserId,
            content: input.content,
            $createdAt: `2026-10-10T10:00:0${nextEvent}.000Z`,
          };
          nextEvent += 1;
          conversationMessages.push(conversationMessage);
          createdMessages.push(conversationMessage);
          purchaseRequest.lastMessage = input.content;
          purchaseRequest.$updatedAt = conversationMessage.$createdAt;
          return { message: conversationMessage, request: purchaseRequest };
        }
        return { error: { code: "invalid_input", message: "Action invalide." }, status: 400 };
      };
      const result = execute();
      const statusCode = result.status || (input.action === "create-request" ? 201 : 200);
      await route.fulfill({
        json: {
          $id: `execution-${nextEvent}`,
          status: "completed",
          responseStatusCode: statusCode,
          responseBody: JSON.stringify(result),
        },
      });
      return;
    }

    if (path.includes("/storage/buckets/") && path.endsWith("/files") && request.method() === "POST") {
      uploadedPhotos += 1;
      await route.fulfill({
        status: 201,
        json: {
          $id: `photo-${uploadedPhotos}`,
          $createdAt: "2026-10-10T10:00:00.000Z",
          $permissions: [],
          bucketId: "e2e-listing-photos",
          name: `photo-${uploadedPhotos}.png`,
          signature: "test-signature",
          mimeType: "image/png",
          sizeOriginal: photoBytes.length,
        },
      });
      return;
    }

    if (path.includes("/storage/buckets/") && path.endsWith("/view")) {
      await route.fulfill({ contentType: "image/png", body: photoBytes });
      return;
    }

    if (path.includes("/databases/") && path.endsWith("/documents") && request.method() === "GET") {
      const documents = collectionId === "e2e-requests"
        ? requests.filter((item) => item.buyerId === currentUserId || item.sellerId === currentUserId)
        : collectionId === "e2e-messages"
          ? conversationMessages
          : listings;
      await route.fulfill({ json: { total: documents.length, documents } });
      return;
    }

    if (path.includes("/databases/") && path.endsWith("/documents") && request.method() === "POST") {
      const { data, permissions = [] } = request.postDataJSON();
      if (collectionId === "e2e-requests") {
        const allowedPermissionRoles = new Set([
          "any",
          "users",
          "user:family-1",
          "user:family-1/verified",
          "users/verified",
        ]);
        const rejectedPermission = permissions.find((permission) => {
          const role = permission.match(/\("([^"]+)"\)$/)?.[1];
          return !allowedPermissionRoles.has(role);
        });
        if (rejectedPermission) {
          await route.fulfill({
            status: 401,
            json: {
              code: 401,
              type: "user_unauthorized",
              message: "Permissions must be one of: (any, users, user:family-1, user:family-1/verified, users/verified)",
            },
          });
          return;
        }
        const purchaseRequest = {
          ...data,
          $id: `request-${requests.length + 1}`,
          $createdAt: "2026-10-10T10:00:00.000Z",
          $permissions: permissions,
        };
        createdRequests.push(purchaseRequest);
        requests.unshift(purchaseRequest);
        await route.fulfill({ status: 201, json: purchaseRequest });
      } else {
        const listing = {
          ...data,
          $id: `listing-${listings.length + 1}`,
          $createdAt: "2026-10-10T10:00:00.000Z",
        };
        published.push(listing);
        listings.unshift(listing);
        await route.fulfill({ status: 201, json: listing });
      }
      return;
    }

    await route.fulfill({
      status: 404,
      json: { code: 404, type: "not_found", message: `Unexpected Appwrite request: ${request.method()} ${path}` },
    });
  });

  return {
    listings,
    published,
    requests,
    createdRequests,
    createdMessages,
    setCurrentUserId(userId) {
      currentUserId = userId;
    },
  };
}

async function startListing(page, category) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Les annonces du marché" })).toBeVisible();
  await page.getByRole("button", { name: "Déposer une annonce" }).click();
  await page.getByRole("button", { name: category }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.locator("#draft-photo").setInputFiles({
    name: "annonce.png",
    mimeType: "image/png",
    buffer: photoBytes,
  });
  const mainPhotoCaption = {
    Livres: "Couverture",
    "Jeux et jouets": "Vue d’ensemble",
    "Matériel scolaire": "Vue d’ensemble",
  }[category];
  if (mainPhotoCaption) {
    await expect(page.locator(".photo-thumb").first()).toContainText(mainPhotoCaption);
  }
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByRole("heading", { name: "Décrivez l’objet" })).toBeVisible();
  await expectFormFieldOrder(page, category);
}

async function expectFormFieldOrder(page, category) {
  const expectedFields = {
    "Vêtements": ["subcategory", "condition", "ageGroup", "title", "brand", "color", "price", "description"],
    Livres: ["subcategory", "condition", "ageGroup", "title", "author", "language", "price", "description"],
    "Jeux et jouets": ["subcategory", "condition", "ageGroup", "title", "brand", "price", "description"],
    "Matériel scolaire": ["subcategory", "condition", "ageGroup", "title", "brand", "price", "description"],
  };
  expect(await objectFormFieldNames(page)).toEqual(expectedFields[category]);
}

async function objectFormFieldNames(page) {
  return page.locator("#object-form .object-form-grid > *").evaluateAll((fields) =>
    fields.map((field) => field.matches(".age-picker")
      ? "ageGroup"
      : field.querySelector("select, input, textarea")?.getAttribute("name")),
  );
}

async function expectSubcategoryGroups(select, expectedLabels) {
  const groups = await select.evaluate((element) => {
    const collator = new Intl.Collator("fr", { sensitivity: "base" });
    const optionGroups = [...element.querySelectorAll("optgroup")];
    return {
      labels: optionGroups.map((group) => group.label),
      sorted: optionGroups.every((group) => {
        const values = [...group.querySelectorAll("option")].map((option) => option.value);
        return values.every((value, index) => index === 0 || collator.compare(values[index - 1], value) <= 0);
      }),
      otherIsLast: element.options[element.options.length - 1].value === "Autre",
    };
  });
  expect(groups.labels).toEqual(expectedLabels);
  expect(groups.sorted).toBe(true);
  expect(groups.otherIsLast).toBe(true);
}

test("a family can open an announcement, browse its photos, and return to the list", async ({ page }) => {
  const galleryListing = {
    ...existingListing(),
    $id: "gallery-listing",
    title: "Veste imperméable",
    description: "Doublure propre, fermeture fonctionnelle.",
    ageGroups: [6],
    sizes: ["111 à 116 cm"],
    sellerInitials: "C. M.",
    photoIds: ["front-photo", "label-photo", "detail-photo"],
  };
  const singlePhotoListing = {
    ...existingListing(),
    $id: "single-photo-listing",
    title: "Livre illustré",
    description: "Album en très bon état.",
    category: "Livres",
    condition: "Neuf",
    ageGroups: [8],
    subcategory: "Albums",
    sizes: [],
    color: "",
    brand: "",
    author: "Claude Ponti",
    language: "Français",
    sellerInitials: "A. B.",
    photoIds: ["book-cover"],
  };
  await installMarketplaceApi(page, [galleryListing, singlePhotoListing]);

  await page.goto("/");
  await page.getByRole("link", { name: "Consulter l’annonce : Veste imperméable" }).click();

  const detail = page.locator(".listing-detail");
  const gallery = detail.locator(".listing-detail-gallery");
  await expect(page.getByRole("heading", { name: "Veste imperméable" })).toBeVisible();
  await expect(detail.locator(".listing-detail-condition")).toHaveText("Bon état");
  await expect(detail.locator(".listing-detail-seller")).toContainText("C. M.");
  await expect(detail.locator(".listing-detail-row").nth(1)).toContainText("Type / genre");
  await expect(detail.locator(".listing-detail-row").nth(1).locator("dd")).toHaveText("Pull");
  await expect(detail.locator(".listing-detail-row").nth(4).locator("dd")).toHaveText("Kiabi · Rouge");
  await expect(detail.locator(".listing-detail-age")).toHaveCount(1);
  await expect(detail.locator(".listing-detail-age dd")).toHaveText("6 ans · 111–116 cm");
  await expect(gallery.locator(".listing-gallery-count")).toHaveText("1 / 3");
  await expect(gallery.locator(".listing-gallery-thumbnails button")).toHaveCount(3);
  await expect(gallery.locator(".listing-gallery-main img")).toHaveAttribute("alt", "Photo 1 sur 3 de Veste imperméable");

  await gallery.getByRole("button", { name: "Photo suivante" }).click();
  await expect(gallery.locator(".listing-gallery-count")).toHaveText("2 / 3");
  await gallery.getByRole("button", { name: "Afficher la photo 3" }).click();
  await expect(gallery.locator(".listing-gallery-main img")).toHaveAttribute("alt", "Photo 3 sur 3 de Veste imperméable");
  await gallery.getByRole("button", { name: "Photo suivante" }).click();
  await expect(gallery.locator(".listing-gallery-count")).toHaveText("1 / 3");
  await gallery.getByRole("button", { name: "Photo précédente" }).click();
  await expect(gallery.locator(".listing-gallery-count")).toHaveText("3 / 3");

  await page.getByRole("button", { name: "Retour aux annonces" }).click();
  await expect(page.getByRole("heading", { name: "Les annonces du marché" })).toBeVisible();
  await page.getByRole("link", { name: "Consulter l’annonce : Livre illustré" }).click();

  const singlePhotoDetail = page.locator(".listing-detail");
  const singlePhotoGallery = singlePhotoDetail.locator(".listing-detail-gallery");
  await expect(singlePhotoDetail.locator(".listing-detail-seller")).toContainText("A. B.");
  await expect(singlePhotoDetail.locator(".listing-detail-age dd")).toHaveText("8 ans");
  await expect(singlePhotoGallery.locator(".listing-gallery-count")).toHaveText("1 / 1");
  await expect(singlePhotoGallery.locator(".listing-gallery-main img")).toHaveAttribute("alt", "Photo 1 sur 1 de Livre illustré");
  await expect(singlePhotoGallery.getByRole("button", { name: "Photo suivante" })).toHaveCount(0);
  await expect(singlePhotoGallery.locator(".listing-gallery-thumbnails button")).toHaveCount(0);

  await page.getByRole("button", { name: "Retour aux annonces" }).click();
  await expect(page.getByRole("heading", { name: "Les annonces du marché" })).toBeVisible();
});

test("a family can send a prefilled offer and find its pending status in purchases", async ({ page }) => {
  const { createdRequests } = await installMarketplaceApi(page, [existingListing()]);

  await page.goto("/");
  await page.getByRole("link", { name: "Consulter l’annonce : Pull en laine" }).click();

  const offerAmount = page.getByRole("spinbutton", { name: "Votre offre" });
  await expect(offerAmount).toHaveValue("4");
  await offerAmount.fill("3");
  await page.getByRole("button", { name: "Envoyer une offre" }).click();

  await expect(page.getByRole("heading", { name: "Mes achats" })).toBeVisible();
  await page.getByRole("button", { name: "← Mes achats" }).click();
  await expect(page.locator(".purchase-card")).toContainText("Pull en laine");
  await expect(page.locator(".purchase-card")).toContainText("Offre de prix");
  await expect(page.locator(".purchase-card")).toContainText("3 € proposés");
  const requestPrices = page.locator(".purchase-card-prices");
  await expect(requestPrices.getByText("3 € proposés")).toBeVisible();
  await expect(requestPrices.locator("s")).toHaveText("4 €");
  await expect(page.locator(".purchase-card-status")).toHaveText("Statut : En attente");
  expect(createdRequests).toHaveLength(1);
  expect(createdRequests[0]).toMatchObject({
    listingId: "existing-listing",
    listingPrice: 4,
    buyerId: "family-1",
    sellerId: "seller-2",
    type: "offer",
    amount: 3,
    status: "pending",
  });
  expect(createdRequests[0].$permissions).toEqual(['read("user:family-1")', 'read("user:seller-2")']);

  await page.reload();
  await page.getByRole("button", { name: "Mes achats" }).click();
  await expect(page.locator(".purchase-card-status")).toHaveText("Statut : En attente");
});

test("buyer and seller can exchange persistent messages in an offer conversation", async ({ page }) => {
  const api = await installMarketplaceApi(page, [existingListing()]);

  await page.goto("/");
  await page.getByRole("link", { name: "Consulter l’annonce : Pull en laine" }).click();
  await page.getByRole("spinbutton", { name: "Votre offre" }).fill("3");
  await page.getByLabel("Message (facultatif)").fill("Bonjour, le pull est-il toujours disponible ?");
  await page.getByRole("button", { name: "Envoyer une offre" }).click();

  await expect(page.getByRole("heading", { name: "Conversation avec S. V." })).toBeVisible();
  await expect(page.locator(".conversation-events").getByText("3 € proposés")).toBeVisible();
  await expect(page.getByText("Bonjour, le pull est-il toujours disponible ?")).toBeVisible();

  api.setCurrentUserId("seller-2");
  await page.reload();
  await page.getByRole("button", { name: "Mes ventes" }).click();
  await page.getByRole("button", { name: /Pull en laine/ }).click();
  await expect(page.getByText("Bonjour, le pull est-il toujours disponible ?")).toBeVisible();
  await page.getByLabel("Votre message").fill("Oui, il est disponible.");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText("Oui, il est disponible.")).toBeVisible();

  api.setCurrentUserId("family-1");
  await page.reload();
  await page.getByRole("button", { name: "Mes achats" }).click();
  await page.getByRole("button", { name: /Pull en laine/ }).click();
  await expect(page.getByText("Bonjour, le pull est-il toujours disponible ?")).toBeVisible();
  await expect(page.getByText("Oui, il est disponible.")).toBeVisible();
  expect(api.createdMessages.map((item) => item.content)).toEqual([
    "Bonjour, le pull est-il toujours disponible ?",
    "Oui, il est disponible.",
  ]);
});

test("a free listing sends a donation request instead of an offer", async ({ page }) => {
  const freeListing = { ...existingListing(), price: 0, title: "Livre à donner" };
  const { createdRequests } = await installMarketplaceApi(page, [freeListing]);

  await page.goto("/");
  await page.getByRole("link", { name: "Consulter l’annonce : Livre à donner" }).click();

  await expect(page.getByRole("spinbutton", { name: "Votre offre" })).toHaveCount(0);
  await page.getByRole("button", { name: "Envoyer ma demande" }).click();

  await expect(page.getByRole("heading", { name: "Mes achats" })).toBeVisible();
  await page.getByRole("button", { name: "← Mes achats" }).click();
  await expect(page.locator(".purchase-card")).toContainText("Demande de don");
  await expect(page.locator(".purchase-card-status")).toHaveText("Statut : En attente");
  expect(createdRequests).toHaveLength(1);
  expect(createdRequests[0]).toMatchObject({
    listingId: "existing-listing",
    buyerId: "family-1",
    sellerId: "seller-2",
    type: "donation",
    amount: 0,
    status: "pending",
  });
});

test("listing cards show category and condition as footer tags", async ({ page }) => {
  const categories = ["Vêtements", "Livres", "Jeux et jouets", "Matériel scolaire"];
  const listings = categories.map((category, index) => ({
    ...existingListing(),
    $id: `other-${index}`,
    title: `Objet autre ${index}`,
    category,
    subcategory: "Autre",
  }));
  listings.push({
    ...existingListing(),
    $id: "many-sizes",
    title: "Manteau avec toutes les tailles",
    category: "Vêtements",
    subcategory: "Manteau",
    ageGroups: [3, 4, 5, 6, 7, 8, 9, 10, 11],
    sizes: [
      "36 mois · 93 à 98 cm",
      "99 à 104 cm",
      "105 à 110 cm",
      "111 à 116 cm",
      "117 à 122 cm",
      "123 à 128 cm",
      "129 à 134 cm",
      "135 à 140 cm",
      "141 à 152 cm (indicatif)",
    ],
  });
  await installMarketplaceApi(page, listings);

  await page.goto("/");
  for (const [index, category] of categories.entries()) {
    const card = page.locator(".listing-card").filter({ hasText: `Objet autre ${index}` });
    await expect(card.locator(".listing-card-details")).toContainText("Autre");
    expect(await card.locator(".listing-card-footer .listing-card-tag").allTextContents()).toEqual([category, "Bon état"]);
    await expect(card.locator(".listing-other-type")).toHaveCount(0);
  }
  const manySizesCard = page.locator(".listing-card").filter({ hasText: "Manteau avec toutes les tailles" });
  await expect(manySizesCard.getByRole("heading", { name: "Manteau avec toutes les tailles" })).toBeVisible();
  await expect(manySizesCard.locator(".listing-category-tag")).toHaveText("Vêtements");
  await expect(manySizesCard.locator(".listing-card-details")).toContainText("Manteau");
  await expect(manySizesCard.locator(".listing-card-age-details")).toContainText("93–152 cm");
  expect(await manySizesCard.evaluate((card) => card.getBoundingClientRect().height)).toBeGreaterThan(390);
});

test("families can filter listings on mobile and clear their criteria", async ({ page }) => {
  const listings = [
    {
      ...existingListing(),
      $id: "clothing-kiabi",
      title: "Pull Kiabi",
    },
    {
      ...existingListing(),
      $id: "clothing-petit-bateau",
      title: "Manteau Petit Bateau",
      condition: "Neuf",
      subcategory: "Manteau",
      ageGroups: [6],
      sizes: ["111 à 116 cm"],
      brand: "Petit Bateau",
    },
    {
      ...existingListing(),
      $id: "book-claude-ponti",
      title: "Album de Claude Ponti",
      category: "Livres",
      subcategory: "Album illustré",
      author: "Claude Ponti",
      language: "Français",
    },
    {
      ...existingListing(),
      $id: "toy-djeco",
      title: "Puzzle Djeco",
      category: "Jeux et jouets",
      subcategory: "Puzzle",
      brand: "Djeco",
    },
    {
      ...existingListing(),
      $id: "school-tanns",
      title: "Cartable Tann’S",
      category: "Matériel scolaire",
      subcategory: "Cartable",
      brand: "Tann’S",
      ageGroups: [6],
    },
  ];
  await installMarketplaceApi(page, listings);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.locator(".listing-card")).toHaveCount(5);

  await page.getByLabel("Catégorie").selectOption("Vêtements");
  await expect(page.locator(".listing-card")).toHaveCount(2);
  await expect(page.getByRole("group", { name: "État de l’objet" })).toBeVisible();
  await expect(page.getByLabel("Type / genre")).toBeVisible();
  await expect(page.getByLabel("Marque")).toBeVisible();
  await expect(page.getByLabel("Âge – taille")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByLabel("Âge – taille").selectOption("5");
  await expect(page.locator(".listing-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Tout effacer" }).click();
  await expect(page.locator(".listing-card")).toHaveCount(5);

  await page.getByLabel("Bon", { exact: true }).check();
  await expect(page.locator(".listing-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Tout effacer" }).click();
  await expect(page.locator(".listing-card")).toHaveCount(5);

  const categoryFilters = [
    ["Livres", ["Type / genre", "Auteur / autrice", "Langue", "Âge"]],
    ["Jeux et jouets", ["Type / genre", "Marque", "Âge"]],
    ["Matériel scolaire", ["Type / genre", "Marque", "Âge – classe"]],
  ];
  for (const [category, labels] of categoryFilters) {
    await page.getByLabel("Catégorie").selectOption(category);
    for (const label of labels) {
      await expect(page.getByLabel(label)).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  await page.getByLabel("Catégorie").selectOption("Vêtements");
  await page.getByLabel("Marque").selectOption("Kiabi");
  await expect(page.locator(".listing-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Pull Kiabi" })).toBeVisible();
  await page.getByRole("button", { name: "Tout effacer" }).click();
  await expect(page.locator(".listing-card")).toHaveCount(5);
});

test("a family publishes a clothing listing and sees it in the uniform listing grid", async ({ page }) => {
  const listings = [existingListing()];
  const published = [];
  let uploadedPhotos = 0;

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/account") && request.method() === "GET") {
      await route.fulfill({ json: { $id: "family-1", name: "Famille Test", email: "camille.martin@example.test" } });
      return;
    }

    if (path.includes("/storage/buckets/") && path.endsWith("/files") && request.method() === "POST") {
      uploadedPhotos += 1;
      await route.fulfill({
        status: 201,
        json: {
          $id: `photo-${uploadedPhotos}`,
          $createdAt: "2026-10-10T10:00:00.000Z",
          $permissions: [],
          bucketId: "e2e-listing-photos",
          name: `photo-${uploadedPhotos}.png`,
          signature: "test-signature",
          mimeType: "image/png",
          sizeOriginal: photoBytes.length,
        },
      });
      return;
    }

    if (path.includes("/storage/buckets/") && path.endsWith("/view")) {
      await route.fulfill({ contentType: "image/png", body: photoBytes });
      return;
    }

    if (path.includes("/databases/") && path.endsWith("/documents") && request.method() === "GET") {
      await route.fulfill({ json: { total: listings.length, documents: listings } });
      return;
    }

    if (path.includes("/databases/") && path.endsWith("/documents") && request.method() === "POST") {
      const { data } = request.postDataJSON();
      const listing = {
        ...data,
        $id: `listing-${listings.length + 1}`,
        $createdAt: "2026-10-10T10:00:00.000Z",
      };
      published.push(listing);
      listings.unshift(listing);
      await route.fulfill({ status: 201, json: listing });
      return;
    }

    await route.fulfill({
      status: 404,
      json: { code: 404, type: "not_found", message: `Unexpected Appwrite request: ${request.method()} ${path}` },
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Les annonces du marché" })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Vêtements" })).toHaveCount(0);

  await page.getByRole("button", { name: "Déposer une annonce" }).click();
  await expect(page.getByRole("heading", { name: "Choisissez une catégorie" })).toBeVisible();
  await expect(page.getByLabel("Titre")).toHaveCount(0);
  await page.getByRole("button", { name: "Vêtements" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByRole("heading", { name: "Ajoutez des photos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Vêtements" })).toHaveCount(0);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByRole("alert")).toContainText("Ajoutez au moins une photo");

  await page.locator("#draft-photo").setInputFiles(
    [1, 2, 3, 4].map((index) => ({
      name: `trop-${index}.png`,
      mimeType: "image/png",
      buffer: photoBytes,
    })),
  );
  await expect(page.getByRole("alert")).toContainText("trois photos au maximum");
  await expect(page.locator(".photo-thumb")).toHaveCount(0);

  await page.locator("#photo-drop-zone").evaluate((dropZone, bytes) => {
    const transfer = new DataTransfer();
    for (let index = 1; index <= 3; index += 1) {
      transfer.items.add(new File([new Uint8Array(bytes)], `photo-${index}.png`, { type: "image/png" }));
    }
    dropZone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, [...photoBytes]);
  await expect(page.locator(".photo-thumb")).toHaveCount(3);
  await expect(page.locator(".photo-thumb").nth(0)).toContainText("Devant");
  await expect(page.locator(".photo-thumb").nth(1)).toContainText("Étiquette taille/marque");
  await expect(page.locator(".photo-thumb").nth(2)).toContainText("Détail / défaut");
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByRole("heading", { name: "Décrivez l’objet" })).toBeVisible();
  await expectFormFieldOrder(page, "Vêtements");
  const clothingTypes = page.locator('select[name="subcategory"]');
  await expect(clothingTypes.locator('option[value="Anorak"]')).toHaveCount(1);
  await expect(clothingTypes.locator('option[value="T-shirt manches courtes"]')).toHaveCount(1);
  await expect(clothingTypes.locator('option[value="Autre"]')).toHaveCount(1);
  await expectSubcategoryGroups(clothingTypes, ["Manteaux et vestes", "Hauts", "Bas et tenues", "Chaussures", "Accessoires"]);
  await clothingTypes.selectOption("Imperméable");
  await page.getByLabel("Titre").fill("Veste de pluie");
  await page.getByLabel("État").selectOption({ label: "Très bon état" });
  await page.getByLabel("Couleur").selectOption("Autre");
  await expect(page.getByText("Précisez la couleur dans la description.")).toBeVisible();
  await page.getByRole("textbox", { name: "Marque" }).fill("kia");
  await expect(page.locator("#suggestions-brand [role=option]", { hasText: "Kiabi" })).toBeVisible();
  await page.locator("#suggestions-brand [role=option]", { hasText: "Kiabi" }).click();
  await page.locator('textarea[name="description"]').fill("Vert sauge, doublure amovible.");
  await page.getByLabel("Prix (€)").fill("0");
  await page.getByRole("button", { name: "Voir l’aperçu" }).click();
  await expect(page.getByRole("alert")).toContainText("Sélectionnez au moins un âge");
  await page.getByLabel("5 ans").check();
  await page.getByLabel("6 ans").check();
  await expect(page.locator("#derived-sizes")).toContainText("105–116 cm");
  await page.getByRole("button", { name: "Voir l’aperçu" }).click();

  await expect(page.getByRole("heading", { name: "Vérifiez votre annonce" })).toBeVisible();
  await expect(page.locator(".preview-card")).toContainText("Don");
  await expect(page.locator(".preview-card")).toContainText("5 et 6 ans");
  await expect(page.locator(".preview-card")).toContainText("105–116 cm");
  await expect(page.locator(".preview-card")).toContainText("Vert sauge, doublure amovible.");

  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByRole("heading", { name: "Les annonces du marché" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Veste de pluie" })).toBeVisible();
  await expect(page.locator(".listing-card")).toHaveCount(2);
  const clothingCard = page.locator(".listing-card").filter({ hasText: "Veste de pluie" });
  await expect(clothingCard).toContainText("Don");
  await expect(clothingCard.locator(".listing-card-details")).toContainText("Imperméable · Kiabi · Autre");
  await expect(clothingCard.locator(".listing-card-age-details")).toContainText("5 et 6 ans");
  await expect(clothingCard.locator(".listing-condition-tag")).toHaveText("Très bon état");
  await expect.poll(() => uploadedPhotos).toBe(3);
  expect(published).toHaveLength(1);
  expect(published[0].ageGroups).toEqual([5, 6]);
  expect(published[0].sizes).toEqual(["105 à 110 cm", "111 à 116 cm"]);
  expect(published[0].subcategory).toBe("Imperméable");
  expect(published[0].brand).toBe("Kiabi");
  expect(published[0].condition).toBe("Très bon");
  expect(published[0]).not.toHaveProperty("shoeSize");
  await expect.poll(async () => {
    const heights = await page.locator(".listing-card").evaluateAll((cards) =>
      cards.map((card) => Math.round(card.getBoundingClientRect().height)),
    );
    return new Set(heights).size;
  }).toBe(1);
  await clothingCard.click();
  await expect(page.locator(".listing-detail-seller strong")).toHaveText("C. M.");
});

test("a family sees age-based EU footwear sizes for shoes", async ({ page }) => {
  const { published } = await installMarketplaceApi(page);

  await startListing(page, "Vêtements");
  await page.locator('select[name="subcategory"]').selectOption("Baskets");
  expect(await objectFormFieldNames(page)).toEqual([
    "subcategory", "condition", "ageGroup", "title", "brand", "color", "shoeSize", "price", "description",
  ]);
  const shoeSize = page.locator('select[name="shoeSize"]');
  const shoeSizeLabel = page.locator('label[for="draft-shoe-size"]');
  const shoeSizeHint = page.locator(".shoe-size-hint");
  await expect(shoeSize).toBeVisible();
  await expect(shoeSizeLabel).toHaveText("Pointure");
  await expect(shoeSizeHint).toHaveText("Les pointures proposées dépendent des âges sélectionnés.");
  await expect(shoeSizeHint).toBeVisible();
  await expect(shoeSize).toBeDisabled();
  await page.getByLabel("Titre").fill("Baskets enfant");
  await page.getByLabel("État").selectOption("Neuf");
  await page.getByLabel("Couleur").selectOption("Noir");
  await page.getByLabel("Prix (€)").fill("8");
  await page.getByLabel("5 ans").check();
  await expect(shoeSizeHint).toBeVisible();
  await expect(shoeSize.locator('option:not([value=""])')).toHaveText(["28", "29"]);
  await page.getByLabel("6 ans").check();
  await expect(shoeSizeHint).toBeVisible();
  await expect(page.locator("#derived-sizes")).toHaveText("Pointures correspondantes : 28–31 EU");
  await expect(shoeSize).toBeEnabled();
  await expect(shoeSize).toHaveAttribute("required", "");
  await expect(shoeSize.locator('option:not([value=""])')).toHaveText(["28", "29", "30", "31"]);
  await page.getByRole("button", { name: "Voir l’aperçu" }).click();
  await expect(page.getByRole("heading", { name: "Décrivez l’objet" })).toBeVisible();
  await shoeSize.selectOption("29");
  await expect(shoeSizeLabel).toHaveText("Pointure");
  await page.getByRole("button", { name: "Voir l’aperçu" }).click();
  await expect(page.locator(".preview-card")).toContainText("Pointure 29 EU");
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByRole("button", { name: "Déposer une annonce" })).toBeVisible();

  expect(published[0].sizes).toEqual(["28–29 EU", "29–31 EU"]);
  expect(published[0].shoeSize).toBe(29);
  const shoesCard = page.locator(".listing-card").filter({ hasText: "Baskets enfant" });
  await expect(shoesCard.locator(".listing-card-age-details")).toContainText("5 et 6 ans · Pointure 29 EU");
});

test("a family publishes a listing in the Livres category with age, genre, author and language", async ({ page }) => {
  const bookListings = [{
    ...existingListing(),
    $id: "existing-book",
    title: "Albums de Claude Ponti",
    category: "Livres",
    ageGroups: [5, 6],
    sizes: [],
    color: "",
    brand: "",
    subcategory: "Albums",
    author: "Claude Ponti",
    language: "Français",
  }];
  const { published } = await installMarketplaceApi(page, bookListings);

  await startListing(page, "Livres");
  const bookTypes = page.locator('select[name="subcategory"]');
  await expect(bookTypes.locator('option:not([value=""])')).toHaveCount(16);
  await expectSubcategoryGroups(bookTypes, ["Albums et récits", "Découverte et apprentissage", "Éveil et activités"]);
  await expect(bookTypes.locator('option[value="Bande dessinée"]')).toHaveCount(1);
  await expect(bookTypes.locator('option[value="Manga"]')).toHaveCount(1);
  await expect(bookTypes.locator('option[value="Livre d’activités"]')).toHaveCount(1);
  await expect(bookTypes.locator('option[value="Autre"]')).toHaveCount(1);
  await bookTypes.selectOption("Autre");
  await page.getByLabel("Titre").fill("Le petit album");
  await page.getByLabel("État").selectOption({ label: "Bon état" });
  await expect(page.getByText("Précisez dans la description.")).toBeVisible();
  await page.getByRole("textbox", { name: "Auteur" }).fill("claude");
  await expect(page.getByRole("option", { name: "Claude Ponti" })).toBeVisible();
  await page.getByRole("option", { name: "Claude Ponti" }).click();
  const language = page.getByLabel("Langue");
  await expect(language.locator("option")).toHaveCount(8);
  await expect(language.locator('option[value="Français"]')).toHaveCount(1);
  await expect(language.locator('option[value="Anglais"]')).toHaveCount(1);
  await expect(language.locator('option[value="Autre"]')).toHaveCount(1);
  await language.selectOption("Autre");
  await expect(page.getByText("Précisez la langue dans la description.")).toBeVisible();
  await expect(page.locator('textarea[name="description"]')).toHaveAttribute("required", "");
  await page.getByLabel("Prix (€)").fill("0");
  await page.locator('textarea[name="description"]').fill("Album illustré.");
  await page.getByRole("button", { name: "Voir l’aperçu" }).click();
  await expect(page.getByRole("alert")).toContainText("Sélectionnez au moins un âge");

  await page.getByLabel("5 ans").check();
  await page.getByRole("button", { name: "Voir l’aperçu" }).click();
  await page.getByRole("button", { name: "Modifier" }).click();
  await page.locator('textarea[name="description"]').fill("");
  await page.getByRole("button", { name: "Voir l’aperçu" }).click();
  await expect(page.getByRole("heading", { name: "Décrivez l’objet" })).toBeVisible();
  await expect(page.locator('textarea[name="description"]')).toHaveAttribute("required", "");
  await page.locator('textarea[name="description"]').fill("Album illustré en langue régionale.");
  await page.getByRole("button", { name: "Voir l’aperçu" }).click();
  await expect(page.getByRole("heading", { name: "Vérifiez votre annonce" })).toBeVisible();
  await expect(page.locator(".preview-card")).toContainText("Claude Ponti");
  await expect(page.locator(".preview-card")).toContainText("Autre");
  await expect(page.locator(".preview-card")).not.toContainText("CM1");
  await page.getByRole("button", { name: "Publier" }).click();

  await expect(page.getByRole("button", { name: "Déposer une annonce" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Le petit album" })).toBeVisible();
  const bookCard = page.locator(".listing-card").filter({ hasText: "Le petit album" });
  await expect(bookCard.locator(".listing-card-details")).toContainText("Autre · Claude Ponti · Autre");
  await expect(bookCard.locator(".listing-card-age-details")).toContainText("5 ans");
  expect(published).toHaveLength(1);
  expect(published[0]).toMatchObject({
    category: "Livres",
    subcategory: "Autre",
    ageGroups: [5],
    sizes: [],
    color: "",
    brand: "",
    author: "Claude Ponti",
    language: "Autre",
  });
});

test("a family publishes a listing in the Jeux et jouets category with age, type and a brand suggestion", async ({ page }) => {
  const games = ["Janod", "JANOD"].map((brand, index) => ({
    ...existingListing(),
    $id: `existing-game-${index}`,
    title: "Jeu existant",
    category: "Jeux et jouets",
    ageGroups: [5, 6],
    sizes: [],
    color: "",
    brand,
    subcategory: "Jeux de construction",
  }));
  const { published } = await installMarketplaceApi(page, games);

  await startListing(page, "Jeux et jouets");
  await page.getByLabel("Titre").fill("Circuit de train");
  await page.getByLabel("État").selectOption({ label: "Très bon état" });
  const genre = page.locator('select[name="subcategory"]');
  await expect(genre.locator('option:not([value=""])')).toHaveCount(25);
  await expectSubcategoryGroups(genre, ["Jeux de société et construction", "Imitation et figurines", "Jeux créatifs et éducatifs", "Plein air et mobilité"]);
  await expect(genre.locator('option[value="Jeu de plein air"]')).toHaveCount(1);
  await expect(genre.locator('option[value="Vélo enfant"]')).toHaveCount(1);
  await genre.selectOption("Jeu de plein air");
  await expect(genre.locator('option[value="Jeu de plein air"]')).toHaveCount(1);
  await expect(genre.locator('option[value="Autre"]')).toHaveCount(1);

  const brand = page.getByRole("textbox", { name: "Marque" });
  await brand.fill("jan");
  await expect(page.locator("#suggestions-brand [role=option]", { hasText: "Janod" })).toHaveCount(1);
  await expect(page.locator("#suggestions-brand [role=option]")).toHaveCount(1);
  await page.locator("#suggestions-brand [role=option]", { hasText: "Janod" }).click();
  await brand.fill("nOuVeLLe marque");
  await page.getByLabel("Prix (€)").fill("12");
  await expect(brand).toHaveValue("Nouvelle Marque");
  await page.getByRole("button", { name: "Voir l’aperçu" }).click();
  await expect(page.getByRole("alert")).toContainText("Sélectionnez au moins un âge");

  await page.getByLabel("6 ans").check();
  await page.getByRole("button", { name: "Voir l’aperçu" }).click();
  await expect(page.locator(".preview-card")).toContainText("Jeu de plein air");
  await expect(page.locator(".preview-card")).toContainText("Nouvelle Marque");
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByRole("button", { name: "Déposer une annonce" })).toBeVisible();

  expect(published).toHaveLength(1);
  expect(published[0]).toMatchObject({
    category: "Jeux et jouets",
    subcategory: "Jeu de plein air",
    ageGroups: [6],
    sizes: [],
    color: "",
    brand: "Nouvelle Marque",
  });
  const gameCard = page.locator(".listing-card").filter({ hasText: "Circuit de train" });
  await expect(gameCard.locator(".listing-card-details")).toContainText("Jeu de plein air · Nouvelle Marque");
  await expect(gameCard.locator(".listing-card-age-details")).toContainText("6 ans");
});

test("a family publishes a listing in the Matériel scolaire category with classes derived from age", async ({ page }) => {
  const { published } = await installMarketplaceApi(page);

  await startListing(page, "Matériel scolaire");
  const schoolTypes = page.locator('select[name="subcategory"]');
  await expect(schoolTypes.locator('option:not([value=""])')).toHaveCount(26);
  await expectSubcategoryGroups(schoolTypes, ["Papeterie et organisation", "Sacs et équipement", "Écriture et dessin", "Mesure et découpage", "Matériel de classe"]);
  await expect(schoolTypes.locator('option[value="Crayon de couleur"]')).toHaveCount(1);
  await schoolTypes.selectOption("Cartable");
  await page.getByLabel("Titre").fill("Cartable bleu");
  await page.getByLabel("État").selectOption("Autre");
  await expect(page.getByText("Précisez l’état de l’objet dans la description.")).toBeVisible();
  await page.getByRole("textbox", { name: "Marque" }).fill("Tann’s");
  await page.getByLabel("Prix (€)").fill("5");
  await page.locator('textarea[name="description"]').fill("Fermeture éclair à vérifier.");
  await expect(page.getByLabel(/classe/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Voir l’aperçu" }).click();
  await expect(page.getByRole("alert")).toContainText("Sélectionnez au moins un âge");

  await page.getByLabel("6 ans").check();
  await page.getByLabel("7 ans").check();
  await expect(page.locator("#derived-sizes")).toContainText("CP / CE1");
  await page.getByRole("button", { name: "Voir l’aperçu" }).click();
  await expect(page.locator(".preview-card")).toContainText("CP / CE1");
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByRole("button", { name: "Déposer une annonce" })).toBeVisible();

  expect(published).toHaveLength(1);
  expect(published[0]).toMatchObject({
    category: "Matériel scolaire",
    subcategory: "Cartable",
    condition: "Autre",
    ageGroups: [6, 7],
    sizes: [],
    color: "",
    brand: "Tann’S",
  });
  expect(published[0]).not.toHaveProperty("schoolLevel");
  const schoolCard = page.locator(".listing-card").filter({ hasText: "Cartable bleu" });
  await expect(schoolCard.locator(".listing-card-details")).toContainText("Cartable · Tann’S");
  await expect(schoolCard.locator(".listing-card-age-details")).toContainText("6 et 7 ans · CP · CE1");
});

test("a family can retry loading listings after a temporary Appwrite error", async ({ page }) => {
  let listAttempts = 0;
  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path.endsWith("/account") && request.method() === "GET") {
      await route.fulfill({ json: { $id: "family-1", name: "Famille Test" } });
      return;
    }

    if (path.includes("/databases/") && path.endsWith("/documents") && request.method() === "GET") {
      listAttempts += 1;
      if (listAttempts === 1) {
        await route.fulfill({
          status: 500,
          json: { code: 500, type: "general_unknown", message: "Temporary Appwrite error" },
        });
      } else {
        await route.fulfill({ json: { total: 0, documents: [] } });
      }
      return;
    }

    await route.fulfill({
      status: 404,
      json: { code: 404, type: "not_found", message: `Unexpected Appwrite request: ${request.method()} ${path}` },
    });
  });

  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Impossible de charger les annonces");
  await page.getByRole("button", { name: "Réessayer" }).click();
  await expect(page.getByRole("heading", { name: "Aucune annonce pour le moment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Réessayer" })).toHaveCount(0);
  expect(listAttempts).toBe(2);
});
