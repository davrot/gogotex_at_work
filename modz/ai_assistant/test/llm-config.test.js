const { config } = require('./loadConfig')

const cfg = config()

if (!cfg.runIntegration) {
  console.log('LLM integration tests are disabled. Set RUN_LLM_TESTS=true or set "runIntegration": true in test/config.local.json to enable. Skipping.');
  process.exit(0)
}

// When runIntegration is true, assert API details are present
if (!cfg.LLM_API_URL) {
  console.error('LLM_API_URL is not set. Please set it via environment or test/config.local.json')
  process.exit(2)
}
if (!cfg.LLM_API_KEY) {
  console.error('LLM_API_KEY is not set. Please set it via environment or test/config.local.json')
  process.exit(2)
}

console.log('LLM config present; you can run live integration tests.')
process.exit(0)
