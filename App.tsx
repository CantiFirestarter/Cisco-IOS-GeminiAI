
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
      console.error("Failed to load history:", e);
      return [];
    }
  });

  const [view, setView] = useState(() => (messages.length === 0 ? 'home' : 'chat'));
  const [hasApiKey, setHasApiKey] = useState(true); 
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  const [isAiStudioEnv, setIsAiStudioEnv] = useState(false);
  const [viewportHeight, setViewportHeight] = useState('100dvh');

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
  
  const [uploadMode, setUploadMode] = useState<'image' | 'file'>('image');
  const [attachedFile, setAttachedFile] = useState<{ data: string, mimeType: string, name: string } | null>(null);

  const [clearConfirmState, setClearConfirmState] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isResearchMode, setIsResearchMode] = useState(false);

  const clearTimerRef = useRef(null);
  const scrollRef = useRef(null);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!window.visualViewport) return;

    const handleResize = () => {
      setViewportHeight(`${window.visualViewport.height}px`);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        setIsListening(false);
      }
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputValue(prev => prev + (prev ? ' ' : '') + transcript);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        recognitionRef.current = null;
        
        if (event.error === 'not-allowed') {
          alert("Microphone access was denied. Please check your browser's site permissions.");
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to initialize speech:", err);
      setIsListening(false);
    }
  };

  useEffect(() => {
    const checkKey = async () => {
      const isStudio = !!(window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function');
      setIsAiStudioEnv(isStudio);
      
      if (isStudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        // For Vercel/Standard: check if process.env.API_KEY actually exists
        // (It might be "undefined" as a string if define was used incorrectly)
        const key = process.env.API_KEY;
        setHasApiKey(!!key && key !== "undefined");
      }
      setIsCheckingKey(false);
    };
    checkKey();
  }, []);

  const handleOpenKeySelection = async () => {
    if (isAiStudioEnv) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); 
    } else {
      alert("Please ensure API_KEY is set in Vercel project settings and trigger a NEW deployment.");
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    if (view === 'chat' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, view]);

  const isPredictive = useMemo(() => {
    return JSON.stringify(dynamicSuggestions) !== JSON.stringify(DEFAULT_SUGGESTIONS);
  }, [dynamicSuggestions]);

  useEffect(() => {
    const updateSuggestions = async () => {
      const userQueries = [];
      for (let i = 0; i < messages.length - 1; i++) {
        const msg = messages[i];
        const nextMsg = messages[i + 1];
        
        const isValidUserMsg = msg.role === 'user' && msg.content !== "Analyze attached resource";
        const isValidAssistantResponse = nextMsg && nextMsg.role === 'assistant' && nextMsg.metadata && !nextMsg.metadata.isOutOfScope;

        if (isValidUserMsg && isValidAssistantResponse) {
          userQueries.push(msg.content);
        }
      }

      const recentQueries = userQueries.slice(-5);

      if (recentQueries.length > 0) {
        const newSuggestions = await getDynamicSuggestions(recentQueries);
        setDynamicSuggestions(newSuggestions);
        localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(newSuggestions));
      } else {
        setDynamicSuggestions(DEFAULT_SUGGESTIONS);
        localStorage.removeItem(SUGGESTIONS_KEY);
      }
    };

    const timeout = setTimeout(updateSuggestions, 1500);
    return () => clearTimeout(timeout);
  }, [messages.length]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedFile({
          data: reader.result as string,
          mimeType: file.type || 'application/octet-stream',
          name: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleUploadMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadMode(prev => prev === 'image' ? 'file' : 'image');
    setAttachedFile(null);
  };

  const goHome = () => setView('home');

  const hardReset = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SUGGESTIONS_KEY);
    setDynamicSuggestions(DEFAULT_SUGGESTIONS);
    setClearConfirmState(false);
    setView('home');
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
  };

  const handleClearHistory = () => {
    if (!clearConfirmState) {
      setClearConfirmState(true);
      clearTimerRef.current = setTimeout(() => {
        setClearConfirmState(false);
      }, 3000);
    } else {
      hardReset();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const trimmedValue = inputValue.trim();
    if ((!trimmedValue && !attachedFile) || isLoading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedValue || `Analyze attached ${uploadMode}`,
      timestamp: Date.now(),
      image: attachedFile?.mimeType.startsWith('image/') ? attachedFile.data : undefined,
      file: !attachedFile?.mimeType.startsWith('image/') ? attachedFile : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setAttachedFile(null);
    setIsLoading(true);
    setView('chat');

    try {
      const modelToUse = isResearchMode ? 'gemini-3-pro-preview' : selectedModel.id;
      const result = await getCiscoCommandInfo(
        userMsg.content, 
        userMsg.image ? { data: userMsg.image, mimeType: 'image/jpeg' } : (userMsg.file ? { data: userMsg.file.data, mimeType: userMsg.file.mimeType } : undefined), 
        modelToUse, 
        isResearchMode
      );
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Analysis complete for requested resource.`,
        timestamp: Date.now(),
        metadata: result
      }]);
    } catch (error) {
      console.error("Submit error:", error);
      let errorMessage = "Synthesis failure. This usually occurs if the API key is invalid or the model capacity is exceeded.";
      
      if (!process.env.API_KEY || process.env.API_KEY === "undefined") {
        errorMessage = "CRITICAL: API Key not found in build environment. Please add API_KEY to Vercel settings and RE-DEPLOY the application.";
      } else if (error.message?.includes("Requested entity was not found")) {
        errorMessage = isAiStudioEnv ? "API Key selection required. Re-authenticate via the header." : "Model access error. The selected model might be unavailable in your region or your API key lacks permission.";
      } else if (error.message?.includes("No valid JSON")) {
        errorMessage = "Protocol Analysis Error: The AI response could not be structured into the Cisco Command Schema. Try refining your query.";
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
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
        <div className="bg-rose-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-2xl animate-pulse">
          <i className="fas fa-exclamation-triangle text-2xl text-white"></i>
        </div>
        <h2 className="text-2xl font-bold mb-2">Build Configuration Error</h2>
        <p className={`max-w-md mb-8 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          The `API_KEY` was not injected during the Vercel build process. Add the environment variable in your dashboard and <strong>Redeploy</strong>.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={handleOpenKeySelection}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg transition-all"
          >
            {isAiStudioEnv ? 'Select API Key' : 'Troubleshoot Deployment'}
          </button>
          <a
            href="https://vercel.com/docs/concepts/projects/environment-variables"
            target="_blank"
            className="text-xs text-blue-500 hover:underline"
          >
            How to set Vercel Environment Variables
          </a>
        </div>
      </div>
    );
  }

  const getShortModelName = () => {
    if (isResearchMode) return 'Research';
    const parts = selectedModel.name.split(' ');
    return parts.slice(1).join(' ');
  };

  return (
    <div style={{ height: viewportHeight }} className={`flex flex-col transition-colors duration-300 overflow-hidden ${themeClasses.bg} ${isDark ? 'dark-mode' : 'light-mode'}`}>
      <header className={`border-b p-3 sm:p-4 pb-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between z-10 shrink-0 ${themeClasses.header}`}>
        <button
          onClick={goHome}
          className="flex items-center gap-2 sm:gap-3 group text-left transition-transform active:scale-95 overflow-hidden"
        >
          <div className="bg-blue-600 p-1.5 sm:p-2 rounded-lg shadow-lg group-hover:bg-blue-500 transition-colors group-hover:scale-105 transform shrink-0">
            <i className="fas fa-network-wired text-base sm:text-xl text-white"></i>
          </div>
          <div className="flex flex-col overflow-hidden">
            <h1 className="font-bold text-sm sm:text-lg leading-tight tracking-tight group-hover:text-blue-500 transition-colors truncate">Cisco CLI Expert</h1>
            <p className={`text-[7px] sm:text-[10px] uppercase tracking-[0.1em] sm:tracking-[0.15em] font-bold block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {isDark ? 'DARK INTELLIGENCE OPS' : 'ENTERPRISE LIGHT PROTOCOL'}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={handleClearHistory}
            className={`px-2 sm:px-3 h-8 sm:h-10 rounded-xl border transition-all flex items-center gap-2 ${clearConfirmState
                ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                : `${themeClasses.util} hover:text-rose-500`
              }`}
          >
            <i className={`fas ${clearConfirmState ? 'fa-exclamation-triangle' : 'fa-trash-alt'} text-xs sm:text-sm`}></i>
            {clearConfirmState && <span className="text-[10px] font-bold uppercase hidden sm:inline">Reset?</span>}
          </button>

          <button onClick={() => setIsDark(!isDark)} className={`p-1.5 sm:p-2 rounded-xl border w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center ${themeClasses.util}`}>
            <i className={`fas ${isDark ? 'fa-sun text-amber-400' : 'fa-moon'} text-xs sm:text-sm`}></i>
          </button>

          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              className={`flex items-center gap-1.5 sm:gap-3 px-2 sm:px-4 h-8 sm:h-10 rounded-xl border transition-all ${themeClasses.util} ${isMenuOpen ? 'ring-2 ring-blue-500/50' : ''}`}
            >
              <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isResearchMode ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              <span className="text-[10px] sm:text-xs font-bold sm:font-semibold truncate max-w-[50px] sm:max-w-none">
                {getShortModelName()}
              </span>
              <i className="fas fa-chevron-down text-[8px] sm:text-[10px] opacity-40 ml-0.5"></i>
            </button>
            
            {isMenuOpen && (
              <div className={`absolute right-0 mt-2 w-56 sm:w-64 rounded-xl border shadow-2xl z-50 animate-menuIn ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="p-2 space-y-1">
                  <div className="px-3 py-2 text-[9px] uppercase tracking-widest font-bold opacity-40 border-b border-white/5 mb-1">Select Engine</div>
                  {MODELS.map((m) => (
                    <button 
                      key={m.id} 
                      onClick={() => { setSelectedModel(m); setIsMenuOpen(false); setIsResearchMode(false); }} 
                      className={`w-full text-left p-2.5 sm:p-3 rounded-lg transition-colors ${selectedModel.id === m.id && !isResearchMode ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-opacity-10 hover:bg-slate-500 text-slate-400'}`}
                    >
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

      <main className="flex-1 overflow-hidden relative flex flex-col max-w-5xl mx-auto w-full">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth pb-8">
          {view === 'home' ? (
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:grid-cols-2 gap-3 w-full max-w-2xl mb-8">
                {dynamicSuggestions.map((suggestion, idx) => (
                  <button
                    key={`${suggestion}-${idx}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`p-3 border rounded-xl text-left text-xs sm:text-sm transition-all flex items-center justify-between group animate-fadeIn ${themeClasses.suggestion}`}
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    <span className="truncate pr-2">{suggestion}</span>
                    <i className="fas fa-chevron-right text-slate-300 group-hover:text-blue-500 transition-colors text-[10px] shrink-0"></i>
                  </button>
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
                      Standard AI knowledge has a "<strong>cutoff</strong>." Deep Research connects Gemini to <strong>live Cisco documentation</strong> via <strong>Google Search</strong>.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
                      <i className="fas fa-lightbulb text-blue-500/60"></i> When to use it?
                    </div>
                    <p className={`text-[11px] sm:text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      <strong>Critical</strong> for <strong>niche commands</strong>, <strong>high-stakes changes</strong>, or verifying syntax for the <strong>latest IOS software trains</strong>.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
                      <i className="fas fa-check-double text-blue-500/60"></i> How to use it?
                    </div>
                    <p className={`text-[11px] sm:text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Toggle the <strong>Search Icon</strong> inside the command bar. The interface will <strong>glow blue</strong> when <strong>live verification</strong> is active.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 w-full">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn w-full`}>
                  <div className={`${msg.role === 'user' ? 'max-w-[90%] sm:max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-tr-none p-3 sm:p-4 shadow-md' : 'w-full'}`}>
                    {msg.image && <img src={msg.image} className="max-w-full sm:max-w-sm rounded-lg mb-3 border border-white/20 shadow-lg" alt="User upload" />}
                    {msg.file && (
                      <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl border border-white/20 mb-3">
                        <i className="fas fa-file-code text-xl"></i>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-xs font-bold truncate">{msg.file.name}</span>
                          <span className="text-[9px] opacity-60 uppercase">{msg.file.mimeType}</span>
                        </div>
                      </div>
                    )}
                    {msg.role === 'assistant' ? (
                      msg.metadata ? <ResultCard data={msg.metadata} isDark={isDark} /> : <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>{msg.content}</div>
                    ) : <p className="text-sm font-medium break-words">{msg.content}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex justify-start animate-pulse p-4 w-full">
              <div className={`border p-6 rounded-xl shadow-xl w-full flex flex-col items-center justify-center gap-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.5s]"></div>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-widest font-bold opacity-50 mb-1">Synthesizing Network Intelligence...</span>
                  {isResearchMode && <span className="text-[9px] text-blue-400 animate-pulse font-bold"><i className="fas fa-search mr-1"></i> Live Web Research in Progress</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t shrink-0 ${isDark ? 'bg-slate-950/90 border-slate-800 backdrop-blur-md' : 'bg-white/90 border-slate-200 backdrop-blur-md'}`}>
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="flex gap-2 items-center">
              <div className="relative group/att shrink-0">
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current.click()} 
                  className={`p-3 w-10 h-10 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center shrink-0 ${themeClasses.util} hover:bg-blue-500/10 hover:text-blue-500 transition-all shadow-sm group`}
                  title={uploadMode === 'image' ? "Attach Image" : "Attach Configuration File"}
                >
                  <i className={`fas ${uploadMode === 'image' ? 'fa-camera' : 'fa-paperclip'} text-sm sm:text-base`}></i>
                  
                  <div 
                    onClick={toggleUploadMode}
                    className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border flex items-center justify-center text-[8px] transition-all hover:scale-110 active:scale-95 z-20 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-sm'
                    } hover:bg-blue-600 hover:text-white hover:border-blue-500`}
                  >
                    <i className="fas fa-sync-alt"></i>
                  </div>
                </button>
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept={uploadMode === 'image' ? "image/*" : ".txt,.cfg,.log,.pdf,application/pdf,text/plain"} 
                className="hidden" 
              />
              
              <div className="relative flex-1 group">
                <button
                  type="button"
                  onClick={() => setIsResearchMode(!isResearchMode)}
                  className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-all group/res ${
                    isResearchMode 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                    : `${isDark ? 'text-slate-500 hover:text-slate-300 bg-slate-800/50' : 'text-slate-400 hover:text-slate-600 bg-slate-200/50'}`
                  }`}
                  title={isResearchMode ? "Disable Deep Research" : "Enable Deep Research (Live Web Verification)"}
                >
                  <i className={`fas fa-search ${isResearchMode ? 'animate-pulse' : ''} text-[10px] sm:text-xs`}></i>
                  {isResearchMode && <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-blue-600"></span>}
                </button>

                {attachedFile && (
                  <div className="absolute left-12 top-1/2 -translate-y-1/2 z-10 animate-fadeIn">
                    <div className="relative flex items-center gap-1.5 bg-blue-600/10 border border-blue-500/30 px-1.5 py-1 rounded-lg">
                      {attachedFile.mimeType.startsWith('image/') ? (
                        <img src={attachedFile.data} className="w-6 h-6 sm:w-8 sm:h-8 object-cover rounded border border-blue-500/50" alt="Preview" />
                      ) : (
                        <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center bg-blue-500/20 rounded border border-blue-500/50">
                          <i className="fas fa-file-alt text-[10px] text-blue-500"></i>
                        </div>
                      )}
                      <div className="flex flex-col max-w-[60px] sm:max-w-[100px]">
                        <span className="text-[8px] font-bold truncate text-blue-500">{attachedFile.name}</span>
                      </div>
                      <button onClick={() => setAttachedFile(null)} className="text-rose-500 hover:text-rose-400 transition-colors p-0.5"><i className="fas fa-times text-[9px]"></i></button>
                    </div>
                  </div>
                )}

                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={attachedFile ? `Analysing ${attachedFile.name}...` : (isResearchMode ? "Searching Cisco Live..." : "Enter CLI Command...")}
                  className={`w-full py-2.5 sm:py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-xs sm:text-sm transition-all ${themeClasses.input} ${
                    attachedFile ? 'pl-32 sm:pl-44' : 'pl-12'
                  }`}
                />
              </div>

              <button 
                type="button" 
                onClick={toggleListening} 
                className={`p-3 w-10 h-10 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center shrink-0 transition-all shadow-sm ${
                  isListening ? 'bg-rose-600 border-rose-500 text-white animate-pulse shadow-[0_0_15px_rgba(225,29,72,0.4)]' : 
                  `${themeClasses.util} hover:bg-blue-500/10 hover:text-blue-500`
                }`}
                title="Voice Input"
              >
                <i className="fas fa-microphone text-sm sm:text-base"></i>
              </button>

              <button 
                type="submit" 
                disabled={(!inputValue.trim() && !attachedFile) || isLoading} 
                className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 disabled:opacity-50 shadow-lg flex items-center justify-center shrink-0 transition-all transform active:scale-95"
                title="Execute Query"
              >
                <i className="fas fa-arrow-right text-base sm:text-lg"></i>
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
