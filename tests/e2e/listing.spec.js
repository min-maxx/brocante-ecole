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
    sizes: ["105 à 110 cm"],
    color: "Rouge",
    brand: "",
    price: 4,
    photoIds: ["existing-photo"],
  };
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
  await expect(page.getByLabel("Nom du vêtement")).toHaveCount(0);
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
  await page.getByLabel("Nom du vêtement").fill("Veste de pluie");
  await page.getByLabel("État de l’objet").selectOption("Très bon");
  await page.getByLabel("Couleur").selectOption("Autre");
  await expect(page.getByText("Précisez la couleur dans la description.")).toBeVisible();
  await page.getByLabel("Description").fill("Vert sauge, doublure amovible.");
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
  await expect(page.locator(".listing-card").filter({ hasText: "Veste de pluie" })).toContainText("Don");
  await expect.poll(() => uploadedPhotos).toBe(3);
  expect(published).toHaveLength(1);
  expect(published[0].ageGroups).toEqual([5, 6]);
  expect(published[0].sizes).toEqual(["105 à 110 cm", "111 à 116 cm"]);
  await expect.poll(async () => {
    const heights = await page.locator(".listing-card").evaluateAll((cards) =>
      cards.map((card) => Math.round(card.getBoundingClientRect().height)),
    );
    return new Set(heights).size;
  }).toBe(1);
});
