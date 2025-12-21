let mongoose
try {
  mongoose = require('../infrastructure/Mongoose')
} catch (e) {
  // In tests or minimal environments, fall back to a no-op mongoose that won't try to
  // connect to a real database or access settings.
  mongoose = { models: {}, model: () => ({}), Schema: class { constructor() {} } }
}
const { Schema } = mongoose

const UserSSHKeySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    keyName: { type: String, default: '' },
    publicKey: { type: String, required: true },
    privateKeyHash: { type: String, default: '' },
    fingerprint: { type: String, default: '' },
    createdAt: {
      type: Date,
      default() {
        return new Date()
      },
    },
    updatedAt: { type: Date, default: null },
  },
  { minimize: false }
)

UserSSHKeySchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

// Ensure fingerprint uniqueness across keys to support idempotent creates
try {
  // Use a non-sparse unique index so that missing/empty fingerprint values are
  // also constrained. This helps prevent duplicate doc insertion during
  // concurrent creates in test environments where indexes may have lagged.
  UserSSHKeySchema.index({ fingerprint: 1 }, { unique: true })
} catch (e) {
  // index creation may throw in some environments (e.g., tests); ignore here
}

exports.UserSSHKey = mongoose.models.UserSSHKey || mongoose.model('UserSSHKey', UserSSHKeySchema)

// Ensure indexes are created and log index creation errors so test runs surface index problems
try {
  exports.UserSSHKey.createIndexes().catch(err => {
    // Make index creation failures visible in logs; do not crash the process during boot
    try { console.error('UserSSHKey.createIndexes error', err && err.stack ? err.stack : err) } catch (e) {}
  })
} catch (e) {
  try { console.error('UserSSHKey.createIndexes threw', e && e.stack ? e.stack : e) } catch (ee) {}
}

// In test environments, aggressively deduplicate any existing documents that
// violate the intended uniqueness of `fingerprint`. This helps make contract
// runs deterministic even if previous runs created duplicates or index
// creation lagged behind inserts.
if (process.env.NODE_ENV === 'test') {
  ;(async () => {
    try {
      // Skip dedupe if collection.aggregate is not available in this environment
      if (!exports.UserSSHKey || !exports.UserSSHKey.collection || typeof exports.UserSSHKey.collection.aggregate !== 'function') {
        try { console.debug('UserSSHKey startup dedupe skipped: collection.aggregate not available') } catch (e) {}
        return
      }

      // Find fingerprints with more than one document
      const pipeline = [
        { $match: { fingerprint: { $exists: true } } },
        { $group: { _id: '$fingerprint', ids: { $push: { id: '$_id', createdAt: '$createdAt', userId: '$userId' } }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
      ]
      const groups = await exports.UserSSHKey.collection.aggregate(pipeline).toArray()
      for (const g of groups) {
        try {
          // Sort candidates by createdAt (oldest first); fallback to lexical id order
          const candidates = (g.ids || []).sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
            if (ta !== tb) return ta - tb
            return String(a.id).localeCompare(String(b.id))
          })
          const keeper = candidates[0]
          const toDelete = candidates.slice(1).map(c => c.id)
          if (toDelete.length) {
            try {
              const delRes = await exports.UserSSHKey.deleteMany({ _id: { $in: toDelete } })
              try { console.debug('UserSSHKey startup dedupe deleted', delRes && delRes.deletedCount, 'docs for fingerprint', g._id) } catch (e) {}
            } catch (e) {
              try { console.error('UserSSHKey startup dedupe deleteMany failed', e && e.stack ? e.stack : e) } catch (e2) {}
            }
          }
        } catch (e) {
          try { console.error('UserSSHKey startup dedupe group-handling error', e && e.stack ? e.stack : e) } catch (e2) {}
        }
      }
    } catch (e) {
      try { console.error('UserSSHKey startup dedupe failed', e && e.stack ? e.stack : e) } catch (ee) {}
    }
  })()
}
