import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("completes the sales flow from registration to payment", async ({
  page,
}) => {
  const suffix = Date.now();
  await page.goto("/acceso");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre de la organización").fill("Organización E2E");
  await page.getByLabel("Razón social").fill("PastaGansa E2E SL");
  await page.getByLabel("NIF").fill("B12345674");
  await page
    .getByLabel("Correo electrónico")
    .fill(`ventas-e2e-${suffix}@example.com`);
  await page.getByLabel("Contraseña").fill("playwright-password-123");
  await page
    .locator(".auth-form")
    .getByRole("button", { name: "Crear cuenta" })
    .click();
  await expect(page).toHaveURL(/\/inicio$/);

  await page.getByRole("link", { name: /Clientes/ }).click();
  await page
    .locator(".page-heading")
    .getByRole("button", { name: "Nuevo cliente" })
    .click();
  await page.getByLabel("Razón social *").fill("Cliente E2E SL");
  await page.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Cliente E2E SL ya está en tu cartera",
  );

  await page.getByRole("link", { name: /Catálogo/ }).click();
  await page
    .locator(".page-heading")
    .getByRole("button", { name: "Nuevo elemento" })
    .click();
  await page.getByLabel("Nombre *").fill("Servicio E2E");
  await page.getByLabel("Precio de venta · EUR").fill("100");
  await page.getByRole("button", { name: "Guardar elemento" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Servicio E2E ya está disponible",
  );

  await page.getByRole("link", { name: /Facturas/ }).click();
  await page
    .locator(".page-heading")
    .getByRole("button", { name: "Nueva factura" })
    .click();
  await page.getByLabel("Cliente").selectOption({ label: "Cliente E2E SL" });
  await page.getByLabel("Catálogo").selectOption({ label: "Servicio E2E" });
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Borrador guardado por 121,00",
  );
  await page.getByRole("link", { name: "Borrador" }).click();
  await expect(
    page.getByRole("heading", { name: "Factura en borrador" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Emitir factura" }).click();
  await expect(
    page.getByText("Al emitir se asignará un número definitivo"),
  ).toBeVisible();
  await page.getByLabel("Nueva serie").fill("FE2E");
  await page.getByRole("button", { name: "Emitir definitivamente" }).click();
  await expect(page.getByRole("heading", { name: "FE2E-0001" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ver trazabilidad" }),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Descargar PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("factura-FE2E-0001.pdf");
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const pdf = await readFile(downloadPath!);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

  await page.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(page.getByLabel("Importe")).toHaveValue("121.00");
  await page.getByLabel("Referencia (opcional)").fill("E2E-COBRO-001");
  await page.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(page.getByText("Cobrada", { exact: true })).toBeVisible();
  await expect(page.getByText("0,00 €", { exact: true })).toBeVisible();
  await expect(page.getByText("E2E-COBRO-001", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Cobrada", { exact: true })).toBeVisible();
  await expect(page.getByText("0,00 €", { exact: true })).toBeVisible();
  await expect(page.getByText("E2E-COBRO-001", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Ver trazabilidad" }).click();
  await expect(page.getByText(/Asiento #\d+/)).toBeVisible();
  await expect(page.getByText("Libro de IVA")).toBeVisible();
});

test("completes a purchase from supplier to approval and payment", async ({
  page,
}) => {
  const suffix = Date.now();
  await page.goto("/acceso");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre de la organización").fill("Compras E2E");
  await page.getByLabel("Razón social").fill("PastaGansa Compras SL");
  await page.getByLabel("NIF").fill("B12345674");
  await page
    .getByLabel("Correo electrónico")
    .fill(`compras-e2e-${suffix}@example.com`);
  await page.getByLabel("Contraseña").fill("playwright-password-123");
  await page
    .locator(".auth-form")
    .getByRole("button", { name: "Crear cuenta" })
    .click();
  await expect(page).toHaveURL(/\/inicio$/);

  await page.getByRole("link", { name: /Clientes/ }).click();
  await page
    .locator(".page-heading")
    .getByRole("button", { name: "Nuevo cliente" })
    .click();
  await page.getByLabel("Razón social *").fill("Proveedor E2E SL");
  await page.getByLabel("También es proveedor").check();
  await page.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Proveedor E2E SL ya está en tu cartera",
  );

  await page.getByRole("link", { name: /Compras/ }).click();
  await page.getByRole("button", { name: "Nueva compra" }).click();
  const purchaseDialog = page.getByRole("dialog", {
    name: "Factura de proveedor",
  });
  await purchaseDialog
    .locator('select[name="supplierId"]')
    .selectOption({ label: "Proveedor E2E SL" });
  await purchaseDialog.getByLabel("Número del proveedor").fill("PROV-E2E-001");
  await purchaseDialog
    .getByLabel("Descripción")
    .fill("Servicio profesional E2E");
  await purchaseDialog.getByLabel("Precio").fill("100");
  await purchaseDialog
    .getByRole("button", { name: "Guardar borrador" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "PROV-E2E-001 guardada por 121,00",
  );
  await page.getByRole("link", { name: "Borrador" }).click();
  await expect(
    page.getByRole("heading", { name: "Compra en borrador" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Aprobar compra" }).click();
  await page.getByLabel("Nueva serie de recepción").fill("RCE2E");
  await page.getByRole("button", { name: "Aprobar definitivamente" }).click();
  await expect(page.getByRole("heading", { name: "RCE2E-0001" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ver trazabilidad" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Registrar pago" }).click();
  await expect(page.getByLabel("Importe")).toHaveValue("121.00");
  await page.getByLabel("Referencia (opcional)").fill("E2E-PAGO-001");
  await page.getByRole("button", { name: "Confirmar pago" }).click();
  await expect(page.getByText("E2E-PAGO-001", { exact: true })).toBeVisible();
  await expect(
    page.locator(".summary-card").filter({ hasText: "Pendiente" }),
  ).toContainText("0,00 €");

  await page.reload();
  await expect(page.getByText("E2E-PAGO-001", { exact: true })).toBeVisible();
  await expect(
    page.locator(".summary-card").filter({ hasText: "Pendiente" }),
  ).toContainText("0,00 €");
  await page.getByRole("link", { name: "Ver trazabilidad" }).click();
  await expect(page.getByText(/Asiento #\d+/)).toBeVisible();
  await expect(page.getByText("Libro de IVA recibido")).toBeVisible();
});
