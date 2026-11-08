export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
// Tax is exclusive and applied after discount. All money math lives here (server-side only).
export function calcTotals(lines, { discountType = 'none', discountValue = 0, taxRate = 0 } = {}) {
  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  let discount = 0;
  if (discountType === 'percent') discount = (subtotal * Math.min(discountValue, 100)) / 100;
  if (discountType === 'fixed') discount = Math.min(discountValue, subtotal);
  discount = round2(discount);
  const tax = round2(((subtotal - discount) * taxRate) / 100);
  return { subtotal, discount, tax, total: round2(subtotal - discount + tax) };
}
