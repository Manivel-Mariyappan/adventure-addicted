const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const inrPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// ₹1,250 / ₹1,250.50, with Indian grouping (₹1,23,456)
export function formatInr(value: number): string {
  return (Number.isInteger(value) ? inrWhole : inrPaise).format(value);
}

// Money is kept in rupees with at most 2 decimals; round after every multiplication.
export const roundMoney = (value: number): number => Math.round(value * 100) / 100;
