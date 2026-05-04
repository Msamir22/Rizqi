import { database, type Transaction, type Transfer } from "@monyvi/db";
import { Q } from "@nozbe/watermelondb";

/**
 * Check whether an SMS has already produced a transaction or transfer.
 */
export async function hasExistingSmsBodyHash(
  smsBodyHash: string
): Promise<boolean> {
  const [transactionCount, transferCount] = await Promise.all([
    database
      .get<Transaction>("transactions")
      .query(
        Q.where("sms_body_hash", smsBodyHash),
        Q.where("deleted", Q.notEq(true))
      )
      .fetchCount(),
    database
      .get<Transfer>("transfers")
      .query(
        Q.where("sms_body_hash", smsBodyHash),
        Q.where("deleted", Q.notEq(true))
      )
      .fetchCount(),
  ]);

  return transactionCount > 0 || transferCount > 0;
}
