import Settings from '@overleaf/settings'
import validateConfig from '../../app/src/config/validateConfig.mjs'
import assertHashAvailability from '../../app/src/config/hashAvailability.mjs'

// This module is intentionally loaded early during service startup to validate
// the runtime configuration and to assert that any required native modules (e.g. argon2)
// are present when configured. If a check fails we throw so the service fails to start.

try {
  // Only validate when configured to use the local token manager or when any of
  // the token hashing environment variables are present. This avoids causing
  // unrelated services/tests to fail when the feature is not enabled.
  const shouldValidate = (process.env.FEATURE_GIT_AUTH_LOCAL_TOKEN_MANAGER === 'true') ||
    Boolean(process.env.AUTH_TOKEN_HASH_ALGO || process.env.AUTH_TOKEN_ARGON2_TIME || process.env.AUTH_TOKEN_ARGON2_MEMORY_KB || process.env.AUTH_TOKEN_ARGON2_PARALLELISM || process.env.AUTH_TOKEN_BCRYPT_COST)
  if (shouldValidate) {
    // validate structural presence and basic bounds for required configuration keys
    // Use process.env so we validate the actual runtime environment variables
    validateConfig(process.env)

    // ensure that requested hash algorithm is available at runtime. This will throw
    // if no suitable algorithm/module is available and configuration does not allow fallback.
    assertHashAvailability(process.env)
  }
} catch (err) {
  // Print a clear error and rethrow so service startup aborts.
  // We also keep the error so that test harnesses can assert on thrown errors.
  console.error('Startup configuration validation failed:', err.message)
  throw err
}

export default {}
