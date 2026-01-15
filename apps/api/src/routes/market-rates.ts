import express from "express";
import { asyncHandler, Errors } from "../lib/errors";
import { getSupabaseClientAdmin } from "../lib/supabase";
import { AuthenticatedRequest } from "../middleware/auth";

const router = express.Router();

// GET /api/rates - Get cached rates
router.get(
  "/",
  asyncHandler<AuthenticatedRequest>(async (_req, res) => {
    const supabase = getSupabaseClientAdmin();
    const { data, error } = await supabase
      .from("market_rates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(); // Use maybeSingle() to handle empty table (returns null instead of error)

    if (error) {
      throw Errors.supabaseError(error);
    }

    res.json({
      status: "success",
      data,
    });
  })
);

/**
 * GET /api/market-rates/previous-day
 * Get the most recent market rates from before today (for trend comparison)
 */
router.get(
  "/previous-day",
  asyncHandler<AuthenticatedRequest>(async (_req, res) => {
    const supabase = getSupabaseClientAdmin();

    // Get start of today in UTC
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Get the most recent rate before today
    const { data, error } = await supabase
      .from("market_rates")
      .select(
        "usd_egp, gold_egp_per_gram, silver_egp_per_gram, platinum_egp_per_gram, palladium_egp_per_gram, created_at"
      )
      .lt("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw Errors.supabaseError(error);
    }

    res.json({ status: "success", data });
  })
);

export default router;
