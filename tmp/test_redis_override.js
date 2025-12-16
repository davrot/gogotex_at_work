process.env.NODE_ENV = 'test'
const S = require('@overleaf/settings')
console.log('Settings.redis.web.host before=', S.redis.web.host)
const R = require('@overleaf/redis-wrapper')
const c = R.createClient(S.redis.web)
console.log('client.options.host after createClient=', c.options && c.options.host)
console.log('creationStack:', c._creationStack)
setTimeout(()=>{ try { c.disconnect().catch(()=>{}) } catch (e) {} }, 2000)
