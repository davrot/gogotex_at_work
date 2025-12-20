# Git-bridge benchmark harness (Phase 0)

This is a minimal benchmark harness for the Go `git-bridge` binary. It runs Go benchmarks and saves output to `out.txt`.

Usage:

  cd ci/benchmarks/git-bridge-benchmark
  ./run.sh

The script will run `go test -bench` in `services/git-bridge` and write `out.txt` in this folder.
