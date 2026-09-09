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

test("completes a purchase through payment and bank reconciliation", async ({
  page,
}) => {
  test.setTimeout(90_000);
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

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "factura-proveedor.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%%EOF\n"),
  });
  await expect(
    page.getByRole("link", { name: "factura-proveedor.pdf" }),
  ).toBeVisible();
  await expect(page.getByText("OCR no disponible para PDF")).toBeVisible();
  const attachmentDownloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "factura-proveedor.pdf" }).click();
  const attachmentDownload = await attachmentDownloadPromise;
  expect(attachmentDownload.suggestedFilename()).toBe("factura-proveedor.pdf");
  const attachmentPath = await attachmentDownload.path();
  expect(attachmentPath).not.toBeNull();
  expect((await readFile(attachmentPath!)).subarray(0, 5).toString()).toBe(
    "%PDF-",
  );

  const imageBase64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 400;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black";
    context.font = "32px sans-serif";
    [
      "PROVEEDOR: Proveedor E2E SL",
      "FACTURA: PROV-E2E-001",
      "BASE IMPONIBLE: 100,00 EUR",
      "IVA 21%: 21,00 EUR",
      "TOTAL FACTURA: 121,00 EUR",
    ].forEach((line, index) => context.fillText(line, 30, 55 + index * 65));
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await fileInput.setInputFiles({
    name: "factura-proveedor.png",
    mimeType: "image/png",
    buffer: Buffer.from(imageBase64, "base64"),
  });
  const imageRow = page.locator(".attachment-list article").filter({
    hasText: "factura-proveedor.png",
  });
  await expect(imageRow).toBeVisible();
  await imageRow.getByRole("button", { name: "Solicitar OCR" }).click();
  await expect(
    page.getByRole("button", { name: "Aprobar compra" }),
  ).toBeDisabled();
  await imageRow
    .getByRole("button", { name: "Revisar extracción" })
    .click({ timeout: 30_000 });
  await page.getByLabel("Número de factura").fill("PROV-E2E-001 REVISADA");
  await page.getByRole("button", { name: "Confirmar revisión humana" }).click();
  await expect(imageRow.getByText("Revisión humana completada")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aprobar compra" }),
  ).toBeEnabled();

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

  await page.getByRole("link", { name: /Inicio/ }).click();
  await expect(
    page.locator(".dashboard-grid article").filter({
      hasText: "Compras aprobadas",
    }),
  ).toContainText("1");
  await expect(
    page.locator(".dashboard-grid article").filter({
      hasText: "Pendiente de pago",
    }),
  ).toContainText("0,00 €");

  await page.getByRole("link", { name: /Contabilidad/ }).click();
  await expect(
    page.getByRole("heading", { name: "Libro diario" }),
  ).toBeVisible();
  await expect(page.getByText(/Asiento #\d+/).first()).toBeVisible();
  const supplierAccount = page
    .getByLabel("Cuenta para el mayor")
    .locator("option")
    .filter({ hasText: "400" })
    .first();
  const supplierAccountId = await supplierAccount.getAttribute("value");
  expect(supplierAccountId).toBeTruthy();
  await page
    .getByLabel("Cuenta para el mayor")
    .selectOption(supplierAccountId!);
  await expect(page.getByText("Saldo final")).toBeVisible();

  await page.getByRole("link", { name: /Tesorería/ }).click();
  await expect(
    page.getByRole("heading", { name: "Conecta tu cuenta contable de banco" }),
  ).toBeVisible();
  const bankLedgerSelect = page.locator('select[name="accountId"]');
  const bankLedgerOption = bankLedgerSelect
    .locator("option")
    .filter({ hasText: "572000" });
  const bankLedgerId = await bankLedgerOption.getAttribute("value");
  expect(bankLedgerId).toBeTruthy();
  await bankLedgerSelect.selectOption(bankLedgerId!);
  await page.getByLabel("Nombre").fill("Cuenta E2E");
  await page.getByRole("button", { name: "Crear cuenta bancaria" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Cuenta E2E ya está lista",
  );
  await page.getByText("Importar un movimiento manualmente").click();
  await page.getByLabel("Identificador único").fill(`BANK-E2E-${suffix}`);
  await page.getByLabel("Importe").fill("-121");
  await page.getByLabel("Contraparte").fill("Proveedor E2E SL");
  await page.getByLabel("Descripción").fill("Pago PROV-E2E-001");
  await page.getByLabel("Referencia (opcional)").fill("E2E-PAGO-001");
  await page.getByRole("button", { name: "Importar movimiento" }).click();
  await expect(page.getByRole("status")).toContainText("Movimiento importado");
  await page.getByRole("button", { name: /Proveedor E2E SL/ }).click();
  await expect(page.getByText(/Asiento #\d+/)).toBeVisible();
  await page.getByRole("button", { name: "Conciliar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Movimiento conciliado");
  await page.getByLabel("Estado").selectOption("RECONCILED");
  await expect(
    page.getByRole("button", { name: /Proveedor E2E SL/ }),
  ).toBeVisible();
});
