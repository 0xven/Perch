# Contributing to Perch

Thanks for your interest in improving Perch. This project stays approachable for non-developer contributors (destination/journey data) as well as code contributors — pick the path that fits.

## Contributing data (no code required)

Use the in-app [/contribute](https://perch-gamma.vercel.app/contribute) form to add a destination or journey you have first-hand experience with. This is the easiest way to help and doesn't require touching this repo.

## Contributing code

1. Fork the repo and clone your fork.
2. `npm install`
3. `cp .env.local.example .env.local` and fill in your own Supabase project (or leave it as placeholder values — most pages degrade gracefully without a live database).
4. `npm run dev` to start the dev server.
5. Make your change on a branch: `git checkout -b your-feature-name`.
6. Before opening a PR, run:
   ```bash
   npx tsc --noEmit
   npx eslint app components lib scripts --quiet
   npm run build
   ```
   These are the same checks CI runs.
7. Open a pull request against `main` with a clear description of what changed and why.

## Conventions

- TypeScript, App Router conventions (see `AGENTS.md` for Next.js version-specific notes — this project pins a newer Next.js than most training data reflects).
- Keep components and queries close to where they're used; see `lib/queries/*.ts` for the data-fetching pattern and its fallback behavior.
- Don't add secrets, API keys, or `.env.local` to a commit — see [SECURITY.md](SECURITY.md).

## Reporting bugs / requesting features

Open a GitHub issue using the relevant template. For security issues, do **not** open a public issue — see [SECURITY.md](SECURITY.md).

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
