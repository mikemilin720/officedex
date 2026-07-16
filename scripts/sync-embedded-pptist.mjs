import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function syncEmbeddedPptist({ distDir, publicDir, embedCssPath }) {
  if (!distDir || !publicDir || !embedCssPath) {
    throw new Error("distDir, publicDir, and embedCssPath are required");
  }

  await rm(publicDir, { force: true, recursive: true });
  await mkdir(path.dirname(publicDir), { recursive: true });
  await cp(distDir, publicDir, { recursive: true });
  await cp(embedCssPath, path.join(publicDir, "officedex-embed.css"));

  const indexPath = path.join(publicDir, "index.html");
  let html = await readFile(indexPath, "utf8");
  html = html.replace(/\s*<link\b[^>]*href=["']\.\/officedex-embed\.css["'][^>]*>\s*/g, "\n");
  const moduleScript = /([ \t]*)(<script\b[^>]*\btype=["']module["'][^>]*><\/script>)/;
  if (!moduleScript.test(html)) {
    throw new Error(`PPTist index module script not found in ${indexPath}`);
  }
  html = html.replace(
    moduleScript,
    '$1<link rel="stylesheet" crossorigin href="./officedex-embed.css">\n$1$2',
  );
  await writeFile(indexPath, html);
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error(`Invalid argument near ${key ?? "<end>"}`);
    values.set(key.slice(2), value);
  }
  return {
    distDir: values.get("dist"),
    publicDir: values.get("public"),
    embedCssPath: values.get("css"),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  syncEmbeddedPptist(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
