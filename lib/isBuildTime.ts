// True when running during `next build` (production build phase).
// Useful to prevent external network calls that can make builds flaky.
export const isBuildTime =
  process.env.NEXT_PHASE === 'phase-production-build';
