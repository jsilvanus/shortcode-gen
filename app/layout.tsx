import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shortcode Gen",
  description: "Self-hosted short-link service",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
