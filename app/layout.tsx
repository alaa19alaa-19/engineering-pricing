import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "تسعير BOQ تلقائيًا",
  description: "Breakdown Templates + 20 سؤال لكل بند",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}