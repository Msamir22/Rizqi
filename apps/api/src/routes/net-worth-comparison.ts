import { DailySnapshotNetWorth, NetWorthComparison } from "@astik/logic";
import { Router } from "express";
import { Errors, asyncHandler } from "../lib/errors";
import { getSupabaseClientAdmin } from "../lib/supabase";
import { AuthenticatedRequest } from "../middleware/auth";

const router = Router();

/**
 * GET /api/net-worth/comparison
 * Get net worth comparison between current and a previous date
 *
 * Query params:
 * - date: ISO date string for comparison (e.g., "2025-12-13")
 */
router.get(
  "/comparison",
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { date } = req.query;
    const userId = req.userId;

    if (!date || typeof date !== "string") {
      throw Errors.badRequest("Missing required 'date' query parameter");
    }

    // Validate date format
    const comparisonDate = new Date(date);
    if (isNaN(comparisonDate.getTime())) {
      throw Errors.badRequest(
        "Invalid date format. Use ISO format: YYYY-MM-DD"
      );
    }

    const supabase = getSupabaseClientAdmin();

    // Get the latest net worth snapshot for the user
    const { data: currentSnapshot, error: currentError } = await supabase
      .from("daily_snapshot_net_worth")
      .select("total_net_worth, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (currentError && currentError.code !== "PGRST116") {
      throw Errors.supabaseError(currentError);
    }

    // If no current snapshot exists, return null
    if (!currentSnapshot) {
      res.json({ status: "success", data: null });
      return;
    }

    // Get the snapshot closest to the comparison date
    // We look for snapshots on that exact date or the closest one before it
    const { data: previousSnapshot, error: previousError } = await supabase
      .from("daily_snapshot_net_worth")
      .select("total_net_worth, snapshot_date")
      .eq("user_id", userId)
      .lte("snapshot_date", date)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    if (previousError && previousError.code !== "PGRST116") {
      throw Errors.supabaseError(previousError);
    }

    // Calculate percentage change
    const percentageChange = getNetWorthComparison(
      currentSnapshot,
      previousSnapshot
    );

    const response: NetWorthComparison = {
      currentNetWorth: Number(currentSnapshot.total_net_worth),
      previousNetWorth: previousSnapshot
        ? Number(previousSnapshot.total_net_worth)
        : null,
      percentageChange,
      comparisonDate: previousSnapshot ? previousSnapshot.snapshot_date : null,
    };

    res.json({ status: "success", data: response });
  })
);

function getNetWorthComparison(
  currentSnapshot: Pick<DailySnapshotNetWorth, "total_net_worth">,
  previousSnapshot: Pick<DailySnapshotNetWorth, "total_net_worth"> | null
): number | null {
  let percentageChange: number | null = null;
  if (previousSnapshot && previousSnapshot.total_net_worth > 0) {
    const current = Number(currentSnapshot.total_net_worth);
    const previous = Number(previousSnapshot.total_net_worth);
    percentageChange = ((current - previous) / previous) * 100;
    // Round to 2 decimal places
    percentageChange = Math.round(percentageChange * 100) / 100;
  }

  return percentageChange;
}

export default router;
