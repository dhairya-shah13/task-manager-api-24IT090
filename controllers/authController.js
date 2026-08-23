const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

function validateCredentials(email, password) {
    if (email === undefined || email === null || password === undefined || password === null) {
        return "Email and password are required";
    }

    if (typeof email !== "string" || typeof password !== "string") {
        return "Email and password must be strings";
    }

    if (!email.trim() || !password) {
        return "Email and password are required";
    }

    if (!EMAIL_REGEX.test(email.trim())) {
        return "Please provide a valid email address";
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    return null;
}

// POST /register — hash the password with bcrypt before storing the user
async function registerUser(req, res, next) {
    try {
        const { email, password } = req.body || {};
        const validationError = validateCredentials(email, password);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists"
            });
        }

        // Cost factor 10 is a standard bcrypt work factor for this practical
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            email: normalizedEmail,
            password: hashedPassword
        });

        res.status(201).json({
            success: true,
            message: "Registration successful",
            user: {
                id: user._id,
                email: user.email
            }
        });
    } catch (err) {
        // Unique index race: treat duplicate email as 409, not 500
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "User already exists"
            });
        }
        next(err);
    }
}

// POST /login — compare the plaintext password to the stored hash, then issue a JWT
async function loginUser(req, res, next) {
    try {
        const { email, password } = req.body || {};

        if (!email || !password || typeof email !== "string" || typeof password !== "string") {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail });

        // Same 401 for missing user and wrong password so we do not leak which one failed
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Server configuration error"
            });
        }

        // Payload is the user id; expiry is 1 hour as required by the practical
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                email: user.email
            }
        });
    } catch (err) {
        next(err);
    }
}

// GET /me — uses req.user.id set by authMiddleware, never returns the password hash
async function getCurrentUser(req, res, next) {
    try {
        const user = await User.findById(req.user.id).select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                createdAt: user.createdAt
            }
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    registerUser,
    loginUser,
    getCurrentUser
};
