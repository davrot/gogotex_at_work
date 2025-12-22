#!/bin/bash
set -e

# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js 24
nvm install 24

# Install Java and Maven
sudo apt-get update -y
sudo apt-get install -y openjdk-17-jdk maven mc lynx

# Add nvm to bashrc
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.bashrc

# Install GitHub CLI (gh) if missing
if ! command -v gh >/dev/null 2>&1; then
  echo "Installing GitHub CLI..."
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates gnupg
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg >/dev/null 2>&1
  sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y gh
else
  echo "GitHub CLI (gh) already installed"
fi

# Populate helpful .bash_history entries for vscode and root so developers can see common setup/test commands
HIST_ADD=$(cat <<'HIST'
# Overleaf dev container - essential commands and notes
# Install Node and tools:
nvm install 24
# Build services:
./bin/build
# Start local docker services:
docker compose up -d
# Run single integration tests:
npx mocha --timeout 60000 --require test/acceptance/bootstrap.js test/integration/src/TokenRevocationImmediacyTests.mjs --exit
# Run full test suite:
npm test
# Redis probe (useful when debugging pubsub):
redis-cli -h redis ping
# GitHub CLI (interactive):
gh auth login
gh repo clone <org>/<repo>
# Useful logs:
docker compose logs -f web
HIST
)
# Append to vscode history
echo "$HIST_ADD" >> /home/vscode/.bash_history || true
# Append to root history (requires sudo)
echo "$HIST_ADD" | sudo tee -a /root/.bash_history >/dev/null || true
# Fix ownership for vscode history
sudo chown vscode:vscode /home/vscode/.bash_history || true

echo ". Development environment setup complete!"

