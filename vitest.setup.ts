import "@testing-library/jest-dom/vitest";

// Confirmation-code hashing is keyed with AUTH_SECRET; give tests a fixed one.
process.env.AUTH_SECRET = "test-secret-for-vitest";
