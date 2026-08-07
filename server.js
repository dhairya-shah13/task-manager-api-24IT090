const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const Task = require("./models/Task");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/task-manager-api";

// Middleware
app.use(express.json());

// Logging Middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
});

// MongoDB Connection
mongoose.connect(MONGO_URI)
.then(() => {
    console.log("✅ MongoDB Connected");
})
.catch((err) => {
    console.log("MongoDB Connection Error:", err.message);
});


// =========================
// GET ALL TASKS
// =========================
app.get("/tasks", async (req, res, next) => {

    try {

        const tasks = await Task.find();

        res.status(200).json(tasks);

    } catch (err) {

        next(err);

    }

});


// =========================
// GET TASK BY ID
// =========================
app.get("/tasks/:id", async (req, res, next) => {

    try {

        const task = await Task.findById(req.params.id);

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

});


// =========================
// CREATE TASK
// =========================
app.post("/tasks", async (req, res, next) => {

    try {

        const task = await Task.create(req.body);

        res.status(201).json(task);

    } catch (err) {

        next(err);

    }

});


// =========================
// UPDATE TASK
// =========================
app.put("/tasks/:id", async (req, res, next) => {

    try {

        const task = await Task.findByIdAndUpdate(

            req.params.id,

            req.body,

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

});


// =========================
// DELETE TASK
// =========================
app.delete("/tasks/:id", async (req, res, next) => {

    try {

        const task = await Task.findByIdAndDelete(req.params.id);

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

});


// =========================
// GLOBAL ERROR HANDLER
// =========================
app.use((err, req, res, next) => {

    console.error(err);

    if (err.name === "ValidationError") {

        const errors = {};

        Object.keys(err.errors).forEach(key => {

            errors[key] = err.errors[key].message;

        });

        return res.status(400).json({

            success: false,

            errors

        });

    }

    if (err.name === "CastError") {

        return res.status(400).json({

            success: false,

            message: "Invalid Task ID"

        });

    }

    res.status(500).json({

        success: false,

        message: err.message || "Internal Server Error"

    });

});


app.listen(PORT, () => {

    console.log(`Server running on http://localhost:${PORT}`);

});