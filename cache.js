const NodeCache = require("node-cache");

// Practical 9: In-memory server-side cache with 60-second TTL
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

let hits = 0;
let misses = 0;

function get(key) {
    const val = cache.get(key);
    if (val !== undefined) {
        hits++;
        return val;
    }
    misses++;
    return null;
}

function set(key, value, ttl) {
    if (ttl) {
        return cache.set(key, value, ttl);
    }
    return cache.set(key, value);
}

function del(key) {
    return cache.del(key);
}

function flush() {
    return cache.flushAll();
}

function getStats() {
    return {
        hits,
        misses,
        hitRatio: hits + misses > 0 ? (hits / (hits + misses)).toFixed(2) : "0.00",
        keysCount: cache.keys().length,
        keys: cache.keys(),
        stats: cache.getStats()
    };
}

module.exports = {
    cache,
    get,
    set,
    del,
    flush,
    getStats
};
