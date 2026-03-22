/**
 * BudgetForm Component
 *
 * Shared form for creating and editing budgets.
 * Handles name, type toggle, category picker, amount, period selector,
 * custom date range (conditional), alert threshold slider, and validation.
 *
 * Architecture & Design Rationale:
 * - Pattern: Smart Form Component (Composition)
 * - Why: Reused by create-budget.tsx in both create and edit mode.
 * - SOLID: SRP — manages form state and validation only.
 *
 * @module BudgetForm
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useCategories } from "@/hooks/useCategories";
import { CategorySelectorModal } from "@/components/modals/CategorySelectorModal";
import { AlertThresholdSlider } from "./AlertThresholdSlider";
import type { Budget, BudgetPeriod, BudgetType } from "@astik/db";
import {
  createBudget,
  updateBudget,
  type CreateBudgetInput,
  type UpdateBudgetInput,
} from "@/services/budget-service";
import { useToast } from "@/components/ui/Toast";
import { router } from "expo-router";
import { useCategoryLookup } from "@/context/CategoriesContext";
import DateTimePicker from "@react-native-community/datetimepicker";

// =============================================================================
// Types
// =============================================================================

interface BudgetFormProps {
  /** Existing budget for edit mode (undefined = create mode) */
  readonly existingBudget?: Budget;
}

interface FormState {
  name: string;
  type: BudgetType;
  categoryId: string;
  amount: string;
  period: BudgetPeriod;
  periodStart: Date;
  periodEnd: Date;
  alertThreshold: number;
}

interface FormErrors {
  name?: string;
  amount?: string;
  category?: string;
  period?: string;
  general?: string;
}

// =============================================================================
// Constants
// =============================================================================

const PERIODS: Array<{ key: BudgetPeriod; label: string }> = [
  { key: "WEEKLY", label: "Weekly" },
  { key: "MONTHLY", label: "Monthly" },
  { key: "CUSTOM", label: "Custom" },
];

const DEFAULT_THRESHOLD = 80;

// =============================================================================
// Component
// =============================================================================

export function BudgetForm({
  existingBudget,
}: BudgetFormProps): React.JSX.Element {
  const isEditMode = !!existingBudget;
  const { isDark } = useTheme();
  const { expenseCategories } = useCategories();
  const categoryMap = useCategoryLookup();
  const { showToast } = useToast();

  // ── Form state ──
  const [form, setForm] = useState<FormState>(() => ({
    name: existingBudget?.name ?? "",
    type: existingBudget?.type ?? "CATEGORY",
    categoryId: existingBudget?.categoryId ?? "",
    amount: existingBudget?.amount?.toString() ?? "",
    period: existingBudget?.period ?? "MONTHLY",
    periodStart: existingBudget?.periodStart ?? new Date(),
    periodEnd: existingBudget?.periodEnd ?? new Date(),
    alertThreshold: existingBudget?.alertThreshold ?? DEFAULT_THRESHOLD,
  }));

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const selectedCategory = form.categoryId
    ? categoryMap.get(form.categoryId)
    : null;

  // ── Field updaters ──
  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]): void => {
      setForm((prev) => ({ ...prev, [key]: value }));

      // Map form keys to their corresponding FormErrors keys
      const errorKeyMap: Partial<Record<keyof FormState, keyof FormErrors>> = {
        categoryId: "category",
        periodStart: "period",
        periodEnd: "period",
      };
      const errorKey = errorKeyMap[key] ?? (key as keyof FormErrors);

      setErrors((prev) => ({
        ...prev,
        [errorKey]: undefined,
        general: undefined,
      }));
    },
    []
  );

  // ── Auto-clear category when switching to Global ──
  useEffect(() => {
    if (form.type === "GLOBAL") {
      setForm((prev) => ({ ...prev, categoryId: "" }));
    }
  }, [form.type]);

  // ── Validation ──
  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!form.name.trim()) {
      newErrors.name = "Budget name is required";
    }

    const parsedAmount = parseFloat(form.amount);
    if (!form.amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = "Enter a valid amount greater than 0";
    }

    if (form.type === "CATEGORY" && !form.categoryId) {
      newErrors.category = "Select a category";
    }

    if (form.period === "CUSTOM") {
      if (form.periodEnd.getTime() <= form.periodStart.getTime()) {
        newErrors.period = "End date must be after start date";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  // ── Submit ──
  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (isEditMode && existingBudget) {
        // Edit mode
        const input: UpdateBudgetInput = {
          name: form.name.trim(),
          amount: parseFloat(form.amount),
          period: form.period,
          alertThreshold: form.alertThreshold,
          ...(form.period === "CUSTOM" && {
            periodStart: form.periodStart,
            periodEnd: form.periodEnd,
          }),
          ...(form.type === "CATEGORY" && {
            categoryId: form.categoryId,
          }),
        };

        await updateBudget(existingBudget.id, input);
        showToast({
          type: "success",
          title: "Updated",
          message: "Budget updated successfully",
        });
      } else {
        const input: CreateBudgetInput = {
          name: form.name.trim(),
          type: form.type,
          categoryId: form.type === "CATEGORY" ? form.categoryId : undefined,
          amount: parseFloat(form.amount),
          period: form.period,
          alertThreshold: form.alertThreshold,
          ...(form.period === "CUSTOM" && {
            periodStart: form.periodStart,
            periodEnd: form.periodEnd,
          }),
        };

        await createBudget(input);
        showToast({
          type: "success",
          title: "Created",
          message: "Budget created successfully",
        });
      }

      router.back();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  }, [validate, isEditMode, existingBudget, form, showToast]);

  return (
    <ScrollView
      className="flex-1 px-5"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* ─── S-09: Field order: Type → Name → Category → Amount → Period → Alert ─── */}

      {/* General Error */}
      {errors.general ? (
        <View className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl mb-4">
          <Text className="text-red-600 dark:text-red-400 text-sm font-medium">
            {errors.general}
          </Text>
        </View>
      ) : null}

      {/* Budget Type (hidden in edit mode) — S-08: icon-bearing cards */}
      {!isEditMode && (
        <View className="mb-5">
          <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2">
            Budget Type
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => updateField("type", "CATEGORY")}
              accessibilityRole="button"
              accessibilityLabel="Category budget type"
              accessibilityState={{ selected: form.type === "CATEGORY" }}
              className={`flex-1 rounded-2xl items-center justify-center border bg-white dark:bg-slate-800 ${
                form.type === "CATEGORY"
                  ? ""
                  : "border-slate-200 dark:border-slate-700"
              }`}
              style={[
                { height: 80 },
                form.type === "CATEGORY"
                  ? { borderColor: palette.nileGreen[500], borderWidth: 2 }
                  : undefined,
              ]}
            >
              <Ionicons
                name="grid-outline"
                size={24}
                color={
                  form.type === "CATEGORY"
                    ? palette.nileGreen[500]
                    : isDark
                      ? palette.slate[400]
                      : palette.slate[500]
                }
              />
              <Text
                className={`text-sm font-bold mt-2 ${
                  form.type === "CATEGORY"
                    ? ""
                    : "text-slate-600 dark:text-slate-300"
                }`}
                style={
                  form.type === "CATEGORY"
                    ? { color: palette.nileGreen[500] }
                    : undefined
                }
              >
                Category
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => updateField("type", "GLOBAL")}
              accessibilityRole="button"
              accessibilityLabel="Global budget type"
              accessibilityState={{ selected: form.type === "GLOBAL" }}
              className={`flex-1 rounded-2xl items-center justify-center border bg-white dark:bg-slate-800 ${
                form.type === "GLOBAL"
                  ? ""
                  : "border-slate-200 dark:border-slate-700"
              }`}
              style={[
                { height: 80 },
                form.type === "GLOBAL"
                  ? { borderColor: palette.nileGreen[500], borderWidth: 2 }
                  : undefined,
              ]}
            >
              <Ionicons
                name="earth-outline"
                size={24}
                color={
                  form.type === "GLOBAL"
                    ? palette.nileGreen[500]
                    : isDark
                      ? palette.slate[400]
                      : palette.slate[500]
                }
              />
              <Text
                className={`text-sm font-bold mt-2 ${
                  form.type === "GLOBAL"
                    ? ""
                    : "text-slate-600 dark:text-slate-300"
                }`}
                style={
                  form.type === "GLOBAL"
                    ? { color: palette.nileGreen[500] }
                    : undefined
                }
              >
                Global
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Budget Name */}
      <View className="mb-5">
        <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2">
          Budget Name
        </Text>
        <TextInput
          value={form.name}
          onChangeText={(v) => updateField("name", v)}
          placeholder="e.g., Monthly Food Budget"
          placeholderTextColor={
            isDark ? palette.slate[600] : palette.slate[400]
          }
          className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-base text-slate-800 dark:text-white font-medium"
        />
        {errors.name ? (
          <Text className="text-red-500 text-xs font-medium mt-1">
            {errors.name}
          </Text>
        ) : null}
      </View>

      {/* Category Picker (only for CATEGORY type) */}
      {form.type === "CATEGORY" && (
        <View className="mb-5">
          <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2">
            Category
          </Text>
          <TouchableOpacity
            onPress={() => setIsCategoryModalOpen(true)}
            activeOpacity={0.7}
            className="flex-row items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700"
          >
            <Ionicons
              name="grid-outline"
              size={18}
              color={isDark ? palette.slate[400] : palette.slate[500]}
            />
            <Text
              numberOfLines={1}
              className="flex-1 ml-3 text-base font-medium text-slate-800 dark:text-white"
            >
              {selectedCategory?.displayName ?? "Select a category"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={isDark ? palette.slate[500] : palette.slate[400]}
            />
          </TouchableOpacity>
          {errors.category ? (
            <Text className="text-red-500 text-xs font-medium mt-1">
              {errors.category}
            </Text>
          ) : null}
        </View>
      )}

      {/* Amount — S-10: EGP prefix */}
      <View className="mb-5">
        <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2">
          Budget Limit
        </Text>
        <View className="flex-row items-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <Text
            className="text-base font-bold pl-4"
            style={{ color: palette.nileGreen[500] }}
          >
            EGP
          </Text>
          <TextInput
            value={form.amount}
            onChangeText={(v) => updateField("amount", v)}
            placeholder="0.00"
            placeholderTextColor={
              isDark ? palette.slate[600] : palette.slate[400]
            }
            keyboardType="decimal-pad"
            className="flex-1 p-4 text-base text-slate-800 dark:text-white font-medium"
          />
        </View>
        {errors.amount ? (
          <Text className="text-red-500 text-xs font-medium mt-1">
            {errors.amount}
          </Text>
        ) : null}
      </View>

      {/* Period */}
      <View className="mb-5">
        <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2">
          Period
        </Text>
        <View className="flex-row gap-2">
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              onPress={() => updateField("period", p.key)}
              className={`flex-1 py-3 rounded-2xl items-center ${
                form.period === p.key ? "" : "bg-slate-100 dark:bg-slate-800"
              }`}
              style={
                form.period === p.key
                  ? { backgroundColor: palette.nileGreen[500] }
                  : undefined
              }
            >
              <Text
                className={`text-sm font-bold ${
                  form.period === p.key
                    ? "text-white"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Custom date range */}
      {form.period === "CUSTOM" && (
        <View className="mb-5">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2">
                Start Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowStartPicker(true)}
                className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700"
              >
                <Text className="text-sm font-medium text-slate-800 dark:text-white">
                  {form.periodStart.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2">
                End Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowEndPicker(true)}
                className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700"
              >
                <Text className="text-sm font-medium text-slate-800 dark:text-white">
                  {form.periodEnd.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          {errors.period ? (
            <Text className="text-red-500 text-xs font-medium mt-1">
              {errors.period}
            </Text>
          ) : null}

          {showStartPicker && (
            <DateTimePicker
              value={form.periodStart}
              mode="date"
              display="default"
              onChange={(_, date) => {
                setShowStartPicker(false);
                if (date) updateField("periodStart", date);
              }}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              value={form.periodEnd}
              mode="date"
              display="default"
              minimumDate={form.periodStart}
              onChange={(_, date) => {
                setShowEndPicker(false);
                if (date) updateField("periodEnd", date);
              }}
            />
          )}
        </View>
      )}

      {/* Alert Threshold */}
      <View className="mb-8">
        <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2">
          Alert When Spending Reaches
        </Text>
        <AlertThresholdSlider
          value={form.alertThreshold}
          onValueChange={(v) => updateField("alertThreshold", v)}
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        onPress={() => void handleSubmit()}
        disabled={isSubmitting}
        activeOpacity={0.85}
        className="rounded-2xl py-4 items-center"
        style={{ backgroundColor: palette.nileGreen[500] }}
      >
        {isSubmitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-base font-bold text-white">
            {isEditMode ? "Save Changes" : "Create Budget"}
          </Text>
        )}
      </TouchableOpacity>

      {/* Category Modal */}
      <CategorySelectorModal
        visible={isCategoryModalOpen}
        rootCategories={expenseCategories}
        selectedId={form.categoryId}
        type="EXPENSE"
        onSelect={(id) => updateField("categoryId", id)}
        onClose={() => setIsCategoryModalOpen(false)}
      />
    </ScrollView>
  );
}
