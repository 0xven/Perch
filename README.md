<div align="center">

# 🏔️ Perch

### **Work from anywhere. Worry about nothing.**

**Tested WiFi. Real road status. Honest altitude. Live disaster alerts.**
*97 hill stations from the Western Ghats to the Himalaya — checked by people who actually went.*

[**🌐 Live site →**](https://perch-gamma.vercel.app) &nbsp;·&nbsp; [**Contribute →**](CONTRIBUTING.md) &nbsp;·&nbsp; [**Alerts →**](https://perch-gamma.vercel.app/alerts)

[![CI](https://github.com/0xven/Perch/actions/workflows/ci.yml/badge.svg)](https://github.com/0xven/Perch/actions/workflows/ci.yml)
[![CodeQL](https://github.com/0xven/Perch/actions/workflows/codeql.yml/badge.svg)](https://github.com/0xven/Perch/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-E0A93B.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-7FB89C.svg)](CONTRIBUTING.md)
[![No API keys](https://img.shields.io/badge/API%20keys-zero-7FB89C.svg)](#-built-on-free-and-open-data)

</div>

---

## The problem

Every remote worker heading into the Indian hills runs the same two searches, from scratch, every time:

> *"Can I actually work from there?"* &nbsp;&nbsp;and&nbsp;&nbsp; *"How do I get there, and what's the road like?"*

The answers live scattered across a hundred blog posts, a dozen Telegram groups, and other people's memory. Brochures say the view is nice. Nobody tells you the WiFi dies at 6pm, the ghat road is single-lane after the landslide, or that 3,500 m means two days of acclimatisation before you can think straight.

**Perch is the permanent home for that research.**

---

## 📊 By the numbers

| | |
|---|---|
| 🏔️ **97** destinations | Western Ghats → Himalaya, up to **5,883 m** |
| 🗺️ **10** states & UTs | TN · KL · KA · AP · TS · PY · J&K · Ladakh · HP · UK |
| 🏡 **1,645+** stays mapped | Filtered by tested WiFi, workspace & winter heating |
| ⚡ **7** EV networks | Charging maps for the whole hill circuit |
| ⚠️ **Live** disaster alerts | Floods, quakes & cyclones across South Asia — every 4h |
| 💰 **₹0** API costs | No keys, no billing, no usage caps. Ever. |

---

## ✨ What makes it different

### 🎯 Numbers, not adjectives
Every destination carries its **altitude, oxygen fraction and acclimatisation days**. 3,500 m becomes a plan, not a surprise. The altimeter on the homepage is real barometric maths, not decoration.

### 📡 WiFi you can bet a call on
Speed tests run **on-site**, per stay and per town — down, up, and whether it survives a power cut.

### 🛣️ Roads as they actually are
Surface, hairpins, checkpoints and seasonal closures — **logged from the saddle**, not scraped from brochures.

### ⚠️ Live disaster alerts
Floods, earthquakes and cyclones across India, Nepal, Bhutan, Bangladesh, Pakistan, Sri Lanka and Myanmar — straight from **GDACS** (the EU/UN alert system), refreshed every 4 hours, surfaced before you book.

### 🐘 You're a guest here
Protected-area sightings and wildlife corridor notes, so you slow down where the forest crosses the road.

### 🤝 One form, two records
*"I went from X to Y by car/bike/bus/train"* populates **both** a destination record and a journey record at once. Low-friction enough that non-developers actually contribute.

---

## 🔓 Built on free and open data

Perch runs on **zero paid APIs and zero API keys**. Not as a cost-saving hack — as a design constraint that keeps the project forkable by anyone, forever.

| Source | Used for | Cost |
|---|---|---|
| [Open-Meteo](https://open-meteo.com/) | Live weather + 16-day forecasts | Free, keyless |
| [OpenFreeMap](https://openfreemap.org/) + MapLibre GL | All maps & tiles | Free, keyless |
| [OpenStreetMap](https://www.openstreetmap.org/) / Overpass | 1,645 stays | Free, keyless |
| [GDACS](https://www.gdacs.org/) (EU/UN) | Disaster alerts | Public domain |
| [Wikimedia Commons](https://commons.wikimedia.org/) | Photography (CC-licensed, credited) | Free |

> **Fork it and it just runs.** No billing account, no key provisioning, no usage caps to trip over.

---

## 🚀 Quick start

```bash
git clone https://github.com/0xven/Perch.git
cd Perch
npm install
cp .env.local.example .env.local   # optional — see below
npm run dev
```

Open **[localhost:3000](http://localhost:3000)**. That's it.

> 💡 **No Supabase project? Still works.** Every query degrades to a sensible fallback when the database is unreachable (see `lib/queries/*.ts`), so the whole site builds and renders on placeholder credentials — which is exactly how CI builds it without secrets.

---

## 🏗️ Stack

**[Next.js 16](https://nextjs.org)** (App Router, Turbopack) · **React 19** · **TypeScript** · **Tailwind v4** · **[Supabase](https://supabase.com)** (Postgres + PostGIS + RLS) · **MapLibre GL** · deployed on Vercel

### Performance is a feature
Nearly every public route is **statically prerendered with ISR** — the 97 destination pages included. Data fetching is wrapped so that a Supabase read never accidentally flips a route to dynamic rendering. On the 3G that this site is genuinely used on in the hills, that's the whole ballgame.

### Security is not an afterthought
- **Row Level Security on every table** — the database is the last word, not the client
- **No `service_role` key exists anywhere in the app** — only the public anon key ever ships
- **Strict CSP** with an allowlist for embeds, set in `next.config.ts`
- **CodeQL + Dependabot** on every push · zero open alerts
- See **[SECURITY.md](SECURITY.md)** to report a vulnerability

---

## 🗺️ Routes

| Route | What's there |
|---|---|
| `/` | Live altimeter, personalised "from here" distances, telemetry |
| `/destinations` | All 97, filterable — each with WiFi, weather, wildlife, charging |
| `/trip-finder` | Plan a route before you've picked a destination |
| `/stays` | 1,645+ homestays & hotels, filtered by what matters |
| `/journeys` | Road write-ups: ghats, hairpins, checkpoints |
| `/charging` | EV charging across 7 networks |
| `/alerts` | ⚠️ Live natural-disaster watches for South Asia |
| `/reports` | First-hand trip reports from the community |
| `/kashmir` | The Kashmir Circuit '26 trip log |
| `/contribute` | Add yours — no code required |

---

## 🤝 Contributing

**You don't need to write code to help.** The highest-value contribution is a trip report from a place you actually went — [use the form](https://perch-gamma.vercel.app/contribute).

For code: fork, branch, and make sure `npx tsc --noEmit`, `npx eslint app components lib scripts --quiet` and `npm run build` all pass. Full guide in **[CONTRIBUTING.md](CONTRIBUTING.md)**, ground rules in **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)**.

Good first issues are labelled. Data contributions (a new destination, a corrected road note) are just as welcome as pull requests.

---

## 📄 License

**[MIT](LICENSE)** — fork it, ship it, make it yours.

<div align="center">

---

*Built for the Indian hills — Western Ghats to the Himalaya.*
**Checked by people who actually went.** 🏔️

⭐ **Star this repo** if a mountain with working WiFi sounds like your kind of office.

</div>
