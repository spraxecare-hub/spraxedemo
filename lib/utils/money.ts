export function bdt(n: number) {
  return `৳${(n || 0).toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}
