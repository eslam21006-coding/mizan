import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./brand-theme.css";

export const metadata: Metadata = {
  title: {
    default: "ميزان",
    template: "%s | ميزان",
  },
  description: "منصة عربية لدعم القرارات المالية واقتصاديات البزنس.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8f5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
