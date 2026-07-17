# Self-Contained PptxGenJS Runtime Design

## Goal

Ship OfficeDex with everything required to finish a Canvas Node PPTX generation on a clean macOS or Windows machine. The final renderer must continue to use PptxGenJS; it must not silently fall back to a lower-quality renderer.

Target releases:

- OfficeCLI 0.2.119
- OfficeDex 0.6.2
- Node.js 24.18.0 LTS
- PptxGenJS 4.0.1

## Current Failure

OfficeCLI 0.2.118 enters Canvas Node mode correctly, but the final Vibe stage invokes node by command name and searches for PptxGenJS in global npm directories plus a developer-workspace path. A Finder-launched OfficeDex process has a restricted PATH, and the OfficeDex release contains neither Node nor PptxGenJS.

The release tests only initialize the bridge and cancel after the Canvas appears, so they never exercise final rendering.

## Decision

Use a strict self-contained runtime:

- OfficeDex packages a pinned Node executable and pinned PptxGenJS production dependency tree.
- OfficeDex passes absolute runtime paths to the OfficeCLI bridge.
- OfficeCLI validates the runtime before requesting JavaScript from the LLM.
- Missing, mismatched, or unreadable runtime files fail immediately with a precise diagnostic.
- Runtime failures are never sent through the LLM script-repair retry loop.
- There is no renderer downgrade.

## Runtime Layout

macOS:

    OfficeDex.app/Contents/Resources/pptxgenjs-runtime/
      bin/node
      node_modules/pptxgenjs/
      package.json
      package-lock.json
      runtime.json
      licenses/

Windows:

    pptxgenjs-runtime/
      bin/node.exe
      node_modules/pptxgenjs/
      package.json
      package-lock.json
      runtime.json
      licenses/

runtime.json records the Node version, PptxGenJS version, platform, architecture, source URLs, and SHA-256 values used during staging.

The macOS Node executable is assembled as a universal Mach-O binary from the official Node arm64 and x64 tarballs. The release job verifies both slices before signing it as nested executable code.

## OfficeCLI Changes

OfficeCLI owns runtime validation and execution semantics.

Add a PptxGenJS runtime resolver with this precedence:

1. OFFICECLI_PPTXGENJS_NODE and OFFICECLI_PPTXGENJS_NODE_MODULES
2. A runtime directory adjacent to the OfficeCLI executable
3. System node and npm root -g for standalone developer use

Remove the developer-workspace hard-coded path.

The resolver validates:

- Node path exists, is a regular executable file, and reports Node 24.18.0 for the bundled desktop runtime.
- Module root contains pptxgenjs/package.json with version 4.0.1.
- A smoke script can require("pptxgenjs") and create a one-slide PPTX.

Runtime resolution happens before the LLM generates JavaScript. Environment and preflight errors return directly. The existing two script-repair attempts remain only for JavaScript that was actually launched by Node and exited unsuccessfully.

## OfficeDex Changes

OfficeDex owns acquisition, packaging, signing, and bridge environment wiring.

Add deterministic scripts to:

- download official Node archives and verify SHASUMS256.txt;
- install PptxGenJS from a committed lockfile with npm ci --omit=dev;
- generate runtime.json;
- collect Node, PptxGenJS, and transitive dependency license files;
- copy the staged runtime into macOS and Windows application layouts;
- verify the packaged runtime with a restricted PATH.

When OfficeDex starts the OfficeCLI bridge, it adds absolute:

- OFFICECLI_PPTXGENJS_NODE
- OFFICECLI_PPTXGENJS_NODE_MODULES

The paths are derived from the packaged application layout. Development and real-E2E runs use the corresponding staged build/pptxgenjs-runtime paths.

## Integrity and Error Handling

Runtime acquisition fails the build if:

- a Node archive checksum does not match;
- the npm lockfile changes during installation;
- required license data is absent;
- the Node or PptxGenJS version differs from the pinned versions;
- the macOS universal binary lacks either architecture.

Runtime startup fails before any paid LLM request if:

- the configured files are missing;
- Node cannot execute;
- PptxGenJS cannot be loaded;
- the runtime manifest does not match the required versions.

The user-facing failure identifies the missing or mismatched component and includes the resolved runtime paths. OfficeCLI does not retry these failures and does not switch renderers.

## Test and Release Gates

OfficeCLI tests:

- explicit runtime paths work with a restricted PATH;
- missing Node and missing module fail before the LLM is called;
- environment failures are not retried;
- an executed JavaScript failure still uses the existing repair retry;
- the hard-coded developer path is absent.

OfficeDex tests:

- Node archive checksum verification;
- deterministic runtime staging and manifest generation;
- bridge environment path generation for macOS, Windows, and development;
- package verification rejects missing or wrong-version Node/PptxGenJS;
- license bundling includes the runtime dependency set.

End-to-end release test:

1. Start the released OfficeCLI with PATH=/usr/bin:/bin on macOS and an equivalent restricted path on Windows.
2. Submit the deterministic Canvas magic prompt.
3. Wait for task completion rather than cancelling after Canvas entry.
4. Assert a non-empty PPTX artifact exists and opens as a valid ZIP/OOXML package.
5. Confirm logs show the packaged Node and PptxGenJS paths.

The macOS release additionally verifies nested code signing, universal architectures, app notarization, and DMG notarization after the runtime is embedded.

## Non-Goals

- Replacing PptxGenJS with OfficeGen or PPTist export.
- Falling back to another renderer.
- Depending on Homebrew, system npm, or a developer checkout.
- Changing the Canvas interaction model or generated deck design prompts.
