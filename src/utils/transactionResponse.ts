/** Trả về thêm shippingAddress = address (FE tương thích). */
export function withShippingAddressAlias<T extends { address: string | null }>(
  row: T
): T & { shippingAddress: string | null } {
  return { ...row, shippingAddress: row.address ?? null };
}

export function mapTransactionsWithShippingAlias<T extends { address: string | null }>(
  rows: T[]
): Array<T & { shippingAddress: string | null }> {
  return rows.map(withShippingAddressAlias);
}
