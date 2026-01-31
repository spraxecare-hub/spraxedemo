export type SizeMeasurement = {
  label: string;
  value: string;
};

export type SizeOption = {
  size: string;
  measurements: SizeMeasurement[];
};

export const DEFAULT_SIZE_OPTIONS = ['S', 'M', 'L', 'XL', 'XXL'];

const toTrimmedString = (value: unknown) => String(value ?? '').trim();

export const parseSizeChart = (raw: unknown): SizeOption[] => {
  if (!raw) return [];

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const maybe = parsed as { sizes?: unknown };
    if (Array.isArray(maybe.sizes)) parsed = maybe.sizes;
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry) => {
      const size = toTrimmedString((entry as any)?.size);
      const measurements = Array.isArray((entry as any)?.measurements)
        ? (entry as any).measurements
            .map((m: any) => ({
              label: toTrimmedString(m?.label),
              value: toTrimmedString(m?.value),
            }))
            .filter((m: SizeMeasurement) => m.label || m.value)
        : [];
      return { size, measurements };
    })
    .filter((entry) => entry.size);
};

export const sanitizeSizeChart = (entries: SizeOption[]): SizeOption[] =>
  (entries || [])
    .map((entry) => ({
      size: toTrimmedString(entry.size),
      measurements: (entry.measurements || [])
        .map((m) => ({ label: toTrimmedString(m.label), value: toTrimmedString(m.value) }))
        .filter((m) => m.label && m.value),
    }))
    .filter((entry) => entry.size);
