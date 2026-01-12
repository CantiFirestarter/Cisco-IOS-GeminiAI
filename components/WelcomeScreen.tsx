
import React from 'react';

export default function WelcomeScreen({ 
  isDark, 
  themeClasses, 
  isPredictive, 
  dynamicSuggestions, 
  handleSuggestionClick 
}: any) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center text-center p-4 sm:p-8 animate-fadeIn">
      <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-6 shadow-2xl transition-colors ${themeClasses.emptyCard}`}>
        <i className="fas fa-terminal text-2xl sm:text-3xl text-blue-500"></i>
      </div>
      <h2 className={`text-xl sm:text-2xl font-bold mb-2 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Cisco Terminal Intelligence</h2>
      <p className={`max-w-md mx-auto mb-1 text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        Real-time command synthesis for IOS, IOS XE, and IOS XR environments.
      </p>

      <div className="flex items-center gap-2 text-[9px] sm:text-[10px] uppercase tracking-widest font-bold mt-8 mb-4 transition-all duration-500 text-blue-400">
        {isPredictive && <i className="fas fa-microchip animate-pulse"></i>}
        {isPredictive ? 'Predictive Intelligence Active' : 'Standard Protocols'}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mb-8 mt-4">
        {dynamicSuggestions.map((suggestion: string, idx: number) => (
          <button key={`${suggestion}-${idx}`} onClick={() => handleSuggestionClick(suggestion)} className={`p-3 border rounded-xl text-left text-xs sm:text-sm transition-all flex items-center justify-between group animate-fadeIn ${themeClasses.suggestion}`}><span className="truncate pr-2">{suggestion}</span><i className="fas fa-chevron-right text-slate-300 group-hover:text-blue-500 transition-colors text-[10px] shrink-0"></i></button>
        ))}
      </div>

      <div className={`w-full max-w-2xl mb-10 p-4 sm:p-6 rounded-2xl border transition-all ${isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50/50 border-blue-100 shadow-sm'}`}>
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg">
            <i className="fas fa-search text-white text-xs"></i>
          </div>
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-blue-500">Deep Research Protocol</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 text-left">
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
              <i className="fas fa-question-circle text-blue-500/60"></i> Why use it?
            </div>
            <p className={`text-[11px] sm:text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              AI knowledge has a "<strong>cutoff</strong>." Deep Research connects Gemini to <strong>live Cisco docs</strong> via <strong>Google Search</strong>.
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
              <i className="fas fa-lightbulb text-blue-500/60"></i> When to use it?
            </div>
            <p className={`text-[11px] sm:text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <strong>Critical</strong> for <strong>niche commands</strong> or verifying syntax for the <strong>latest IOS trains</strong>.
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
              <i className="fas fa-check-double text-blue-500/60"></i> How to use it?
            </div>
            <p className={`text-[11px] sm:text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Toggle the <strong>Search Icon</strong> in the bar. The interface will <strong>glow blue</strong> when active.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
