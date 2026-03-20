import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { LanguageProvider } from "@/contexts/LanguageContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Eatodakimasu | Wasemeshi Guide",
  description: "Discover local Waseda restaurants.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LanguageProvider>
          <Navbar />
          <main className="min-h-screen max-w-7xl mx-auto p-4 md:p-8">
            {children}
          </main>
        </LanguageProvider>
      </body>
    </html>
  );
}