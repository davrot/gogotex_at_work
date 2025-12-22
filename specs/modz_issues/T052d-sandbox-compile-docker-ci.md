Title: T052d-followup — Add sandbox-compile Docker smoke CI job

Description:
Add an optional CI job that runs the sandbox-compile Docker smoke tests in a runner that supports Docker. This will validate the compile image and a sample compile job.

Acceptance criteria:

- Add a GitHub Actions workflow/job using `ubuntu-latest` with `docker` enabled (or use a self-hosted runner) to build the compile image and run the `test:sandbox-compile` target.
- Gate the job behind `RUN_DOCKER_SMOKE=true` to avoid requiring docker by default on PRs.
- Document the steps and required secrets/permissions in `specs/modz_followups.md`.

Owner: TBD
Estimate: 1-2 days
Blocking: CI runner with Docker privileges (self-hosted runner or GitHub-hosted runner with privileged mode via runner groups).

Suggested labels: T052, P1, CI
