import { getSameDayLastMonth, NetWorthComparison } from "@astik/logic";
import { get } from "./request";

/**
 * Fetch net worth comparison from API
 */
export async function getNetWorthComparison(): Promise<NetWorthComparison | null> {
  const date = getSameDayLastMonth();

  const { data, error } = await get("/api/net-worth/comparison", {
    queryParams: { date },
  });

  if (error) {
    console.error("Error fetching net worth comparison:", error);
    return null;
  }

  return data;
}
