const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { registerUser, loginUser, getCurrentUser } = require("../controllers/authController");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", authMiddleware, getCurrentUser);

module.exports = router;
