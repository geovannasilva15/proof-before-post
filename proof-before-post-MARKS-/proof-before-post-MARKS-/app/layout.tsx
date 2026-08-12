import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proof Before Post",
  description:
    "A guided evidence-checking practice for young digital creators.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
