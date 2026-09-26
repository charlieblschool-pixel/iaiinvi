// Feature switches for things that aren't ready for customers yet.

/**
 * Automatic reordering (auto-charging a card and placing vendor orders).
 * While false: the toggles show "Coming soon", the API refuses to turn it
 * on, and the engine never charges — it only queues suggestions.
 */
export const AUTO_REORDER_LIVE = false;
