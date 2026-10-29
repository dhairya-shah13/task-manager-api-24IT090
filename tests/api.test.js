process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "practical12_ci_pipeline_secret_test_2026";

const request = require("supertest");
const app = require("../server");

describe("Practical 12 — Automated CI/CD Test Suite", () => {
    describe("GET /debug/cache-stats", () => {
        test("returns 200 and body containing keys and stats", async () => {
            const res = await request(app).get("/debug/cache-stats");
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("keys");
            expect(res.body).toHaveProperty("stats");
            expect(Array.isArray(res.body.keys)).toBe(true);
            expect(typeof res.body.stats).toBe("object");
        });
    });

    describe("GET /tasks without authorization token", () => {
        test("returns 401 Unauthorized and required auth error message", async () => {
            const res = await request(app).get("/tasks");
            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({
                success: false,
                message: "Authentication required"
            });
        });
    });

    describe("POST /register with empty body", () => {
        test("returns 400 Bad Request and validation error message", async () => {
            const res = await request(app)
                .post("/register")
                .send({});
            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({
                success: false,
                message: "Email and password are required"
            });
        });
    });
});
