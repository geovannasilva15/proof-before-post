# Proof Before Post

**Pause. Check the evidence. Then post.**

[Acessar a plataforma](https://proof-before-post.vercel.app/)

Plataforma bilíngue de educação midiática criada para ajudar pessoas a revisar evidências antes de publicar um conteúdo. A solução organiza a análise, mas mantém a decisão editorial sob controle humano.

## O problema

Criadores de conteúdo precisam tomar decisões rápidas e nem sempre possuem um processo claro para verificar afirmações, avaliar fontes e registrar as evidências consideradas. O Proof Before Post transforma essa revisão em um fluxo curto, rastreável e fácil de repetir.

## Como funciona

1. Insira uma legenda, roteiro, publicação ou URL pública.
2. Selecione uma afirmação que merece revisão.
3. Compare até três fontes e seus metadados.
4. Registre sua própria avaliação das evidências.
5. Revise o texto e gere um **Evidence Receipt**.

O recibo documenta o processo realizado. Ele não certifica que um conteúdo é verdadeiro e não substitui especialistas.

## Funcionalidades

- fluxo completo em português e inglês;
- pesquisa com links verificáveis;
- relação entre afirmações e evidências;
- comparação entre texto original e revisado;
- histórico privado armazenado no navegador;
- exportação em PDF, PNG e texto;
- narração pelo navegador e navegação por teclado;
- controles de segurança para importação de URLs;
- testes de produto, comportamento e regressão.

## Tecnologias

`Next.js 16` `React 19` `TypeScript` `OpenAI Responses API` `Playwright` `jsPDF` `Web Speech API`

## Executar localmente

Requisitos: Node.js 20.9 ou superior e npm.

```bash
npm install
npm run dev
```

Para executar as verificações:

```bash
npm run check
npm run test:e2e
```

Crie um `.env.local` com base no `.env.example`. A chave da API deve permanecer somente no servidor.

## Estrutura

```text
app/      interface e rotas
hooks/    comportamento reutilizável
lib/      análise, revisão, sessão e exportação
data/     demonstração guiada
scripts/  suporte ao desenvolvimento e testes
tests/    testes de produto e fluxos E2E
```

## Equipe

- [Geovanna Eduarda da Silva](https://github.com/geovannasilva15)
- [Matheus Barcelli Marques de Lima — Matheus Marks](https://github.com/BRMARKS)

## Licença

Distribuído sob a licença MIT.
