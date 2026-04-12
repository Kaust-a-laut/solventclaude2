import React from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const ClickToEditPill: React.FC = () => {
  const { previewSelectedElement, setSelectedElement } = useAppStore();

  if (!previewSelectedElement) return null;

  const { tag, classes, text } = previewSelectedElement;
  const classStr = classes.slice(0, 2).join('.');
  const label = classStr ? `<${tag}.${classStr}>` : `<${tag}>`;
  const textPreview = text ? `"${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"` : '';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-jb-accent/10 border border-jb-accent/20">
      <span className="text-[11px] text-jb-accent/80 font-mono">
        Clicked: {label} {textPreview}
      </span>
      <button
        type="button"
        onClick={() => setSelectedElement(null)}
        className="p-0.5 hover:bg-white/10 rounded text-white/30 hover:text-white/60"
        aria-label="Dismiss"
      >
        <X size={10} />
      </button>
    </div>
  );
};
