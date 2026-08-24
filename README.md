<div align="center">

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=2563eb&height=180&section=header&text=Proof%20Before%20Post&fontSize=42&fontColor=ffffff&animation=fadeIn&fontAlignY=34&desc=Pause.%20Check%20the%20evidence.%20Then%20post.&descAlignY=57" alt="Proof Before Post" />

</div>

<div align="center">

[![Site](https://img.shields.io/badge/Acessar_projeto-Online-2563EB?style=for-the-badge&logo=vercel&logoColor=white)](https://proof-before-post.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![License](https://img.shields.io/badge/Licença-MIT-green?style=for-the-badge)](LICENSE)

**Experiência bilíngue de educação midiática que ajuda criadores a examinar evidências antes da publicação — sem delegar à IA o veredito sobre o que é verdadeiro.**

</div>

## O problema

Uma pesquisa da UNESCO com 500 criadores de conteúdo em 45 países indicou que 62% não realizavam verificação rigorosa e sistemática antes de compartilhar conteúdo. O Proof Before Post transforma esse desafio em uma experiência curta e prática no momento em que a decisão editorial ainda pode ser revista.

## Como funciona

1. Insira uma legenda, roteiro, publicação ou URL pública.
2. Selecione uma afirmação que merece atenção.
3. Compare até três fontes e revise seus metadados.
4. Registre uma avaliação humana da evidência.
5. Revise o trecho e gere um **Evidence Receipt**.

> O recibo documenta o processo de verificação. Ele não certifica que o conteúdo é verdadeiro.

## Recursos principais

- Pesquisa web com links verificáveis
- Fluxo completo em português e inglês
- Mapa da relação entre afirmações e evidências
- Comparação entre texto original e revisado
- Histórico privado armazenado no navegador
- Exportação em PDF, PNG e texto
- Narração pelo navegador e suporte a teclado
- Controles de segurança para importação de URLs
- Testes de produto, comportamento e regressão com Playwright

## Princípios éticos

A plataforma organiza perguntas, fontes e lacunas de evidência, mas não classifica conteúdo como verdadeiro ou falso, não inventa fontes, não aprova publicações e não substitui especialistas.

## Tecnologias

Next.js 16, React 19, TypeScript, CSS, OpenAI Responses API, Canvas API, jsPDF, Web Speech API e Playwright.

## Executar localmente

Requisitos: Node.js 20.9 ou superior e npm.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

Para validação completa:

```bash
npm run check
npm run test:e2e
```

## Configuração

Copie `.env.example` e configure `OPENAI_API_KEY` apenas no servidor. Nunca use o prefixo `NEXT_PUBLIC_` para essa credencial.

## Equipe

- [Geovanna Eduarda da Silva](https://github.com/geovannasilva15)
- [Matheus Barcelli Marques de Lima — Matheus Marks](https://github.com/BRMARKS)

## Licença

Distribuído sob a licença MIT. Consulte [LICENSE](LICENSE).
