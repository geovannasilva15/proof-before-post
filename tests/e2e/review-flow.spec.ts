import { expect, test, type Page } from "@playwright/test";

async function completeGuidedReview(page: Page, language: "pt" | "en") {
  await page.goto("/");
  if (language === "en") await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByRole("button", { name: language === "pt" ? "Testar o exemplo guiado" : "Try the guided example" }).click();
  await page.getByRole("button", { name: language === "pt" ? /Analisar demonstração/ : /Analyze demonstration/ }).click();
  await page.getByRole("button", { name: language === "pt" ? /Examinar esta afirmação/ : /Examine this claim/ }).click();
  await page.getByRole("button", { name: language === "pt" ? "Sustenta parcialmente" : "Partially supports", exact: true }).click();
  await page.getByLabel(language === "pt" ? "JUSTIFICATIVA DA SUA ESCOLHA" : "JUSTIFICATION FOR YOUR CHOICE").fill(language === "pt" ? "A pesquisa descreve práticas, mas não prova toda a generalização." : "The research describes practices but does not prove the entire generalization.");
  await page.getByRole("button", { name: language === "pt" ? /Continuar para a decisão/ : /Continue to decision/ }).click();
  await page.getByRole("button", { name: new RegExp(language === "pt" ? "Corrigir a afirmação" : "Correct the claim") }).click();
  await page.getByRole("button", { name: language === "pt" ? /Revisar o conteúdo/ : /Revise the content/ }).click();
  await page.getByRole("button", { name: language === "pt" ? "Reduzi o alcance da afirmação" : "I narrowed the scope of the claim" }).click();
  await page.getByRole("button", { name: language === "pt" ? "Gerar versão traduzida" : "Generate translated version", exact: true }).click();
  await expect(page.locator(".translation-card .field-error")).toContainText(language === "pt" ? "Não foi possível" : "could not");
  const checklist = page.locator(".checklist-card input[type=checkbox]");
  await expect(checklist).toHaveCount(7);
  for (let index = 0; index < 7; index += 1) await checklist.nth(index).check();
  await page.getByRole("button", { name: language === "pt" ? /Criar meu resumo da publicação/ : /Create my publication summary/ }).click();
  await expect(page.locator("#receipt")).toBeVisible();
}

test("desktop, mobile, PT/EN, Unicode, history, security and exports", async ({ page, context }, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await completeGuidedReview(page, "pt");
  const pngPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Baixar resumo da publicação/ }).click();
  const png = await pngPromise;
  expect(png.suggestedFilename()).toMatch(/^proof-before-post-resumo-\d{4}-\d{2}-\d{2}\.png$/);
  await png.saveAs(testInfo.outputPath("receipt.png"));
  const pdfPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Baixar PDF acessível/ }).click();
  const pdf = await pdfPromise;
  expect(pdf.suggestedFilename()).toMatch(/^proof-before-post-resumo-\d{4}-\d{2}-\d{2}\.pdf$/);
  await pdf.saveAs(testInfo.outputPath("receipt.pdf"));
  await page.getByRole("button", { name: "Copiar resumo" }).click();
  await expect(page.getByRole("button", { name: /Resumo copiado/ })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await completeGuidedReview(page, "en");
  await expect(page.getByText("This summary documents the verification process performed by the creator.")).toBeVisible();

  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Revisar meu rascunho" }).click();
  const draft = page.getByLabel("Seu rascunho");
  const value = "á👍🏽👩‍💻🇧🇷";
  await draft.fill(value);
  await expect(page.getByText("4 de 1.500 caracteres")).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByLabel("Your draft")).toHaveValue(value);
  await expect(page.getByText("4 of 1,500 characters")).toBeVisible();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Home" }).click();
  await expect(page.getByText(value)).toBeVisible();

  await page.getByRole("button", { name: "Review my own draft" }).click();
  await page.getByRole("tab", { name: "Import from URL" }).click();
  await page.locator("#publication-url").fill("http://127.0.0.1/private");
  await page.getByRole("button", { name: "Extract content" }).click();
  await expect(page.locator(".url-import-card .field-error")).toContainText(/security|URL|local|private/i);
  await page.getByRole("tab", { name: "Paste text" }).click();
  await page.getByLabel("Your draft").fill("A verifiable claim about a public fact.");
  await page.getByRole("button", { name: /Research and find claims/ }).click();
  await expect(page.locator(".analysis-error")).toContainText("OPENAI_API_KEY");
});
