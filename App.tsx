
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getCiscoCommandInfo, getDynamicSuggestions } from './services/geminiService';
import ResultCard from './components/ResultCard';
import AppHeader from './components/AppHeader';
import AppFooter from './components/AppFooter';
import WelcomeScreen from './components/WelcomeScreen';
import { useGoogleSync } from './hooks/useGoogleSync';
import { useVoice } from './hooks/useVoice';
import { ChatMessage } from './types';
import { MODELS, STORAGE_KEY, SUGGESTIONS_KEY, DEFAULT_SUGGESTIONS } from './constants';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [dynamicSuggestions, setDynamicSuggestions] = useState(() => {
    const saved = localStorage.getItem(SUGGESTIONS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_SUGGESTIONS;
  });

  const [view, setView] = useState(() => (messages.length === 0 ? 'home' : 'chat'));
  const [hasApiKey, setHasApiKey] = useState(false); 
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState('');
  
  const [viewportHeight, setViewportHeight] = useState('100dvh');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [uploadMode, setUploadMode] = useState<'image' | 'file'>('image');
  const [attachedFile, setAttachedFile] = useState<any>(null);
  const [clearConfirmState, setClearConfirmState] = useState(false);
  const [isResearchMode, setIsResearchMode] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draftValue, setDraftValue] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { googleUser, isSyncing, handleGoogleAuth } = useGoogleSync(messages, dynamicSuggestions, setMessages, setDynamicSuggestions);
  const { isListening, toggleListening } = useVoice((transcript) => setInputValue(p => p + (p ? ' ' : '') + transcript));

  useEffect(() => {
    const checkKey = async () => {
      // 1. Check Local Storage (User Key)
      const localKey = localStorage.getItem('cisco_expert_api_key');
      if (localKey) {
        setHasApiKey(true);
        setIsCheckingKey(false);
        return;
      }

      // 2. Check Environment Variable (Developer/Built Key)
      if (process.env.API_KEY) {
        setHasApiKey(true);
        setIsCheckingKey(false);
        return;
      }

      // 3. Fallback to IDX / AI Studio check
      const isStudio = !!(window as any).aistudio?.hasSelectedApiKey;
      if (isStudio) {
        const has = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      } else {
        setHasApiKey(false);
      }
      setIsCheckingKey(false);
    };
    checkKey();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    if (view === 'chat' && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, view]);

  useEffect(() => {
    if (!window.visualViewport) return;
    const updateHeight = () => setViewportHeight(`${window.visualViewport!.height}px`);
    window.visualViewport.addEventListener('resize', updateHeight);
    return () => window.visualViewport?.removeEventListener('resize', updateHeight);
  }, []);

  const userPromptHistory = useMemo(() => messages.filter(m => m.role === 'user').map(m => m.content).reverse(), [messages]);

  const handleSaveKey = () => {
    if (apiKeyInput.trim()) {
      localStorage.setItem('cisco_expert_api_key', apiKeyInput.trim());
      setHasApiKey(true);
    }
  };

  const handleDisconnectKey = () => {
    if (window.confirm("Disconnect your API Key? This will require you to re-enter it to use the app.")) {
      localStorage.removeItem('cisco_expert_api_key');
      // If no env key exists, this will trigger the lock screen
      if (!process.env.API_KEY) {
        setHasApiKey(false);
        setApiKeyInput('');
      } else {
         // If env key exists, we technically still have a key, so we stay logged in but rely on env
         // But to give visual feedback, we force a reload or UI refresh
         alert("User key removed. Reverting to system key if available.");
         window.location.reload();
      }
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputValue.trim() && !attachedFile) || isLoading) return;
    
    const userMsg: any = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim() || `Analyze attached ${uploadMode}`,
      timestamp: Date.now(),
      image: attachedFile?.mimeType.startsWith('image/') ? attachedFile.data : undefined,
      file: !attachedFile?.mimeType.startsWith('image/') ? attachedFile : undefined
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputValue(''); setHistoryIndex(-1); setDraftValue(''); setAttachedFile(null);
    setIsLoading(true); setView('chat');

    try {
      const res = await getCiscoCommandInfo(userMsg.content, userMsg.image ? { data: userMsg.image, mimeType: 'image/jpeg' } : (userMsg.file ? { data: userMsg.file.data, mimeType: userMsg.file.mimeType } : undefined), isResearchMode ? 'gemini-3-pro-preview' : selectedModel.id, isResearchMode);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `Analysis complete.`, timestamp: Date.now(), metadata: res }]);
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found") && (window as any).aistudio) setHasApiKey(false);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: "Synthesis failure. Please verify your network or API key.", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      const next = historyIndex + 1;
      if (next < userPromptHistory.length) {
        if (historyIndex === -1) setDraftValue(inputValue);
        setHistoryIndex(next); setInputValue(userPromptHistory[next]);
      }
    } else if (e.key === 'ArrowDown') {
      const next = historyIndex - 1;
      if (next >= -1) {
        setHistoryIndex(next); setInputValue(next === -1 ? draftValue : userPromptHistory[next]);
      }
    }
  };

  const themeClasses = isDark ? {
    bg: 'bg-slate-950 text-slate-100',
    header: 'bg-slate-950/80 backdrop-blur-lg border-slate-800/60',
    input: 'bg-slate-900 border-slate-800 text-slate-100',
    util: 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:bg-slate-800',
    emptyCard: 'bg-slate-900 border-slate-800',
    suggestion: 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:bg-slate-800'
  } : {
    bg: 'bg-slate-50 text-slate-900',
    header: 'bg-white/80 backdrop-blur-lg border-slate-200/60',
    input: 'bg-slate-100 border-slate-200 text-slate-900',
    util: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm',
    emptyCard: 'bg-white border-slate-200 shadow-sm',
    suggestion: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
  };

  if (!hasApiKey && !isCheckingKey) {
    return (
      <div style={{ height: viewportHeight }} className={`flex flex-col items-center justify-center p-6 text-center ${themeClasses.bg}`}>
        <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-2xl animate-fadeIn">
          <i className="fas fa-shield-alt text-2xl text-white"></i>
        </div>
        
        <h2 className="text-2xl font-bold mb-2">Initialize Neural Engine</h2>
        <p className="max-w-xs mx-auto mb-8 text-sm opacity-70 leading-relaxed">
          This application runs locally in your browser. Connect your Gemini API key to activate the expert system.
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
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Paste your API key (sk-...)"
              className={`w-full py-3.5 pl-10 pr-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm transition-all ${themeClasses.input}`}
            />
          </div>

          <button 
            onClick={handleSaveKey}
            disabled={!apiKeyInput.trim()}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <span>Connect System</span>
            <i className="fas fa-arrow-right"></i>
          </button>
          
          {(window as any).aistudio && (
             <button onClick={() => (window as any).aistudio.openSelectKey().then(() => setHasApiKey(true))} className={`mt-4 w-full py-2 rounded-xl border border-dashed text-xs opacity-60 hover:opacity-100 ${isDark ? 'border-slate-800' : 'border-slate-300'}`}>Use IDX/Studio Key</button>
          )}

          <p className="text-[10px] opacity-40 mt-6 max-w-[280px] mx-auto">
            <i className="fas fa-lock mr-1"></i>
            Keys are stored securely in your browser's local storage. Free keys may use data for model training.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: viewportHeight }} className={`flex flex-col transition-colors duration-300 overflow-hidden ${themeClasses.bg} ${isDark ? 'dark-mode' : 'light-mode'}`}>
      <AppHeader 
        goHome={() => setView('home')} 
        handleClearHistory={() => clearConfirmState ? (setMessages([]), setView('home'), setClearConfirmState(false)) : setClearConfirmState(true)}
        clearConfirmState={clearConfirmState} isDark={isDark} setIsDark={setIsDark}
        handleGoogleAuth={handleGoogleAuth} googleUser={googleUser} isSyncing={isSyncing}
        selectedModel={selectedModel} setSelectedModel={setSelectedModel}
        isResearchMode={isResearchMode} setIsResearchMode={setIsResearchMode} themeClasses={themeClasses}
        handleDisconnectKey={handleDisconnectKey}
      />

      <main className="flex-1 overflow-hidden relative flex flex-col max-w-5xl mx-auto w-full">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth pb-8">
          {view === 'home' ? (
            <WelcomeScreen 
              isDark={isDark} themeClasses={themeClasses} 
              isPredictive={JSON.stringify(dynamicSuggestions) !== JSON.stringify(DEFAULT_SUGGESTIONS)}
              dynamicSuggestions={dynamicSuggestions} handleSuggestionClick={(s: string) => setInputValue(s)}
            />
          ) : (
            <div className="flex flex-col gap-6 w-full">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn w-full`}>
                  <div className={`${msg.role === 'user' ? 'max-w-[90%] sm:max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-tr-none p-3 sm:p-4 shadow-md' : 'w-full'}`}>
                    {msg.image && <img src={msg.image} className="max-w-full sm:max-w-sm rounded-lg mb-3 border border-white/20 shadow-lg" alt="User upload" />}
                    {msg.role === 'assistant' ? (msg.metadata ? <ResultCard data={msg.metadata} isDark={isDark} /> : <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>{msg.content}</div>) : <p className="text-sm font-medium break-words">{msg.content}</p>}
                  </div>
                </div>
              ))}
              {isLoading && <div className="animate-pulse p-4 w-full"><div className={`border p-6 rounded-xl w-full flex flex-col items-center justify-center gap-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}><div className="flex gap-2"><div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div><div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></div><div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.5s]"></div></div><span className="text-[10px] uppercase tracking-widest font-bold opacity-50">Synthesizing...</span></div></div>}
            </div>
          )}
        </div>
        
        <AppFooter 
          handleSubmit={handleSubmit} inputValue={inputValue} setInputValue={setInputValue} handleKeyDown={handleKeyDown}
          attachedFile={attachedFile} setAttachedFile={setAttachedFile} uploadMode={uploadMode} 
          toggleUploadMode={(e: any) => (e.stopPropagation(), setUploadMode(p => p === 'image' ? 'file' : 'image'), setAttachedFile(null))}
          fileInputRef={fileInputRef} isResearchMode={isResearchMode} setIsResearchMode={setIsResearchMode}
          isListening={isListening} toggleListening={toggleListening} isLoading={isLoading} isDark={isDark} themeClasses={themeClasses}
          handleFileUpload={(e: any) => {
            const file = e.target.files?.[0];
            if (file) {
              const r = new FileReader();
              r.onloadend = () => setAttachedFile({ data: r.result as string, mimeType: file.type || 'application/octet-stream', name: file.name });
              r.readAsDataURL(file);
            }
          }}
        />
      </main>
    </div>
  );
}
