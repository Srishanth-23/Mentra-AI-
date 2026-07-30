import React, { useState } from 'react';
import { GoogleLogin, useGoogleLogin } from '@react-oauth/google';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

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
        name: name || email.split('@')[0],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#FFFDF7] border border-[#E2D9CB] rounded-2xl shadow-2xl overflow-hidden p-6 md:p-8 space-y-6 text-[#2C221E] font-body relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#EFE9DD] text-[#786C5E] transition-colors"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[#8C6D3B] text-3xl">school</span>
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-[#2C221E]">Mentra</h2>
          </div>
          <p className="font-mono text-xs text-[#786C5E] uppercase tracking-wide">
            {authMode === 'login' ? 'Sign in to access your scholar workspace' : 'Create your scholar account'}
          </p>
        </div>

        {/* Official Google OAuth Sign In Component */}
        <div className="flex flex-col items-center justify-center w-full min-h-[44px]">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap
            shape="pill"
            theme="outline"
            text="continue_with"
            size="large"
            width="100%"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#E2D9CB]"></div>
          <span className="font-mono text-[10px] text-[#A89B8C] uppercase tracking-wider">or email</span>
          <div className="flex-1 h-px bg-[#E2D9CB]"></div>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'signup' && (
            <div className="space-y-1">
              <label className="font-mono text-xs text-[#786C5E]">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Scholar Name"
                className="w-full px-3.5 py-2.5 bg-[#F5F0E6] border border-[#E2D9CB] rounded-xl text-xs text-[#2C221E] outline-none focus:border-[#8C6D3B] transition-colors"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="font-mono text-xs text-[#786C5E]">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="scholar@university.edu"
              required
              className="w-full px-3.5 py-2.5 bg-[#F5F0E6] border border-[#E2D9CB] rounded-xl text-xs text-[#2C221E] outline-none focus:border-[#8C6D3B] transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="font-mono text-xs text-[#786C5E]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2.5 bg-[#F5F0E6] border border-[#E2D9CB] rounded-xl text-xs text-[#2C221E] outline-none focus:border-[#8C6D3B] transition-colors"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-[#FCEBE6] text-[#9E4735] text-xs font-mono">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#2C221E] text-[#FFFDF7] hover:bg-[#3D322B] rounded-xl font-mono text-xs font-medium transition-all shadow-sm active:scale-98 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : authMode === 'login' ? 'Sign In ➔' : 'Create Account ➔'}
          </button>
        </form>

        {/* Toggle Mode Footer */}
        <div className="text-center font-mono text-xs text-[#786C5E]">
          {authMode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className="text-[#2C221E] font-medium underline"
              >
                Sign Up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="text-[#2C221E] font-medium underline"
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
