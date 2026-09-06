import { PackageInfo } from "../../types/parcel";
import { Field } from "../shared/Field";

interface Props {
  value: PackageInfo;
  errors: Record<string, string>;
  onChange: (field: keyof PackageInfo, value: string | number) => void;
}

const CATEGORIES: { value: PackageInfo["category"]; label: string }[] = [
  { value: "DOCUMENT", label: "Tài liệu / giấy tờ" },
  { value: "CLOTHING", label: "Quần áo" },
  { value: "ELECTRONICS", label: "Điện tử" },
  { value: "FOOD", label: "Thực phẩm" },
  { value: "OTHER", label: "Khác" },
];

export function StepPackageInfo({ value, errors, onChange }: Props) {
  return (
    <div>
      <Field label="Loại hàng">
        <select value={value.category} onChange={(e) => onChange("category", e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="field-row">
        <Field label="Cân nặng (kg)" error={errors.weightKg}>
          <input
            type="number"
            min={0}
            step={0.1}
            value={value.weightKg || ""}
            onChange={(e) => onChange("weightKg", Number(e.target.value))}
          />
        </Field>
        <Field label="Dài (cm)" error={errors.lengthCm}>
          <input
            type="number"
            min={0}
            value={value.lengthCm || ""}
            onChange={(e) => onChange("lengthCm", Number(e.target.value))}
          />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Rộng (cm)" error={errors.widthCm}>
          <input
            type="number"
            min={0}
            value={value.widthCm || ""}
            onChange={(e) => onChange("widthCm", Number(e.target.value))}
          />
        </Field>
        <Field label="Cao (cm)" error={errors.heightCm}>
          <input
            type="number"
            min={0}
            value={value.heightCm || ""}
            onChange={(e) => onChange("heightCm", Number(e.target.value))}
          />
        </Field>
      </div>

      <Field label="Ghi chú (không bắt buộc)">
        <textarea
          rows={2}
          value={value.note ?? ""}
          onChange={(e) => onChange("note", e.target.value)}
          placeholder="VD: Hàng dễ vỡ, giao giờ hành chính..."
        />
      </Field>
    </div>
  );
}
