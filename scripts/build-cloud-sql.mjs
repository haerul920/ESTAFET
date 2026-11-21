// Builds supabase/cloud-sql/: the migrations as numbered files you paste into the Supabase SQL Editor, one at a time, in order.
// Run: node scripts/build-cloud-sql.mjs   (the files are generated from supabase/migrations, so never edit them by hand)
//
// Why one file per run: some migrations add enum values and the next one uses them. Values added by ALTER TYPE are only usable
// after they are committed, so each file is run on its own, exactly like `supabase db push` does.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const OUT = "supabase/cloud-sql";
const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n").trimEnd();

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
const rows = [];
files.forEach((f, i) => {
  const n = String(i + 1).padStart(2, "0");
  const name = f.replace(/^\d+_/, "").replace(/\.sql$/, "");
  const target = `${n}_${name}.sql`;
  const header = `-- ESTAFET database, step ${n} of ${files.length}: ${name}.\n-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step ${String(i).padStart(2, "0")} succeeded.\n-- Generated from supabase/migrations/${f}. Do not edit by hand.\n\n`;
  writeFileSync(`${OUT}/${target}`, header + read(`supabase/migrations/${f}`) + "\n", "utf8");
  rows.push(`| ${n} | \`${target}\` |`);
});

writeFileSync(
  `${OUT}/99_OPTIONAL_demo_data.sql`,
  "-- OPTIONAL. Demo data for trying the product: 3 demo accounts, 8 projects, items, requests. Every row is marked is_demo = true.\n-- Do NOT run this on a project that real people use. Run it after the last numbered step, and only if you want the demo.\n\n" +
    read("supabase/seed.sql") +
    "\n",
  "utf8",
);

writeFileSync(
  `${OUT}/README.md`,
  `# Run these in the Supabase SQL Editor

Open your project at supabase.com, then **SQL Editor, New query**. For each file below, in this order:
paste the whole file, click **Run**, wait for "Success", then do the next one. Do not combine files.

| Step | File |
|---|---|
${rows.join("\n")}
| optional | \`99_OPTIONAL_demo_data.sql\` (demo data, skip it for a real site) |

Then make yourself the first admin (replace the email with the one you signed up with):

\`\`\`sql
select public.promote_admin('you@example.com');
\`\`\`

These files are generated from \`supabase/migrations\` by \`node scripts/build-cloud-sql.mjs\`. The migrations stay the source of truth.
`,
  "utf8",
);

console.log(`${OUT}: ${files.length} numbered files + optional demo data + README`);
