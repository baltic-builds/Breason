import { createElement, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #E2E8F0",
  borderRadius: 20,
  padding: 20,
  boxShadow: "0 2px 10px rgba(15,23,42,0.06)"
};

export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return createElement(
    "div",
    { style: { display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh", background: "#F6F9FC" } },
    createElement("aside", { style: { background: "#00A2FF", color: "#fff", padding: 20 } }, sidebar),
    createElement("main", { style: { padding: 28 } }, children)
  );
}

export function Card({ title, children, style }: { title: string; children: ReactNode; style?: CSSProperties }) {
  return createElement(
    "section",
    { style: { ...cardStyle, ...style } },
    createElement("p", { style: { margin: "0 0 14px", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "#64748B", fontWeight: 700 } }, title),
    children
  );
}

export function PillButton({ children, tone = "primary", style, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "lime" | "ghost" }) {
  const bg = tone === "lime" ? "#7CFF00" : tone === "ghost" ? "transparent" : "#00A2FF";
  const border = tone === "ghost" ? "1px solid #CBD5E1" : "none";
  return createElement(
    "button",
    {
      ...props,
      style: {
        borderRadius: 999,
        background: bg,
        border,
        color: "#0F172A",
        padding: "10px 16px",
        fontWeight: 700,
        cursor: "pointer",
        ...style
      }
    },
    children
  );
}

export function MetricPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return createElement(
    "div",
    { style: { borderRadius: 999, background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "8px 12px", display: "inline-flex", gap: 8, alignItems: "center" } },
    createElement("span", { style: { color: "#64748B", fontSize: 12 } }, label),
    createElement("strong", { style: { color } }, String(value))
  );
}

export function Input(props: HTMLAttributes<HTMLInputElement> & { value?: string; onChange?: (event: any) => void }) {
  return createElement("input", {
    ...props,
    style: { width: "100%", borderRadius: 12, border: "1px solid #CBD5E1", padding: "10px 12px", ...(props.style ?? {}) }
  });
}

export function Select(props: HTMLAttributes<HTMLSelectElement> & { value?: string; onChange?: (event: any) => void }) {
  return createElement("select", {
    ...props,
    style: { width: "100%", borderRadius: 12, border: "1px solid #CBD5E1", padding: "10px 12px", background: "#fff", ...(props.style ?? {}) }
  });
}

export function TextArea(props: HTMLAttributes<HTMLTextAreaElement> & { value?: string; onChange?: (event: any) => void }) {
  return createElement("textarea", {
    ...props,
    style: { width: "100%", borderRadius: 12, border: "1px solid #CBD5E1", padding: "12px", minHeight: 150, ...(props.style ?? {}) }
  });
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return createElement(
    "div",
    { style: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "grid", placeItems: "center", padding: 20, zIndex: 50 } },
    createElement(
      "div",
      { style: { width: "min(720px, 100%)", background: "#fff", borderRadius: 20, border: "1px solid #E2E8F0", padding: 20 } },
      createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } },
        createElement("h3", { style: { margin: 0 } }, title),
        createElement(PillButton, { tone: "ghost", onClick: onClose }, "Close")
      ),
      children
    )
  );
}

export function Skeleton({ height = 16 }: { height?: number }) {
  return createElement("div", { style: { height, borderRadius: 8, background: "linear-gradient(90deg,#eef2f7,#f8fafc,#eef2f7)", backgroundSize: "200% 100%", animation: "pulse 1.3s ease infinite" } });
}
