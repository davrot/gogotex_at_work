export function resetMeta() {
  window.metaAttributesCache = new Map()
  window.metaAttributesCache.set('ol-i18n', { currentLangCode: 'en' })
  window.metaAttributesCache.set('ol-capabilities', [
    'chat',
    'dropbox',
    'link-sharing',
  ])
  // Common keys used by many modules; set safe defaults for tests
  window.metaAttributesCache.set('ol-csrfToken', 'test-csrf')
  window.metaAttributesCache.set('ol-baseAssetPath', '/')
  window.metaAttributesCache.set('ol-project_id', null)
  window.metaAttributesCache.set('ol-user_id', null)
  window.metaAttributesCache.set('ol-user', {})
  window.metaAttributesCache.set('ol-footer', { translatedLanguages: [], subdomainLang: undefined })
  window.metaAttributesCache.set('ol-splitTestVariants', {})
  window.metaAttributesCache.set('ol-shouldLoadHotjar', false)

  window.metaAttributesCache.set('ol-ExposedSettings', {
    appName: 'Overleaf',
    maxEntitiesPerProject: 10,
    maxUploadSize: 5 * 1024 * 1024,
    siteUrl: 'https://www.dev-overleaf.com',
    hasLinkUrlFeature: true,
    hasLinkedProjectFileFeature: true,
    hasLinkedProjectOutputFileFeature: true,
    recaptchaDisabled: {},
    enableSubscriptions: false,
    validRootDocExtensions: ['tex', 'latex'],
    editableFilenames: ['latexmkrc', '.latexmkrc', 'makefile', 'gnumakefile'],
  })
}
