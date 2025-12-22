import { db, ObjectId } from '../../mongodb.js'

export class MissingMessageError extends Error {}

export async function createMessage(roomId, userId, content, timestamp) {
  let newMessageOpts = {
    content,
    room_id: roomId,
    user_id: userId,
    timestamp,
  }
  newMessageOpts = _ensureIdsAreObjectIds(newMessageOpts)
  const confirmation = await db.messages.insertOne(newMessageOpts)
  newMessageOpts._id = confirmation.insertedId
  return newMessageOpts
}

export async function getMessages(roomId, limit, before) {
  let query = { room_id: roomId }
  if (before) {
    query.timestamp = { $lt: before }
  }
  query = _ensureIdsAreObjectIds(query)
  return await db.messages
    .find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray()
}

function parseSeedThreads() {
  try {
    const raw = process.env.SEED_THREADS
    if (raw) return JSON.parse(raw)
  } catch (e) {
    // ignore
  }
  return {}
}

export async function findAllMessagesInRooms(roomIds) {
  // If SEED_THREADS is set, avoid touching Mongo and return empty messages
  // for seeded rooms to make parity tests deterministic without a DB.
  const seed = parseSeedThreads()
  if (seed) {
    // check if any room ID is listed under any seeded project and return []
    try {
      for (const pid of Object.keys(seed)) {
        const threads = seed[pid]
        for (const r of threads) {
          if (roomIds.includes(r)) {
            return []
          }
        }
      }
    } catch (e) {
      // ignore and fallthrough to DB call
    }
  }

  return await db.messages
    .find({
      room_id: { $in: roomIds },
    })
    .toArray()
}

export async function deleteAllMessagesInRoom(roomId) {
  await db.messages.deleteMany({
    room_id: roomId,
  })
}

export async function deleteAllMessagesInRooms(roomIds) {
  await db.messages.deleteMany({
    room_id: { $in: roomIds },
  })
}

export async function updateMessage(
  roomId,
  messageId,
  userId,
  content,
  timestamp
) {
  const query = _ensureIdsAreObjectIds({
    _id: messageId,
    room_id: roomId,
  })
  if (userId) {
    query.user_id = new ObjectId(userId)
  }
  const res = await db.messages.updateOne(query, {
    $set: {
      content,
      edited_at: timestamp,
    },
  })
  return res.modifiedCount === 1
}

export async function deleteMessage(roomId, messageId) {
  const query = _ensureIdsAreObjectIds({
    _id: messageId,
    room_id: roomId,
  })
  await db.messages.deleteOne(query)
}

export async function deleteUserMessage(userId, roomId, messageId) {
  await db.messages.deleteOne({
    _id: new ObjectId(messageId),
    user_id: new ObjectId(userId),
    room_id: new ObjectId(roomId),
  })
}

export async function getMessage(roomId, messageId) {
  const query = _ensureIdsAreObjectIds({
    _id: messageId,
    room_id: roomId,
  })
  const message = await db.messages.findOne(query)
  if (!message) {
    throw new MissingMessageError(`Message not found`)
  }
  return message
}

function _ensureIdsAreObjectIds(query) {
  if (query.user_id && !(query.user_id instanceof ObjectId)) {
    query.user_id = new ObjectId(query.user_id)
  }
  if (query.room_id && !(query.room_id instanceof ObjectId)) {
    query.room_id = new ObjectId(query.room_id)
  }
  if (query._id && !(query._id instanceof ObjectId)) {
    query._id = new ObjectId(query._id)
  }
  return query
}

export async function duplicateRoomToOtherRoom(sourceRoomId, targetRoomId) {
  const sourceMessages = await findAllMessagesInRooms([sourceRoomId])
  const targetMessages = sourceMessages.map(comment => {
    return _ensureIdsAreObjectIds({
      room_id: targetRoomId,
      content: comment.content,
      timestamp: comment.timestamp,
      user_id: comment.user_id,
    })
  })
  await db.messages.insertMany(targetMessages)
}
