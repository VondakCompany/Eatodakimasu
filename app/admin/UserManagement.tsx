'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Icons } from './shared';

const AVAILABLE_TABS = [
  { id: 'directory', label: 'Directory', icon: <Icons.Directory className="w-5 h-5" /> },
  { id: 'pending', label: 'Pending Queue', icon: <Icons.Pending className="w-5 h-5" /> },
  { id: 'categories', label: 'Event Hub', icon: <Icons.Categories className="w-5 h-5" /> },
  { id: 'translations', label: 'Translations', icon: <Icons.Translations className="w-5 h-5" /> },
  { id: 'ad_studio', label: 'Ad Studio', icon: <Icons.AdStudio className="w-5 h-5" /> },
  { id: 'users', label: 'Team Roles', icon: <Icons.Users className="w-5 h-5" /> },
  { id: 'registration', label: 'Form Builder', icon: <Icons.Registration className="w-5 h-5" /> }
];

const ROLES = [
  { id: 'admin', label: 'Admin' },
  { id: 'ad_manager', label: 'Ad Manager' },
  { id: 'directory_manager', label: 'Directory Manager' },
  { id: 'event_manager', label: 'Event Manager' },
  { id: 'translator', label: 'Translator' },
  { id: 'editor', label: 'General Editor' },
  { id: 'registration_manager', label: 'Form Manager' },
];

const ToggleSwitch = ({ checked, onChange, disabled }: { checked: boolean, onChange: () => void, disabled: boolean }) => (
  <div onClick={() => !disabled && onChange()} className={`w-11 h-6 rounded-full flex items-center px-1 transition-all duration-300 ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${checked ? 'bg-gray-900' : 'bg-gray-200'}`}>
    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
  </div>
);

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('directory_manager');

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
    if (!error) setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const originalEmail = inviteEmail;
    setInviteEmail('Inviting...');

    try {
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: originalEmail.trim(), role: inviteRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite user');

      alert(`✅ Successfully invited ${originalEmail}!\nThey will receive an email to set their password.`);
      setInviteEmail('');
      fetchUsers();
    } catch (error: any) {
      alert(`Error inviting user: ${error.message}`);
      setInviteEmail(originalEmail); 
    }
  };

  const updateRole = async (id: string, newRole: string) => {
    const { error } = await supabase.from('user_profiles').update({ role: newRole }).eq('id', id);
    if (error) alert(`Failed to update role: ${error.message}`);
    else fetchUsers();
  };

  const toggleTabAccess = async (user: any, tabId: string) => {
    const currentTabs = user.allowed_tabs || [];
    const newTabs = currentTabs.includes(tabId) ? currentTabs.filter((t: string) => t !== tabId) : [...currentTabs, tabId];
    const { error } = await supabase.from('user_profiles').update({ allowed_tabs: newTabs }).eq('id', user.id);
    if (error) alert(`Failed to update access: ${error.message}`);
    else fetchUsers();
  };

  const removeUser = async (id: string, email: string) => {
    if (confirm(`Revoke CMS access and completely delete the account for ${email}?`)) {
      try {
        const res = await fetch('/api/remove-user', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error);
        }
        
        fetchUsers();
      } catch (error: any) {
        alert(`Failed to remove user: ${error.message}`);
      }
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch(role) {
      case 'admin': return 'bg-purple-100 text-purple-700';
      case 'ad_manager': return 'bg-indigo-100 text-indigo-700';
      case 'directory_manager': return 'bg-orange-100 text-orange-700';
      case 'event_manager': return 'bg-pink-100 text-pink-700';
      case 'translator': return 'bg-blue-100 text-blue-700';
      case 'registration_manager': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getRoleIcon = (role: string) => {
    switch(role) {
      case 'admin': return <Icons.Admin className="w-3.5 h-3.5" />;
      case 'ad_manager': return <Icons.AdStudio className="w-3.5 h-3.5" />;
      case 'directory_manager': return <Icons.Directory className="w-3.5 h-3.5" />;
      case 'event_manager': return <Icons.Categories className="w-3.5 h-3.5" />;
      case 'translator': return <Icons.Translations className="w-3.5 h-3.5" />;
      case 'registration_manager': return <Icons.Registration className="w-3.5 h-3.5" />;
      default: return <Icons.Editor className="w-3.5 h-3.5" />;
    }
  };

  const rootAdminId = [...users].reverse().find(u => u.role === 'admin')?.id;

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20 animate-in fade-in duration-500">
      <section className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-200">
        <div className="mb-8">
          <h2 className="text-3xl font-black text-gray-900 mb-2">Team Access</h2>
          <p className="text-gray-500 font-bold">Invite collaborators and manage their module permissions.</p>
        </div>

        <form onSubmit={handleInviteUser} className="flex flex-wrap items-center gap-4 p-6 bg-gray-50 rounded-[32px] border border-gray-100">
          <div className="flex-1 min-w-[250px] relative">
            <Icons.Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@example.com" className="w-full pl-12 pr-5 py-4 border border-gray-200 rounded-2xl font-bold text-gray-800 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition" required />
          </div>
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="py-4 px-5 border border-gray-200 rounded-2xl font-black text-gray-700 bg-white outline-none cursor-pointer hover:bg-gray-50 transition">
            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <button type="submit" className="bg-gray-900 text-white font-black px-10 py-4 rounded-2xl hover:bg-black transition shadow-md w-full md:w-auto">Send Invite</button>
        </form>
      </section>

      <section className="space-y-6">
        <h3 className="text-xl font-black text-gray-900 px-2">Current Members ({users.length})</h3>
        {loading ? (
          <div className="text-center py-20 font-black tracking-widest text-gray-300 animate-pulse">LOADING ROSTER...</div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {users.map((user: any) => {
              const isRootAdmin = user.id === rootAdminId;

              return (
                <div key={user.id} className="bg-white rounded-[32px] border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300">
                  <div className="flex flex-wrap justify-between items-center p-6 sm:px-10 sm:py-8 bg-gray-50/50 border-b border-gray-100">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white font-black text-xl shadow-inner">
                        {user.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                          {user.email}
                          {isRootAdmin && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase tracking-widest font-black">ROOT</span>}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${getRoleBadgeStyle(user.role)}`}>
                            {getRoleIcon(user.role)} {user.role.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-6 sm:mt-0">
                      <select 
                        value={user.role} 
                        onChange={(e) => updateRole(user.id, e.target.value)} 
                        disabled={isRootAdmin}
                        className={`py-2.5 px-4 border border-gray-200 rounded-xl font-black text-sm outline-none transition ${isRootAdmin ? 'bg-gray-50 text-gray-400 cursor-not-allowed opacity-70' : 'text-gray-700 bg-white cursor-pointer hover:bg-gray-50'}`}
                      >
                        {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>

                      {isRootAdmin ? (
                        <div className="p-2.5 bg-gray-50 text-gray-400 rounded-xl font-black text-sm border border-gray-100 cursor-not-allowed select-none flex items-center gap-1.5" title="Root Admin cannot be removed">
                          <Icons.Lock className="w-4 h-4" /> Protected
                        </div>
                      ) : (
                        <button onClick={() => removeUser(user.id, user.email)} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition font-black text-sm" title="Revoke Access">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-6 sm:px-10 sm:py-8 bg-white">
                    <div className="flex justify-between items-end mb-6">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Module Access Controls</h4>
                      {isRootAdmin && <span className="text-[10px] font-bold text-purple-500 bg-purple-50 px-3 py-1 rounded-full">Root Admin Protected</span>}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {AVAILABLE_TABS.map(tab => {
                        const isChecked = isRootAdmin || (user.allowed_tabs || []).includes(tab.id);
                        const isDisabled = isRootAdmin;
                        
                        return (
                          <div key={tab.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${isChecked ? 'border-gray-200 bg-gray-50/50' : 'border-gray-100 bg-white opacity-60'}`}>
                            <div className="flex items-center gap-3">
                              {tab.icon}
                              <span className={`font-black text-sm ${isChecked ? 'text-gray-900' : 'text-gray-400'}`}>{tab.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                               {isDisabled && <Icons.Lock className="w-3.5 h-3.5 text-gray-300" title="Permanently unlocked for Root Admin" />}
                               <ToggleSwitch checked={isChecked} onChange={() => toggleTabAccess(user, tab.id)} disabled={isDisabled} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}