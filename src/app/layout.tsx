import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pixel-Art Office: AI Faceless Reel Studio",
  description: "Single-user studio where 8 pixel-art AI employees make explainer reels.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
