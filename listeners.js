const taskEvents = require("./events");
const User = require("./models/User");

// Practical 10: ALL event listeners are registered here, exactly once, at startup
// (server.js requires this module). Never require this file from routes/controllers —
// registering listeners in multiple places would fire the same notification twice.

// Registered once via the guard below; eventNames() is logged so the startup console
// proves registration happened (and only once).
function registerListeners() {
    // Guard checks the EMITTER, not a module-level flag: even if this module were
    // re-required with its require-cache entry cleared (e.g. by a test runner),
    // listeners would still not be duplicated.
    if (taskEvents.listenerCount("task-created") > 0) {
        return;
    }

    taskEvents.on("task-created", (payload) => {
        // RETURN the promise so captureRejections can route any rejection to the
        // 'error' listener below. (Calling .catch() here would swallow the rejection
        // before the emitter ever sees it and the error log would never fire.)
        return handleTaskCreated(payload);
    });

    taskEvents.on("task-deleted", (payload) => {
        console.log(
            `[Notification] Task "${payload.title}" was deleted by user ${payload.user} at ${new Date().toISOString()}`
        );
    });

    // 'error' is special: an emitted 'error' event with NO listener throws and can
    // crash the server. This listener must always exist; log and never rethrow.
    taskEvents.on("error", (err) => {
        console.error(`[Notification:error] ${err.message}`);
    });

    console.log(`[Events] Registered listeners: ${taskEvents.eventNames().join(", ")}`);
}

async function handleTaskCreated(payload) {
    // Read env INSIDE the handler (not at module top level) so it does not matter
    // whether dotenv.config() ran before this module was required.
    const delayMs = Number(process.env.NOTIFICATION_DELAY_MS) || 0;

    console.log(`[Notification] handler STARTED at ${new Date().toISOString()}`);

    // Demo knob: prove the 'error' listener works. With captureRejections the throw
    // is routed to the 'error' event instead of crashing the process.
    if (process.env.SIMULATE_LISTENER_ERROR === "true") {
        throw new Error("Simulated notification failure");
    }

    // Simulate a slow job (email/SMS send) with setTimeout, NOT a busy `while` loop:
    // a CPU loop would block the single event loop thread and freeze the whole API,
    // which is the opposite of what this practical demonstrates. setTimeout yields
    // the single thread back to the event loop, so other requests keep being served.
    if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // The "notification" does its extra work here — off the critical request path.
    // Resolve the assigned user's email; fall back to the raw id if the lookup fails.
    let assignedUser = payload.user;
    try {
        const user = await User.findById(payload.user).select("email");

        if (user) {
            assignedUser = user.email;
        }
    } catch {
        assignedUser = String(payload.user);
    }

    // Lag behind the API response — proves the response was sent BEFORE the handler finished
    const lagMs = Date.now() - payload.responseSentAtMs;

    console.log(
        `[Notification] handler DONE ${new Date().toISOString()} | Task "${payload.title}" | user: ${assignedUser} | +${lagMs} ms after API response`
    );
}

registerListeners();

// Exported for the demo-only sync-vs-async comparison mode in createTask
module.exports = { handleTaskCreated };
