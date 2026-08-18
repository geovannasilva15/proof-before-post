# Guia rápido para publicar no GitHub

O projeto não contém chaves secretas. A pesquisa ao vivo usa a variável `OPENAI_API_KEY`, que deve ser cadastrada apenas na Vercel e nunca enviada ao GitHub.

## Opção mais simples: GitHub Desktop

1. Extraia o arquivo `proof-before-post.zip` no computador.
2. Abra o GitHub Desktop.
3. Clique em **File > Add local repository**.
4. Escolha a pasta extraída `proof-before-post`.
5. Se o programa informar que a pasta ainda não é um repositório, clique em **Create a repository**.
6. Use o nome `proof-before-post` e mantenha a opção **Initialize this repository with a README** desmarcada, pois o README já existe.
7. Clique em **Create repository**.
8. No campo de resumo, escreva: `feat: publish Proof Before Post MVP`.
9. Clique em **Commit to main**.
10. Clique em **Publish repository**.
11. Desmarque **Keep this code private** se quiser que recrutadores e jurados possam acessar o código.

## Pelo terminal

Dentro da pasta do projeto, execute:

```bash
git init
git add .
git commit -m "feat: publish Proof Before Post MVP"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/proof-before-post.git
git push -u origin main
```

Substitua `SEU-USUARIO` pelo seu usuário do GitHub.

## Testar antes de publicar

No terminal aberto dentro da pasta:

```bash
npm install
npm run dev
```

Depois, abra `http://localhost:3000` no navegador.

## Publicar gratuitamente na Vercel

1. Entre em [vercel.com](https://vercel.com) usando sua conta do GitHub.
2. Clique em **Add New > Project**.
3. Selecione o repositório `proof-before-post`.
4. Confirme o framework **Next.js**.
5. Em **Environment Variables**, adicione `OPENAI_API_KEY` e cole a chave diretamente na Vercel.
6. Mantenha a variável disponível para **Production**, **Preview** e **Development**.
7. Não use o prefixo `NEXT_PUBLIC_`, pois ele deixaria a chave visível no navegador.
8. Clique em **Deploy**.

O modelo pode ser alterado pela variável opcional `OPENAI_MODEL`. Sem essa variável, o projeto usa `gpt-5.5`.

## Depois de publicar

No GitHub, abra **About**, clique na engrenagem e adicione:

- a descrição: `Human-centered media literacy tool for reviewing evidence before publishing.`
- o link da aplicação publicada;
- os tópicos: `nextjs`, `typescript`, `media-literacy`, `ai-ethics`, `unesco`, `fact-checking`, `bilingual`.

A equipe já está identificada no `README.md`:

- Geovanna Eduarda da Silva;
- Matheus Barcelli Marques de Lima (Matheus Marks).
