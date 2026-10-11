import { expect, test } from "@playwright/test";

test("explains how to configure the market instead of offering a useless retry", async ({ page }) => {
  await page.route("**/v1/account", (route) => route.fulfill({
    json: {
      $id: "family-1",
      name: "Famille Test",
      email: "famille@example.test",
    },
  }));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Les annonces du marché" })).toBeVisible();

  const error = page.getByRole("alert");
  await expect(error).toContainText("VITE_APPWRITE_DATABASE_ID");
  await expect(error).toContainText(".env.local");
  await expect(error).toContainText("Redémarrez");
  await expect(page.getByRole("button", { name: "Réessayer" })).toHaveCount(0);
});
