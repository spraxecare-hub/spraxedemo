// lib/utils/category-colors.ts

/**
 * Deterministic, pleasant accent colors for category chips/cards.
 * We avoid Tailwind class generation (dynamic classes) by returning inline styles.
 */

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getCategoryAccent(seed: string | number | null | undefined): {
  border: string;
  background: string;
  shadow: string;
} {
  const s = String(seed ?? 'category');
  const hue = hashString(s) % 360;

  const border = `hsl(${hue} 78% 45%)`;
  const background = `hsl(${hue} 85% 96%)`;
  const shadow = `0 0 0 4px hsla(${hue}, 78%, 45%, 0.14)`;

  return { border, background, shadow };
}
