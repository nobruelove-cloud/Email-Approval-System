import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

export function formatIndonesianNumber(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === "") return "";
  const numStr = String(val).replace(/\D/g, "");
  if (!numStr) return "";
  const cleanedNum = String(Number(numStr));
  return cleanedNum.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseFormattedNumber(val: string): number {
  const digitsOnly = val.replace(/\D/g, "");
  if (!digitsOnly) return 0;
  return Number(digitsOnly);
}

interface FormattedNumberInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> {
  value: number;
  onChange: (val: number) => void;
}

export function FormattedNumberInput({ value, onChange, className, ...props }: FormattedNumberInputProps) {
  const [displayValue, setDisplayValue] = useState<string>(() => formatIndonesianNumber(value));

  useEffect(() => {
    const currentNumeric = parseFormattedNumber(displayValue);
    if (currentNumeric !== value) {
      setDisplayValue(formatIndonesianNumber(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digitsOnly = rawVal.replace(/\D/g, "");
    if (!digitsOnly) {
      setDisplayValue("");
      onChange(0);
      return;
    }

    const cleanDigits = String(BigInt(digitsOnly));
    const formatted = cleanDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const numericValue = Number(cleanDigits);

    setDisplayValue(formatted);
    onChange(numericValue);
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      className={className}
    />
  );
}
