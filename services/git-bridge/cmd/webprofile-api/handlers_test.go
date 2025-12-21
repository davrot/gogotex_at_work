package main

import "testing"

func TestComputeFingerprint(t *testing.T) {
	pk := "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCtest"
	fp := computeFingerprint(pk)
	if len(fp) == 0 {
		t.Fatal("empty fingerprint")
	}
	if fp[:6] != "SHA256" {
		t.Fatalf("unexpected prefix: %s", fp)
	}
}
