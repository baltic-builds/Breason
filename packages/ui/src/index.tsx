import type { ButtonHTMLAttributes, ReactNode } from "react";

export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "264px 1fr", minHeight: "100vh", background: "#f7f9fc" }}>
      <aside style={{ background: "#00A2FF", color: "#fff", padding: 20 }}>{sidebar}</aside>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ background: "#fff", border: "1px solid #e6ecf4", borderRadius: 18, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: 13, letterSpacing: ".04em", textTransform: "uppercase", color: "#6f7b8c" }}>{title}</h3>
      {children}
    </section>
  );
}

export function PillButton({ children, tone = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "lime" | "ghost" }) {
  const bg = tone === "lime" ? "#7CFF00" : tone === "ghost" ? "transparent" : "#00A2FF";
  const color = tone === "ghost" ? "#0f172a" : "#0f172a";
  return (
    <button
      {...props}
      style={{
        borderRadius: 999,
        border: tone === "ghost" ? "1px solid #d8e0ec" : "none",
        background: bg,
        color,
        padding: "10px 16px",
        fontWeight: 600,
        cursor: "pointer"
      }}
    >
      {children}
    </button>
  );
}

export function Skeleton({ height = 14 }: { height?: number }) {
  return <div style={{ height, borderRadius: 8, background: "linear-gradient(90deg,#edf2f8,#f6f9fd,#edf2f8)", backgroundSize: "200% 100%", animation: "pulse 1.4s ease infinite" }} />;
}
