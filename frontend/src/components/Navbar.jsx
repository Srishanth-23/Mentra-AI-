import React from 'react';
import { getUIText } from '../ui_translations';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  currentDoc, 
  onDeleteData, 
  user, 
  onOpenLogin, 
  onLogout,
  preferredLanguage = 'en',
  simplifyMode = false,
  onLanguageChange
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems = [
    { id: 'upload', label: getUIText(preferredLanguage, 'nav_upload'), icon: 'upload_file' },
    { id: 'concepts', label: getUIText(preferredLanguage, 'nav_concepts'), icon: 'account_tree', disabled: !currentDoc },
    { id: 'tutor', label: getUIText(preferredLanguage, 'nav_tutor'), icon: 'school', disabled: !currentDoc },
    { id: 'teach', label: getUIText(preferredLanguage, 'nav_teach'), icon: 'record_voice_over', disabled: !currentDoc },
    { id: 'speak', label: getUIText(preferredLanguage, 'nav_speak'), icon: 'mic', disabled: !currentDoc },
    { id: 'quiz', label: getUIText(preferredLanguage, 'nav_quiz'), icon: 'quiz', disabled: !currentDoc },
    { id: 'dashboard', label: getUIText(preferredLanguage, 'nav_dashboard'), icon: 'dashboard', disabled: !currentDoc },
  ];

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'Hindi (हिंदी)' },
    { code: 'ta', name: 'Tamil (தமிழ்)' },
    { code: 'es', name: 'Spanish (Español)' },
    { code: 'fr', name: 'French (Français)' },
    { code: 'de', name: 'German (Deutsch)' },
    { code: 'te', name: 'Telugu (తెలుగు)' },
    { code: 'kn', name: 'Kannada (கன்னடம்)' },
    { code: 'mr', name: 'Marathi (मराठी)' },
    { code: 'bn', name: 'Bengali (বাংলা)' },
    { code: 'zh', name: 'Chinese (中文)' },
    { code: 'ja', name: 'Japanese (日本語)' }
  ];

  const handleMobileNavClick = (id) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  const handleSelectLang = async (code) => {
    if (onLanguageChange) {
      onLanguageChange(code, simplifyMode);
    }
    if (currentDoc) {
      try {
        const { updateDocumentLanguage } = await import('../api');
        await updateDocumentLanguage(currentDoc.document_id, code, simplifyMode);
      } catch (err) {
        console.error("Failed to persist document language:", err);
      }
    }
  };

  const handleToggleSimplify = async () => {
    const nextSimplify = !simplifyMode;
    if (onLanguageChange) {
      onLanguageChange(preferredLanguage, nextSimplify);
    }
    if (currentDoc) {
      try {
        const { updateDocumentLanguage } = await import('../api');
        await updateDocumentLanguage(currentDoc.document_id, preferredLanguage, nextSimplify);
      } catch (err) {
        console.error("Failed to persist simplify mode:", err);
      }
    }
  };

  return (
    <>
      {/* Desktop Sidebar Navigation Drawer */}
      <aside className="fixed left-0 top-0 h-screen flex flex-col p-6 z-50 bg-[#EFE9DD] border-r border-[#E2D9CB] w-72 hidden md:flex">
        {/* Brand */}
        <div className="mb-8 cursor-pointer" onClick={() => setActiveTab('upload')}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#8C6D3B] text-2xl" data-icon="school">school</span>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-[#2C221E]">Mentra</h1>
          </div>
          <p className="font-mono text-xs text-[#786C5E] mt-1 uppercase tracking-wide">Grounded Learning</p>
        </div>

        {/* Language Control Panel */}
        <div className="mb-6 p-3 rounded-xl bg-[#FFFDF7] border border-[#E2D9CB] shadow-xs">
          {/* Document Context Chip */}
          {currentDoc && (
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[#E2D9CB]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[#8C6D3B] text-sm" data-icon="description">description</span>
                <span className="font-mono text-xs font-medium text-[#2C221E] truncate max-w-[120px]" title={currentDoc.filename}>
                  {currentDoc.filename}
                </span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#D9A441] animate-pulse"></span>
            </div>
          )}

          {/* Multilingual Selector */}
          <div className="flex items-center justify-between gap-2">
            <label className="font-mono text-xs text-[#786C5E] flex items-center gap-1.5 shrink-0">
              <span className="text-sm">🌐</span> {getUIText(preferredLanguage, 'language_label')}
            </label>
            <div className="relative flex-1 max-w-[130px]">
              <select
                value={preferredLanguage}
                onChange={(e) => handleSelectLang(e.target.value)}
                className="w-full bg-[#F5F0E6] text-[#2C221E] border border-[#E2D9CB] rounded-lg px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-[#8C6D3B] focus:border-[#8C6D3B] cursor-pointer truncate"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                disabled={item.disabled}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium transition-all text-left text-sm ${
                  isActive
                    ? 'bg-[#2C221E] text-[#FFFDF7] font-medium shadow-sm'
                    : item.disabled
                    ? 'text-[#A89B8C] cursor-not-allowed'
                    : 'text-[#786C5E] hover:bg-[#E7E0D3] hover:text-[#2C221E]'
                }`}
              >
                <span className={`material-symbols-outlined text-xl ${isActive ? 'text-[#FFFDF7]' : 'text-[#786C5E]'}`} data-icon={item.icon}>
                  {item.icon}
                </span>
                <span className="font-mono text-sm tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer Actions / Delete Data & User Profile */}
        <div className="mt-auto pt-4 border-t border-outline-variant/15 space-y-3">
          {currentDoc && (
            <button
              onClick={onDeleteData}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-mono text-error hover:bg-error-container/20 transition-colors"
            >
              <span className="material-symbols-outlined text-base" data-icon="delete">delete</span>
              <span>Purge Session Data</span>
            </button>
          )}

          {user ? (
            <div className="flex items-center justify-between p-2 rounded-xl bg-[#FFFDF7] border border-[#E2D9CB]">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#2C221E] text-[#FFFDF7] flex items-center justify-center shrink-0 shadow-xs">
                    <span className="material-symbols-outlined text-base">person</span>
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-[#2C221E] truncate">{user.name}</span>
                  <span className="text-[10px] font-mono text-[#786C5E] uppercase truncate">{user.provider === 'google' ? 'Google Scholar' : 'Verified'}</span>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-1 rounded text-[#786C5E] hover:bg-[#E7E0D3] hover:text-[#9E4735] transition-colors"
                title="Sign Out"
              >
                <span className="material-symbols-outlined text-base">logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2C221E] text-[#FFFDF7] font-mono text-xs font-medium hover:bg-[#3D322B] transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-base">login</span>
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Header Bar */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 w-full bg-[#EFE9DD] border-b border-[#E2D9CB] sticky top-0 z-40 shadow-xs">
        {/* Left Side: Hamburger & Brand */}
        <div className="flex items-center gap-2">
          {/* Hamburger Menu Toggle Button (Left Side) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-[#2C221E] hover:bg-[#E7E0D3] transition-colors focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            <span className="material-symbols-outlined text-2xl">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>

          {/* Brand Logo */}
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => handleMobileNavClick('upload')}>
            <span className="material-symbols-outlined text-[#8C6D3B] text-xl" data-icon="school">school</span>
            <span className="font-heading text-lg font-semibold text-[#2C221E]">Mentra</span>
          </div>
        </div>

        {/* Right Side: Sign In / Profile Action */}
        <div className="flex items-center gap-2">
          {!user ? (
            <button
              onClick={onOpenLogin}
              className="px-2.5 py-1.5 rounded-lg bg-[#2C221E] text-[#FFFDF7] text-xs font-mono font-medium flex items-center gap-1 shadow-xs"
            >
              <span className="material-symbols-outlined text-sm">login</span>
              <span>Sign In</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover border border-[#E2D9CB]" />
              ) : (
                <button onClick={onLogout} className="p-1 rounded-lg text-[#786C5E]" title="Sign Out">
                  <span className="material-symbols-outlined text-lg">logout</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Mobile Hamburger Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-[#F5F0E6] animate-in slide-in-from-top duration-200">
          {/* Drawer Top Header */}
          <div className="flex items-center justify-between px-4 h-14 bg-[#EFE9DD] border-b border-[#E2D9CB]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#8C6D3B] text-xl">school</span>
              <span className="font-heading text-lg font-semibold text-[#2C221E]">Mentra Menu</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg text-[#2C221E] hover:bg-[#E7E0D3]"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </div>

          {/* Language & Simplify Control Panel (Mobile) */}
          <div className="mx-4 mt-4 p-3 rounded-xl bg-[#FFFDF7] border border-[#E2D9CB] space-y-2.5 shadow-xs">
            {currentDoc && (
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E2D9CB]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-[#8C6D3B] text-sm">description</span>
                  <span className="font-mono text-xs font-medium text-[#2C221E] truncate">{currentDoc.filename}</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#D9A441] animate-pulse"></span>
              </div>
            )}

            {/* Multilingual Selector */}
            <div className="flex items-center justify-between gap-2">
              <label className="font-mono text-xs text-[#786C5E] flex items-center gap-1.5 shrink-0">
                <span className="text-sm">🌐</span> {getUIText(preferredLanguage, 'language_label')}
              </label>
              <div className="relative flex-1 max-w-[130px]">
                <select
                  value={preferredLanguage}
                  onChange={(e) => handleSelectLang(e.target.value)}
                  className="w-full bg-[#F5F0E6] text-[#2C221E] border border-[#E2D9CB] rounded-lg px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-[#8C6D3B] focus:border-[#8C6D3B] cursor-pointer truncate"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Navigation Feature List */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  disabled={item.disabled}
                  onClick={() => handleMobileNavClick(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl font-medium text-left transition-all ${
                    isActive
                      ? 'bg-[#2C221E] text-[#FFFDF7] font-semibold shadow-xs'
                      : item.disabled
                      ? 'text-[#A89B8C]/40 cursor-not-allowed'
                      : 'text-[#786C5E] hover:bg-[#EFE9DD] hover:text-[#2C221E]'
                  }`}
                >
                  <span className={`material-symbols-outlined text-2xl ${isActive ? 'text-[#FFFDF7]' : 'text-[#786C5E]'}`}>
                    {item.icon}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-mono text-sm tracking-wide">{item.label}</span>
                    {item.disabled && (
                      <span className="text-[10px] font-mono opacity-60">Requires uploaded document</span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Drawer Footer Actions */}
          <div className="p-4 border-t border-[#E2D9CB] bg-[#EFE9DD] space-y-3">
            {currentDoc && (
              <button
                onClick={() => {
                  onDeleteData();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono text-error border border-error/20 hover:bg-error/10 transition-colors"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                <span>Purge Session Data</span>
              </button>
            )}

            {user ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FFFDF7] border border-[#E2D9CB]">
                <div className="flex items-center gap-3 min-w-0">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#2C221E] text-[#FFFDF7] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-base">person</span>
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-[#2C221E] truncate">{user.name}</span>
                    <span className="text-[10px] font-mono text-[#786C5E] uppercase truncate">{user.email}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="p-1.5 rounded-lg text-[#786C5E] hover:bg-[#EFE9DD] hover:text-[#9E4735]"
                  title="Sign Out"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  onOpenLogin();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#2C221E] text-[#FFFDF7] font-mono text-xs font-medium shadow-xs"
              >
                <span className="material-symbols-outlined text-base">login</span>
                <span>Sign In / Register</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
