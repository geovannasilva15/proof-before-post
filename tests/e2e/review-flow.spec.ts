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
  await expect(page.locator(".citation-preview mark")).toBeVisible();
  if (language === "pt") {
    const revised = page.getByRole("textbox", { name: "Versão revisada" });
    await revised.click();
    await revised.press("Control+Home");
    for (let index = 0; index < 12; index += 1) await revised.press("Shift+ArrowRight");
    await page.locator(".citation-form fieldset input").check();
    await page.locator(".citation-form > label input").fill("Conferido na fonte original.");
    await page.getByRole("button", { name: "Associar fontes ao trecho" }).click();
    await expect(page.locator(".citation-card li")).toHaveCount(2);
  }
  await page.getByRole("button", { name: language === "pt" ? "Gerar versão traduzida" : "Generate translated version", exact: true }).click();
  await expect(page.locator(".translation-card .field-error")).toContainText(language === "pt" ? "Não foi possível" : "could not");
  const checklist = page.locator(".checklist-card input[type=checkbox]");
  await expect(checklist).toHaveCount(7);
  for (let index = 0; index < 7; index += 1) await checklist.nth(index).check();
  await page.getByRole("button", { name: language === "pt" ? /Criar meu resumo da publicação/ : /Create my publication summary/ }).click();
  await expect(page.locator("#receipt")).toBeVisible();
  await expect(page.locator("#receipt")).toContainText(language === "pt" ? "Concluída" : "Completed");
  await expect(page.locator("#receipt")).not.toContainText("completed_with_pending");
}

async function reachEditorialDecision(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Testar o exemplo guiado" }).click();
  await page.getByRole("button", { name: /Analisar demonstração/ }).click();
  await page.getByRole("button", { name: /Examinar esta afirmação/ }).click();
  await page.getByRole("button", { name: "Não sustenta", exact: true }).click();
  await page.getByLabel("JUSTIFICATIVA DA SUA ESCOLHA").fill("A fonte não mediu a divulgação de desinformação.");
  await page.getByRole("button", { name: /Continuar para a decisão/ }).click();
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
  await page.getByRole("tab", { name: "Paste text" }).focus();
  await page.getByRole("tab", { name: "Paste text" }).press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Import from URL" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Import from URL" }).click();
  await page.locator("#publication-url").fill("http://127.0.0.1/private");
  await page.getByRole("button", { name: "Extract content" }).click();
  await expect(page.locator(".url-import-card .field-error")).toContainText(/security|URL|local|private/i);
  await page.getByRole("tab", { name: "Paste text" }).click();
  await page.getByLabel("Your draft").fill("A verifiable claim about a public fact.");
  await page.getByRole("button", { name: /Research and find claims/ }).click();
  await expect(page.locator(".analysis-error")).toContainText("OPENAI_API_KEY");
});

test("all five editorial actions change only the selected claim", async ({ page }) => {
  await reachEditorialDecision(page);
  const cases = [
    { action: /Corrigir a afirmação/, expected: /A pesquisa analisou|500 criadores/, absent: /UNESCO provou/ },
    { action: /Adicionar contexto/, expected: /A pesquisa não mediu/, absent: null },
    { action: /Remover a afirmação/, expected: /Segundo a pesquisa/, absent: /UNESCO provou/ },
    { action: /Manter com transparência/, expected: /Limitação da evidência/, absent: null },
    { action: /Procurar evidência melhor/, expected: /PENDENTE DE EVIDÊNCIA/, absent: null },
  ];
  for (const item of cases) {
    await page.getByRole("button", { name: item.action }).click();
    await page.getByRole("button", { name: /Revisar o conteúdo/ }).click();
    const revised = page.getByRole("textbox", { name: "Versão revisada" });
    await expect(revised).toHaveValue(item.expected);
    await expect(revised).toHaveValue(/Segundo a pesquisa|Criadores são menos confiáveis|PENDENTE DE EVIDÊNCIA/);
    if (item.absent) await expect(revised).not.toHaveValue(item.absent);
    await page.getByRole("button", { name: "Voltar", exact: false }).click();
  }
});

test("research timeout and invalid response stay transparent", async ({ page }) => {
  for (const mocked of [
    { code: "TIMEOUT", status: 504, message: /demorou mais que o limite/ },
    { code: "INVALID_RESPONSE", status: 502, message: /dados incompletos ou inválidos/ },
  ]) {
    await page.route("**/api/analyze", async (route) => route.fulfill({ status: mocked.status, contentType: "application/json", body: JSON.stringify({ code: mocked.code }) }));
    await page.goto("/");
    await page.getByRole("button", { name: "Revisar meu rascunho" }).click();
    await page.getByLabel("Seu rascunho").fill("Uma afirmação pública verificável com um número de 42%.");
    await page.getByRole("button", { name: /Pesquisar e encontrar afirmações/ }).click();
    await expect(page.locator(".analysis-error")).toContainText(mocked.message);
    await expect(page.locator(".analysis-error")).toContainText("A pesquisa não foi concluída");
    await page.unroute("**/api/analyze");
  }
});

test("local history can be saved, searched, filtered and resumed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Revisar meu rascunho" }).first().click();
  const draftText = "O relatório municipal informa que a coleta seletiva cresceu 18% em 2025.";
  await page.getByLabel("Seu rascunho").fill(draftText);
  await expect(page.getByText(/Salvo neste navegador às/)).toBeVisible();
  await page.getByRole("button", { name: "Salvar e continuar depois" }).click();
  await expect(page.getByText(draftText)).toBeVisible();
  await expect(page.locator(".status-badge.in_progress")).toBeVisible();
  await page.getByPlaceholder("Busque pelo rascunho ou afirmação…").fill("coleta seletiva");
  await expect(page.locator(".history-list article")).toHaveCount(1);
  await page.getByLabel("Filtrar por status").selectOption("completed");
  await expect(page.getByText("Nenhuma revisão corresponde a esta busca.")).toBeVisible();
  await page.getByLabel("Filtrar por status").selectOption("in_progress");
  await page.getByLabel("Filtrar por idioma").selectOption("pt");
  await page.getByLabel("Ordenar por atualização").selectOption("oldest");
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByLabel("Seu rascunho")).toHaveValue(draftText);
});

test("three sources are compared on desktop and as cards on mobile", async ({ page }) => {
  const sources = [1, 2, 3].map((number) => ({
    id: `source-${number}`,
    title: `Fonte verificável ${number}`,
    url: `https://example.com/source-${number}`,
    authorOrInstitution: `Instituição ${number}`,
    publishedAt: "2026-08-01",
    sourceType: "Relatório",
    methodology: `Metodologia ${number}`,
    sample: `${number * 100} participantes`,
    geography: "Brasil",
    keyFindings: `Resultado principal ${number}`,
    measuredOrReported: `Indicador ${number}`,
    doesNotEstablish: `Limitação ${number}`,
    contextLimitations: `Contexto ${number}`,
    relationSummary: `Relação ${number}`,
    accessedAt: "2026-08-14",
    provenance: "research",
  }));
  await page.route("**/api/analyze", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      mode: "live",
      language: "pt",
      searchedAt: "2026-08-14T12:00:00.000Z",
      researchSummary: "Três fontes verificáveis foram encontradas.",
      claims: [{ id: "claim-1", text: "O indicador cresceu 18%.", category: "Dado verificável", reason: "Exige conferência.", question: "Como o indicador foi medido?", tone: "amber", sourceIds: sources.map((source) => source.id) }],
      sources,
    }),
  }));
  await page.goto("/");
  await page.getByRole("button", { name: "Revisar meu rascunho" }).first().click();
  await page.getByLabel("Seu rascunho").fill("O indicador cresceu 18%.");
  await page.getByRole("button", { name: /Pesquisar e encontrar afirmações/ }).click();
  await page.getByRole("button", { name: /Examinar esta afirmação/ }).click();
  await expect(page.locator(".comparison-table thead th")).toHaveCount(4);
  await expect(page.locator(".comparison-table")).toBeVisible();
  await page.getByRole("button", { name: /Fonte verificável 2/ }).click();
  await page.getByLabel("URL da fonte").fill("https://example.com/source-1/");
  await expect(page.getByText("Remova a fonte duplicada antes de continuar.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Continuar para a decisão/ })).toBeDisabled();
  await page.getByLabel("URL da fonte").fill("https://example.com/source-2");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".comparison-mobile article")).toHaveCount(3);
  await expect(page.locator(".comparison-mobile")).toBeVisible();
});
