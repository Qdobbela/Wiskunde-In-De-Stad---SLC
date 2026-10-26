// The Edge Functions reuse the pure, tested logic in src/lib/. Supabase only
// bundles files under supabase/functions/, so copy them there before deploying.
// Never edit supabase/functions/_shared/ by hand.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const FILES = ["formula.ts", "geo.ts", "grading.ts", "niveau.ts", "number.ts", "unlock.ts"];
const target = "supabase/functions/_shared";
mkdirSync(target, { recursive: true });
for (const file of FILES) {
  const source = readFileSync(`src/lib/${file}`, "utf8");
  writeFileSync(`${target}/${file}`, `// Copied from src/lib/${file} by scripts/sync-functions-shared.mjs. Don't edit.\n${source}`);
}
console.log(`copied ${FILES.length} files to ${target}`);
