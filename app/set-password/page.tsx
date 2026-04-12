// src/app/set-password/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Invalid or expired invite link. Please contact your administrator.");
      }
    };
    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      alert("✅ Password set successfully! Redirecting to CMS...");
      router.push('/admin'); // Assuming /admin is your dashboard
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <form onSubmit={handleUpdatePassword} className="max-w-md w-full bg-white p-10 rounded-[32px] shadow-xl border border-gray-200">
        <h1 className="text-3xl font-black mb-2 text-gray-900 text-center">Welcome Aboard</h1>
        <p className="text-sm font-bold text-gray-500 text-center mb-8">Please set a secure password for your account.</p>
        
        {error && <div className="mb-6 text-xs font-bold text-red-500 bg-red-50 p-4 rounded-xl border border-red-100">{error}</div>}
        
        <div className="space-y-4 mb-8">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 mb-1 block">New Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required
              autoFocus
              className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-gray-900" 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 mb-1 block">Confirm Password</label>
            <input 
              type="password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              required
              className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-gray-900" 
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading || !!error.includes('Invalid')} 
          className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl hover:bg-black transition shadow-lg disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Set Password & Login'}
        </button>
      </form>
    </div>
  );
}