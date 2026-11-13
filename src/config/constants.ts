/**
 * Identifier for the status bar entry
 */
export const STATUS_KEY = "tokenSpeed";

/**
 * Maximum number of dead timestamp entries before compacting the array.
 */
export const COMPACTION_THRESHOLD = 5000;

/**
 * Minimum sliding window duration (ms) — 100ms is the smallest meaningful window
 */
export const MIN_SLIDING_WINDOW = 100;

/**
 * Maximum sliding window duration (ms) — 30s is the largest practical window
 */
export const MAX_SLIDING_WINDOW = 30000;

/**
 * How often (ms) the live TPS is sampled for the rolling average.
 */
export const ROLLING_AVERAGE_SAMPLE_MS = 300;

/**
 * Maximum number of live TPS samples kept for the rolling average, which
 * also caps the configurable rolling-average size (100 × 300 ms = 30 s).
 */
export const MAX_ROLLING_AVERAGE = 100;
