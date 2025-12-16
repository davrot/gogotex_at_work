process.env.NODE_ENV = 'test'
const R = require('@overleaf/redis-wrapper')
const c = R.createClient()
console.log('created host=', (c && c.options && c.options.host) || c)
console.log('has creationStack=', !!(c && c._creationStack))
setTimeout(() => { try { if (c && typeof c.disconnect === 'function') c.disconnect().catch(()=>{}); } catch (e) {} }, 2000)
