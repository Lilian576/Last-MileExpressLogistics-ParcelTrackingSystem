import { Address } from "../../types/parcel";
import { Field } from "../shared/Field";

interface Props {
  sender: Address;
  receiver: Address;
  errors: Record<string, string>;
  onChange: (which: "sender" | "receiver", field: keyof Address, value: string) => void;
}

const PROVINCES = [
  "TP. Hồ Chí Minh",
  "Hà Nội",
  "Đà Nẵng",
  "Cần Thơ",
  "Hải Phòng",
  "Bình Dương",
  "Đồng Nai",
  "Khánh Hòa",
];

function AddressForm({
  title,
  value,
  prefix,
  errors,
  onChange,
}: {
  title: string;
  value: Address;
  prefix: "sender" | "receiver";
  errors: Record<string, string>;
  onChange: Props["onChange"];
}) {
  return (
    <div>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, marginBottom: 12 }}>{title}</h3>
      <Field label="Họ tên" error={errors[`${prefix}.fullName`]}>
        <input
          value={value.fullName}
          onChange={(e) => onChange(prefix, "fullName", e.target.value)}
          placeholder="Nguyễn Văn A"
        />
      </Field>
      <div className="field-row">
        <Field label="Số điện thoại" error={errors[`${prefix}.phone`]}>
          <input
            value={value.phone}
            onChange={(e) => onChange(prefix, "phone", e.target.value)}
            placeholder="09xxxxxxxx"
          />
        </Field>
        <Field label="Tỉnh / Thành phố" error={errors[`${prefix}.province`]}>
          <select value={value.province} onChange={(e) => onChange(prefix, "province", e.target.value)}>
            <option value="">-- Chọn --</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Địa chỉ chi tiết" error={errors[`${prefix}.addressLine`]}>
        <input
          value={value.addressLine}
          onChange={(e) => onChange(prefix, "addressLine", e.target.value)}
          placeholder="Số nhà, đường, phường/xã"
        />
      </Field>
    </div>
  );
}

export function StepSenderReceiver({ sender, receiver, errors, onChange }: Props) {
  return (
    <div>
      <AddressForm title="① Người gửi" value={sender} prefix="sender" errors={errors} onChange={onChange} />
      <hr style={{ border: "none", borderTop: "1px dashed var(--line)", margin: "22px 0" }} />
      <AddressForm title="② Người nhận" value={receiver} prefix="receiver" errors={errors} onChange={onChange} />
    </div>
  );
}
