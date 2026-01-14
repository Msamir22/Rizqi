import express from "express";
import { asyncHandler, Errors } from "../lib/errors";
import { getSupabaseClientAdmin } from "../lib/supabase";
import { AuthenticatedRequest } from "../middleware/auth";

const router = express.Router();

/**
 * GET /api/market-rates/previous-day
 * Get the most recent market rates snapshot (yesterday or earlier)
 */
router.get(
  "/previous-day",
  asyncHandler<AuthenticatedRequest>(async (_req, res) => {
    const supabase = getSupabaseClientAdmin();

    // Get today's date
    const today = new Date().toISOString().split("T")[0];

    // Get the most recent snapshot before today
    const { data, error } = await supabase
      .from("daily_snapshot_market_rates")
      .select(
        "usd_egp, gold_egp_per_gram, silver_egp_per_gram, platinum_egp_per_gram, palladium_egp_per_gram, snapshot_date"
      )
      .lt("snapshot_date", today)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      throw Errors.supabaseError(error);
    }

    // If no snapshot exists, return null values
    if (!data) {
      res.json({ status: "success", data: null });
      return;
    }

    res.json({ status: "success", data });
  })
);

export default router;
