import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';

export default function LoginPage({ onLoginSuccess }) {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle Official Google OAuth Credential Response
  const handleGoogleSuccess = (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      // Decode JWT token payload
      const jwt = credentialResponse.credential;
      const base64Url = jwt.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(jsonPayload);

      const user = {
        name: payload.name || payload.email.split('@')[0],
        email: payload.email,
        avatar: payload.picture,
        provider: 'google'
      };

      localStorage.setItem('mentra_user', JSON.stringify(user));
      onLoginSuccess(user);
    } catch (err) {
      console.error("Google Auth Decode Error:", err);
      setError("Failed to process Google Sign-In.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Official Google Sign-In failed or was cancelled.");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    setError('');
    setTimeout(() => {
      const user = {
        name: authMode === 'signup' && name ? name : email.split('@')[0],
        email: email,
        avatar: null,
        provider: 'email'
      };
      localStorage.setItem('mentra_user', JSON.stringify(user));
      onLoginSuccess(user);
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#F5F0E6] flex flex-col justify-center items-center p-4 font-body text-[#2C221E] relative overflow-hidden">
      {/* Background Subtle Accent Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#8C6D3B]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-md bg-[#FFFDF7] border border-[#E2D9CB] rounded-2xl shadow-lg p-8 z-10 relative space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#EFE9DD] border border-[#E2D9CB] mb-2 shadow-xs">
            <span className="material-symbols-outlined text-[#8C6D3B] text-3xl">school</span>
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-[#2C221E]">
            Welcome to Mentra
          </h1>
          <p className="font-mono text-xs text-[#786C5E] uppercase tracking-wide">
            Evidence-Grounded Learning Copilot
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-[#FADBD8] border border-[#F5B7B1] text-[#78281F] text-xs font-mono flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Official Google OAuth Sign In */}
        <div className="flex flex-col items-center justify-center pt-2">
          <p className="font-mono text-xs text-[#786C5E] mb-3">Sign in directly with your Google Account:</p>
          <div className="transform transition-transform hover:scale-[1.02] shadow-xs rounded-lg overflow-hidden">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap
              shape="pill"
              theme="outline"
              size="large"
              width="320"
            />
          </div>
        </div>

        {/* Separator Divider */}
        <div className="relative flex items-center justify-center my-4">
          <div className="border-t border-[#E2D9CB] w-full" />
          <span className="bg-[#FFFDF7] px-3 font-mono text-xs text-[#786C5E] uppercase absolute">
            Or continue with email
          </span>
        </div>

        {/* Auth Mode Toggle Tabs */}
        <div className="flex p-1 bg-[#EFE9DD] rounded-xl border border-[#E2D9CB]">
          <button
            type="button"
            onClick={() => { setAuthMode('login'); setError(''); }}
            className={`flex-1 py-2 font-mono text-xs font-medium rounded-lg transition-all ${
              authMode === 'login'
                ? 'bg-[#2C221E] text-[#FFFDF7] shadow-xs'
                : 'text-[#786C5E] hover:text-[#2C221E]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('signup'); setError(''); }}
            className={`flex-1 py-2 font-mono text-xs font-medium rounded-lg transition-all ${
              authMode === 'signup'
                ? 'bg-[#2C221E] text-[#FFFDF7] shadow-xs'
                : 'text-[#786C5E] hover:text-[#2C221E]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {authMode === 'signup' && (
            <div>
              <label className="block font-mono text-xs text-[#786C5E] mb-1.5 font-medium">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Student Name"
                className="w-full bg-[#F5F0E6] border border-[#E2D9CB] rounded-xl px-3.5 py-2.5 font-mono text-xs text-[#2C221E] placeholder-[#A89B8C] outline-none focus:border-[#8C6D3B] focus:ring-1 focus:ring-[#8C6D3B] transition-all"
              />
            </div>
          )}

          <div>
            <label className="block font-mono text-xs text-[#786C5E] mb-1.5 font-medium">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@university.edu"
              className="w-full bg-[#F5F0E6] border border-[#E2D9CB] rounded-xl px-3.5 py-2.5 font-mono text-xs text-[#2C221E] placeholder-[#A89B8C] outline-none focus:border-[#8C6D3B] focus:ring-1 focus:ring-[#8C6D3B] transition-all"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-[#786C5E] mb-1.5 font-medium">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#F5F0E6] border border-[#E2D9CB] rounded-xl px-3.5 py-2.5 font-mono text-xs text-[#2C221E] placeholder-[#A89B8C] outline-none focus:border-[#8C6D3B] focus:ring-1 focus:ring-[#8C6D3B] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#2C221E] text-[#FFFDF7] font-mono text-xs font-medium rounded-xl hover:bg-[#3D322B] active:scale-98 transition-all shadow-xs disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating...' : authMode === 'login' ? 'Sign In to Workspace' : 'Create Free Account'}
          </button>
        </form>

        {/* Footer Note */}
        <p className="text-center font-mono text-[11px] text-[#786C5E]">
          By continuing, you agree to Mentra's grounded privacy & evidence terms.
        </p>
      </div>
    </div>
  );
}
