//go:build officedex_demo

package demoflow

import (
	_ "embed"
	"os"
)

//go:embed testdata/launch-strategy-demo.officecli.pptx
var officecliGeneratedDemoPptx []byte

func writePptx(path string) error {
	return os.WriteFile(path, officecliGeneratedDemoPptx, 0o644)
}
