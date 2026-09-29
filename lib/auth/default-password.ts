// The password a TPO-created student account starts with.
//
// Default is the student's own enrollment number. That is deliberately
// per-student rather than one shared college-wide password: a shared value
// means anyone who learns it can sign in as ANY student who hasn't logged
// in yet, whereas an enrollment number only ever opens one account — and
// the student already knows theirs, so nothing has to be communicated.
//
// It is still guessable (enrollment numbers run in sequence), which is why
// `User.mustChangePassword` is set at the same time: the dashboard refuses
// to load anything until the student replaces it. The starter password is
// usable exactly once.
//
// Set DEFAULT_STUDENT_PASSWORD to override with a fixed value if your
// process needs one — accepting that it is then shared across accounts.

export function defaultStudentPassword(enrollmentNumber: string): string {
  const configured = process.env.DEFAULT_STUDENT_PASSWORD?.trim();
  if (configured) return configured;
  return enrollmentNumber.trim();
}

/** What to tell the student, for the TPO to pass on. */
export function defaultPasswordHint(): string {
  return process.env.DEFAULT_STUDENT_PASSWORD?.trim()
    ? "the password your placement cell set"
    : "your enrollment number";
}
