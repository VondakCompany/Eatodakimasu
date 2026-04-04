import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Eatodakimasu | Waseda Restaurant Guide",
  description: "Discover the best student-friendly restaurants, hidden gems, and cheap eats around Waseda University on Eatodakimasu. Updated for 2026.",
  other: {
    google: 'notranslate',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-gray-50 min-h-screen text-gray-900 flex flex-col`}>
        <LanguageProvider>
          <Navbar />
          <div className="flex-1">
            {children}
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}