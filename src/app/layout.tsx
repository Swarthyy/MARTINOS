import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MARTIN OS",
  description: "A command centre for life and business"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
