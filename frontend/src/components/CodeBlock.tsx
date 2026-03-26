import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy, Terminal, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { fetchWithRetry } from '../lib/api-client';

interface CodeBlockProps {
  language: string;
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addMessage } = useAppStore();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { BASE_URL } = await import('../lib/config');
      const data = await fetchWithRetry<{ filename?: string }>(`${BASE_URL}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: code,
          filename: `generated-code-${Date.now()}.${language === 'typescript' ? 'ts' : language === 'javascript' ? 'js' : language || 'txt'}`
        }),
      });
      if (data.filename) {
        addMessage({ role: 'assistant', content: `✅ Code saved as: ${data.filename}` });
      }
    } catch (error) {
      console.error('Save failed:', error);
      addMessage({ role: 'assistant', content: '❌ Failed to save code to file.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-slate-700/50 shadow-2xl bg-[#1e1e1e]">
      {/* Mac-style Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="ml-3 flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Terminal size={12} />
            <span>{language || 'text'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
            title="Save to backend uploads"
          >
            <Save size={14} className={cn("text-slate-400", saving && "animate-pulse")} />
            <span className="text-xs text-slate-400 font-medium">Save</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 transition-colors"
          >
            {copied ? (
              <Check size={14} className="text-green-400" />
            ) : (
              <Copy size={14} className="text-slate-400" />
            )}
            <span className="text-xs text-slate-400 font-medium">
              {copied ? 'Copied!' : 'Copy'}
            </span>
          </button>
        </div>
      </div>

      {/* Code Content */}
      <div className="relative group">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1.5rem',
            background: 'transparent',
            fontSize: '0.9rem',
            lineHeight: '1.5',
          }}
          showLineNumbers={true}
          wrapLines={true}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};
