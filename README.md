# WC Player Guess

An animated React guessing game for World Cup players. The player gets six guesses and each guess compares nation, position, club, age, World Cup goals, UCL trophies, World Cup trophies, current club, former club, and transfer value.

## Run Locally

```bash
npm install
npm run dev
```

## Build For Deployment

```bash
npm run build
```

The production output is created in `dist/`.

## Deployment

This project is a Vite React static app, so it can deploy to Vercel, Netlify, Cloudflare Pages, or GitHub Pages.

Recommended settings:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: `22`

## Data

The first player pool is starter seed data. Before a public launch, verify current clubs, ages, transfer values, and the exact FIFA top-20 team list for the ranking date you want to support.
