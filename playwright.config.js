import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4179";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "listing.spec.js",
  use: {
    baseURL,
    browserName: "chromium",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4179 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
    env: {
      VITE_APPWRITE_ENDPOINT: `${baseURL}/v1`,
      VITE_APPWRITE_PROJECT_ID: "e2e-project",
      VITE_APPWRITE_SIGNUP_FUNCTION_ID: "e2e-signup",
      VITE_APPWRITE_DATABASE_ID: "e2e-database",
      VITE_APPWRITE_LISTINGS_COLLECTION_ID: "e2e-listings",
      VITE_APPWRITE_REQUESTS_COLLECTION_ID: "e2e-requests",
      VITE_APPWRITE_LISTING_PHOTOS_BUCKET_ID: "e2e-listing-photos",
    },
  },
});
