/** Trạng thái giao hàng do seller cập nhật (sau khi thanh toán đủ & xe sold). */
export const DELIVERY_STATUSES = ['preparing', 'delivering', 'delivered'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function stalePendingTransactionDays(): number {
  return parseEnvInt('STALE_PENDING_TRANSACTION_DAYS', 14);
}

export function autoConfirmReceiptDays(): number {
  return parseEnvInt('AUTO_CONFIRM_RECEIPT_DAYS', 7);
}

/** Khoảng chạy batch job (phút). */
export function fulfillmentJobIntervalMs(): number {
  return parseEnvInt('FULFILLMENT_JOB_INTERVAL_MINUTES', 5) * 60 * 1000;
}
