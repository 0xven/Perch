// Generates supabase/migrations/003 from the canonical catalogue so the DB stays
// in sync with lib/data/destinations.ts. Run: npx tsx scripts/gen-dest-sql.ts
import process from 'node:process'
import { DESTINATIONS } from '../lib/data/destinations'

const esc = (s: string) => s.replace(/'/g, "''")

const rows = DESTINATIONS.map(
  (d) =>
    `  ('${esc(d.name)}', '${d.slug}', '${d.state}', ${d.elevationM}, '${d.category}', '${esc(d.summary)}', ST_Point(${d.lng}, ${d.lat})::geography)`,
).join(',\n')

const sql = `-- AUTO-GENERATED from lib/data/destinations.ts (npx tsx scripts/gen-dest-sql.ts).
-- Seeds every catalogue destination so community data (WiFi, work spots,
-- journeys) and the contribution form can attach by slug. Safe to re-run.

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE destinations ADD COLUMN IF NOT EXISTS
  category TEXT DEFAULT 'hill_station'
  CHECK (category IN ('hill_station', 'coastal', 'city', 'forest', 'heritage', 'gateway'));

INSERT INTO destinations (name, slug, state, elevation_m, category, climate_notes, location) VALUES
${rows}
ON CONFLICT (slug) DO UPDATE SET
  name         = EXCLUDED.name,
  state        = EXCLUDED.state,
  elevation_m  = EXCLUDED.elevation_m,
  category     = EXCLUDED.category,
  climate_notes = EXCLUDED.climate_notes,
  location     = EXCLUDED.location;
`

process.stdout.write(sql)
