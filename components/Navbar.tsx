'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Navbar() {
  // Pulling our new dynamic variables from the upgraded context
  const { currentLang, setLanguage, appLanguages, t } = useLanguage();

  return (
    <nav className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-black text-gray-900 tracking-tight">
          Eatodakimasu
        </Link>
        
        <div className="flex gap-4 items-center">
          
          {/* THE UPGRADED DYNAMIC DROPDOWN */}
          <div className="relative flex items-center bg-gray-100 rounded-lg p-1 transition hover:bg-gray-200">
            <select
              value={currentLang}
              onChange={(e) => setLanguage(e.target.value)}
              className="appearance-none bg-transparent text-gray-700 py-1 pl-3 pr-8 rounded-md font-bold text-sm focus:outline-none cursor-pointer w-full h-full"
            >
              {/* If DB hasn't loaded yet, show safe fallbacks, otherwise loop the dynamic languages */}
              {appLanguages.length > 0 ? (
                appLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.code.toUpperCase()} - {lang.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="ja">JA - Japanese</option>
                  <option value="en">EN - English</option>
                </>
              )}
            </select>
            
            {/* Custom downward arrow to keep the UI looking clean */}
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-500">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>

          {/* Upgraded the Register button to use our new translation engine t() */}
          <Link href="/register" className="hidden md:block bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800 font-bold transition shadow-sm">
            {t('nav_register', currentLang === 'ja' ? '店舗登録' : 'Register')}
          </Link>
          
        </div>
      </div>
    </nav>
  );
}