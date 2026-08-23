const ALLOWED_PRIORITIES = ["low", "medium", "high"];

function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function reject(res, message) {
    return res.status(400).json({
        success: false,
        message
    });
}

// POST /tasks — title is required; optional fields are type-checked if present
function validateCreateTask(req, res, next) {
    const { title, description, completed, priority } = req.body || {};

    if (title === undefined || title === null) {
        return reject(res, "Title is required");
    }

    if (typeof title !== "string") {
        return reject(res, "Title must be a string");
    }

    req.body.title = title.trim();

    if (!req.body.title) {
        return reject(res, "Title is required");
    }

    if (description !== undefined) {
        if (typeof description !== "string") {
            return reject(res, "Description must be a string");
        }
        req.body.description = description.trim();
    }

    if (completed !== undefined && typeof completed !== "boolean") {
        return reject(res, "Completed must be a boolean");
    }

    if (priority !== undefined && !ALLOWED_PRIORITIES.includes(priority)) {
        return reject(res, "Priority must be one of: low, medium, high");
    }

    next();
}

// PUT /tasks/:id — only validate fields that the client actually sent
function validateUpdateTask(req, res, next) {
    const body = req.body || {};

    if (body.title !== undefined) {
        if (typeof body.title !== "string") {
            return reject(res, "Title must be a string");
        }
        req.body.title = body.title.trim();
        if (!req.body.title) {
            return reject(res, "Title is required");
        }
    }

    if (body.description !== undefined) {
        if (typeof body.description !== "string") {
            return reject(res, "Description must be a string");
        }
        req.body.description = body.description.trim();
    }

    if (body.completed !== undefined && typeof body.completed !== "boolean") {
        return reject(res, "Completed must be a boolean");
    }

    if (body.priority !== undefined && !ALLOWED_PRIORITIES.includes(body.priority)) {
        return reject(res, "Priority must be one of: low, medium, high");
    }

    next();
}

module.exports = {
    validateCreateTask,
    validateUpdateTask
};
