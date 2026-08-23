const express = require("express");
const { validateCreateTask, validateUpdateTask } = require("../middleware/validateTask");
const {
    getAllTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask
} = require("../controllers/taskController");

const router = express.Router();

// Auth middleware is applied in server.js before this router
router.get("/", getAllTasks);
router.get("/:id", getTaskById);
router.post("/", validateCreateTask, createTask);
router.put("/:id", validateUpdateTask, updateTask);
router.delete("/:id", deleteTask);

module.exports = router;
