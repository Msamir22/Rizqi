/**
 * SmsScanProgress Component
 *
 * Redesigned card-based progress UI for the SMS scanning pipeline.
 * Shows a hero card with circular progress ring, stat cards,
 * pipeline status steps, and state-specific layouts.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component (no business logic)
 * - Why: Receives all data via props — easy to test/theme
 * - SOLID: SRP — only renders scan progress UI
 *
 * @module SmsScanProgress
 */

import { palette } from "@/constants/colors";
import type { SmsScanProgress as SmsScanProgressData } from "@/services/sms-sync-service";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RING_SIZE = 120;
const RING_STROKE_WIDTH = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE_WIDTH) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SmsScanProgressProps {
  /** Current scan status */
  readonly status: "idle" | "scanning" | "complete" | "error";
  /** Live progress data during scanning */
  readonly progress: SmsScanProgressData | null;
  /** Number of transactions found */
  readonly transactionsFound: number;
  /** Total messages scanned */
  readonly totalScanned: number;
  /** Duration of completed scan in milliseconds */
  readonly durationMs: number;
  /** Top category system names detected (for success state) */
  readonly topCategories: readonly string[];
  /** Error message if scan failed */
  readonly error: string | null;
  /** Called when user taps "Review Transactions" */
  readonly onReviewPress: () => void;
  /** Called when user taps "Back to Dashboard" (empty/error state) */
  readonly onBackPress: () => void;
  /** Called when user taps "Retry" after error */
  readonly onRetryPress: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SmsScanProgress({
  status,
  progress,
  transactionsFound,
  totalScanned,
  durationMs,
  topCategories,
  error,
  onReviewPress,
  onBackPress,
  onRetryPress,
}: SmsScanProgressProps): React.JSX.Element {
  return (
    <View className="flex-1 bg-slate-900">
      {/* ── Header ───────────────────────────────────────────── */}
      <View className="flex-row items-center px-4 pt-2 pb-3">
        <TouchableOpacity
          onPress={onBackPress}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          className="w-10 h-10 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={24} color={palette.slate[400]} />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-base font-bold text-white -ml-10">
          SMS Scan
        </Text>
      </View>

      {/* ── State Content ─────────────────────────────────────── */}
      <View className="flex-1 px-4">
        {status === "scanning" && <ScanningState progress={progress} />}

        {status === "complete" && transactionsFound > 0 && (
          <SuccessState
            transactionsFound={transactionsFound}
            totalScanned={totalScanned}
            durationMs={durationMs}
            topCategories={topCategories}
            onReviewPress={onReviewPress}
            onBackPress={onBackPress}
          />
        )}

        {status === "complete" && transactionsFound === 0 && (
          <EmptyState totalScanned={totalScanned} onBackPress={onBackPress} />
        )}

        {status === "error" && (
          <ErrorState
            error={error}
            onRetryPress={onRetryPress}
            onBackPress={onBackPress}
          />
        )}
      </View>

      {/* ── Bottom action (scanning state only) ───────────────── */}
      {status === "scanning" && (
        <View className="px-4 pb-6">
          <ScanHintText progress={progress} />
          <TouchableOpacity
            onPress={onBackPress}
            activeOpacity={0.85}
            className="w-full py-4 rounded-2xl bg-slate-800 items-center"
          >
            <Text className="text-white text-sm font-semibold">
              Cancel Scan
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Circular Progress Ring (SVG-based)
// ---------------------------------------------------------------------------

function CircularProgressRing({
  percentage,
}: {
  readonly percentage: number;
}): React.JSX.Element {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset =
    RING_CIRCUMFERENCE - (clampedPercentage / 100) * RING_CIRCUMFERENCE;

  return (
    <View
      className="items-center justify-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <Svg width={RING_SIZE} height={RING_SIZE}>
        {/* Track */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={palette.slate[700]}
          strokeWidth={RING_STROKE_WIDTH}
          fill="transparent"
        />
        {/* Fill arc */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={palette.nileGreen[500]}
          strokeWidth={RING_STROKE_WIDTH}
          fill="transparent"
          strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      {/* Center text overlay */}
      <View className="absolute items-center justify-center">
        <Text className="text-3xl font-extrabold text-white">
          {clampedPercentage}%
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Scanning State
// ---------------------------------------------------------------------------

function ScanningState({
  progress,
}: {
  readonly progress: SmsScanProgressData | null;
}): React.JSX.Element {
  const scanned = progress?.messagesScanned ?? 0;
  const total = progress?.totalMessages ?? 0;
  const found = progress?.transactionsFound ?? 0;
  const phase = progress?.currentPhase ?? "filtering";
  const scanStartedAt = progress?.scanStartedAt;
  const aiChunksCompleted = progress?.aiChunksCompleted ?? 0;
  const aiChunksTotal = progress?.aiChunksTotal;
  const estimatedRemainingMs = progress?.estimatedRemainingMs;

  // ── T008: Elapsed timer ──────────────────────────────────────────────
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (scanStartedAt === undefined) return;

    // Sync immediately, then update every second
    setElapsedMs(Date.now() - scanStartedAt);
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - scanStartedAt);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [scanStartedAt]);

  // Two-phase percentage: filter = 0–50%, AI = 50–100%
  let percentage = 0;
  if (phase === "filtering" && total > 0) {
    percentage = Math.round((scanned / total) * 50);
  } else if (phase === "ai-parsing") {
    const aiTotal = aiChunksTotal ?? 1;
    percentage = 50 + Math.round((aiChunksCompleted / aiTotal) * 50);
  } else if (phase === "complete") {
    percentage = 100;
  }

  const statusText =
    phase === "ai-parsing"
      ? "Analyzing Transactions..."
      : "Scanning Messages...";

  const senderName = progress?.currentSender ?? "";

  // ── T009: Batch counter sub-text ──────────────────────────────────────
  const batchCounterText =
    phase === "ai-parsing" && aiChunksTotal !== undefined && aiChunksTotal > 0
      ? `Analyzing batch ${aiChunksCompleted + (aiChunksCompleted < aiChunksTotal ? 1 : 0)} of ${aiChunksTotal}...`
      : undefined;

  return (
    <Animated.View entering={FadeIn.duration(400)} className="flex-1">
      {/* ── Hero Card ───────────────────────────────────────── */}
      <View className="bg-slate-800 rounded-3xl p-6 items-center mt-2">
        <CircularProgressRing percentage={percentage} />

        <Text className="text-lg font-semibold text-white mt-4">
          {statusText}
        </Text>

        {/* T009: Batch counter during AI parsing */}
        {batchCounterText !== undefined && (
          <Text className="text-sm text-slate-400 mt-1">
            {batchCounterText}
          </Text>
        )}

        {senderName.length > 0 && (
          <View className="flex-row items-center mt-1">
            <Ionicons
              name="business-outline"
              size={14}
              color={palette.slate[400]}
            />
            <Text className="text-sm text-slate-400 ml-1">
              Reading from {senderName}
            </Text>
          </View>
        )}

        {/* T008: Elapsed timer */}
        <View className="flex-row items-center mt-3 gap-4">
          <View className="flex-row items-center">
            <Ionicons
              name="time-outline"
              size={14}
              color={palette.slate[500]}
            />
            <Text className="text-xs text-slate-500 ml-1">
              {formatDuration(elapsedMs)} elapsed
            </Text>
          </View>

          {/* T013: Estimated remaining time */}
          {estimatedRemainingMs !== undefined && estimatedRemainingMs > 0 && (
            <View className="flex-row items-center">
              <Ionicons
                name="hourglass-outline"
                size={14}
                color={palette.nileGreen[400]}
              />
              <Text
                className="text-xs ml-1"
                // eslint-disable-next-line react-native/no-inline-styles
                style={{ color: palette.nileGreen[400] }}
              >
                ~{formatDuration(estimatedRemainingMs)} remaining
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Stats Cards ─────────────────────────────────────── */}
      <View className="flex-row gap-3 mt-3">
        <StatCard
          icon="mail-outline"
          label="SCANNED"
          value={scanned}
          total={total}
          sublabel="Messages"
        />
        <StatCard
          icon="receipt-outline"
          label="FOUND"
          value={found}
          sublabel="Transactions"
          valueColor={palette.nileGreen[400]}
        />
      </View>

      {/* ── Pipeline Status ─────────────────────────────────── */}
      <View className="bg-slate-800 rounded-3xl p-5 mt-3">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Pipeline Status
        </Text>

        <PipelineStep
          label="Read SMS permissions"
          status="completed"
          isLast={false}
        />
        <PipelineStep
          label="Filtering financial messages"
          status={
            phase === "filtering"
              ? "active"
              : phase === "ai-parsing" || phase === "complete"
                ? "completed"
                : "pending"
          }
          isLast={false}
        />
        <PipelineStep
          label="AI transaction parsing"
          status={
            phase === "ai-parsing"
              ? "active"
              : phase === "complete"
                ? "completed"
                : "pending"
          }
          isLast
        />
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// T010: Dynamic Hint Text — replaces static "This usually takes 30–60 seconds"
// ---------------------------------------------------------------------------

/**
 * Bottom hint text that adapts to the current scan phase and progress.
 * Presentational: receives all data via `progress` prop.
 */
function ScanHintText({
  progress,
}: {
  readonly progress: SmsScanProgressData | null;
}): React.JSX.Element {
  const phase = progress?.currentPhase ?? "filtering";
  const aiChunksCompleted = progress?.aiChunksCompleted ?? 0;
  const aiChunksTotal = progress?.aiChunksTotal;

  let hint: string;

  if (phase === "filtering") {
    hint = "Scanning your messages...";
  } else if (phase === "ai-parsing") {
    if (aiChunksCompleted === 0) {
      hint = "Processing may take a few minutes for large inboxes";
    } else if (aiChunksTotal !== undefined && aiChunksTotal > 0) {
      const pctComplete = Math.round((aiChunksCompleted / aiChunksTotal) * 100);
      hint = `${pctComplete}% of AI analysis complete`;
    } else {
      hint = "Analyzing your transactions...";
    }
  } else {
    hint = "Wrapping up...";
  }

  return (
    <Text className="text-xs text-slate-500 text-center mb-3">{hint}</Text>
  );
}

// ---------------------------------------------------------------------------
// Success State
// ---------------------------------------------------------------------------

function SuccessState({
  transactionsFound,
  totalScanned,
  durationMs,
  topCategories,
  onReviewPress,
  onBackPress,
}: {
  readonly transactionsFound: number;
  readonly totalScanned: number;
  readonly durationMs: number;
  readonly topCategories: readonly string[];
  readonly onReviewPress: () => void;
  readonly onBackPress: () => void;
}): React.JSX.Element {
  const durationLabel = formatDuration(durationMs);

  return (
    <Animated.View entering={ZoomIn.springify()} className="flex-1">
      {/* ── Success Icon ────────────────────────────────────── */}
      <View className="items-center mt-6">
        {/* Outer glow ring */}
        <View
          className="w-24 h-24 rounded-full items-center justify-center"
          // eslint-disable-next-line react-native/no-inline-styles
          style={{ backgroundColor: `${palette.nileGreen[500]}15` }}
        >
          {/* Inner circle */}
          <View
            className="w-16 h-16 rounded-full items-center justify-center"
            // eslint-disable-next-line react-native/no-inline-styles
            style={{ backgroundColor: palette.nileGreen[900] }}
          >
            <Ionicons
              name="checkmark-circle"
              size={40}
              color={palette.nileGreen[500]}
            />
          </View>
        </View>

        <Text className="text-2xl font-bold text-white mt-5">
          Scan Complete!
        </Text>
        <Text className="text-sm text-slate-400 mt-1">
          Your messages have been analyzed
        </Text>
      </View>

      {/* ── Summary Card ────────────────────────────────────── */}
      <View className="bg-slate-800 rounded-3xl mt-6">
        <SummaryRow
          label="Messages Scanned"
          value={totalScanned.toLocaleString()}
        />
        <SummaryRow
          label="Transactions Found"
          value={transactionsFound.toString()}
          valueColor={palette.nileGreen[400]}
        />
        <SummaryRow label="Time Taken" value={durationLabel} isLast />
      </View>

      {/* ── Category Chips ──────────────────────────────────── */}
      {topCategories.length > 0 && (
        <Animated.View entering={FadeInDown.delay(300)} className="mt-5">
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Identified Categories
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {topCategories.map((cat) => (
              <CategoryChip key={cat} name={cat} />
            ))}
          </View>
        </Animated.View>
      )}

      {/* ── Action Buttons ──────────────────────────────────── */}
      <View className="flex-1 justify-end pb-6">
        <TouchableOpacity
          onPress={onReviewPress}
          activeOpacity={0.85}
          className="w-full py-4 rounded-2xl items-center mb-3"
          // eslint-disable-next-line react-native/no-inline-styles
          style={{
            backgroundColor: palette.nileGreen[500],
            shadowColor: palette.nileGreen[500],
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <Text className="text-white text-base font-bold">
            Review {transactionsFound} Transaction
            {transactionsFound !== 1 ? "s" : ""}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onBackPress}
          activeOpacity={0.7}
          className="w-full py-3 items-center"
        >
          <Text className="text-slate-400 text-sm">Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({
  totalScanned,
  onBackPress,
}: {
  readonly totalScanned: number;
  readonly onBackPress: () => void;
}): React.JSX.Element {
  return (
    <Animated.View
      entering={FadeInDown.springify()}
      className="flex-1 items-center justify-center"
    >
      <View className="w-20 h-20 rounded-full bg-slate-800 items-center justify-center mb-6">
        <Ionicons name="search-outline" size={40} color={palette.slate[400]} />
      </View>

      <Text className="text-xl font-bold text-white mb-2">
        No Transactions Found
      </Text>
      <Text className="text-sm text-slate-400 text-center mb-4">
        Scanned {totalScanned.toLocaleString()} messages
      </Text>

      {/* ── Reasons Card ────────────────────────────────────── */}
      <View className="bg-slate-800 rounded-2xl p-4 w-full mb-8">
        <Text className="text-sm font-semibold text-slate-300 mb-3">
          Possible Reasons
        </Text>
        <ReasonBullet text="No bank SMS found from supported senders" />
        <ReasonBullet text="Messages may be too old or already synced" />
        <ReasonBullet text="SMS format not recognized" />
      </View>

      <View className="w-full">
        <TouchableOpacity
          onPress={onBackPress}
          activeOpacity={0.85}
          className="w-full py-4 rounded-2xl bg-slate-800 items-center"
        >
          <Text className="text-slate-300 text-sm font-semibold">
            Back to Dashboard
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

function ErrorState({
  error,
  onRetryPress,
  onBackPress,
}: {
  readonly error: string | null;
  readonly onRetryPress: () => void;
  readonly onBackPress: () => void;
}): React.JSX.Element {
  return (
    <Animated.View
      entering={FadeInDown.springify()}
      className="flex-1 items-center justify-center"
    >
      {/* Error icon */}
      <View
        className="w-20 h-20 rounded-full items-center justify-center mb-6"
        // eslint-disable-next-line react-native/no-inline-styles
        style={{ backgroundColor: `${palette.red[500]}20` }}
      >
        <Ionicons name="warning-outline" size={36} color={palette.red[500]} />
      </View>

      <Text className="text-xl font-bold text-white mb-2">Scan Failed</Text>

      {/* Error detail card */}
      <View className="bg-slate-800 rounded-2xl p-4 w-full mb-4">
        <View className="flex-row items-start">
          <View
            className="w-2 h-2 rounded-full mt-1.5 mr-2"
            // eslint-disable-next-line react-native/no-inline-styles
            style={{ backgroundColor: palette.red[500] }}
          />
          <Text className="text-sm text-slate-300 flex-1 leading-5">
            {error ??
              "An unexpected error occurred while scanning SMS messages."}
          </Text>
        </View>
      </View>

      <Text className="text-sm text-slate-400 text-center mb-8 px-4">
        Please check your SMS permissions in Settings and try again.
      </Text>

      {/* Actions */}
      <View className="w-full">
        <TouchableOpacity
          onPress={onRetryPress}
          activeOpacity={0.85}
          className="w-full py-4 rounded-2xl items-center mb-3"
          // eslint-disable-next-line react-native/no-inline-styles
          style={{ backgroundColor: palette.nileGreen[500] }}
        >
          <Text className="text-white text-sm font-bold">Try Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onBackPress}
          activeOpacity={0.85}
          className="w-full py-4 rounded-2xl bg-slate-800 items-center"
        >
          <Text className="text-slate-300 text-sm font-semibold">
            Back to Dashboard
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Shared UI Atoms
// ---------------------------------------------------------------------------

/** Stat card for the scanning state (Scanned / Found) */
function StatCard({
  icon,
  label,
  value,
  total,
  sublabel,
  valueColor,
}: {
  readonly icon: "mail-outline" | "receipt-outline";
  readonly label: string;
  readonly value: number;
  readonly total?: number;
  readonly sublabel: string;
  readonly valueColor?: string;
}): React.JSX.Element {
  return (
    <View className="flex-1 bg-slate-800 rounded-3xl p-4">
      <View
        className="w-10 h-10 rounded-xl items-center justify-center mb-3"
        // eslint-disable-next-line react-native/no-inline-styles
        style={{ backgroundColor: `${palette.nileGreen[500]}15` }}
      >
        <Ionicons name={icon} size={20} color={palette.nileGreen[400]} />
      </View>
      <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </Text>
      <Text
        className="text-2xl font-bold"
        // eslint-disable-next-line react-native/no-inline-styles
        style={{ color: valueColor ?? "#FFFFFF" }}
      >
        {value.toLocaleString()}
        {total !== undefined && (
          <Text className="text-sm text-slate-500">
            {" / "}
            {total.toLocaleString()}
          </Text>
        )}
      </Text>
      <Text className="text-xs text-slate-400">{sublabel}</Text>
    </View>
  );
}

/** Pipeline step row with status indicator and connector line */
function PipelineStep({
  label,
  status,
  isLast,
}: {
  readonly label: string;
  readonly status: "completed" | "active" | "pending";
  readonly isLast: boolean;
}): React.JSX.Element {
  const statusLabel =
    status === "completed"
      ? "Completed"
      : status === "active"
        ? "Processing..."
        : "Waiting for filter";

  const statusColor =
    status === "completed" || status === "active"
      ? palette.nileGreen[400]
      : palette.slate[500];

  const textColor = status === "pending" ? "text-slate-500" : "text-white";

  return (
    <View className="flex-row">
      {/* Indicator column */}
      <View className="items-center mr-3" style={{ width: 24 }}>
        {status === "completed" ? (
          <View
            className="w-6 h-6 rounded-full items-center justify-center"
            // eslint-disable-next-line react-native/no-inline-styles
            style={{ backgroundColor: palette.nileGreen[500] }}
          >
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </View>
        ) : status === "active" ? (
          <View
            className="w-6 h-6 rounded-full items-center justify-center"
            // eslint-disable-next-line react-native/no-inline-styles
            style={{
              backgroundColor: palette.nileGreen[900],
              borderWidth: 2,
              borderColor: palette.nileGreen[500],
            }}
          >
            <View
              className="w-2 h-2 rounded-full"
              // eslint-disable-next-line react-native/no-inline-styles
              style={{ backgroundColor: palette.nileGreen[500] }}
            />
          </View>
        ) : (
          <View
            className="w-6 h-6 rounded-full"
            // eslint-disable-next-line react-native/no-inline-styles
            style={{
              borderWidth: 2,
              borderColor: palette.slate[600],
              backgroundColor: "transparent",
            }}
          />
        )}

        {/* Connector line */}
        {!isLast && (
          <View
            className="flex-1"
            // eslint-disable-next-line react-native/no-inline-styles
            style={{
              width: 2,
              backgroundColor:
                status === "completed"
                  ? palette.nileGreen[500]
                  : palette.slate[700],
              minHeight: 24,
            }}
          />
        )}
      </View>

      {/* Text column */}
      <View className="flex-1 pb-5">
        <Text className={`text-sm font-medium ${textColor}`}>{label}</Text>
        <Text className="text-xs mt-0.5" style={{ color: statusColor }}>
          {statusLabel}
        </Text>
      </View>
    </View>
  );
}

/** Summary row in the success state results card */
function SummaryRow({
  label,
  value,
  valueColor,
  isLast,
}: {
  readonly label: string;
  readonly value: string;
  readonly valueColor?: string;
  readonly isLast?: boolean;
}): React.JSX.Element {
  return (
    <View
      className={`flex-row items-center justify-between px-5 py-4 ${
        !isLast ? "border-b border-slate-700" : ""
      }`}
    >
      <Text className="text-sm text-slate-400">{label}</Text>
      <Text
        className="text-base font-bold"
        // eslint-disable-next-line react-native/no-inline-styles
        style={{ color: valueColor ?? "#FFFFFF" }}
      >
        {value}
      </Text>
    </View>
  );
}

/** Category chip in the success state */
function CategoryChip({ name }: { readonly name: string }): React.JSX.Element {
  // Resolve systemName to a display-friendly label
  const displayName = formatCategoryName(name);
  const icon = getCategoryIcon(name);

  return (
    <View className="flex-row items-center bg-slate-800 rounded-xl px-3 py-2">
      <Ionicons name={icon} size={14} color={palette.nileGreen[400]} />
      <Text className="text-xs text-white ml-1.5">{displayName}</Text>
    </View>
  );
}

/** Bullet point for the empty state reasons */
function ReasonBullet({ text }: { readonly text: string }): React.JSX.Element {
  return (
    <View className="flex-row items-start mb-2">
      <View
        className="w-1.5 h-1.5 rounded-full mt-1.5 mr-2"
        // eslint-disable-next-line react-native/no-inline-styles
        style={{ backgroundColor: palette.nileGreen[400] }}
      />
      <Text className="text-sm text-slate-400 flex-1">{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats duration from milliseconds to a human-readable string */
function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainderSec = seconds % 60;
  return remainderSec > 0 ? `${minutes}m ${remainderSec}s` : `${minutes}m`;
}

/** Converts a systemName like "food_drinks" to "Food & Drinks" */
function formatCategoryName(systemName: string): string {
  const KNOWN_NAMES: Record<string, string> = {
    food_drinks: "Food & Drinks",
    food_restaurants: "Restaurants",
    food_groceries: "Groceries",
    food_coffee: "Coffee",
    shopping: "Shopping",
    shopping_clothing: "Clothing",
    shopping_electronics: "Electronics",
    transport: "Transport",
    transport_fuel: "Fuel",
    transport_ride: "Rides",
    transport_public: "Public Transit",
    bills_utilities: "Bills & Utilities",
    entertainment: "Entertainment",
    health_medical: "Health",
    education: "Education",
    personal_care: "Personal Care",
    gifts_donations: "Gifts",
    income: "Income",
    income_salary: "Salary",
    transfer: "Transfer",
  };

  if (KNOWN_NAMES[systemName]) return KNOWN_NAMES[systemName];

  // Fallback: capitalize and replace underscores
  return systemName
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Returns an Ionicons icon name for a category systemName */
function getCategoryIcon(
  systemName: string
): React.ComponentProps<typeof Ionicons>["name"] {
  if (systemName.startsWith("food")) return "restaurant-outline";
  if (systemName.startsWith("shopping")) return "bag-outline";
  if (systemName.startsWith("transport")) return "car-outline";
  if (systemName.startsWith("bills")) return "receipt-outline";
  if (systemName.startsWith("entertainment")) return "game-controller-outline";
  if (systemName.startsWith("health")) return "medkit-outline";
  if (systemName.startsWith("education")) return "school-outline";
  if (systemName.startsWith("income")) return "wallet-outline";
  if (systemName.startsWith("transfer")) return "swap-horizontal-outline";
  if (systemName.startsWith("personal")) return "sparkles-outline";
  if (systemName.startsWith("gift")) return "gift-outline";
  return "pricetag-outline";
}
