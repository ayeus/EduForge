export type FormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
  /** Submitted values, echoed back so the form keeps them after React resets it on error. */
  values?: Record<string, string>;
} | null;

/** Text fields from a submission, minus secrets, for re-filling a form after a failed action. */
export function echo(formData: FormData, omit: string[] = ["password"]) {
  const values: Record<string, string> = {};
  for (const [k, v] of formData) {
    if (typeof v === "string" && !k.startsWith("$") && !omit.includes(k)) values[k] = v;
  }
  return values;
}
