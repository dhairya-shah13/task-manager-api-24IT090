const Task = require("../models/Task");
const cache = require("../cache");
const taskEvents = require("../events");
const { handleTaskCreated } = require("../listeners");

// Every query is scoped to req.user.id (from the JWT) so account A
// cannot read, update, or delete account B's tasks.

function ownerFilter(req) {
    return { user: req.user.id };
}

function getTasksCacheKey(req) {
    return req.user && req.user.id ? `tasks_${req.user.id}` : "all_tasks";
}

async function getAllTasks(req, res, next) {
    try {
        const cacheKey = getTasksCacheKey(req);
        const cached = cache.get(cacheKey);

        if (cached) {
            return res.status(200).json(cached);
        }

        const tasks = await Task.find(ownerFilter(req));
        cache.set(cacheKey, tasks);

        res.status(200).json(tasks);
    } catch (err) {
        next(err);
    }
}

async function getTaskById(req, res, next) {
    try {
        const cacheKey = `task_${req.params.id}`;
        const cached = cache.get(cacheKey);

        if (cached) {
            return res.status(200).json(cached);
        }

        const task = await Task.findOne({ _id: req.params.id, ...ownerFilter(req) });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        cache.set(cacheKey, task);
        res.status(200).json(task);
    } catch (err) {
        next(err);
    }
}

async function createTask(req, res, next) {
    try {
        // Ignore any client-supplied owner; the logged-in user always owns the task
        const { user: _ignored, ...taskData } = req.body || {};

        const task = await Task.create({
            ...taskData,
            user: req.user.id
        });

        // Cache Invalidation: invalidate tasks collection after successful write
        cache.del(getTasksCacheKey(req));
        cache.del("all_tasks");

        // Snapshot the plain values we need — deliberately NOT the Mongoose document,
        // so the event payload survives even if the doc is mutated/GC'd later.
        const payload = {
            _id: task._id,
            title: task.title,
            priority: task.priority,
            user: task.user,
            createdAt: task.createdAt,
            responseSentAtMs: 0
        };

        // =============================
        // DEMO ONLY — Practical 10 sync-vs-async comparison; remove in production.
        // sync mode: the slow notification runs BEFORE the response, so the client
        // waits the full NOTIFICATION_DELAY_MS — the control experiment that shows
        // what the event-driven version saves. Default (async) ignores this branch.
        // =============================
        if (process.env.NOTIFICATION_MODE === "sync") {
            payload.responseSentAtMs = Date.now();

            await handleTaskCreated(payload);

            res.status(201).json(task);
            return;
        }
        // ============================= END DEMO ONLY =============================

        const responseSentAtMs = Date.now();
        payload.responseSentAtMs = responseSentAtMs;
        console.log(`[API] POST /tasks -> 201 response sent at ${new Date().toISOString()}`);

        res.status(201).json(task);

        // Emit AFTER the response (never awaited): the client is already unblocked;
        // the listener does the slow notification work in the background.
        try {
            taskEvents.emit("task-created", payload);
        } catch (emitErr) {
            // A synchronous throw inside emit() must NOT reach next(err): the response
            // is already sent, so next(err) would cause ERR_HTTP_HEADERS_SENT.
            console.error("[Notification] synchronous emit failure:", emitErr.message);
        }
    } catch (err) {
        next(err);
    }
}

async function updateTask(req, res, next) {
    try {
        const { user: _ignored, ...updates } = req.body || {};

        const task = await Task.findOneAndUpdate(
            { _id: req.params.id, ...ownerFilter(req) },
            updates,
            {
                new: true,
                runValidators: true
            }
        );

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        // Cache Invalidation: invalidate tasks collection & single task cache
        cache.del(getTasksCacheKey(req));
        cache.del("all_tasks");
        cache.del(`task_${req.params.id}`);

        res.status(200).json(task);
    } catch (err) {
        next(err);
    }
}

async function deleteTask(req, res, next) {
    try {
        const task = await Task.findOneAndDelete({ _id: req.params.id, ...ownerFilter(req) });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        // Cache Invalidation: invalidate tasks collection & single task cache
        cache.del(getTasksCacheKey(req));
        cache.del("all_tasks");
        cache.del(`task_${req.params.id}`);

        res.status(200).json({
            success: true,
            message: "Task deleted successfully"
        });

        // Emit only on real success (the 404 path above returns early — never emits).
        // `task` is the deleted document returned by findOneAndDelete, which already
        // carries the title — no extra query needed. Response body stays byte-identical.
        try {
            taskEvents.emit("task-deleted", {
                _id: task._id,
                title: task.title,
                user: task.user
            });
        } catch (emitErr) {
            // Same reasoning as in createTask: response already sent, never next(err)
            console.error("[Notification] synchronous emit failure:", emitErr.message);
        }
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getAllTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask
};
