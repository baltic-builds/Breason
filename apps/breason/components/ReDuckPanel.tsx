"use client";

import { useMemo } from "react";
import { PillButton } from "@breason/ui";

export function CheckWithReDuckButton({ text, market }: { text: string; market: string }) {
  const href = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_REDUCK_URL ?? "http://localhost:3001";
    const params = new URLSearchParams({ text, market });
    return `${base}/?${params.toString()}`;
  }, [market, text]);

  return (
    <a href={href} target="_blank" rel="noreferrer">
      <PillButton tone="lime">Check with ReDuck 🦆</PillButton>
    </a>
  );
}
