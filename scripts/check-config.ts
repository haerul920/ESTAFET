/**
 * Checks an environment before deploying it, with the same rules the server applies at boot.
 *
 *   pnpm config:check                       reads the current environment (for example in a deploy pipeline)
 *   pnpm config:check --file .env.staging   reads a dotenv file on top of the current environment
 *
 * Prints every problem by name and exits with 1 if there are any. It never prints a value.
 */
import { config } from "dotenv";
import { checkConfig } from "../src/lib/config";

const i = process.argv.indexOf("--file");
if (i >= 0 && process.argv[i + 1]) config({ path: process.argv[i + 1], quiet: true, override: true });

const report = checkConfig();
console.log(`Environment: ${report.env}`);
for (const w of report.warnings) console.log(`  warning: ${w}`);
for (const e of report.errors) console.log(`  ERROR:   ${e}`);
console.log(
  report.errors.length
    ? `\n${report.errors.length} problem(s). The server would refuse to start.`
    : "\nOK: the server would start.",
);
process.exit(report.errors.length ? 1 : 0);
