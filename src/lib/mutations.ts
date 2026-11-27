/**
 * Row level security filters rows out of updates and deletes without an error. Callers select the
 * affected rows and pass them here, so "nothing happened" is never reported as success (5.7).
 */
export function assertChanged(rows: unknown[] | null | undefined, subject: string) {
  if (!rows?.length) {
    throw new Error(
      `${subject} was not changed. It may no longer exist, or you may not have permission.`,
    );
  }
}
