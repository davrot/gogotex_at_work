const fs = require('fs')
const path = require('path')

function loadLocalConfig() {
  const localPath = path.join(__dirname, 'config.local.json')
  if (fs.existsSync(localPath)) {
    try {
      return JSON.parse(fs.readFileSync(localPath, 'utf8'))
    } catch (err) {
      throw new Error(`Failed parsing ${localPath}: ${err.message}`)
    }
  }
  return null
}

function loadExampleConfig() {
  const examplePath = path.join(__dirname, 'config.example.json')
  if (fs.existsSync(examplePath)) {
    try {
      return JSON.parse(fs.readFileSync(examplePath, 'utf8'))
    } catch (err) {
      throw new Error(`Failed parsing ${examplePath}: ${err.message}`)
    }
  }
  return {}
}

function config() {
  // Priority: explicit env vars (for CI), then local config, then example config
  const env = {
    LLM_API_URL: process.env.LLM_API_URL,
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_MODEL_NAME: process.env.LLM_MODEL_NAME,
    RUN_INTEGRATION: process.env.RUN_LLM_TESTS,
  }

  const local = loadLocalConfig() || {}
  const example = loadExampleConfig() || {}

  return {
    runIntegration: env.RUN_INTEGRATION === 'true' || local.runIntegration === true || example.runIntegration === true,
    LLM_API_URL: env.LLM_API_URL || local.LLM_API_URL || example.LLM_API_URL,
    LLM_API_KEY: env.LLM_API_KEY || local.LLM_API_KEY || example.LLM_API_KEY,
    LLM_MODEL_NAME: env.LLM_MODEL_NAME || local.LLM_MODEL_NAME || example.LLM_MODEL_NAME,
  }
}

module.exports = { config }
