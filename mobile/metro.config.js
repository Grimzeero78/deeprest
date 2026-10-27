const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// EAS free-tier builders are memory-constrained: cap Metro workers so the
// "Bundle JavaScript" phase cannot OOM-crash with an unreadable log.
config.transformer.maxWorkers = 2;

module.exports = config;
