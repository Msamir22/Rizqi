/**
 * Delete Confirmation Modal
 *
 * Thin wrapper around `ConfirmationModal` with `variant="danger"`.
 * Preserves the legacy API (accepts `count` and computes title + message).
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { ConfirmationModal } from "./ConfirmationModal";

interface DeleteConfirmationModalProps {
  readonly visible: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly count: number;
}

export function DeleteConfirmationModal({
  visible,
  onConfirm,
  onCancel,
  count,
}: DeleteConfirmationModalProps): React.JSX.Element {
  const { t } = useTranslation("common");
  const isPlural = count > 1;

  return (
    <ConfirmationModal
      visible={visible}
      onConfirm={onConfirm}
      onCancel={onCancel}
      variant="danger"
      title={isPlural ? t("delete_transactions") : t("delete_transaction")}
      message={
        isPlural
          ? t("delete_transactions_message", { count })
          : t("delete_transaction_message")
      }
      confirmLabel={t("delete")}
    />
  );
}
