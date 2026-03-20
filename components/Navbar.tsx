'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Navbar() {
  const { lang, setLang } = useLanguage();

  return (
    <nav className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-black text-gray-900 tracking-tight">
          Eatodakimasu
        </Link>
        
        <div className="flex gap-4 items-center">
          {/* The Language Switcher */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button 
              onClick={() => setLang('ja')}
              className={`px-3 py-1 text-sm font-bold rounded-md transition ${lang === 'ja' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              JP
            </button>
            <button 
              onClick={() => setLang('en')}
              className={`px-3 py-1 text-sm font-bold rounded-md transition ${lang === 'en' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              EN
            </button>
          </div>

          <Link href="/register" className="hidden md:block bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800 font-bold transition">
            {lang === 'ja' ? '店舗登録' : 'Register'}
          </Link>
        </div>
      </div>
    </nav>
  );
}