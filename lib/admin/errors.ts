/*
 * Admin error types.
 *
 * Lives outside any "use server" module so it can be imported by both server
 * actions and the error boundary client component.
 */

/** Thrown when admin form input fails Zod parse. Caught by app/admin/error.tsx. */
export class AdminValidationError extends Error {
  readonly fieldErrors: Record<string, string[]>;
  constructor(
    fieldErrors: Record<string, string[]>,
    message = "Invalid form data",
  ) {
    super(message);
    this.name = "AdminValidationError";
    this.fieldErrors = fieldErrors;
  }
}
