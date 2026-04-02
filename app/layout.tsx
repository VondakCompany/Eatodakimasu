import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar"; // <-- RESTORED: Import the Navbar

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Eatodakimasu | Waseda Restaurant Guide",
  description: "Discover the best student-friendly restaurants, hidden gems, and cheap eats around Waseda University. Updated for 2026.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-gray-50 min-h-screen text-gray-900 flex flex-col`}>
        {/* The LanguageProvider wraps everything so the whole app knows the current language */}
        <LanguageProvider>
          
          {/* RESTORED: The Navbar is back and will appear on every single page! */}
          <Navbar />
          
          {/* The main page content (Search, Admin, Restaurant Details) loads here */}
          <div className="flex-1">
            {children}
          </div>
          
        </LanguageProvider>
      </body>
    </html>
  );
}