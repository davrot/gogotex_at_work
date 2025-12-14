const mongoose = require('../infrastructure/Mongoose')
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
  UserSSHKeySchema.index({ fingerprint: 1 }, { unique: true, sparse: true })
} catch (e) {
  // index creation may throw in some environments (e.g., tests); ignore here
}

exports.UserSSHKey = mongoose.models.UserSSHKey || mongoose.model('UserSSHKey', UserSSHKeySchema)
