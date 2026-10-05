# X-tractor — frontend

React + Vite single-page app written in **JavaScript** (no TypeScript). See the [project README](../README.md) for the full picture.

```bash
npm install
npm run dev      # http://localhost:5173 — proxies /api to http://localhost:8000
npx oxlint       # lint
npm run build    # production build in dist/
```

| Folder | Contents |
|---|---|
| `src/pages` | one page per route (login, dashboard, extractors, the job steps, history) |
| `src/layouts` | app shell (sidebar), job layout (header + stepper), route guard |
| `src/components/ui` | design-system primitives (buttons, cards, badges, progress, modal…) |
| `src/components/features` | job timeline and lanes, results viewers, SDK cards |
| `src/hooks` | TanStack Query hooks and the SSE `useJobEvents` hook |
| `src/context` | auth, theme, upload draft |
| `src/lib` | API client, endpoints, formatting |
| `src/styles/index.css` | Tailwind v4 and the design tokens (light and dark) |
