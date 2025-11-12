"use client";

import { Input } from "./input";
import { useEffect, useState } from "react";

interface TimeInputProps {
  value: number | null; // seconds
  onChange: (seconds: number | null) => void;
  placeholder?: string;
  className?: string;
}

export function TimeInput({ value, onChange, placeholder = "00:00:00", className }: TimeInputProps) {
  const [timeValue, setTimeValue] = useState("");

  useEffect(() => {
    if (value !== null && value !== undefined) {
      const hours = Math.floor(value / 3600);
      const minutes = Math.floor((value % 3600) / 60);
      const seconds = value % 60;
      setTimeValue(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    } else {
      setTimeValue("");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setTimeValue(input);

    // Parse the time input (supports HH:MM:SS, MM:SS, or just SS)
    const parts = input.split(":").map((p) => parseInt(p) || 0);

    let totalSeconds = 0;
    if (parts.length === 3) {
      // HH:MM:SS
      totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // MM:SS
      totalSeconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
      // SS
      totalSeconds = parts[0];
    }

    onChange(totalSeconds || null);
  };

  return (
    <Input
      type="text"
      value={timeValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
}
