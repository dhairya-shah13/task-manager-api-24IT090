const Task = require("../models/Task");

// Every query is scoped to req.user.id (from the JWT) so account A
// cannot read, update, or delete account B's tasks.

function ownerFilter(req) {
    return { user: req.user.id };
}

async function getAllTasks(req, res, next) {
    try {
        const tasks = await Task.find(ownerFilter(req));
        res.status(200).json(tasks);
    } catch (err) {
        next(err);
    }
}

async function getTaskById(req, res, next) {
    try {
        const task = await Task.findOne({ _id: req.params.id, ...ownerFilter(req) });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

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

        res.status(201).json(task);
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

        res.status(200).json({
            success: true,
            message: "Task deleted successfully"
        });
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
