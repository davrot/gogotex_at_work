// Lightweight bootstrap for focused frontend tests
const path = require('path')

require('@babel/register')({
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
  presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
  plugins: [['module-resolver', { alias: { '^@/(.+)': path.resolve(__dirname, '../..', 'frontend/js') + '/\\1' } }]],
})

// Minimal JSDOM setup
require('jsdom-global')(undefined, {
  pretendToBeVisual: true,
  url: 'https://www.test-overleaf.com/',
})

// Basic globals
const fetch = require('node-fetch')
globalThis.fetch = global.fetch = window.fetch = (url, ...options) => fetch(new URL(url, 'http://127.0.0.1'), ...options)

// simple navigator.clipboard polyfill if missing
if (!navigator.clipboard) {
  navigator.clipboard = { writeText: async (s) => { globalThis._lastClipboard = s } }
}

// ignore styles and static assets
const { addHook } = require('pirates')
addHook(() => '', { exts: ['.css', '.scss', '.svg', '.png', '.gif', '.mp4'], ignoreNodeModules: false })

// minimal fake indexeddb
require('fake-indexeddb/auto')

// fetch-mock spy
const fetchMock = require('fetch-mock').default
// Prevent accidental recursion by ensuring config.fetch points to the native fetch
const _nativeFetch = global.fetch || (typeof fetch !== 'undefined' ? fetch : undefined)
if (_nativeFetch) fetchMock.config.fetch = _nativeFetch
fetchMock.spyGlobal()
fetchMock.config.Response = fetch.Response

// simple no-op for HTMLElement.scrollIntoView
globalThis.HTMLElement.prototype.scrollIntoView = () => {}

// make some globals available used by tests
globalThis.DOMParser = window.DOMParser

// expose chai utilities if needed by tests
const chai = require('chai')
chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))

