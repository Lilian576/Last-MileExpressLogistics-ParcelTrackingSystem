import { ReactNode } from "react";

interface FieldProps {
  label: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, error, children }: FieldProps) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
