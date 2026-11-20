export interface SkippedFile {
  name: string;
  reason: string;
}

const NAME_RULES: { test: (base: string) => boolean; reason: string }[] = [
  { test: (b) => b === ".env" || b.startsWith(".env."), reason: "Environment file" },
  { test: (b) => b.endsWith(".pem"), reason: "Private key or certificate (.pem)" },
  { test: (b) => b.endsWith(".key"), reason: "Key file (.key)" },
  { test: (b) => b.endsWith(".p12") || b.endsWith(".pfx"), reason: "Key store" },
  { test: (b) => /^id_(rsa|dsa|ecdsa|ed25519)/.test(b), reason: "SSH private key" },
  { test: (b) => /^credentials.*\.json$/.test(b), reason: "Credentials file" },
  { test: (b) => b === "keys.json" || b === "secrets.json" || b === "secret.json", reason: "Secrets file" },
  { test: (b) => b === ".npmrc" || b === ".pypirc" || b === ".netrc", reason: "Package registry credentials" },
];

/** Sensitive file name check (`.env*`, `*.pem`, `id_rsa*`, `*.key`, `credentials*.json`, ...). */
export function sensitiveNameReason(path: string): string | null {
  const base = path.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  for (const rule of NAME_RULES) if (rule.test(base)) return rule.reason;
  return null;
}

const PATTERNS: { rule: string; re: RegExp; strictOnly?: boolean }[] = [
  { rule: "Private key block", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/ },
  { rule: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { rule: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { rule: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { rule: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { rule: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { rule: "Secret API key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { rule: "JSON Web Token", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  {
    rule: "Hard-coded secret value",
    re: /\b(?:api[_-]?key|secret|token|passwd|password|private[_-]?key)\b\s*[:=]\s*["']?[A-Za-z0-9/+_=.-]{16,}/i,
    strictOnly: true,
  },
];

export interface SecretHit {
  rule: string;
  line: number;
}

/**
 * Scans text for common token patterns. `loose` (Markdown) also checks `key = value` assignments;
 * PDFs use the high-confidence rules only to avoid flagging prose.
 */
export function findSecretPatterns(text: string, opts: { loose?: boolean } = {}): SecretHit[] {
  const hits: SecretHit[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const p of PATTERNS) {
      if (p.strictOnly && !opts.loose) continue;
      if (p.re.test(lines[i])) {
        hits.push({ rule: p.rule, line: i + 1 });
        break;
      }
    }
  }
  return hits;
}
