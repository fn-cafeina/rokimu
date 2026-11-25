/**
 * Which files an interrupted download may reuse. Pure: the rule that decides
 * whether a folder is playable runs in its self-check without a device.
 *
 * The marker names the format version and the server that wrote the segments.
 * Two servers segment the same episode differently, so resuming with a second
 * one splices unrelated bytes together and the episode plays garbage past the
 * seam while the app reports it as complete.
 */
export const FORMAT_VERSION = "aes-key-v1";

export function markerFor(server: { id: string }): string {
  return `${FORMAT_VERSION}:${server.id}`;
}

/** Resume keeps the files on disk only when the same server wrote them. */
export function canResumeFolder(resume: boolean, marker: string | null, expected: string): boolean {
  return resume && marker != null && marker.trim() === expected;
}
