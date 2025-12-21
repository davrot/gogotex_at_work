/* eslint-disable no-undef */

// Idempotent replica set initializer. If a replica set is already configured
// calling rs.initiate again throws an error. This wrapper checks for a
// configured replica set and only calls rs.initiate when necessary.
try {
	// If rs.status succeeds, replication is already configured (or in the
	// process of being configured). We do nothing and exit quietly.
	rs.status()
	// If we've got this far, the replset exists.
	printjson({ msg: 'Replica set already configured; skipping init.' })
} catch (e) {
	// No replica set configured; initiate one with the expected settings.
	printjson({ msg: 'Replica set not configured; initiating replica set.' })
	rs.initiate({ _id: 'overleaf', members: [{ _id: 0, host: 'mongo:27017' }] })
}
