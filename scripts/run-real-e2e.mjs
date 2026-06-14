#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const wantsList = args.includes("--list") || args.includes("-list");

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    env: options.env ?? process.env,
  });
  return result.status ?? 1;
}

if (wantsList) {
  const status = run("go", ["test", "-tags", "real_e2e", ".", "./internal/bridge", "-list", "TestReal"]);
  process.exit(status);
}

const runId = process.env.OFFICEDEX_E2E_RUN_ID || timestamp();
const runDir = path.join(repoRoot, "test-results", `real-e2e-${runId}`);
const artifactDir = path.join(runDir, "artifacts");
const bridgeReportPath = path.join(runDir, "bridge-report.json");
const appReportPath = path.join(runDir, "app-report.json");
const finalReportPath = path.join(runDir, "report.json");
const markdownReportPath = path.join(runDir, "report.md");
const officecliBinary = process.env.OFFICECLI_DESKTOP_BINARY || path.join(repoRoot, "build", "officecli", process.platform === "win32" ? "officecli.exe" : "officecli");

mkdirSync(artifactDir, { recursive: true });

const prefetchStatus = run("npm", ["run", "prefetch:officecli"]);
if (prefetchStatus !== 0) {
  writeFinalReport({
    status: "failed",
    runId,
    runDir,
    artifactDir,
    officecliBinary,
    bridgeExitCode: null,
    appExitCode: null,
    records: [],
    failure: "prefetch:officecli failed",
  });
  process.exit(prefetchStatus);
}

const baseEnv = {
  ...process.env,
  OFFICEDEX_E2E_REAL: "1",
  OFFICEDEX_E2E_REAL_GENERATE: "1",
  OFFICECLI_DESKTOP_BINARY: officecliBinary,
  OFFICEDEX_E2E_OUTPUT_DIR: artifactDir,
};

const bridgeEnv = {
  ...baseEnv,
  OFFICEDEX_REAL_E2E_REPORT: bridgeReportPath,
};

const bridgeExitCode = run("go", [
  "test",
  "-tags",
  "real_e2e",
  "./internal/bridge",
  "-run",
  "TestRealOfficeCli",
  "-count=1",
  "-timeout",
  "120m",
  "-v",
], { env: bridgeEnv });

const bridgeReport = readJSON(bridgeReportPath);
const previewArtifact = pickPreviewArtifact(bridgeReport);

const appEnv = {
  ...baseEnv,
  OFFICEDEX_REAL_E2E_APP_REPORT: appReportPath,
};
if (previewArtifact) {
  appEnv.OFFICEDEX_E2E_PREVIEW_ARTIFACT = previewArtifact.filePath;
  appEnv.OFFICEDEX_E2E_PREVIEW_DOCUMENT_TYPE = previewArtifact.documentType;
}

const appExitCode = run("go", [
  "test",
  "-tags",
  "real_e2e",
  ".",
  "-run",
  "TestRealOfficeDex",
  "-count=1",
  "-timeout",
  "45m",
  "-v",
], { env: appEnv });

const appReport = readJSON(appReportPath);
const records = [
  ...recordsFromReport("bridge", bridgeReport),
  ...recordsFromReport("app", appReport),
];
const status = bridgeExitCode === 0 && appExitCode === 0 ? "passed" : "failed";

writeFinalReport({
  status,
  runId,
  runDir,
  artifactDir,
  officecliBinary,
  bridgeExitCode,
  appExitCode,
  bridgeReport,
  appReport,
  records,
});

console.log(`[real-e2e] report: ${finalReportPath}`);
console.log(`[real-e2e] markdown: ${markdownReportPath}`);
console.log(`[real-e2e] artifacts: ${artifactDir}`);

process.exit(status === "passed" ? 0 : 1);

function writeFinalReport(input) {
  const officecliVersion = officecliVersionString(input.officecliBinary);
  const finalReport = {
    status: input.status,
    runId: input.runId,
    generatedAt: new Date().toISOString(),
    officecliBinary: input.officecliBinary,
    officecliVersion,
    runDir: input.runDir,
    artifactDir: input.artifactDir,
    bridgeExitCode: input.bridgeExitCode,
    appExitCode: input.appExitCode,
    failure: input.failure,
    summary: summarize(input.records),
    records: input.records,
    sourceReports: {
      bridge: bridgeReportPath,
      app: appReportPath,
    },
  };
  mkdirSync(input.runDir, { recursive: true });
  writeFileSync(finalReportPath, `${JSON.stringify(finalReport, null, 2)}\n`);
  writeFileSync(markdownReportPath, markdownReport(finalReport));
}

function readJSON(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function recordsFromReport(source, report) {
  if (!report || !Array.isArray(report.records)) return [];
  return report.records.map((record) => ({ source, ...record }));
}

function pickPreviewArtifact(report) {
  if (!report || !Array.isArray(report.records)) return null;
  const supported = new Set([".pptx", ".docx", ".xlsx", ".pdf", ".html", ".htm", ".png", ".jpg", ".jpeg", ".webp"]);
  const candidates = report.records
    .filter((record) => record && record.operation === "generate" && typeof record.filePath === "string")
    .filter((record) => supported.has(path.extname(record.filePath).toLowerCase()));
  const withSidecar = candidates.find((record) => {
    const ext = path.extname(record.filePath);
    const sidecar = record.filePath.slice(0, -ext.length) + ".preview.html";
    return existsSync(sidecar);
  });
  return withSidecar || candidates[0] || null;
}

function summarize(records) {
  const bySource = {};
  const artifacts = [];
  for (const record of records ?? []) {
    const source = record.source || "unknown";
    bySource[source] = (bySource[source] || 0) + 1;
    if (record.filePath && existsSync(record.filePath)) {
      let size = record.fileSize;
      if (!Number.isFinite(size)) {
        try {
          size = statSync(record.filePath).size;
        } catch {
          size = null;
        }
      }
      artifacts.push({ path: record.filePath, size });
    }
  }
  return {
    recordCount: records?.length ?? 0,
    bySource,
    artifactCount: artifacts.length,
    artifacts,
  };
}

function markdownReport(report) {
  const lines = [];
  lines.push("# OfficeDex Real E2E Report");
  lines.push("");
  lines.push(`- Status: ${report.status}`);
  lines.push(`- Run ID: ${report.runId}`);
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- OfficeCLI: ${report.officecliVersion || report.officecliBinary}`);
  lines.push(`- Artifacts: ${report.artifactDir}`);
  lines.push(`- JSON report: ${finalReportPath}`);
  lines.push("");
  lines.push("## Records");
  lines.push("");
  lines.push("| Source | Operation | Name | Document | Duration | File |");
  lines.push("| --- | --- | --- | --- | ---: | --- |");
  for (const record of report.records ?? []) {
    lines.push([
      record.source || "",
      record.operation || record.group || "",
      record.name || "",
      record.documentType || "",
      record.durationMs != null ? `${record.durationMs} ms` : "",
      record.filePath || record.detail || "",
    ].map(markdownCell).join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- This run uses the real bundled OfficeCLI binary and real hosted generation.");
  lines.push("- Browser-dev mock bridge tests are not part of this E2E entrypoint.");
  lines.push("- OAuth completion, OS file picker windows, Finder reveal, and forced long-running cancellation remain manual or require a Wails webview runner.");
  return `${lines.join("\n")}\n`;
}

function markdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function officecliVersionString(binary) {
  if (!binary || !existsSync(binary)) return "";
  const result = spawnSync(binary, ["--version"], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) return "";
  return (result.stdout || result.stderr || "").trim();
}

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
