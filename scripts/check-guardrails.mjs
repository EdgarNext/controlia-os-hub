import fs from "node:fs";
import path from "node:path";

const hubRoot = process.cwd();
const maxUseClient = Number.parseInt(process.env.MAX_USE_CLIENT ?? "60", 10);
const useClientThreshold = Number.isFinite(maxUseClient) ? maxUseClient : 60;

const authGetUserAllowlist = new Set([
  "actions/auth/sign-in.ts",
  "lib/auth/get-user.ts",
  "lib/auth/require-guest.ts",
  "lib/supabase/update-session.ts",
]);

const skipDirs = new Set(["node_modules", ".next", ".git", "dist", "build", "coverage"]);
const codeExt = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function walkFiles(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) {
        walkFiles(absPath, acc);
      }
      continue;
    }

    const ext = path.extname(entry.name);
    if (codeExt.has(ext)) {
      acc.push(absPath);
    }
  }

  return acc;
}

function rel(absPath) {
  return path.relative(hubRoot, absPath).split(path.sep).join("/");
}

function read(absPath) {
  return fs.readFileSync(absPath, "utf8");
}

function formatLine(refPath, lineNo, message) {
  return `${refPath}:${lineNo}${message ? ` ${message}` : ""}`;
}

function getLineNo(content, index) {
  return content.slice(0, index).split("\n").length;
}

const allCodeFiles = walkFiles(hubRoot);

const failLines = [];
const warnLines = [];

// 1) PageFrame nested under tenant slug pages
for (const absPath of allCodeFiles) {
  const filePath = rel(absPath);
  if (!filePath.endsWith("/page.tsx")) {
    continue;
  }
  if (!filePath.includes("app/(tenant)/[tenantSlug]/")) {
    continue;
  }

  const content = read(absPath);
  const idx = content.indexOf("PageFrame");
  if (idx >= 0) {
    failLines.push(formatLine(filePath, getLineNo(content, idx), "PageFrame detectado en page tenant-scoped"));
  }
}

// 2) toast.error + inline error heuristic in forms (WARN)
for (const absPath of allCodeFiles) {
  const filePath = rel(absPath);
  const lowerName = path.basename(filePath).toLowerCase();
  const isLikelyForm =
    lowerName.includes("form") ||
    filePath.includes("/components/auth/") ||
    filePath.includes("/components/pos/catalog/");
  if (!isLikelyForm) {
    continue;
  }

  const content = read(absPath);
  const toastIdx = content.indexOf("toast.error");
  if (toastIdx < 0) {
    continue;
  }

  const hasInlineSignal =
    content.includes("aria-invalid") ||
    content.includes("StatePanel kind=\"error\"") ||
    content.includes("id=\"") && content.includes("-error");

  if (hasInlineSignal) {
    warnLines.push(formatLine(filePath, getLineNo(content, toastIdx), "posible inline + toast.error (heuristica)"));
  }
}

// 3) use client count
let useClientCount = 0;
for (const absPath of allCodeFiles) {
  const content = read(absPath);
  if (/^\s*["']use client["'];/m.test(content)) {
    useClientCount += 1;
  }
}
if (useClientCount > useClientThreshold) {
  warnLines.push(`use client total=${useClientCount} supera umbral=${useClientThreshold}`);
}

// 4) auth.getUser allowlist enforcement (FAIL outside allowlist)
for (const absPath of allCodeFiles) {
  const filePath = rel(absPath);
  if (filePath.startsWith("scripts/")) {
    continue;
  }
  const content = read(absPath);
  let idx = content.indexOf("auth.getUser(");

  while (idx >= 0) {
    if (!authGetUserAllowlist.has(filePath)) {
      failLines.push(formatLine(filePath, getLineNo(content, idx), "auth.getUser fuera de allowlist"));
    }
    idx = content.indexOf("auth.getUser(", idx + 1);
  }
}

const summary = [];
summary.push(`[guardrails] FAIL=${failLines.length} WARN=${warnLines.length} use-client=${useClientCount}`);

if (failLines.length > 0) {
  summary.push("[FAIL]");
  for (const line of failLines) {
    summary.push(`- ${line}`);
  }
}

if (warnLines.length > 0) {
  summary.push("[WARN]");
  for (const line of warnLines) {
    summary.push(`- ${line}`);
  }
}

if (failLines.length === 0 && warnLines.length === 0) {
  summary.push("[OK] Guardrails sin hallazgos.");
}

console.log(summary.join("\n"));
process.exitCode = failLines.length > 0 ? 1 : 0;
