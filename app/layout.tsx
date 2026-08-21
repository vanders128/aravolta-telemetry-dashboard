import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aravolta Telemetry Dashboard",
  description: "Live operational telemetry for a fleet of connected devices.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
