package main

import "testing"

func TestWailsAppOptionsEnableFileDrop(t *testing.T) {
	opts := newWailsAppOptions(nil)
	if opts.DragAndDrop == nil {
		t.Fatal("DragAndDrop options are nil")
	}
	if !opts.DragAndDrop.EnableFileDrop {
		t.Fatal("EnableFileDrop is false")
	}
	if !opts.DragAndDrop.DisableWebViewDrop {
		t.Fatal("DisableWebViewDrop is false")
	}
}
