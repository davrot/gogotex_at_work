// Minimal stub for @overleaf/eslint-plugin used in monorepo
function noopRule() {
  return {
    meta: { type: 'suggestion', docs: { description: 'noop rule' } },
    create: () => ({}),
  }
}

module.exports = {
  rules: {
    'prefer-kebab-url': noopRule(),
    'require-vi-doMock-valid-path': noopRule(),
    'require-script-runner': noopRule(),
    'no-generated-editor-themes': noopRule(),
    'no-unnecessary-trans': noopRule(),
    'should-unescape-trans': noopRule(),
    'require-loading-label': noopRule(),
  },
};
