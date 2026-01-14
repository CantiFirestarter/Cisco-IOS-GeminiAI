
import React, { useState, useRef, useEffect } from 'react';
import { MODELS } from '../constants';

export default function AppHeader({ 
  goHome, 
  handleClearHistory, 
  clearConfirmState, 
  isDark, 
  setIsDark, 
  handleGoogleAuth, 
  googleUser, 
  isSyncing, 
  selectedModel, 
  setSelectedModel, 
  isResearchMode, 
  setIsResearchMode,
  themeClasses,
  handleDisconnectKey
}: any) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasUserKey = typeof window !== 'undefined' && localStorage.getItem('cisco_expert_api_key');

  return (
    <header className={`border-b p-3 sm:p-4 pb-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between z-10 shrink-0 ${themeClasses.header}`}>
      <button onClick={goHome} className="flex items-center gap-2 sm:gap-3 group overflow-hidden">
        <div className="bg-blue-600 p-1.5 sm:p-2 rounded-lg shadow-lg group-hover:bg-blue-500 transition-colors shrink-0"><i className="fas fa-network-wired text-base sm:text-xl text-white"></i></div>
        <div className="flex flex-col overflow-hidden">
          <h1 className="font-bold text-sm sm:text-lg leading-tight tracking-tight group-hover:text-blue-500 transition-colors truncate">Cisco CLI Expert</h1>
          <p className={`text-[7px] sm:text-[10px] uppercase tracking-[0.1em] font-bold block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{isDark ? 'DARK INTELLIGENCE OPS' : 'ENTERPRISE LIGHT PROTOCOL'}</p>
        </div>
      </button>
      <div className="flex items-center gap-1 sm:gap-2">
        <button onClick={handleClearHistory} className={`px-2 sm:px-3 h-8 sm:h-10 rounded-xl border transition-all flex items-center gap-2 ${clearConfirmState ? 'bg-rose-600 border-rose-500 text-white animate-pulse' : `${themeClasses.util} hover:text-rose-500`}`}>
          <i className={`fas ${clearConfirmState ? 'fa-exclamation-triangle' : 'fa-trash-alt'} text-xs sm:text-sm`}></i>
        </button>
        
        <button onClick={() => setIsDark(!isDark)} className={`p-1.5 sm:p-2 rounded-xl border w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center ${themeClasses.util}`}><i className={`fas ${isDark ? 'fa-sun text-amber-400' : 'fa-moon'} text-xs sm:text-sm`}></i></button>

        {hasUserKey && (
          <button onClick={handleDisconnectKey} title="Disconnect API Key" className={`p-1.5 sm:p-2 rounded-xl border w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center ${themeClasses.util} text-rose-500 hover:bg-rose-500/10 border-rose-500/20`}>
            <i className="fas fa-key text-xs sm:text-sm"></i>
          </button>
        )}

        <button onClick={handleGoogleAuth} className={`p-1.5 sm:p-2 rounded-xl border w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center transition-all ${themeClasses.util} ${googleUser ? 'border-emerald-500/50' : ''}`} title={googleUser ? "Syncing with Cloud" : "Sign in to Sync with Google Drive"}>
          <i className={`fab fa-google text-xs sm:text-sm ${googleUser ? 'text-emerald-500' : ''} ${isSyncing ? 'animate-spin' : ''}`}></i>
        </button>

        <div className="relative" ref={menuRef}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`flex items-center gap-1.5 sm:gap-3 px-2 sm:px-4 h-8 sm:h-10 rounded-xl border transition-all ${themeClasses.util}`}>
            <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isResearchMode ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`}></span>
            <span className="text-[10px] sm:text-xs font-bold sm:font-semibold truncate max-w-[50px] sm:max-w-none">{(isResearchMode ? 'Research' : selectedModel.name.split(' ').slice(1).join(' '))}</span>
            <i className="fas fa-chevron-down text-[8px] sm:text-[10px] opacity-40 ml-0.5"></i>
          </button>
          {isMenuOpen && (
            <div className={`absolute right-0 mt-2 w-56 sm:w-64 rounded-xl border shadow-2xl z-50 animate-menuIn ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="p-2 space-y-1">
                {MODELS.map((m) => (
                  <button key={m.id} onClick={() => { setSelectedModel(m); setIsMenuOpen(false); setIsResearchMode(false); }} className={`w-full text-left p-2.5 sm:p-3 rounded-lg transition-colors ${selectedModel.id === m.id && !isResearchMode ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-opacity-10 hover:bg-slate-500 text-slate-400'}`}>
                    <div className="text-[11px] sm:text-xs font-bold">{m.name}</div>
                    <div className="text-[9px] sm:text-[10px] opacity-60 line-clamp-1">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
