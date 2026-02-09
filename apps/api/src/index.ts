import cors from "cors";
import { config } from "dotenv";
import express, { json } from "express";
import { existsSync } from "fs";
import path from "path";

// Load environment variables in development
const isProduction = process.env.NODE_ENV === "production";
const isVercel = process.env.VERCEL === "1";
const environment = isVercel
  ? "vercel"
  : isProduction
    ? "production"
    : "development";

if (!isProduction && !isVercel) {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (existsSync(envPath)) {
    config({ path: envPath });
  } else {
    console.warn("⚠️ .env.local not found, using environment variables");
  }
}

// Validate required environment variables
const requiredEnvVars = [
  "EXPRESS_PUBLIC_SUPABASE_URL",
  "EXPRESS_PUBLIC_SUPABASE_ANON_KEY",
  "EXPRESS_SUPABASE_SERVICE_ROLE_KEY",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.error("❌ Missing required environment variables:", missingVars);
  if (!isProduction) {
    console.error("   Please add them to apps/api/.env.local");
  }
}

// Import routes after environment is configured
import { asyncHandler, globalErrorHandler } from "./lib/errors";
import { Auth } from "./middleware/auth";
import mockRouter from "./routes/mock";
import netWorthRouter from "./routes/net-worth-comparison";

const app = express();

// Middleware
app.use(cors());
app.use(json());
app.use(asyncHandler(Auth));

// Routes
app.use("/api/mock", mockRouter);
app.use("/api/net-worth", netWorthRouter);

// Health check
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "Astik API Server",
    environment,
    endpoints: [
      "GET /api/mock/rates - Mock data for development",
      "GET /api/net-worth/comparison - Compare net worth over time",
    ],
  });
});

// Global error handler (must be last)
app.use(globalErrorHandler);

// Start server only in local development (not on Vercel)
if (!isVercel) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Astik API server running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

// Export for Vercel serverless
export default app;
