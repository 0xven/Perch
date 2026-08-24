# Perch

A community-fed platform for remote-work travel in South India. Perch combines two research tasks travellers usually repeat from scratch — "can I work from here?" and "how do I get there?" — into one place: destinations with WiFi/work-spot data, and the journeys that connect them.

[![CI](https://github.com/0xven/Perch/actions/workflows/ci.yml/badge.svg)](https://github.com/0xven/Perch/actions/workflows/ci.yml)
[![CodeQL](https://github.com/0xven/Perch/actions/workflows/codeql.yml/badge.svg)](https://github.com/0xven/Perch/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)


## What it is

- **Destinations** — hill stations, forests, coastal towns, and gateway cities, each with WiFi/work-spot notes and accommodation info.
- **Journeys** — transport-agnostic route data (car, bike, bus, train) between destinations, including road conditions and ghat warnings.
- **Contribute** — a single low-friction form: "I went from X to Y by car/bike/bus/train" populates both a destination and a journey record at once.

## Stack

- [Next.js](https://nextjs.org) (App Router) + React 19 + TypeScript
- [Supabase](https://supabase.com) (PostgreSQL + PostGIS) for data and auth
- MapLibre GL for maps
- Deployed on Vercel

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in your own Supabase project details
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app degrades gracefully without Supabase credentials — public pages fall back to empty/placeholder state rather than failing to build (see `lib/queries/*.ts`), which is also how CI builds without real secrets.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, coding conventions, and how to submit a PR. Please also read our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Found a vulnerability? Please see [SECURITY.md](SECURITY.md) for how to report it responsibly rather than opening a public issue.

## License

MIT — see [LICENSE](LICENSE).
