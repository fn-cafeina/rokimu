import { logger } from "./logger";

/** Runs a write and rolls the optimistic state back if storage rejects it. */
export async function persistWithRollback(
  persist: () => Promise<void>,
  rollback: () => void,
  tag: string,
): Promise<void> {
  try {
    await persist();
  } catch (error) {
    rollback();
    logger.error(tag, "Failed to persist", error);
  }
}
