package main

import (
	"os"
	"path/filepath"
	goRuntime "runtime"
	"strings"
)

const (
	pptxgenjsNodeEnv        = "OFFICECLI_PPTXGENJS_NODE"
	pptxgenjsNodeModulesEnv = "OFFICECLI_PPTXGENJS_NODE_MODULES"
)

func bundledPptxgenjsRuntimeEnv() []string {
	executable, _ := os.Executable()
	cwd, _ := os.Getwd()
	return findPptxgenjsRuntimeEnv(goRuntime.GOOS, executable, cwd, pathExists)
}

func findPptxgenjsRuntimeEnv(goos, executable, cwd string, exists func(string) bool) []string {
	if exists == nil {
		exists = pathExists
	}
	if root, packaged := packagedPptxgenjsRuntimeRoot(goos, executable); packaged {
		return runtimeEnvForRoot(goos, root)
	}

	if strings.TrimSpace(cwd) == "" {
		return nil
	}
	root := filepath.Join(cwd, "build", "pptxgenjs-runtime")
	env := runtimeEnvForRoot(goos, root)
	nodePath := strings.TrimPrefix(env[0], pptxgenjsNodeEnv+"=")
	moduleRoot := strings.TrimPrefix(env[1], pptxgenjsNodeModulesEnv+"=")
	if !exists(nodePath) || !exists(filepath.Join(moduleRoot, "pptxgenjs")) {
		return nil
	}
	return env
}

func packagedPptxgenjsRuntimeRoot(goos, executable string) (string, bool) {
	executable = filepath.Clean(strings.TrimSpace(executable))
	if executable == "." || executable == "" {
		return "", false
	}
	switch goos {
	case "darwin":
		macOSDir := filepath.Dir(executable)
		contentsDir := filepath.Dir(macOSDir)
		if strings.EqualFold(filepath.Base(executable), "officedex") &&
			filepath.Base(macOSDir) == "MacOS" && filepath.Base(contentsDir) == "Contents" {
			return filepath.Join(contentsDir, "Resources", "pptxgenjs-runtime"), true
		}
	case "windows":
		if strings.EqualFold(filepath.Base(executable), "officedex.exe") {
			return filepath.Join(filepath.Dir(executable), "pptxgenjs-runtime"), true
		}
	}
	return "", false
}

func runtimeEnvForRoot(goos, root string) []string {
	nodeName := "node"
	if goos == "windows" {
		nodeName = "node.exe"
	}
	return []string{
		pptxgenjsNodeEnv + "=" + filepath.Join(root, "bin", nodeName),
		pptxgenjsNodeModulesEnv + "=" + filepath.Join(root, "node_modules"),
	}
}

func appendPptxgenjsRuntimeEnv(base, runtimeEnv []string) []string {
	if len(runtimeEnv) == 0 {
		return append([]string(nil), base...)
	}
	result := make([]string, 0, len(base)+len(runtimeEnv))
	for _, entry := range base {
		if strings.HasPrefix(entry, pptxgenjsNodeEnv+"=") || strings.HasPrefix(entry, pptxgenjsNodeModulesEnv+"=") {
			continue
		}
		result = append(result, entry)
	}
	return append(result, runtimeEnv...)
}

func pathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
