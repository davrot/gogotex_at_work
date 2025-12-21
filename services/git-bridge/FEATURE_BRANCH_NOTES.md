Feature branch: feature/001-ssh-git-auth

Scaffold files added:
- `SSHAuthManager.java` (auth scaffold)
- `V0ReplacementAdapter.java` (snapshot adapter scaffold)

Next steps:
- Implement SSH key CRUD and validation using web-profile contract
- Replace V0 snapshot usages with adapter calls to filestore/project-history
- Add tests and integration wiring
