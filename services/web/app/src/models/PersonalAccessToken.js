const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

const PersonalAccessTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    label: { type: String, default: '' },
    hash: { type: String, required: true },
    hashPrefix: { type: String, required: true },
    algorithm: { type: String, default: 'argon2id' },
    scopes: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    createdAt: {
      type: Date,
      default() {
        return new Date()
      },
    },
    updatedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
  },
  { minimize: false }
)

PersonalAccessTokenSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

exports.PersonalAccessToken = mongoose.models.PersonalAccessToken || mongoose.model('PersonalAccessToken', PersonalAccessTokenSchema)
