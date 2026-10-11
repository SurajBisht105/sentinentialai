// e2e/auth.spec.ts
// E2E test: Login flow → redirect to /dashboard
import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("login page renders correctly", async ({ page }) => {
    await expect(page).toHaveTitle(/SentinelAI/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Email input
    await expect(page.getByLabel(/email/i)).toBeVisible();
    // Password input
    await expect(page.getByLabel(/password/i)).toBeVisible();
    // Submit button
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("shows validation error for empty form submission", async ({ page }) => {
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/email is required/i)).toBeVisible();
  });

  test("shows error for invalid email format", async ({ page }) => {
    await page.getByLabel(/email/i).fill("not-an-email");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test("unauthenticated users are redirected to /login from /dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    // Should be redirected back to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("OAuth buttons are rendered", async ({ page }) => {
    // Check that at least one OAuth provider button exists
    const oauthButtons = page.locator("button").filter({ hasText: /github|google|microsoft/i });
    await expect(oauthButtons.first()).toBeVisible();
  });
});
