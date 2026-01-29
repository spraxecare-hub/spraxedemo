export type ColorVariantLike = {
  id: string;
  // Preferred grouping signal (all color variants share the same group id)
  color_group_id?: string | null;
  color_name?: string | null;
  color_hex?: string | null;
  // Optional fields used for best-effort grouping when color_group_id is missing in a query result
  name?: string | null;
  slug?: string | null;
  category_id?: string | null;
};

function normLower(v: any): string {
  return String(v ?? '').trim().toLowerCase();
}

function isBaseVariant(p: ColorVariantLike): boolean {
  const name = String(p.color_name ?? '').trim();
  return name.length === 0;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function simpleSlug(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripColorSuffix(name: string, colorName?: string | null): string {
  const n0 = String(name || '').trim();
  if (!n0) return '';

  const c = String(colorName ?? '').trim();
  if (!c) return n0;

  const ce = escapeRegExp(c);
  // Common patterns: "Product - Red", "Product (Red)", "Product [Red]"
  let n = n0
    .replace(new RegExp(`\\s*[-–—]\\s*${ce}\\s*$`, 'i'), '')
    .replace(new RegExp(`\\s*\\(${ce}\\)\\s*$`, 'i'), '')
    .replace(new RegExp(`\\s*\\[${ce}\\]\\s*$`, 'i'), '')
    .trim();

  // If the color name appears twice (rare but happens), trim again.
  n = n
    .replace(new RegExp(`\\s*[-–—]\\s*${ce}\\s*$`, 'i'), '')
    .trim();

  return n || n0;
}

function makeGroupKey(item: ColorVariantLike): string {
  const gid = String(item.color_group_id ?? '').trim();
  const id = String(item.id ?? '').trim();

  // If color_group_id is set to self id (the DB backfill default), it doesn't help us
  // dedupe "same product, different color" cases created as separate rows.
  // In that case, fall back to name/slug heuristics.
  if (gid && gid !== id) return `gid:${gid}`;

  // Best-effort fallback if a query doesn't select color_group_id.
  const baseName = stripColorSuffix(String(item.name ?? ''), item.color_name);
  const nameKey = normLower(baseName);
  // De-dupe by name (requested: show a single card even if the same product appears in multiple categories)
  if (nameKey) return `name:${nameKey}`;

  const slugRaw = String(item.slug ?? '').trim();
  if (slugRaw) {
    const cSlug = simpleSlug(String(item.color_name ?? ''));
    const baseSlug = cSlug && slugRaw.toLowerCase().endsWith(`-${cSlug}`)
      ? slugRaw.slice(0, -1 * (cSlug.length + 1))
      : slugRaw;
    const slugKey = normLower(baseSlug);
    if (slugKey) return `slug:${slugKey}`;
  }

  return `id:${String(item.id)}`;
}

/**
 * De-dupe products so a single product with multiple color variants only shows once in listings.
 *
 * Priority:
 * 1) `color_group_id` (most reliable)
 * 2) fallback key: product name/slug (best-effort when the query doesn't select `color_group_id`, or when it's backfilled to self)
 */
export function dedupeByColorGroup<T extends ColorVariantLike>(items: T[]): T[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const chosen = new Map<string, T>();
  const order: string[] = [];

  for (const item of items) {
    const key = makeGroupKey(item);

    if (!chosen.has(key)) {
      chosen.set(key, item);
      order.push(key);
      continue;
    }

    const existing = chosen.get(key)!;
    // Prefer the base product row when duplicates exist.
    if (isBaseVariant(item) && !isBaseVariant(existing)) {
      chosen.set(key, item);
    }
  }

  return order.map((k) => chosen.get(k)!).filter(Boolean);
}
