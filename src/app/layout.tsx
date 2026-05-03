import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import HeaderAuth from "@/components/HeaderAuth";

export const metadata: Metadata = {
  title: "LegalMind AI | 行政書士試験対策",
  description: "AI駆動型の高度な忘却曲線学習とOCRによる法律学習サポート。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <main className="container">
          <header style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <h1 style={{ fontSize: "1.5rem", margin: 0, background: "linear-gradient(135deg, var(--primary-color), var(--accent-color))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                ⚖️ LegalMind AI
              </h1>
            </Link>
            <HeaderAuth />
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
