/**
 * The decisions `fetchWithSession` makes per attempt, kept apart from the
 * request loop. Pure: the self-check runs them without a network or a device.
 */

export type FailurePlan =
  /** The source origin refused: refresh the session and ask again */
  | "wash"
  /** Worth the same request again: 5xx and 429 answer differently */
  | "retry"
  /** Another host refused: that host's verdict, never a session problem */
  | "rejected"
  /** Nothing left to try: the caller reads the response */
  | "final";

/**
 * What to do with a non-ok response. A challenge page from the source origin is
 * an auth failure, not a network one; a foreign host runs its own challenge our
 * wash cannot clear, so it is final.
 */
export function failurePlan(input: {
  status: number;
  isSourceOrigin: boolean;
  challengeBody: boolean;
  hasMoreAttempts: boolean;
}): FailurePlan {
  const { status, isSourceOrigin, challengeBody, hasMoreAttempts } = input;

  if (status === 401 || status === 403) {
    return isSourceOrigin ? "wash" : "rejected";
  }
  if ((status >= 500 || status === 429) && hasMoreAttempts) return "retry";
  if (challengeBody && isSourceOrigin) return "wash";
  return "final";
}

/** A timeout says the host is silent: only so many of those are worth waiting. */
export function timeoutPlan(attempt: number, timeoutAttempts: number): "retry" | "final" {
  return attempt + 1 < timeoutAttempts ? "retry" : "final";
}
