# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in Perch, please **do not open a public GitHub issue**. Instead, use GitHub's [private vulnerability reporting](../../security/advisories/new) for this repository.

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce (a minimal example if possible)
- Any suggested fix, if you have one

We aim to acknowledge reports within a few days and will keep you updated as the issue is investigated and fixed. Please give us reasonable time to address the issue before any public disclosure.

## Scope

This is a small, community-run project. In scope: the Next.js application, its API routes, and its Supabase access patterns (RLS policies, auth flows). Out of scope: third-party services we depend on but do not control (Supabase, Vercel, MapLibre) — please report those upstream.

## Supported versions

Only the code on the `main` branch (and what's currently deployed from it) is supported. There are no maintained release branches.

## Automated scanning

This repo runs [CodeQL](.github/workflows/codeql.yml) and [Dependabot](.github/dependabot.yml) to catch known vulnerable patterns and dependencies automatically.
