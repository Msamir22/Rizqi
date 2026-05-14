import { database, type Transaction, type Transfer } from "@monyvi/db";
import { Q } from "@nozbe/watermelondb";
import { getCurrentUserDataScope } from "./user-data-access";

/**
 * Check whether an SMS has already produced a transaction or transfer.
 */
export async function hasExistingSmsBodyHash(
  smsBodyHash: string
): Promise<boolean> {
  const scope = await getCurrentUserDataScope();

  const [transactionCount, transferCount] = await Promise.all([
    scope
      .queryOwned(
        database.get<Transaction>("transactions"),
        Q.where("sms_body_hash", smsBodyHash),
        Q.where("deleted", Q.notEq(true))
      )
      .fetchCount(),
    scope
      .queryOwned(
        database.get<Transfer>("transfers"),
        Q.where("sms_body_hash", smsBodyHash),
        Q.where("deleted", Q.notEq(true))
      )
      .fetchCount(),
  ]);

  return transactionCount > 0 || transferCount > 0;
}
