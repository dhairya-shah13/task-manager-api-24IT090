require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/task-manager-api";

app.use(express.json());

// Enable CORS so the React dev server (http://localhost:5173) can call this API
app.use(cors());

// Logging Middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
});

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("✅ MongoDB Connected");
    })
    .catch((err) => {
        console.log("MongoDB Connection Error:", err.message);
    });

// Public auth routes: POST /register, POST /login, GET /me (protected inside the router)
app.use(authRoutes);

// Cache debug stats endpoint (Practical 9 supplementary)
const cache = require("./cache");
app.get("/debug/cache-stats", (req, res) => {
    res.json(cache.getStats());
});

// Task pipeline: authMiddleware → validation (POST/PUT) → controller → MongoDB
app.use("/tasks", authMiddleware, taskRoutes);

// =========================
// GLOBAL ERROR HANDLER
// =========================
app.use((err, req, res, next) => {
    console.error(err);

    if (err.name === "ValidationError") {
        const errors = {};

        Object.keys(err.errors).forEach((key) => {
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
