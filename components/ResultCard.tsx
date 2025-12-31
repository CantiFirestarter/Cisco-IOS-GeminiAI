
import React, { useState } from 'react';
import { CiscoQueryResponse } from '../types';

interface ResultCardProps {
  data: CiscoQueryResponse;
}

/**
 * A lightweight component to render basic markdown patterns (bold, italic, inline code)
 * without requiring a heavy external library.
 */
const FormattedText: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
  if (!text) return null;

  // Split by bold (**), italic (*), and inline code (`)
  // We also handle newlines to ensure whitespace-pre-wrap behaves nicely with React elements
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\n)/g);

  return (
    <div className={`${className} whitespace-pre-wrap`}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i} className="italic text-slate-800">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded font-mono text-[0.9em] border border-slate-200">
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part === '\n') {
          return <br key={i} />;
        }
        return part;
      })}
    </div>
  );
};

const ResultCard: React.FC<ResultCardProps> = ({ data }) => {
  const [showReasoning, setShowReasoning] = useState(false);

  const Section = ({ 
    title, 
    icon, 
    content, 
    color, 
    isCode = false 
  }: { 
    title: string; 
    icon: string; 
    content: string; 
    color: string;
    isCode?: boolean;
  }) => (
    <div className="mb-6 last:mb-0">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        <i className={`fas ${icon} text-xs`}></i>
        <h3 className="font-bold uppercase text-[11px] tracking-widest">{title}</h3>
      </div>
      <div className={`
        p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md
        ${isCode ? 'bg-slate-900 text-slate-100 font-mono text-sm border-slate-700' : 'bg-white text-slate-700'}
      `}>
        {isCode ? (
          <div className="whitespace-pre-wrap leading-relaxed">{content}</div>
        ) : (
          <FormattedText text={content} className="text-sm leading-relaxed" />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      {/* Reasoning Toggle */}
      <div className="bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
        <button 
          onClick={() => setShowReasoning(!showReasoning)}
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-200 transition-colors"
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
            <i className="fas fa-brain text-blue-500"></i> Analysis & Reasoning
          </span>
          <i className={`fas fa-chevron-${showReasoning ? 'up' : 'down'} text-slate-400 text-[10px]`}></i>
        </button>
        {showReasoning && (
          <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-200">
            <FormattedText text={data.reasoning} className="text-xs text-slate-500 italic" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        <div className="col-span-1 md:col-span-2">
          <Section 
            title="Command Syntax" 
            icon="fa-terminal" 
            content={data.syntax} 
            color="text-blue-600"
            isCode={true}
          />
        </div>
        
        <Section 
          title="Description" 
          icon="fa-info-circle" 
          content={data.description} 
          color="text-indigo-600"
        />
        
        <Section 
          title="Usage Context" 
          icon="fa-layer-group" 
          content={data.usageContext} 
          color="text-teal-600"
        />

        <div className="col-span-1 md:col-span-2">
           <Section 
            title="Options & Parameters" 
            icon="fa-list-ul" 
            content={data.options} 
            color="text-amber-600"
          />
        </div>

        <div className="col-span-1 md:col-span-2">
           <Section 
            title="Notes & Caveats" 
            icon="fa-exclamation-triangle" 
            content={data.notes} 
            color="text-rose-600"
          />
        </div>

        <div className="col-span-1 md:col-span-2">
           <Section 
            title="Examples" 
            icon="fa-code" 
            content={data.examples} 
            color="text-emerald-600"
            isCode={true}
          />
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
