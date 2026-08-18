import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proof Before Post",
  description:
    "Uma prática guiada de verificação de evidências para jovens criadores digitais.",
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
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
