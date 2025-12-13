const { merge } = require('webpack-merge')

const base = require('./webpack.config.dev')

module.exports = merge(base, {
  devServer: {
    // Allow access from the dev container/network (accept connections on all interfaces)
    host: '0.0.0.0',
    // Allow requests from any host (necessary for requests coming from dev containers)
    allowedHosts: 'all',
    devMiddleware: {
      index: false,
    },
    proxy: [
      {
        context: '/socket.io/**',
        target: 'http://real-time:3026',
        ws: true,
      },
      {
        context: ['!**/*.js', '!**/*.css', '!**/*.json'],
        target: 'http://web:3000',
      },
    ],
  },
})
