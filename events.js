const EventEmitter = require("events");

// Practical 10: single in-process event bus for task lifecycle notifications.
// A singleton (module is cached by Node) so every require() gets the SAME emitter —
// two emitters would mean listeners registered on one never fire from the other.

class TaskEvents extends EventEmitter {
    constructor() {
        // captureRejections: if an async listener rejects, Node routes the error to the
        // 'error' event instead of leaving it as an unhandledRejection that could crash the process.
        super({ captureRejections: true });
    }
}

module.exports = new TaskEvents();
