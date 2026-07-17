# Self-Contained PptxGenJS Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Publish OfficeCLI 0.2.119 and OfficeDex 0.6.2 so clean macOS and Windows installations complete Canvas Node PPTX generation with bundled PptxGenJS and no renderer downgrade.

**Architecture:** OfficeDex stages, verifies, packages, signs, and exposes pinned Node 24.18.0 and PptxGenJS 4.0.1 assets. OfficeCLI resolves explicit absolute paths, performs preflight before any LLM request, and retries only JavaScript failures after Node has started. Release gates complete the deterministic magic deck with the OfficeCLI child PATH restricted to system directories.

**Tech Stack:** Go 1.25, Node.js 24.18.0 LTS, PptxGenJS 4.0.1, npm lockfiles, Wails v2, Node test runner, Vitest, Playwright, GitHub Actions, GoReleaser, codesign, Apple notarization.

---

### Task 1: Preserve workspaces and establish baselines

**Files:**
- Worktree: /Users/luyang/.config/superpowers/worktrees/officecli-internal/pptxgenjs-runtime-0.2.119
- Worktree: /Users/luyang/.config/superpowers/worktrees/officedex/pptxgenjs-runtime-0.6.2

- [x] **Step 1: Create isolated worktrees from origin/main**

~~~bash
git -C /Users/luyang/Workspace/shimo/vibe-officing/officecli-internal worktree add \
  /Users/luyang/.config/superpowers/worktrees/officecli-internal/pptxgenjs-runtime-0.2.119 \
  -b codex/pptxgenjs-runtime-0.2.119 origin/main
git -C /Users/luyang/Workspace/shimo/vibe-officing/officedex worktree add \
  /Users/luyang/.config/superpowers/worktrees/officedex/pptxgenjs-runtime-0.6.2 \
  -b codex/pptxgenjs-runtime-0.6.2 origin/main
~~~

- [x] **Step 2: Install root and vendored dependencies**

~~~bash
env -u GOROOT go mod download
HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 npm install
cd third_party/pptist
HUSKY=0 HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 npm ci
~~~

- [x] **Step 3: Verify clean baselines**

~~~bash
# OfficeCLI
env -u GOROOT go test ./... -count=1

# OfficeDex after Wails binding generation
npm run lint
npm run test:scripts
npx vitest run
env -u GOROOT go test ./... -count=1
env -u GOROOT go test -tags officedex_demo ./... -count=1
~~~

Expected: OfficeCLI passes all Go packages; OfficeDex passes lint, 15 script tests, 38 renderer files and 472 tests, plus both Go matrices.

### Task 2: Add strict OfficeCLI runtime resolution

**Files:**
- Create: internal/runtime/pptxgenjs_runtime.go
- Create: internal/runtime/pptxgenjs_runtime_test.go
- Modify: internal/runtime/pptxgenjs.go

- [ ] **Step 1: Write failing resolver tests**

~~~go
func TestResolvePptxgenjsRuntimeUsesExplicitPathsWithRestrictedPATH(t *testing.T) {
    t.Setenv("PATH", "/usr/bin:/bin")
    t.Setenv("OFFICECLI_PPTXGENJS_NODE", fakeNodePath)
    t.Setenv("OFFICECLI_PPTXGENJS_NODE_MODULES", moduleRoot)
    got, err := resolvePptxgenjsRuntime(context.Background())
    if err != nil {
        t.Fatal(err)
    }
    if got.NodePath != fakeNodePath || got.NodeModulesPath != moduleRoot {
        t.Fatalf("runtime = %+v", got)
    }
}

func TestResolvePptxgenjsRuntimeRejectsMissingNode(t *testing.T) {
    t.Setenv("OFFICECLI_PPTXGENJS_NODE", filepath.Join(t.TempDir(), "node"))
    _, err := resolvePptxgenjsRuntime(context.Background())
    if err == nil || !strings.Contains(err.Error(), "OFFICECLI_PPTXGENJS_NODE") {
        t.Fatalf("err = %v", err)
    }
}

func TestResolvePptxgenjsRuntimeRejectsWrongModuleVersion(t *testing.T) {
    writePackageJSON(t, moduleRoot, "4.0.0")
    _, err := resolvePptxgenjsRuntime(context.Background())
    if err == nil || !strings.Contains(err.Error(), "expected 4.0.1") {
        t.Fatalf("err = %v", err)
    }
}
~~~

The fake Node executable answers --version with v24.18.0 and can run a require("pptxgenjs") smoke script.

- [ ] **Step 2: Verify RED**

~~~bash
env -u GOROOT go test ./internal/runtime -run 'TestResolvePptxgenjsRuntime' -count=1
~~~

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement the minimal resolver**

~~~go
const expectedPptxgenjsNodeVersion = "24.18.0"
const expectedPptxgenjsVersion = "4.0.1"

type pptxgenjsRuntime struct {
    NodePath        string
    NodeModulesPath string
}

func resolvePptxgenjsRuntime(ctx context.Context) (pptxgenjsRuntime, error)
func validateNodeVersion(ctx context.Context, nodePath string) error
func validatePptxgenjsModule(moduleRoot string) error
func smokePptxgenjsRuntime(ctx context.Context, runtime pptxgenjsRuntime) error
~~~

Resolution order is explicit environment variables, a runtime adjacent to os.Executable(), then system node plus npm root -g for developer CLI use. Remove the developer-workspace hard-coded path.

- [ ] **Step 4: Verify GREEN and commit**

~~~bash
env -u GOROOT go test ./internal/runtime -run 'TestResolvePptxgenjsRuntime' -count=1
git add internal/runtime/pptxgenjs_runtime.go internal/runtime/pptxgenjs_runtime_test.go internal/runtime/pptxgenjs.go
git diff --cached --check
git commit -m "fix: resolve a strict PptxGenJS runtime"
~~~

### Task 3: Preflight before LLM and isolate retryable script errors

**Files:**
- Modify: internal/runtime/pptxgenjs.go
- Create: internal/runtime/pptxgenjs_test.go

- [ ] **Step 1: Write failing preflight and retry tests**

~~~go
func TestBuildPPTXPreflightsBeforeCallingLLM(t *testing.T) {
    llm := &countingLLM{}
    t.Setenv("OFFICECLI_PPTXGENJS_NODE", "/missing/node")
    _, _, err := BuildPPTXWithPptxgenjs(context.Background(), llm, nil, payload, "Topic")
    if err == nil || llm.Calls != 0 {
        t.Fatalf("err=%v calls=%d", err, llm.Calls)
    }
}

func TestRuntimeLaunchFailureIsNotSentToRepair(t *testing.T) {
    llm := &countingLLM{Responses: []string{validCode}}
    executePptxgenjs = sequenceExecutor(&pptxgenjsRuntimeError{Message: "node disappeared"})
    _, _, err := BuildPPTXWithPptxgenjs(context.Background(), llm, nil, payload, "Topic")
    if err == nil || llm.Calls != 1 {
        t.Fatalf("err=%v calls=%d", err, llm.Calls)
    }
}

func TestExecutedScriptFailureUsesRepairRetry(t *testing.T) {
    llm := &countingLLM{Responses: []string{badCode, fixedCode}}
    executePptxgenjs = sequenceExecutor(scriptExitError, validPPTX)
    _, _, err := BuildPPTXWithPptxgenjs(context.Background(), llm, nil, payload, "Topic")
    if err != nil || llm.Calls != 2 {
        t.Fatalf("err=%v calls=%d", err, llm.Calls)
    }
}
~~~

- [ ] **Step 2: Verify RED**

~~~bash
env -u GOROOT go test ./internal/runtime -run 'Test(BuildPPTXPreflights|RuntimeLaunchFailure|ExecutedScriptFailure)' -count=1
~~~

- [ ] **Step 3: Implement strict error boundaries**

Resolve and smoke-test the runtime before generating JavaScript. Add typed pptxgenjsRuntimeError and pptxgenjsScriptError values. Only pptxgenjsScriptError enters the existing LLM repair loop; missing executables, version mismatch, failed smoke checks, and exec.Error return immediately.

- [ ] **Step 4: Verify GREEN and commit**

~~~bash
env -u GOROOT go test ./internal/runtime -count=1
git add internal/runtime/pptxgenjs.go internal/runtime/pptxgenjs_test.go
git diff --cached --check
git commit -m "fix: preflight PptxGenJS before LLM rendering"
~~~

### Task 4: Complete the deterministic magic deck through real PptxGenJS

**Files:**
- Modify: internal/cli/vibe_magic.go
- Modify: internal/cli/vibe_magic_test.go
- Modify: internal/cli/vibe_report_test.go

- [ ] **Step 1: Write failing deterministic render tests**

~~~go
func TestMagicVibeCompleteTextReturnsPptxgenjsCode(t *testing.T) {
    text, err := newMagicVibeLLMClient().CompleteText(context.Background(), nil)
    if err != nil {
        t.Fatal(err)
    }
    if !strings.Contains(text, "require(\"pptxgenjs\")") || !strings.Contains(text, "process.argv[3]") {
        t.Fatalf("unexpected code: %s", text)
    }
}
~~~

Add a bridge integration test that configures explicit runtime paths, runs the magic Vibe job, waits for task.completed, and opens the generated file with archive/zip to require [Content_Types].xml and ppt/presentation.xml.

- [ ] **Step 2: Verify RED**

~~~bash
env -u GOROOT go test ./internal/cli -run 'TestMagicVibe(CompleteText|.*PPTX)' -count=1
~~~

Expected: CompleteText is empty and no completed PPTX exists.

- [ ] **Step 3: Return a fixed executable PptxGenJS script**

~~~js
const fs = require("fs");
const PptxGenJS = require("pptxgenjs");

async function main() {
  const payload = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  for (const item of payload.slides || []) {
    const slide = pptx.addSlide();
    slide.addText(item.title || "Untitled", { x: 0.7, y: 0.6, w: 11.9, h: 0.6, fontSize: 28, bold: true });
    slide.addText(item.summary || "", { x: 0.8, y: 1.5, w: 11.5, h: 1.0, fontSize: 17 });
  }
  await pptx.writeFile({ fileName: process.argv[3] });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
~~~

- [ ] **Step 4: Verify GREEN, full suite, and commit**

~~~bash
env -u GOROOT go test ./internal/cli ./internal/runtime -count=1
env -u GOROOT go test ./... -count=1
git add internal/cli/vibe_magic.go internal/cli/vibe_magic_test.go internal/cli/vibe_report_test.go
git commit -m "test: complete the magic Vibe deck with PptxGenJS"
~~~

### Task 5: Release OfficeCLI 0.2.119

**Files:**
- Modify: packages/npm/officecli/package.json
- Modify: packages/npm/officecli/package-lock.json

- [ ] **Step 1: Prove old metadata fails, then bump and verify**

~~~bash
cd packages/npm/officecli
RELEASE_TAG=v0.2.119 npm run check:release-version
# Expected: FAIL with 0.2.118.
npm version 0.2.119 --no-git-tag-version
RELEASE_TAG=v0.2.119 npm run check:release-version
npm test
cd ../..
env -u GOROOT go test ./... -count=1
~~~

- [ ] **Step 2: Commit, push, tag, and trigger public release**

~~~bash
git add packages/npm/officecli/package.json packages/npm/officecli/package-lock.json
git commit -m "release: prepare OfficeCLI 0.2.119"
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
git push -u origin codex/pptxgenjs-runtime-0.2.119
git push origin HEAD:main
git tag -a v0.2.119 -m "OfficeCLI 0.2.119"
git push origin v0.2.119
gh workflow run "CLI Release" -R officecli/officecli-ci -f version=v0.2.119
~~~

- [ ] **Step 3: Watch and verify all public assets**

~~~bash
run_id=$(gh run list -R officecli/officecli-ci --workflow "CLI Release" --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch -R officecli/officecli-ci "$run_id" --exit-status
gh release view v0.2.119 -R officecli/officecli-dist --json tagName,assets,url
~~~

Expected: macOS, Windows, and Linux assets publish and report 0.2.119.

### Task 6: Stage pinned Node and PptxGenJS assets in OfficeDex

**Files:**
- Create: runtime/pptxgenjs/package.json
- Create: runtime/pptxgenjs/package-lock.json
- Create: scripts/stage-pptxgenjs-runtime.mjs
- Create: scripts/stage-pptxgenjs-runtime.test.mjs
- Modify: package.json

- [ ] **Step 1: Write failing pure-helper tests**

~~~js
test("finds the exact Node archive checksum", () => {
  assert.equal(findChecksum(shasums, "node-v24.18.0-darwin-arm64.tar.gz"), expected);
});

test("rejects an archive checksum mismatch", async () => {
  await assert.rejects(() => verifyFileChecksum(file, "0".repeat(64)), /SHA256 mismatch/);
});

test("creates pinned runtime metadata", () => {
  assert.equal(buildRuntimeManifest(input).nodeVersion, "24.18.0");
  assert.equal(buildRuntimeManifest(input).pptxgenjsVersion, "4.0.1");
});
~~~

- [ ] **Step 2: Verify RED**

~~~bash
node --test scripts/stage-pptxgenjs-runtime.test.mjs
~~~

- [ ] **Step 3: Add pinned npm metadata**

~~~json
{
  "name": "officedex-pptxgenjs-runtime",
  "private": true,
  "version": "1.0.0",
  "dependencies": {
    "pptxgenjs": "4.0.1"
  }
}
~~~

Generate package-lock.json using npm install --package-lock-only.

- [ ] **Step 4: Implement deterministic staging**

The script downloads SHASUMS256.txt and official Node 24.18.0 archives, verifies every archive, creates universal macOS bin/node with lipo or copies Windows node.exe, runs npm ci --omit=dev, copies Node and package license files, writes runtime.json atomically, and verifies node --version plus require("pptxgenjs").

- [ ] **Step 5: Verify GREEN and real macOS staging**

~~~bash
node --test scripts/stage-pptxgenjs-runtime.test.mjs
HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 \
  node scripts/stage-pptxgenjs-runtime.mjs
build/pptxgenjs-runtime/bin/node --version
lipo -archs build/pptxgenjs-runtime/bin/node
env PATH=/usr/bin:/bin NODE_PATH=build/pptxgenjs-runtime/node_modules \
  build/pptxgenjs-runtime/bin/node -e 'require("pptxgenjs"); console.log("pptxgenjs ok")'
~~~

Expected: v24.18.0, x86_64 arm64, and pptxgenjs ok.

- [ ] **Step 6: Commit staging**

~~~bash
git add runtime/pptxgenjs scripts/stage-pptxgenjs-runtime.mjs scripts/stage-pptxgenjs-runtime.test.mjs package.json package-lock.json
git diff --cached --check
git commit -m "build: stage a self-contained PptxGenJS runtime"
~~~

### Task 7: Inject, bundle, sign, license, and verify the runtime

**Files:**
- Create: pptxgenjs_runtime.go
- Create: pptxgenjs_runtime_test.go
- Create: scripts/bundle-pptxgenjs-runtime.mjs
- Create: scripts/bundle-pptxgenjs-runtime.test.mjs
- Create: scripts/verify-pptxgenjs-runtime.mjs
- Create: scripts/verify-pptxgenjs-runtime.test.mjs
- Modify: app.go
- Modify: scripts/codesign-bundled-officecli.mjs
- Modify: scripts/bundle-licenses.mjs
- Modify: package.json
- Modify: .github/workflows/release.yml

- [ ] **Step 1: Write failing Go runtime-path tests**

~~~go
func TestBundledPptxgenjsRuntimeEnvDarwin(t *testing.T) {
    env := findPptxgenjsRuntimeEnv("darwin", "/Applications/OfficeDex.app/Contents/MacOS/officedex", "", existsAll)
    assertEnv(t, env, "OFFICECLI_PPTXGENJS_NODE=/Applications/OfficeDex.app/Contents/Resources/pptxgenjs-runtime/bin/node")
}

func TestBundledPptxgenjsRuntimeEnvWindows(t *testing.T) {
    env := findPptxgenjsRuntimeEnv("windows", "C:/OfficeDex/officedex.exe", "", existsAll)
    assertEnv(t, env, "OFFICECLI_PPTXGENJS_NODE=C:/OfficeDex/pptxgenjs-runtime/bin/node.exe")
}
~~~

Also capture bridge.Options.Env in an app test and require both OFFICECLI_PPTXGENJS variables.

- [ ] **Step 2: Verify Go RED**

~~~bash
env -u GOROOT go test . -run 'Test(BundledPptxgenjsRuntimeEnv|EnsureBridgeIncludes)' -count=1
~~~

- [ ] **Step 3: Implement path derivation and bridge injection**

Packaged paths take priority; development uses cwd/build/pptxgenjs-runtime. Append both absolute paths to llmProviderEnv before bridge.New.

- [ ] **Step 4: Write failing bundle and verifier tests**

~~~js
test("copies the complete runtime into a macOS app", async () => {
  await bundleRuntime({ source, targetApp });
  await access(path.join(targetApp, "Contents/Resources/pptxgenjs-runtime/bin/node"));
});

test("rejects a package missing Node", async () => {
  await assert.rejects(() => verifyRuntime({ root }), /missing Node/);
});

test("rejects the wrong PptxGenJS version", async () => {
  await assert.rejects(() => verifyRuntime({ root }), /expected PptxGenJS 4.0.1/);
});
~~~

- [ ] **Step 5: Verify script RED and implement**

~~~bash
node --test scripts/bundle-pptxgenjs-runtime.test.mjs scripts/verify-pptxgenjs-runtime.test.mjs
~~~

Implement copying, restricted-PATH smoke PPTX generation, runtime.json checks, Node nested signing before OfficeCLI and outer app signing, and Node plus npm production license collection.

- [ ] **Step 6: Verify GREEN and commit**

~~~bash
env -u GOROOT go test . ./internal/bridge -count=1
node --test \
  scripts/stage-pptxgenjs-runtime.test.mjs \
  scripts/bundle-pptxgenjs-runtime.test.mjs \
  scripts/verify-pptxgenjs-runtime.test.mjs \
  scripts/bundle-licenses.test.mjs
git add app.go pptxgenjs_runtime.go pptxgenjs_runtime_test.go scripts package.json .github/workflows/release.yml
git diff --cached --check
git commit -m "build: bundle the PptxGenJS desktop runtime"
~~~

### Task 8: Require complete Canvas rendering in release gates

**Files:**
- Modify: e2e/canvas-runtime-contract-real.spec.ts
- Modify: scripts/run-real-e2e.mjs
- Create: scripts/verify-officecli-canvas-render.mjs
- Create: scripts/verify-officecli-canvas-render.test.mjs
- Modify: package.json
- Modify: .github/workflows/release.yml

- [ ] **Step 1: Change Playwright to wait for completion**

Remove the Cancel action. Wait up to 180 seconds for completed state, require no contract error, and require the host report to contain a non-empty PPTX artifact.

- [ ] **Step 2: Verify RED against OfficeCLI 0.2.118 or a missing staged runtime**

~~~bash
env OFFICECLI_VERSION=0.2.118 npm run prefetch:officecli
npm run test:e2e -- e2e/canvas-runtime-contract-real.spec.ts
~~~

Expected: FAIL with the original runtime error.

- [ ] **Step 3: Add a headless cross-platform JSON-RPC render verifier**

The verifier launches the exact OfficeCLI binary with a restricted child PATH and explicit runtime paths, initializes agent-bridge, invokes office.generate with PPTX, mode best, generation_mode plan and the magic prompt, answers confirmations, waits for task.completed, rejects task.failed, and validates PPTX ZIP entries.

- [ ] **Step 4: Verify GREEN locally**

~~~bash
npm run prefetch:officecli
npm run prefetch:pptxgenjs-runtime
npm run verify:pptxgenjs-runtime
npm run verify:officecli:canvas-render
npm run test:e2e -- e2e/canvas-runtime-contract-real.spec.ts
~~~

- [ ] **Step 5: Wire both release jobs and commit**

After prefetching both runtimes, run the runtime verifier, initialize contract, and complete-render contract on macOS and Windows.

~~~bash
git add e2e/canvas-runtime-contract-real.spec.ts scripts/run-real-e2e.mjs scripts/verify-officecli-canvas-render.mjs scripts/verify-officecli-canvas-render.test.mjs package.json .github/workflows/release.yml
git commit -m "test: require complete Canvas PPTX rendering"
~~~

### Task 9: Publish OfficeDex 0.6.2

**Files:**
- Modify: package.json
- Modify: package-lock.json
- Modify: wails.json

- [ ] **Step 1: Set OfficeDex 0.6.2 and OfficeCLI 0.2.119**

Update package.json, package-lock.json, and wails.json.

- [ ] **Step 2: Run the complete fresh matrix**

~~~bash
npm run lint
npm run test:scripts
npx vitest run
env -u GOROOT go test ./... -count=1
env -u GOROOT go test -tags officedex_demo ./... -count=1
npm run prefetch:officecli
npm run prefetch:pptxgenjs-runtime
npm run verify:pptxgenjs-runtime
npm run verify:officecli:canvas-render
npm run test:e2e -- e2e/canvas-runtime-contract-real.spec.ts
~~~

- [ ] **Step 3: Build and verify the local macOS package**

~~~bash
env -u GOROOT wails build -platform darwin/universal -ldflags "-X main.appVersion=0.6.2"
npm run bundle:licenses:mac
npm run bundle:pptxgenjs-runtime:mac
npm run bundle:officecli:mac
npm run verify:pptxgenjs-runtime -- --root build/bin/OfficeDex.app/Contents/Resources/pptxgenjs-runtime
lipo -archs build/bin/OfficeDex.app/Contents/MacOS/officedex
lipo -archs build/bin/OfficeDex.app/Contents/Resources/officecli/officecli
lipo -archs build/bin/OfficeDex.app/Contents/Resources/pptxgenjs-runtime/bin/node
codesign --verify --deep --strict --verbose=4 build/bin/OfficeDex.app
~~~

- [ ] **Step 4: Commit, push main, and tag**

~~~bash
git add package.json package-lock.json wails.json
git commit -m "release: prepare OfficeDex 0.6.2"
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
git push -u origin codex/pptxgenjs-runtime-0.6.2
git push origin HEAD:main
git tag -a v0.6.2 -m "OfficeDex 0.6.2"
git push origin v0.6.2
~~~

- [ ] **Step 5: Monitor and verify public artifacts**

Watch the Release workflow to completion. Download macOS and Windows ZIP files and verify their SHA-256 values against the GitHub assets and officedex-dist manifest; manifest version 0.6.2; OfficeCLI 0.2.119; runtime.json Node 24.18.0 and PptxGenJS 4.0.1; universal macOS OfficeDex, OfficeCLI and Node binaries; signing and notarization; and a restricted-PATH smoke PPTX from the extracted packaged runtime.
