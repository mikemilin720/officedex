package main

import (
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestBundledPptxgenjsRuntimeEnvDarwin(t *testing.T) {
	env := findPptxgenjsRuntimeEnv(
		"darwin",
		"/Applications/OfficeDex.app/Contents/MacOS/officedex",
		"",
		func(string) bool { return true },
	)
	assertRuntimeEnv(t, env,
		"OFFICECLI_PPTXGENJS_NODE=/Applications/OfficeDex.app/Contents/Resources/pptxgenjs-runtime/bin/node",
		"OFFICECLI_PPTXGENJS_NODE_MODULES=/Applications/OfficeDex.app/Contents/Resources/pptxgenjs-runtime/node_modules",
	)
}

func TestBundledPptxgenjsRuntimeEnvWindows(t *testing.T) {
	env := findPptxgenjsRuntimeEnv(
		"windows",
		filepath.FromSlash("C:/OfficeDex/officedex.exe"),
		"",
		func(string) bool { return true },
	)
	assertRuntimeEnv(t, env,
		"OFFICECLI_PPTXGENJS_NODE="+filepath.FromSlash("C:/OfficeDex/pptxgenjs-runtime/bin/node.exe"),
		"OFFICECLI_PPTXGENJS_NODE_MODULES="+filepath.FromSlash("C:/OfficeDex/pptxgenjs-runtime/node_modules"),
	)
}

func TestBundledPptxgenjsRuntimeEnvDevelopmentBuild(t *testing.T) {
	cwd := filepath.Join(t.TempDir(), "repo")
	runtimeRoot := filepath.Join(cwd, "build", "pptxgenjs-runtime")
	existing := map[string]bool{
		filepath.Join(runtimeRoot, "bin", "node"):               true,
		filepath.Join(runtimeRoot, "node_modules", "pptxgenjs"): true,
	}
	env := findPptxgenjsRuntimeEnv("darwin", filepath.Join(t.TempDir(), "officedex.test"), cwd, func(path string) bool {
		return existing[path]
	})
	assertRuntimeEnv(t, env,
		"OFFICECLI_PPTXGENJS_NODE="+filepath.Join(runtimeRoot, "bin", "node"),
		"OFFICECLI_PPTXGENJS_NODE_MODULES="+filepath.Join(runtimeRoot, "node_modules"),
	)
}

func TestBundledPptxgenjsRuntimeEnvMissingDevelopmentRuntime(t *testing.T) {
	env := findPptxgenjsRuntimeEnv("darwin", filepath.Join(t.TempDir(), "officedex.test"), t.TempDir(), func(string) bool { return false })
	if len(env) != 0 {
		t.Fatalf("env = %#v, want no development runtime injection", env)
	}
}

func TestAppendPptxgenjsRuntimeEnvReplacesStaleValues(t *testing.T) {
	base := []string{
		"MODEL=test",
		"OFFICECLI_PPTXGENJS_NODE=/stale/node",
		"OFFICECLI_PPTXGENJS_NODE_MODULES=/stale/modules",
	}
	want := []string{
		"MODEL=test",
		"OFFICECLI_PPTXGENJS_NODE=/bundled/node",
		"OFFICECLI_PPTXGENJS_NODE_MODULES=/bundled/modules",
	}
	got := appendPptxgenjsRuntimeEnv(base, []string{
		"OFFICECLI_PPTXGENJS_NODE=/bundled/node",
		"OFFICECLI_PPTXGENJS_NODE_MODULES=/bundled/modules",
	})
	if !slices.Equal(got, want) {
		t.Fatalf("env = %#v, want %#v", got, want)
	}
}

func assertRuntimeEnv(t *testing.T, env []string, expected ...string) {
	t.Helper()
	normalizedEnv := normalizeRuntimeEnvForTest(env)
	normalizedExpected := normalizeRuntimeEnvForTest(expected)
	if !slices.Equal(normalizedEnv, normalizedExpected) {
		t.Fatalf("env = %#v, want %#v", env, expected)
	}
}

func normalizeRuntimeEnvForTest(env []string) []string {
	normalized := make([]string, len(env))
	for i, entry := range env {
		normalized[i] = strings.ReplaceAll(entry, `\`, "/")
	}
	return normalized
}
