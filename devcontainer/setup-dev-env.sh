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

# Install Go toolchain, linters, benchtools and utilities
echo "Installing Go 1.25 and tooling..."
sudo apt-get update -y
sudo apt-get install -y jq curl unzip build-essential ca-certificates

# Install Go 1.25
GO_VERSION=1.25.0
if [ ! -x /usr/local/go/bin/go ] || [ "$(/usr/local/go/bin/go version 2>/dev/null | awk '{print $3}')" != "go$GO_VERSION" ]; then
  echo "Installing Go $GO_VERSION..."
  curl -fsSL https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz -o /tmp/go.tgz
  sudo rm -rf /usr/local/go
  sudo tar -C /usr/local -xzf /tmp/go.tgz
fi
export PATH="/usr/local/go/bin:$PATH"
mkdir -p "$HOME/go"
# Persist GOPATH and PATH for future shells
if ! grep -q "export GOPATH=\$HOME/go" ~/.bashrc 2>/dev/null; then
  echo 'export GOPATH=$HOME/go' >> ~/.bashrc
fi
if ! grep -q "/usr/local/go/bin" ~/.bashrc 2>/dev/null; then
  echo 'export PATH=$GOPATH/bin:/usr/local/go/bin:$PATH' >> ~/.bashrc
fi

# Install golangci-lint
curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sudo sh -s -- -b /usr/local/bin || true

# Install benchstat
export PATH="/usr/local/go/bin:$GOPATH/bin:$PATH"
$(/usr/local/go/bin/go install golang.org/x/perf/cmd/benchstat@latest) || true

# Install act (optional) for local Actions runs
curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash || true

# Ensure tools are on PATH for this session
export PATH="$HOME/go/bin:/usr/local/go/bin:$PATH"



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

