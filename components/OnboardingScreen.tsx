
import React, { useState } from 'react';
import { validateApiKey } from '../services/geminiService';

interface OnboardingScreenProps {
  setHasApiKey: (val: boolean) => void;
  viewportHeight: string;
  isDark: boolean;
  themeClasses: any;
}

export default function OnboardingScreen({ 
  setHasApiKey, 
  viewportHeight, 
  isDark, 
  themeClasses 
}: OnboardingScreenProps) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [validationStatus, setValidationStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [validationError, setValidationError] = useState('');

  const handleVerifyAndSave = async () => {
    if (!apiKeyInput.trim()) return;
    setValidationStatus('checking');
    setValidationError('');
    
    const result = await validateApiKey(apiKeyInput.trim());
    if (result.success) {
      setValidationStatus('success');
      setTimeout(() => {
        localStorage.setItem('cisco_expert_api_key', apiKeyInput.trim());
        setHasApiKey(true);
      }, 800);
    } else {
      setValidationStatus('error');
      setValidationError(result.message);
    }
  };

  const handleStudioKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      // Assume success as per SDK rules to avoid race conditions
      setHasApiKey(true);
    }
  };

  return (
    <div style={{ height: viewportHeight }} className={`flex flex-col items-center justify-center p-6 text-center ${themeClasses.bg}`}>
      <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-2xl animate-fadeIn">
        <i className="fas fa-link text-2xl text-white"></i>
      </div>
      
      <h2 className="text-2xl font-bold mb-2">Gemini API Connectivity</h2>
      <p className="max-w-xs mx-auto mb-8 text-sm opacity-70 leading-relaxed">
        To provide real-time Cisco intelligence, this app needs your Google Gemini API key. Your credentials and terminal history remain local and secure.
      </p>

      <div className="w-full max-w-sm space-y-4 animate-fadeIn">
        <a 
          href="https://aistudio.google.com/app/apikey" 
          target="_blank" 
          rel="noopener noreferrer"
          className={`block w-full py-3 px-4 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2 ${isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
        >
          <span>Get Free API Key</span>
          <i className="fas fa-external-link-alt text-xs opacity-50"></i>
        </a>

        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <i className="fas fa-key text-xs opacity-40"></i>
          </div>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => {
              setApiKeyInput(e.target.value);
              if (validationStatus !== 'idle') setValidationStatus('idle');
            }}
            placeholder="Paste your API key (sk-...)"
            className={`w-full py-3.5 pl-10 pr-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm transition-all ${themeClasses.input} ${validationStatus === 'error' ? 'border-rose-500/50' : validationStatus === 'success' ? 'border-emerald-500/50' : ''}`}
          />
        </div>

        {validationStatus === 'error' && (
          <div className="text-[10px] text-rose-500 font-bold bg-rose-500/10 py-2 rounded-lg border border-rose-500/20 px-3 flex items-center gap-2">
            <i className="fas fa-exclamation-circle"></i>
            {validationError || "Verification Failed"}
          </div>
        )}

        <button 
          onClick={handleVerifyAndSave}
          disabled={!apiKeyInput.trim() || validationStatus === 'checking'}
          className={`w-full py-3.5 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
            validationStatus === 'checking' ? 'bg-slate-700' :
            validationStatus === 'success' ? 'bg-emerald-600' :
            'bg-blue-600 hover:bg-blue-500'
          } text-white disabled:opacity-50`}
        >
          {validationStatus === 'checking' ? (
            <><i className="fas fa-circle-notch fa-spin"></i><span>Verifying Uplink...</span></>
          ) : validationStatus === 'success' ? (
            <><i className="fas fa-check"></i><span>Connectivity Established</span></>
          ) : (
            <><i className="fas fa-bolt"></i><span>Connect to Gemini</span></>
          )}
        </button>
        
        {(window as any).aistudio && (
           <button onClick={handleStudioKey} className={`mt-4 w-full py-2 rounded-xl border border-dashed text-xs opacity-60 hover:opacity-100 ${isDark ? 'border-slate-800' : 'border-slate-300'}`}>Use IDX/Studio Key</button>
        )}

        <p className="text-[10px] opacity-40 mt-6 max-w-[280px] mx-auto">
          <i className="fas fa-lock mr-1"></i>
          Keys are stored securely in your browser's local storage. Free keys may use data for model training.
        </p>
      </div>
    </div>
  );
}
