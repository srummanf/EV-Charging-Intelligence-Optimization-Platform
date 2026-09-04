# Web — EV Charging Platform dashboard (Phase 5)

Next.js (App Router, TypeScript) + Tailwind v4 + Recharts. Operator and driver views over
the FastAPI service (`api/`).

## Run

```bash
cp .env.example .env.local        # point NEXT_PUBLIC_API_BASE_URL at the API
npm install
npm run dev                       # http://localhost:3000
```

The API must be running (`uvicorn api.app:app` from the repo root). If it is down, every
data page renders an inline "couldn't load" card instead of erroring.

```bash
npm run build && npm run start     # production
npm run lint                       # eslint (flat config)
```

## Pages

| Route | View | Data |
| --- | --- | --- |
| `/overview` | KPI cards, data-quality summary, service status | `/analytics/overview`, `/health` |
| `/analytics` | Tabbed breakdowns: time of day, weekday, charger, vehicle, city | `/analytics/patterns`, `/analytics/locations` |
| `/segments` | Cluster profile cards + table | `/analytics/segments` |
| `/anomalies` | Sortable/filterable table, click a row for a reason drawer | `/anomalies` |
| `/forecast` | Actual (last 72 h) vs 24 h forecast line chart + caveat | `/forecast` |
| `/my-charging` | Driver form → recommendation card + charger comparison | `POST /recommend` |

## Design

- **Theme-aware.** Light/dark tokens in `app/globals.css`; `next-themes` toggle
  (`data-theme` attribute), system default.
- **Charts** follow the project data-viz palette — validated categorical hues
  (blue / orange / aqua), one y-axis, legend for ≥2 series, hover tooltips, recessive
  grid. Colours are CSS variables so they swap with the theme.
- Data pages are dynamic Server Components (`fetch` with `cache: "no-store"`);
  interactive bits (`/anomalies`, `/forecast`, `/my-charging`) hydrate as Client
  Components.

## Layout

```
web/
├── app/
│   ├── layout.tsx            shell + theme provider
│   ├── overview/ analytics/ segments/ anomalies/ forecast/ my-charging/
│   └── globals.css           design tokens
├── components/
│   ├── app-shell.tsx  theme-toggle.tsx  charts.tsx  kpi-card.tsx  states.tsx
│   └── ui/            card, button, badge, table, tabs, field
└── lib/
    ├── api.ts                typed client (ApiError, env base URL)
    └── types.ts              response shapes (kept in sync with api/schemas.py)
```
