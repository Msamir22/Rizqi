import { database, type Category } from "@monyvi/db";
import {
  type ParsedSmsTransaction,
  computeSmsHash,
  isLikelyFinancialSms,
  SUPPORTED_CURRENCIES,
} from "@monyvi/logic";
import { Q } from "@nozbe/watermelondb";
import {
  parseSmsWithAi,
  type ParseSmsContext,
  type SmsCandidate,
} from "./ai-sms-parser-service";
import { reconcileLiveDetectionPreference } from "./sms-live-detection-handler";
import { hasExistingSmsBodyHash } from "./sms-dedup-service";
import { getCurrentUserDataScope } from "./user-data-access";
import { logger } from "@/utils/logger";

type LiveSmsDeliveryMode = "foreground" | "headless";

type LiveSmsProcessingStatus =
  | "disabled"
  | "ignored"
  | "duplicate"
  | "ai_failed"
  | "parsed";

export interface LiveSmsEvent {
  readonly sender: string;
  readonly body: string;
  readonly timestamp: number;
  readonly deliveryMode: LiveSmsDeliveryMode;
}

export interface LiveSmsProcessingResult {
  readonly status: LiveSmsProcessingStatus;
  readonly smsBodyHash?: string;
  readonly transactions: readonly ParsedSmsTransaction[];
}

interface LiveSmsProcessingOptions {
  readonly isRecentlyProcessed?: (smsBodyHash: string) => boolean;
  readonly markRecentlyProcessed?: (smsBodyHash: string) => void;
}

const EMPTY_TRANSACTIONS: readonly ParsedSmsTransaction[] = [];

function createResult(
  status: LiveSmsProcessingStatus,
  smsBodyHash?: string,
  transactions: readonly ParsedSmsTransaction[] = EMPTY_TRANSACTIONS
): LiveSmsProcessingResult {
  return { status, smsBodyHash, transactions };
}

async function loadAiContext(): Promise<ParseSmsContext> {
  const scope = await getCurrentUserDataScope();
  const categories = await scope
    .queryAccessibleCategories(
      database.get<Category>("categories"),
      Q.where("deleted", Q.notEq(true))
    )
    .fetch();

  return {
    categories,
    supportedCurrencies: SUPPORTED_CURRENCIES.map((currency) => currency.code),
  };
}

export async function processLiveSmsEvent(
  event: LiveSmsEvent,
  options: LiveSmsProcessingOptions = {}
): Promise<LiveSmsProcessingResult> {
  const canRun = await reconcileLiveDetectionPreference();
  if (!canRun) {
    return createResult("disabled");
  }

  if (!isLikelyFinancialSms(event.body)) {
    return createResult("ignored");
  }

  try {
    const smsBodyHash = await computeSmsHash(event.body);

    if (options.isRecentlyProcessed?.(smsBodyHash)) {
      return createResult("duplicate", smsBodyHash);
    }

    if (await hasExistingSmsBodyHash(smsBodyHash)) {
      return createResult("duplicate", smsBodyHash);
    }

    const candidate: SmsCandidate = {
      message: {
        id: `live-${event.deliveryMode}-${event.timestamp}`,
        address: event.sender,
        body: event.body,
        date: event.timestamp,
        read: false,
      },
      smsBodyHash,
    };
    const aiResult = await parseSmsWithAi([candidate], await loadAiContext());

    if (aiResult.hasError === true) {
      return createResult("ai_failed", smsBodyHash);
    }

    options.markRecentlyProcessed?.(smsBodyHash);

    if (aiResult.transactions.length === 0) {
      return createResult("ignored", smsBodyHash);
    }

    return createResult("parsed", smsBodyHash, aiResult.transactions);
  } catch (error: unknown) {
    logger.error("liveSms.process.failed", error, {
      deliveryMode: event.deliveryMode,
    });
    return createResult("ai_failed");
  }
}
