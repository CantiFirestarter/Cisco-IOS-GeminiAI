
import React, { useState, useRef } from 'react';
import { synthesizeSpeech } from '../services/geminiService';

const FormattedText = ({ text, isDark, className = "" }) => {
  if (!text || text === "N/A") return null;
  
  const cleanedText = text
    .replace(/\(\s*(`.*?`)\s*\)/g, '$1')
    .replace(/'([^']+)'/g, '<$1>')
    .replace(/<([^>]+)\/([^>]+)>/g, '<$1|$2>');
  
  const lines = cleanedText.split('\n');
  const renderInline = (input) => {
    const parts = input.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className={`italic opacity-90 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className={`px-1.5 py-0.5 rounded font-mono text-[0.85em] border transition-colors shadow-sm inline-block max-w-full whitespace-pre break-keep align-baseline leading-none mx-0.5 ${isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-slate-100 text-blue-600 border-slate-200'}`}>
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className={`${className} flex flex-col gap-1.5 hyphens-none break-words`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1"></div>;

        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const isNumberBullet = /^\d+\.\s/.test(trimmed);

        if (isBullet || isNumberBullet) {
          const bulletPrefix = isNumberBullet ? trimmed.match(/^\d+\.\s/)[0] : '';
          let bulletContent = isNumberBullet ? trimmed.replace(/^\d+\.\s/, '') : trimmed.substring(2);
          
          const colonMatch = bulletContent.match(/^(.+?)\s?:\s?([^`]+)$/);
          if (colonMatch && !bulletContent.includes('`')) {
            const cmdPart = colonMatch[1].trim();
            const descPart = colonMatch[2].trim();

            const looksLikeCommand = cmdPart.length < 50 && !cmdPart.includes('.') && (cmdPart.includes('<') || cmdPart.split(' ').length < 6);

            if (looksLikeCommand) {
              return (
                <div key={idx} className="flex gap-2 pl-1 mb-1">
                  <span className={`text-[10px] mt-1.5 shrink-0 font-bold ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    {isNumberBullet ? bulletPrefix : <i className="fas fa-circle text-[6px] text-blue-500/60"></i>}
                  </span>
                  <div className="flex-1 leading-relaxed">
                    <code className={`px-1.5 py-0.5 rounded font-mono text-[0.85em] border transition-colors shadow-sm inline-block max-w-full whitespace-pre break-keep align-baseline leading-none ${isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-slate-100 text-blue-600 border-slate-200'}`}>
                      {cmdPart}
                    </code>
                    <span className={`mx-2 font-bold opacity-40 ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>:</span>
                    <span className={`${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{renderInline(descPart)}</span>
                  </div>
                </div>
              );
            }
          }

          return (
            <div key={idx} className="flex gap-2 pl-1 mb-0.5">
              <span className={`text-[10px] mt-1.5 shrink-0 font-bold ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {isNumberBullet ? bulletPrefix : <i className="fas fa-circle text-[6px] text-blue-500/60"></i>}
              </span>
              <span className={`flex-1 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{renderInline(bulletContent)}</span>
            </div>
          );
        }
        
        return <div key={idx} className={`leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{renderInline(line)}</div>;
      })}
    </div>
  );
};

const Section = ({ title, icon, content, color, isDark, isCode = false, onListen, isListening, isSynthesizing }) => {
  if (!content || content === "N/A") return null;
  const [copied, setCopied] = useState(false);
  
  const rawContent = isCode ? content.replace(/`/g, '') : content;

  const processedContent = rawContent
    .replace(/\(\s*(`.*?`)\s*\)/g, '$1')
    .replace(/'([^']+)'/g, '<$1>')
    .replace(/<([^>]+)\/([^>]+)>/g, '<$1|$2>');

  const handleCopy = () => {
    navigator.clipboard.writeText(processedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-4 sm:mb-6 last:mb-0 relative group">
      <div className={`flex items-center justify-between mb-2`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`flex items-center gap-2 ${color}`}>
            <i className={`fas ${icon} text-[10px] opacity-80`}></i>
            <h3 className="font-bold uppercase text-[9px] sm:text-[10px] tracking-widest">{title}</h3>
          </div>
          {onListen && (
            <button 
              onClick={onListen}
              disabled={isSynthesizing && !isListening}
              className={`w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-full transition-all active:scale-90 ${
                isListening 
                  ? 'bg-blue-600 text-white shadow-lg animate-pulse' 
                  : isDark ? 'text-slate-600 hover:text-blue-400 bg-slate-900' : 'text-slate-400 hover:text-blue-600 bg-slate-100'
              }`}
            >
              {isSynthesizing && !isListening ? (
                <i className="fas fa-circle-notch fa-spin text-[8px]"></i>
              ) : (
                <i className={`fas ${isListening ? 'fa-stop' : 'fa-volume-up'} text-[8px]`}></i>
              )}
            </button>
          )}
        </div>
        {isCode && (
          <button onClick={handleCopy} className={`text-[9px] sm:text-[10px] flex items-center gap-1.5 px-2 py-1.5 sm:py-1 rounded transition-colors active:scale-95 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>
            <i className={`fas ${copied ? 'fa-check text-emerald-500' : 'fa-copy'}`}></i>
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      <div className={`p-3 sm:p-4 rounded-xl border transition-all duration-300 ${isCode ? 'bg-black text-emerald-400 font-mono text-xs sm:text-sm border-slate-800 overflow-x-auto' : `${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} text-slate-300`}`}>
        {isCode ? <div className="whitespace-pre leading-relaxed overflow-x-auto pb-1">{processedContent}</div> : <FormattedText text={processedContent} isDark={isDark} className="text-xs sm:text-sm" />}
      </div>
    </div>
  );
};

export default function ResultCard({ data, isDark }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [activeSpeechId, setActiveSpeechId] = useState(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const audioSourceRef = useRef(null);

  const stopCurrentSpeech = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    setActiveSpeechId(null);
  };

  const handleToggleSpeech = async (id, text, prefix = "") => {
    if (activeSpeechId === id) {
      stopCurrentSpeech();
      return;
    }
    if (activeSpeechId !== null) stopCurrentSpeech();

    try {
      setIsSynthesizing(true);
      const cleanText = text.replace(/`/g, '');
      const fullSpeechText = prefix ? `${prefix}: ${cleanText}` : cleanText;
      const { audioBuffer, audioCtx } = await synthesizeSpeech(fullSpeechText);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        setActiveSpeechId(null);
        audioSourceRef.current = null;
      };
      source.start(0);
      audioSourceRef.current = source;
      setActiveSpeechId(id);
    } catch (err) {
      console.error("Speech Synthesis Error:", err);
      setActiveSpeechId(null);
    } finally {
      setIsSynthesizing(false);
    }
  };

  if (data.isOutOfScope) {
    return (
      <div className={`p-6 rounded-2xl border flex flex-col items-center text-center gap-4 animate-fadeIn ${isDark ? 'bg-amber-950/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${isDark ? 'bg-amber-500/20 text-amber-500' : 'bg-amber-100 text-amber-600'}`}>
          <i className="fas fa-shield-halved text-xl"></i>
        </div>
        <div>
          <h3 className={`font-bold uppercase tracking-widest text-xs mb-1 ${isDark ? 'text-amber-500' : 'text-amber-700'}`}>Protocol Exception</h3>
          <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{data.description}</p>
        </div>
        <div className={`text-[10px] font-mono opacity-50 ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>SCOPE_VIOLATION_ERR:DOMAIN_RESTRICTED</div>
      </div>
    );
  }

  const playSummary = () => {
    const mainText = data.isTechnicalQuestion ? data.generalAnswer : data.description;
    const summaryText = `Cisco expert intelligence. ${data.isTechnicalQuestion ? 'Question Response' : 'Command Analysis'}. ${mainText.replace(/`/g, '')}`;
    handleToggleSpeech('summary', summaryText);
  };

  const getStyle = (type, val) => {
    const isConfig = val?.toLowerCase().includes('config');
    if (type === 'cat') {
      if (val === 'Switch') return { bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50', text: 'text-blue-500', border: 'border-blue-500/20', icon: 'fa-server' };
      if (val === 'Router') return { bg: isDark ? 'bg-orange-500/10' : 'bg-orange-50', text: 'text-orange-500', border: 'border-orange-500/20', icon: 'fa-route' };
      return { bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50', text: 'text-emerald-500', border: 'border-emerald-500/20', icon: 'fa-globe' };
    }
    return isConfig 
      ? { bg: isDark ? 'bg-rose-500/10' : 'bg-rose-50', text: 'text-rose-500', border: 'border-rose-500/20', icon: 'fa-wrench' }
      : { bg: isDark ? 'bg-sky-500/10' : 'bg-sky-50', text: 'text-sky-500', border: 'border-sky-500/20', icon: 'fa-terminal' };
  };

  const catS = getStyle('cat', data.deviceCategory);
  const modeS = getStyle('mode', data.commandMode);

  return (
    <div className="flex flex-col gap-4 animate-fadeIn w-full overflow-hidden">
      {data.correction && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border animate-fadeIn ${isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          <i className="fas fa-magic text-xs"></i>
          <div className="text-xs font-semibold"><span className="opacity-70">Correction:</span> {data.correction}</div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-[9px] sm:text-[10px] font-bold uppercase ${catS.bg} ${catS.text} ${catS.border}`}>
          <i className={`fas ${catS.icon}`}></i>{data.deviceCategory}
        </div>
        {data.commandMode !== "N/A" && (
          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-[9px] sm:text-[10px] font-bold uppercase ${modeS.bg} ${modeS.text} ${modeS.border}`}>
            <i className={`fas ${modeS.icon}`}></i>{data.commandMode}
          </div>
        )}
        {data.isTechnicalQuestion && (
          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-[9px] sm:text-[10px] font-bold uppercase ${isDark ? 'bg-blue-600/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>
            <i className="fas fa-lightbulb"></i>Expert Insight
          </div>
        )}
        
        <div className="w-full sm:w-auto flex flex-1 justify-end gap-1.5 sm:gap-2">
          <button 
            onClick={playSummary} 
            disabled={isSynthesizing && activeSpeechId !== 'summary'}
            className={`px-3 py-1.5 rounded-xl border text-[9px] sm:text-[10px] font-bold uppercase flex items-center gap-2 transition-all active:scale-95 ${
              activeSpeechId === 'summary' ? 'bg-blue-600 border-blue-500 text-white animate-pulse' : 
              isDark ? 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'
            }`}
          >
            {isSynthesizing && activeSpeechId === 'summary' ? <i className="fas fa-circle-notch fa-spin"></i> : <i className={`fas ${activeSpeechId === 'summary' ? 'fa-stop' : 'fa-volume-up'}`}></i>}
            <span className="hidden xs:inline">{activeSpeechId === 'summary' ? 'Stop' : 'Listen All'}</span>
          </button>
          
          <button onClick={() => setShowReasoning(!showReasoning)} className={`px-3 py-1.5 rounded-xl border text-[9px] sm:text-[10px] font-bold uppercase flex items-center gap-2 transition-colors active:scale-95 ${isDark ? 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'}`}>
            <i className="fas fa-brain text-blue-500"></i> <span className="hidden xs:inline">Logic</span> {showReasoning ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {showReasoning && (
        <div className={`px-4 py-3 rounded-xl border animate-menuIn ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
          <FormattedText text={data.reasoning} isDark={isDark} className="text-[11px] sm:text-xs italic opacity-70" />
        </div>
      )}

      {data.isTechnicalQuestion && data.generalAnswer ? (
        <div className="flex flex-col gap-4 animate-fadeIn">
          <div className={`p-5 sm:p-7 rounded-2xl border transition-all duration-300 shadow-sm leading-relaxed ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
            <div className="flex items-center gap-3 mb-4 opacity-50">
              <i className="fas fa-quote-left text-blue-500"></i>
              <span className="text-[10px] font-bold uppercase tracking-widest">Architectural Synthesis</span>
            </div>
            <FormattedText text={data.generalAnswer} isDark={isDark} className="text-sm sm:text-base" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Section 
              title="Reference Examples" icon="fa-code" content={data.examples} color="text-emerald-500" isDark={isDark} isCode={true} 
              onListen={() => handleToggleSpeech('Examples', data.examples, "Reference Examples")}
              isListening={activeSpeechId === 'Examples'}
              isSynthesizing={isSynthesizing}
            />
            <Section 
              title="Operational Best Practices" icon="fa-tasks" content={data.usageGuidelines} color="text-violet-500" isDark={isDark} 
              onListen={() => handleToggleSpeech('Guidelines', data.usageGuidelines, "Operational Best Practices")}
              isListening={activeSpeechId === 'Guidelines'}
              isSynthesizing={isSynthesizing}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-y-2">
          <Section 
            title="Syntax" icon="fa-terminal" content={data.syntax} color="text-blue-500" isDark={isDark} isCode={true} 
            onListen={() => handleToggleSpeech('Syntax', data.syntax, "Command Syntax")}
            isListening={activeSpeechId === 'Syntax'}
            isSynthesizing={isSynthesizing}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <Section 
              title="Description" icon="fa-info-circle" content={data.description} color="text-indigo-500" isDark={isDark} 
              onListen={() => handleToggleSpeech('Description', data.description, "Description")}
              isListening={activeSpeechId === 'Description'}
              isSynthesizing={isSynthesizing}
            />
            <Section 
              title="Context" icon="fa-layer-group" content={data.usageContext} color="text-teal-500" isDark={isDark} 
              onListen={() => handleToggleSpeech('Context', data.usageContext, "Usage Context")}
              isListening={activeSpeechId === 'Context'}
              isSynthesizing={isSynthesizing}
            />
          </div>
          <Section 
            title="Usage Guidelines" icon="fa-book-open" content={data.usageGuidelines} color="text-violet-500" isDark={isDark} 
            onListen={() => handleToggleSpeech('Guidelines', data.usageGuidelines, "Usage Guidelines")}
            isListening={activeSpeechId === 'Guidelines'}
            isSynthesizing={isSynthesizing}
          />
          <Section 
            title="Configuration Checklist" icon="fa-tasks" content={data.checklist} color="text-cyan-400" isDark={isDark} 
            onListen={() => handleToggleSpeech('Checklist', data.checklist, "Configuration Checklist")}
            isListening={activeSpeechId === 'Checklist'}
            isSynthesizing={isSynthesizing}
          />
          <Section 
            title="Options" icon="fa-list-ul" content={data.options} color="text-sky-400" isDark={isDark} 
            onListen={() => handleToggleSpeech('Options', data.options, "Available Options")}
            isListening={activeSpeechId === 'Options'}
            isSynthesizing={isSynthesizing}
          />
          <Section 
            title="Troubleshooting & Verification" icon="fa-tools" content={data.troubleshooting} color="text-fuchsia-500" isDark={isDark} 
            onListen={() => handleToggleSpeech('Troubleshooting', data.troubleshooting, "Troubleshooting and Verification")}
            isListening={activeSpeechId === 'Troubleshooting'}
            isSynthesizing={isSynthesizing}
          />
          <Section 
            title="Security Considerations" icon="fa-shield-halved" content={data.security} color="text-orange-500" isDark={isDark} 
            onListen={() => handleToggleSpeech('Security', data.security, "Security Considerations")}
            isListening={activeSpeechId === 'Security'}
            isSynthesizing={isSynthesizing}
          />
          <Section 
            title="Notes" icon="fa-exclamation-triangle" content={data.notes} color="text-rose-500" isDark={isDark} 
            onListen={() => handleToggleSpeech('Notes', data.notes, "Important Notes")}
            isListening={activeSpeechId === 'Notes'}
            isSynthesizing={isSynthesizing}
          />
          <Section 
            title="Examples" icon="fa-code" content={data.examples} color="text-emerald-500" isDark={isDark} isCode={true} 
            onListen={() => handleToggleSpeech('Examples', data.examples, "Configuration Examples")}
            isListening={activeSpeechId === 'Examples'}
            isSynthesizing={isSynthesizing}
          />
        </div>
      )}

      {data.sources && data.sources.length > 0 && (
        <div className="mt-2 pt-4 border-t border-slate-800/50">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Live References</div>
          <div className="flex flex-wrap gap-2">
            {data.sources.map((s, i) => (
              <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg border text-[11px] sm:text-xs transition-colors active:scale-95 ${isDark ? 'bg-slate-900 border-slate-800 text-blue-400 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 text-blue-600 hover:bg-slate-100'}`}>
                <i className="fas fa-external-link-alt text-[10px]"></i>{s.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
