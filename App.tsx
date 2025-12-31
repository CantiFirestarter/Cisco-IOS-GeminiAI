
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getCiscoCommandInfo, getDynamicSuggestions } from './services/geminiService';
import ResultCard from './components/ResultCard';

const MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: 'Complex Reasoning & Search' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'Speed Synthesis' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite', desc: 'Ultra-Low Latency' }
];

const STORAGE_KEY = 'cisco_cli_history';
const SUGGESTIONS_KEY = 'cisco_cli_suggestions';

const DEFAULT_SUGGESTIONS = [
  'BGP neighbor configuration', 
  'OSPF areas on IOS XR', 
  'VLAN interface setup', 
  'Show spanning-tree details'
];

export default function App() {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [view, setView] = useState(() => (messages.length === 0 ? 'home' : 'chat'));
  const [hasApiKey, setHasApiKey] = useState(true);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  const [dynamicSuggestions, setDynamicSuggestions] = useState(() => {
    try {
      const saved = localStorage.getItem(SUGGESTIONS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_SUGGESTIONS;
    } catch (e) {
      return DEFAULT_SUGGESTIONS;
    }
  });

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [attachedImage, setAttachedImage] = useState(null);
  
  const scrollRef = useRef(null);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const checkKey = async () => {
      // Check for specific platform key-selection availability
      if (window.aistudio?.hasSelectedApiKey) {
        try {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(selected);
        } catch (e) {
          console.warn("Key selection check unavailable", e);
        }
      }
      setIsCheckingKey(false);
    };
    checkKey();
  }, []);

  const handleOpenKeySelection = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success after trigger to avoid race condition
      setHasApiKey(true);
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    if (view === 'chat' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, view]);

  useEffect(() => {
    const updateSuggestions = async () => {
      const userQueries = messages
        .filter(m => m.role === 'user' && m.content !== "Image Analysis Request")
        .map(m => m.content)
        .slice(-3);
      
      if (userQueries.length > 0) {
        try {
          const newSuggestions = await getDynamicSuggestions(userQueries);
          if (Array.isArray(newSuggestions)) {
            setDynamicSuggestions(newSuggestions);
            localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(newSuggestions));
          }
        } catch (e) {
          console.error("Failed to update suggestions", e);
        }
      }
    };
    const timeout = setTimeout(updateSuggestions, 3000);
    return () => clearTimeout(timeout);
  }, [messages.length]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAttachedImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const trimmedValue = inputValue.trim();
    if ((!trimmedValue && !attachedImage) || isLoading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedValue || "Image Analysis Request",
      timestamp: Date.now(),
      image: attachedImage,
      modelName: selectedModel.name
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setAttachedImage(null);
    setIsLoading(true);
    setView('chat');

    try {
      const result = await getCiscoCommandInfo(userMsg.content, userMsg.image, selectedModel.id);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Cisco Intelligence Synthesis`,
        timestamp: Date.now(),
        metadata: result,
        grounded: !!result.sources?.length
      }]);
    } catch (error) {
      const errorMsg = error.message?.includes("Requested entity was not found") 
        ? "API Access Revoked: Project not found or billing inactive. Please re-select your key."
        : "System Fault: Unable to reach Cisco CLI Synthesis node. Please check your connectivity.";
      
      if (error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMsg,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const themeClasses = isDark ? { 
    bg: 'bg-slate-950 text-slate-100', 
    header: 'bg-black border-slate-800', 
    input: 'bg-slate-900 border-slate-800 text-slate-100', 
    util: 'bg-slate-900 border-slate-800 text-slate-400',
    emptyCard: 'bg-slate-900 border-slate-800',
    suggestion: 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:bg-slate-800'
  } : { 
    bg: 'bg-slate-50 text-slate-900', 
    header: 'bg-white border-slate-200', 
    input: 'bg-slate-100 border-slate-200 text-slate-900', 
    util: 'bg-slate-100 border-slate-200 text-slate-600',
    emptyCard: 'bg-white border-slate-200 shadow-sm',
    suggestion: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
  };

  if (!hasApiKey && !isCheckingKey) {
    return (
      <div className={`flex flex-col h-screen items-center justify-center p-6 text-center ${themeClasses.bg}`}>
        <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-2xl animate-pulse">
          <i className="fas fa-shield-alt text-2xl text-white"></i>
        </div>
        <h2 className="text-2xl font-bold mb-2">Enterprise Verification</h2>
        <p className={`max-w-md mb-8 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Secure CLI access requires an active Gemini 3 API key. Please select a project with active billing to continue.
        </p>
        <button onClick={handleOpenKeySelection} className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-xl transition-all active:scale-95 mb-4">
          Activate Service
        </button>
        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener" className="text-xs text-blue-500 hover:underline">Billing & Quota Policy</a>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen transition-colors duration-300 ${themeClasses.bg}`}>
      <header className={`border-b p-4 flex items-center justify-between z-10 ${themeClasses.header}`}>
        <button onClick={() => setView('home')} className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg"><i className="fas fa-network-wired text-white"></i></div>
          <div className="hidden xs:block text-left">
            <h1 className="font-bold text-sm leading-tight">Cisco Expert</h1>
            <p className="text-[9px] opacity-40 font-mono">NODE_DEPLOY:PROD</p>
          </div>
        </button>
        
        <div className="flex items-center gap-2">
          <button onClick={() => setIsDark(!isDark)} className={`w-10 h-10 rounded-xl border flex items-center justify-center ${themeClasses.util}`}>
            <i className={`fas ${isDark ? 'fa-sun text-amber-400' : 'fa-moon'}`}></i>
          </button>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`hidden sm:flex items-center gap-3 px-4 h-10 rounded-xl border ${themeClasses.util}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold">{selectedModel.name}</span>
            </button>
            {isMenuOpen && (
              <div className={`absolute right-0 mt-2 w-64 rounded-xl border shadow-2xl z-50 p-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                {MODELS.map(m => (
                  <button key={m.id} onClick={() => { setSelectedModel(m); setIsMenuOpen(false); }} className={`w-full text-left p-3 rounded-lg text-xs font-bold ${selectedModel.id === m.id ? 'bg-blue-600 text-white' : 'hover:bg-blue-500/10'}`}>{m.name}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative flex flex-col max-w-5xl mx-auto w-full">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
          {view === 'home' ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-xl ${themeClasses.emptyCard}`}>
                <i className="fas fa-terminal text-2xl text-blue-500"></i>
              </div>
              <h2 className="text-xl font-bold mb-2">Terminal Ready</h2>
              <p className="text-xs opacity-50 mb-8 max-w-xs">Awaiting syntax analysis or architectural query...</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {dynamicSuggestions.map((s, i) => (
                  <button key={i} onClick={() => setInputValue(s)} className={`p-3 rounded-xl border text-left text-xs font-medium transition-all ${themeClasses.suggestion}`}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                <div className={`${msg.role === 'user' ? 'max-w-[80%] bg-blue-600 text-white rounded-2xl p-4' : 'w-full'}`}>
                  {msg.image && <img src={msg.image} className="max-w-xs rounded-lg mb-3 border border-white/20 shadow-md" alt="Upload Preview" />}
                  {msg.grounded && <div className="text-[9px] uppercase tracking-tighter font-black text-blue-400 mb-2"><i className="fas fa-globe mr-1"></i> Live Grounding Active</div>}
                  {msg.metadata ? <ResultCard data={msg.metadata} isDark={isDark} /> : <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex flex-col gap-2 items-start p-4 animate-pulse">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
              <span className="text-[9px] font-bold opacity-30 uppercase tracking-widest">Compiling CLI Context...</span>
            </div>
          )}
        </div>

        <div className={`p-4 border-t ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto items-center">
            <button type="button" onClick={() => fileInputRef.current.click()} className={`p-3 rounded-xl border transition-colors ${themeClasses.util} hover:text-blue-500`}><i className="fas fa-camera"></i></button>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter Cisco command or query..."
              className={`flex-1 px-4 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-sm ${themeClasses.input}`}
            />
            <button type="submit" disabled={isLoading} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-500 transition-all disabled:opacity-50">
              {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-arrow-right"></i>}
            </button>
          </form>
          {attachedImage && (
            <div className="mt-2 flex items-center gap-2">
              <div className="relative">
                <img src={attachedImage} className="w-10 h-10 rounded border border-blue-500 object-cover" alt="Selected" />
                <button onClick={() => setAttachedImage(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[8px] flex items-center justify-center">×</button>
              </div>
              <span className="text-[10px] text-blue-500 font-bold">Image ready for analysis</span>
            </div>
          )}
        </div>
      </main>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}
