import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Rol tanımları ve izinler için
  const ROLES = {
    DEV: 'Dev',       // Her şeye erişir
    ADMIN: 'Admin',   // Uyumsoft hariç her şeye erişir
    ATOLYE: 'Atolye', // Yalnızca İş Emirleri sayfasına erişir
    OZEL: 'Ozel'      // Admin/Dev tarafından seçilen sekmelere erişir
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
            loadProfile(newSession.user.id);
        } else {
            setProfile(null);
            setLoading(false);
        }
    });



    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId) => {
    try {
      // profiller tablosunu sorgula
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (data) {
        setProfile(data);
      } else {
        // Eğer profil yoksa ve efehasan ise Dev yap (ilk giriş için)
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email === 'efehasan4335@gmail.com') {
           const devProfile = { id: userId, email: user.email, role: 'Dev', allowed_tabs: ['*'] };
           await supabase.from('profiles').insert(devProfile);
           setProfile(devProfile);
        } else {
          // Normal kayıt
          const p = { id: userId, email: user?.email, role: 'Atolye', allowed_tabs: [] };
          await supabase.from('profiles').insert(p);
          setProfile(p);
        }
      }
    } catch (err) {
      console.error("Profil yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const register = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    session,
    profile,
    loading,
    login,
    register,
    logout,
    ROLES
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
