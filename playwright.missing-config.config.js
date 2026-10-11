import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4183";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "missing-config.spec.js",
  use: {
    baseURL,
    browserName: "chromium",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4183 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
    env: {
      VITE_APPWRITE_ENDPOINT: `${baseURL}/v1`,
      VITE_APPWRITE_PROJECT_ID: "config-e2e-project",
      VITE_APPWRITE_SIGNUP_FUNCTION_ID: "config-e2e-signup",
      VITE_APPWRITE_DATABASE_ID: "",
      VITE_APPWRITE_LISTINGS_COLLECTION_ID: "config-e2e-listings",
      VITE_APPWRITE_LISTING_PHOTOS_BUCKET_ID: "config-e2e-photos",
    },
  },
});
