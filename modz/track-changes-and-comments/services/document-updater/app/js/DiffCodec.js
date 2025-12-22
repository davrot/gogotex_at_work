exports.diffAsHistoryOTEditOperation = function(file, text) { return { isNoop: () => true, toJSON: () => ({}) } }
exports.diffAsShareJsOp = function(oldLines, newLines) { return [] }
