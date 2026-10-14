import { Label } from "@/components/ui/label";

export function Field({
  id,
  label,
  errors,
  hint,
  children,
}: {
  id: string;
  label: string;
  errors?: string[];
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {errors?.length ? (
        <p id={`${id}-error`} className="text-sm text-destructive">{errors[0]}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
