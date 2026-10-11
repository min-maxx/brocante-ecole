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
    photoIds: ["existing-photo"],
  };
}

async function installMarketplaceApi(page, initialListings = []) {
  const listings = [...initialListings];
  const published = [];
  let uploadedPhotos = 0;

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/account") && request.method() === "GET") {
      await route.fulfill({ json: { $id: "family-1", name: "Famille Test", email: "famille@example.test" } });
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

  return { listings, published };
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
  const actualFields = await page.locator("#object-form .object-form-grid > *").evaluateAll((fields) =>
    fields.map((field) => field.matches(".age-picker")
      ? "ageGroup"
      : field.querySelector("select, input, textarea")?.getAttribute("name")),
  );
  expect(actualFields).toEqual(expectedFields[category]);
}

test("a family publishes a clothing listing and sees it in the uniform listing grid", async ({ page }) => {
  const listings = [existingListing()];
  const published = [];
  let uploadedPhotos = 0;

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/account") && request.method() === "GET") {
      await route.fulfill({ json: { $id: "family-1", name: "Famille Test", email: "famille@example.test" } });
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
  await clothingTypes.selectOption("Imperméable");
  await page.getByLabel("Titre").fill("Veste de pluie");
  await page.getByLabel("État").selectOption("Très bon");
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
  await expect(page.locator("#derived-sizes")).toContainText("111 à 116 cm");
  await page.getByRole("button", { name: "Voir l’aperçu" }).click();

  await expect(page.getByRole("heading", { name: "Vérifiez votre annonce" })).toBeVisible();
  await expect(page.locator(".preview-card")).toContainText("Don");
  await expect(page.locator(".preview-card")).toContainText("5 et 6 ans");
  await expect(page.locator(".preview-card")).toContainText("105 à 110 cm");
  await expect(page.locator(".preview-card")).toContainText("111 à 116 cm");
  await expect(page.locator(".preview-card")).toContainText("Vert sauge, doublure amovible.");

  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByRole("heading", { name: "Les annonces du marché" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Veste de pluie" })).toBeVisible();
  await expect(page.locator(".listing-card")).toHaveCount(2);
  const clothingCard = page.locator(".listing-card").filter({ hasText: "Veste de pluie" });
  await expect(clothingCard).toContainText("Don");
  await expect(clothingCard.locator(".listing-card-details")).toContainText("Imperméable · Kiabi · Autre");
  await expect(clothingCard.locator(".listing-card-age-details")).toContainText("5 et 6 ans");
  await expect(clothingCard.locator(".listing-condition")).toHaveText("Très bon");
  await expect.poll(() => uploadedPhotos).toBe(3);
  expect(published).toHaveLength(1);
  expect(published[0].ageGroups).toEqual([5, 6]);
  expect(published[0].sizes).toEqual(["105 à 110 cm", "111 à 116 cm"]);
  expect(published[0].subcategory).toBe("Imperméable");
  expect(published[0].brand).toBe("Kiabi");
  await expect.poll(async () => {
    const heights = await page.locator(".listing-card").evaluateAll((cards) =>
      cards.map((card) => Math.round(card.getBoundingClientRect().height)),
    );
    return new Set(heights).size;
  }).toBe(1);
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
  await expect(bookTypes.locator('option[value="Bande dessinée"]')).toHaveCount(1);
  await expect(bookTypes.locator('option[value="Manga"]')).toHaveCount(1);
  await expect(bookTypes.locator('option[value="Livre d’activités"]')).toHaveCount(1);
  await expect(bookTypes.locator('option[value="Autre"]')).toHaveCount(1);
  await bookTypes.selectOption("Autre");
  await page.getByLabel("Titre").fill("Le petit album");
  await page.getByLabel("État").selectOption("Bon");
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
  await page.getByLabel("État").selectOption("Très bon");
  const genre = page.locator('select[name="subcategory"]');
  await expect(genre.locator('option:not([value=""])')).toHaveCount(25);
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
