# Pocket City

A cozy, playable mini city builder. No account, external assets, network API, or backend required.

## Run

Use Node.js 22.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5186. `npm test` runs simulation tests; `npm run build` checks TypeScript and creates `dist/`. `npm run preview` serves the production build.

## Play

Start a road anywhere on the **left edge**, extend it, and place houses directly beside connected roads. Press **Next day** to welcome residents and collect daily income. Disconnected houses cannot grow; lost road access gradually empties homes.

- Roads $12; houses $100; parks $55; shops $150; services $240.
- Houses hold four residents, plus two when connected jobs exist and two when a connected service is within three Manhattan squares.
- Parks within two Manhattan squares improve happiness. Connected shops provide six jobs and $8/day. Connected services provide two jobs.
- Residents pay $3/day. Every road/building has upkeep, including disconnected buildings. Happiness affects arrival speed.
- Bulldozing is free with no refund. Replacing a plot charges the new building's full price. Removing houses immediately removes their proportional share of residents.
- Use keys **1–6** to select tools. Arrow keys navigate plots; **Enter/Space** builds. Tap/click works too.
- Progress autosaves in this browser. **New city** asks for confirmation and offers a blank map or a starter village. Clearing browser storage erases progress; private browsing/storage restrictions may prevent saving.

This is a bounded 10×10 sandbox: no traffic routing, per-house household ledger, disasters, loans, or real-time background progression. Budget floors at zero after upkeep; construction never permits overspending.

## Deploy

Public app: https://gracebilliris.github.io/pocket-city/

The Pages workflow tests and builds on pushes to `main`, then publishes `dist/` through GitHub Pages Actions. Set repository Pages source to **GitHub Actions**. Vite uses `base: './'` for relative assets. No secrets or environment variables are required.
