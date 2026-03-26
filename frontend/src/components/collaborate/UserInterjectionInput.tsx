import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { cn } from '../../lib/utils';

interface UserInterjectionInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export const UserInterjectionInput: React.FC<UserInterjectionInputProps> = ({
  onSend,
  disabled,
}) => {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex-shrink-0">
      <div className="glass-panel rounded-2xl px-4 py-2.5 flex items-center gap-3">
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Jump into the conversation..."
          disabled={disabled}
          className="flex-1 bg-transparent text-sm text-slate-300 placeholder:text-slate-700 outline-none disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className={cn(
            'p-2 rounded-xl transition-all',
            value.trim() && !disabled
              ? 'bg-jb-accent/15 text-jb-accent hover:bg-jb-accent/25'
              : 'text-slate-700',
          )}
        >
          <Send size={14} />
        </button>
      </div>
    </form>
  );
};
