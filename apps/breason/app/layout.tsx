import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Breason",
  description: "Искать → Проверять → Улучшать",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23C8F135'/><text x='16' y='23' text-anchor='middle' font-family='system-ui,sans-serif' font-weight='800' font-size='18' fill='%2309090B'>B</text></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
