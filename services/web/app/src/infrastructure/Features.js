const _ = require('lodash')

function getSettings() {
  const SettingsModule = require('@overleaf/settings')
  return SettingsModule && (SettingsModule.default || SettingsModule)
}

function moduleAvailable(name) {
  const Settings = getSettings()
  return Boolean(Settings && Array.isArray(Settings.moduleImportSequence) && Settings.moduleImportSequence.includes(name))
}

/**
 * @typedef {Object} Settings
 * @property {Object | undefined}  apis
 * @property {Object | undefined}  apis.linkedUrlProxy
 * @property {string | undefined}  apis.linkedUrlProxy.url
 * @property {boolean | undefined} enableGithubSync
 * @property {boolean | undefined} enableGitBridge
 * @property {boolean | undefined} enableHomepage
 * @property {boolean | undefined} enableSaml
 * @property {boolean | undefined} ldap
 * @property {boolean | undefined} oauth
 * @property {Object | undefined} overleaf
 * @property {Object | undefined} overleaf.oauth
 * @property {boolean | undefined} saml
 */

const Features = {
  /**
   * @returns {boolean}
   */
  externalAuthenticationSystemUsed() {
    const Settings = getSettings()
    return (
      (Boolean(Settings && Settings.ldap) && Boolean(Settings.ldap.enable)) ||
      (Boolean(Settings && Settings.saml) && Boolean(Settings.saml.enable)) ||
      Boolean(Settings && Settings.overleaf)
    )
  },

  /**
   * Whether a feature is enabled in the appliation's configuration
   *
   * @param {string} feature
   * @returns {boolean}
   */
  hasFeature(feature) {
    const Settings = getSettings()
    switch (feature) {
      case 'saas':
        // Allow an explicit env override to force saas mode in test or CI environments
        return Boolean(Settings && Settings.overleaf) || process.env.OVERLEAF_APP === 'saas'
      case 'homepage':
        return Boolean(Settings && Settings.enableHomepage)
      case 'registration-page':
        return (
          !Features.externalAuthenticationSystemUsed() ||
          Boolean(Settings && Settings.overleaf)
        )
      case 'registration':
        return Boolean(Settings && Settings.overleaf)
      case 'chat':
        return Boolean(Settings && Settings.disableChat) === false
      case 'link-sharing':
        return Boolean(Settings && Settings.disableLinkSharing) === false
      case 'github-sync':
        return Boolean(Settings && Settings.enableGithubSync)
      case 'git-bridge':
        return Boolean(Settings && Settings.enableGitBridge)
      case 'oauth':
        return Boolean(Settings && Settings.oauth)
      case 'templates-server-pro':
        return Boolean(Settings && Settings.templates && Settings.templates.user_id)
      case 'affiliations':
      case 'analytics':
        return Boolean(_.get(Settings, ['apis', 'v1', 'url']))
      case 'references':
        return Boolean(_.get(Settings, ['apis', 'references', 'url']))
      case 'saml':
        return Boolean(Settings && Settings.enableSaml)
      case 'linked-project-file':
        return Boolean(Settings && Settings.enabledLinkedFileTypes && Settings.enabledLinkedFileTypes.includes('project_file'))
      case 'linked-project-output-file':
        return Boolean(
          Settings && Settings.enabledLinkedFileTypes && Settings.enabledLinkedFileTypes.includes('project_output_file')
        )
      case 'link-url':
        return Boolean(
          _.get(Settings, ['apis', 'linkedUrlProxy', 'url']) &&
            Settings && Settings.enabledLinkedFileTypes && Settings.enabledLinkedFileTypes.includes('url')
        )
      case 'support':
        return moduleAvailable('support')
      case 'symbol-palette':
        return moduleAvailable('symbol-palette')
      case 'track-changes':
        return moduleAvailable('track-changes')
      default:
        throw new Error(`unknown feature: ${feature}`)
    }
  },
}

module.exports = Features
