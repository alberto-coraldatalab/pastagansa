import { expect, test } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./accessibility";

test("changes the password and revokes another browser session", async ({
  page,
  browser,
}) => {
  const suffix = Date.now();
  const email = `seguridad-e2e-${suffix}@example.com`;
  const originalPassword = "playwright-password-123";
  const newPassword = "playwright-new-password-456";

  await page.goto("/acceso");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre de la organización").fill("Seguridad E2E");
  await page.getByLabel("Razón social").fill("Seguridad E2E SL");
  await page.getByLabel("NIF").fill("Q5000001G");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(originalPassword);
  await page
    .locator(".auth-form")
    .getByRole("button", { name: "Crear cuenta" })
    .click();
  await expect(page).toHaveURL(/\/inicio$/);

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  try {
    await secondPage.goto("/acceso");
    await secondPage.getByLabel("Correo electrónico").fill(email);
    await secondPage.getByLabel("Contraseña").fill(originalPassword);
    await secondPage
      .locator(".auth-form")
      .getByRole("button", { name: "Entrar" })
      .click();
    await expect(secondPage).toHaveURL(/\/inicio$/);

    await page.getByRole("link", { name: /Seguridad/ }).click();
    await expect(
      page.getByRole("heading", { name: "Seguridad" }),
    ).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page, "account security");
    await expect(page.getByText("Esta sesión")).toBeVisible();
    const revoked = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        response.url().includes("/api/auth/sessions/"),
    );
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    expect((await revoked).status()).toBe(204);
    await expect(
      page.getByRole("button", { name: "Cerrar", exact: true }),
    ).toHaveCount(0);

    await expect
      .poll(
        async () =>
          (await secondPage.request.get("/api/auth/session")).status(),
        { message: "the revoked session must be rejected by the server" },
      )
      .toBe(401);
    await secondPage.goto("/seguridad");
    await expect(secondPage).toHaveURL(/\/acceso$/);

    await page.getByLabel("Contraseña actual").fill(originalPassword);
    await page.getByLabel("Nueva contraseña").fill(newPassword);
    await page.getByLabel("Repite la contraseña nueva").fill(newPassword);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Contraseña actualizada",
    );
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/acceso$/);

    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(newPassword);
    await page
      .locator(".auth-form")
      .getByRole("button", { name: "Entrar" })
      .click();
    await expect(page).toHaveURL(/\/inicio$/);
  } finally {
    await secondContext.close();
  }
});
