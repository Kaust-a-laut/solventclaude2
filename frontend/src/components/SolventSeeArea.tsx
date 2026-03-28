import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanEye, Sparkles, Wand2, Palette,
  MessageSquare, Upload, Download, Loader2,
  X, Send, Maximize2, SlidersHorizontal,
  RotateCcw as TransformIcon, Crop, BoxSelect,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';
import { MessageList } from './MessageList';
import { ChatService } from '../services/ChatService';
import { VisionToolControls } from './VisionToolControls';
import { ManualEditTools } from './ManualEditTools';
import { ImageProviderSelector } from './ImageProviderSelector';
import { CropTool, SelectionRect, AspectRatio } from './CropTool';
import { ExportTool } from './ExportTool';

// ─── Tool definitions ─────────────────────────────────────────────────────────

type ToolId =
  | 'adjust' | 'filters' | 'transform' | 'crop' | 'select' | 'export'
  | 'generate' | 'analyze' | 'edit' | 'colors';

interface ToolDef {
  id: ToolId;
  icon: React.ElementType;
  label: string;
  color: string;
  accent: string;
}

const TOOL_GRID: { label: string; tools: ToolDef[] }[] = [
  {
    label: 'Edit',
    tools: [
      { id: 'adjust',    icon: SlidersHorizontal, label: 'Adjust',    color: 'text-slate-300',   accent: 'bg-slate-500/10'   },
      { id: 'filters',   icon: Wand2,             label: 'Filters',   color: 'text-jb-purple',   accent: 'bg-jb-purple/10'   },
      { id: 'transform', icon: TransformIcon,     label: 'Transform', color: 'text-slate-300',   accent: 'bg-slate-500/10'   },
      { id: 'crop',      icon: Crop,              label: 'Crop',      color: 'text-jb-orange',   accent: 'bg-jb-orange/10'   },
      { id: 'select',    icon: BoxSelect,         label: 'Select',    color: 'text-amber-400',   accent: 'bg-amber-500/10'   },
      { id: 'export',    icon: Download,          label: 'Export',    color: 'text-emerald-400', accent: 'bg-emerald-500/10' },
    ],
  },
  {
    label: 'AI',
    tools: [
      { id: 'generate', icon: Sparkles,     label: 'Generate',   color: 'text-jb-orange', accent: 'bg-jb-orange/10' },
      { id: 'analyze',  icon: ScanEye,      label: 'Analyze',    color: 'text-jb-accent', accent: 'bg-jb-accent/10' },
      { id: 'edit',     icon: MessageSquare, label: 'Edit w/ AI', color: 'text-jb-purple', accent: 'bg-jb-purple/10' },
      { id: 'colors',   icon: Palette,      label: 'Colors',     color: 'text-amber-400', accent: 'bg-amber-500/10' },
    ],
  },
];

const MANUAL_TOOLS:  ToolId[] = ['adjust', 'filters', 'transform'];
const AI_TOOLS:      ToolId[] = ['generate', 'analyze', 'edit', 'colors'];
const OVERLAY_TOOLS: ToolId[] = ['crop', 'select'];

// ─── ToolGrid Component ───────────────────────────────────────────────────────

interface ToolGridProps {
  activeTool: ToolId;
  setActiveTool: (id: ToolId) => void;
  setSelection: (s: SelectionRect | null) => void;
}

const ToolGridComponent: React.FC<ToolGridProps> = ({ activeTool, setActiveTool, setSelection }) => (
  <div className="space-y-3 shrink-0">
    {TOOL_GRID.map((section) => (
      <div key={section.label}>
        <span className="text-[11px] font-black text-slate-700 uppercase tracking-[0.3em] block mb-1.5 px-0.5">
          {section.label}
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {section.tools.map((tool) => {
            const Icon     = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => {
                  setActiveTool(tool.id);
                  if (!OVERLAY_TOOLS.includes(tool.id)) setSelection(null);
                }}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl transition-all border',
                  isActive
                    ? cn(tool.accent, 'border-white/10', tool.color)
                    : 'bg-white/[0.02] border-white/5 text-slate-600 hover:text-slate-300 hover:bg-white/[0.04] hover:border-white/8',
                )}
              >
                <Icon size={14} />
                <span className="text-[11px] font-black uppercase tracking-wide leading-none text-center">
                  {tool.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    ))}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const SolventSeeArea = () => {
  const {
    deviceInfo, sendMessage, isProcessing, generateImageAction,
    lastGeneratedImage, setLastGeneratedImage,
  } = useAppStore();

  const [activeTool, setActiveTool]       = useState<ToolId>('analyze');
  const [isHovering, setIsHovering]       = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showPanel, setShowPanel]         = useState(true);
  const [instruction, setInstruction]     = useState('');
  const [imageLoading, setImageLoading]   = useState(false);
  const [localStatus, setLocalStatus]     = useState<{ loaded: boolean; model?: string; fileExists?: boolean }>({ loaded: false });

  // Preview state for manual editing
  const [previewFilter, setPreviewFilter] = useState<{
    cssFilter: string; rotation: number; flipH: boolean; flipV: boolean;
  }>({ cssFilter: 'none', rotation: 0, flipH: false, flipV: false });

  // Crop / Select overlay state
  const [selection, setSelection]         = useState<SelectionRect | null>(null);
  const [isDragging, setIsDragging]       = useState(false);
  const [dragStart, setDragStart]         = useState<{ x: number; y: number } | null>(null);
  const [activeAspect, setActiveAspect]   = useState<AspectRatio>('free');
  const [copiedRegion, setCopiedRegion]   = useState<string | null>(null);

  const containerRef  = useRef<HTMLDivElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const imgRef        = useRef<HTMLImageElement>(null);
  const isResizing    = useRef(false);

  const getInitialWidth = () => {
    if (deviceInfo.isMobile) return window.innerWidth;
    const available = window.innerWidth - 288;
    return Math.min(400, available * 0.35);
  };
  const [panelWidth, setPanelWidth] = useState(getInitialWidth);

  // ── Sync store-generated images ──────────────────────────────────────────
  useEffect(() => {
    if (lastGeneratedImage) {
      setSelectedImage(lastGeneratedImage);
      setImageLoading(false);
      setLastGeneratedImage(null);
    }
  }, [lastGeneratedImage, setLastGeneratedImage]);

  // ── Poll local image server status ────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      const status = await ChatService.checkLocalImageStatus();
      setLocalStatus(status);
    };
    check();
    const id = setInterval(check, 10000);
    return () => clearInterval(id);
  }, []);

  // ── Panel resize handlers ─────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !containerRef.current) return;
    const rect     = containerRef.current.getBoundingClientRect();
    const newWidth = rect.right - e.clientX;
    const max      = rect.width - 320;
    if (newWidth > 280 && newWidth < max) setPanelWidth(newWidth);
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  }, [handleMouseMove]);

  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  }, [handleMouseMove, stopResizing]);

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageLoading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setSelectedImage(dataUrl);
      setPreviewFilter({ cssFilter: 'none', rotation: 0, flipH: false, flipV: false });
      setSelection(null);
      setImageLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // ── AI actions ────────────────────────────────────────────────────────────
  const handleAnalyze = async (image: string) => {
    if (!image) return;
    await sendMessage(
      'Analyze this image and provide a detailed description of its content, structure, and visual elements.',
      image,
    );
  };

  const handleSendInstruction = async () => {
    if (!instruction.trim()) return;
    await sendMessage(instruction, selectedImage ?? undefined);
    setInstruction('');
  };

  const handleGenerate = async () => {
    if (!instruction.trim()) return;
    setImageLoading(true);
    await generateImageAction(instruction);
    setInstruction('');
  };

  const handleToolAction = async (action: string, data?: any) => {
    if (!selectedImage && action !== 'Gen-Fill') return;
    let prompt = '';
    switch (action) {
      case 'Deep Scan':
        prompt = 'Analyze this image and provide a detailed description of its content, composition, subjects, colors, and any notable visual elements.';
        break;
      case 'Gen-Fill':
        setImageLoading(true);
        await generateImageAction(data);
        return;
      case 'Agentic Edit':
        prompt = `I want to make this change to the image: "${data}". Explain how this could be achieved and what the result would look like.`;
        break;
      case 'Extract Palette':
        prompt = 'Extract the primary and secondary color palette from this image. List the hex codes and suggest a color theme name.';
        break;
      case 'Execute Crop':
        prompt = 'Suggest the best crop for this image. Identify the focal point and recommend crop coordinates as percentages (top, left, width, height).';
        break;
      default:
        prompt = `Analyzing: ${action}`;
    }
    await sendMessage(prompt, selectedImage ?? undefined);
  };

  // ── Manual edit apply (Canvas API) ───────────────────────────────────────
  const handleApplyEdits = useCallback(
    (cssFilter: string, rotation: number, flipH: boolean, flipV: boolean) => {
      if (!imgRef.current || !selectedImage) return;
      const img = imgRef.current;

      const swapped = rotation % 180 !== 0;
      const canvas  = document.createElement('canvas');
      canvas.width  = swapped ? img.naturalHeight : img.naturalWidth;
      canvas.height = swapped ? img.naturalWidth  : img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.filter = cssFilter === 'none' ? '' : cssFilter;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      if (flipH) ctx.scale(-1, 1);
      if (flipV) ctx.scale(1, -1);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      setSelectedImage(canvas.toDataURL('image/png'));
      setPreviewFilter({ cssFilter: 'none', rotation: 0, flipH: false, flipV: false });
    },
    [selectedImage],
  );

  // ── Coordinate scaling: screen px → image natural px ─────────────────────
  const screenToNaturalCoords = useCallback(
    (sel: SelectionRect): SelectionRect => {
      if (!imgRef.current) return sel;
      const rect   = imgRef.current.getBoundingClientRect();
      const scaleX = imgRef.current.naturalWidth  / rect.width;
      const scaleY = imgRef.current.naturalHeight / rect.height;
      return {
        x: Math.round(sel.x * scaleX),
        y: Math.round(sel.y * scaleY),
        w: Math.round(sel.w * scaleX),
        h: Math.round(sel.h * scaleY),
      };
    },
    [],
  );

  // ── Crop ──────────────────────────────────────────────────────────────────
  const handleApplyCrop = useCallback(() => {
    if (!selection || !imgRef.current || !selectedImage) return;
    const nat    = screenToNaturalCoords(selection);
    const canvas = document.createElement('canvas');
    canvas.width  = nat.w;
    canvas.height = nat.h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(imgRef.current, nat.x, nat.y, nat.w, nat.h, 0, 0, nat.w, nat.h);
    setSelectedImage(canvas.toDataURL('image/png'));
    setSelection(null);
    setActiveTool('analyze');
  }, [selection, selectedImage, screenToNaturalCoords]);

  // ── Cut (fill selection with white) ──────────────────────────────────────
  const handleCutSelection = useCallback(() => {
    if (!selection || !imgRef.current || !selectedImage) return;
    const nat    = screenToNaturalCoords(selection);
    const canvas = document.createElement('canvas');
    canvas.width  = imgRef.current.naturalWidth;
    canvas.height = imgRef.current.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(imgRef.current, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(nat.x, nat.y, nat.w, nat.h);
    setSelectedImage(canvas.toDataURL('image/png'));
    setSelection(null);
  }, [selection, selectedImage, screenToNaturalCoords]);

  // ── Copy selection ────────────────────────────────────────────────────────
  const handleCopySelection = useCallback(() => {
    if (!selection || !imgRef.current || !selectedImage) return;
    const nat    = screenToNaturalCoords(selection);
    const canvas = document.createElement('canvas');
    canvas.width  = nat.w;
    canvas.height = nat.h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(imgRef.current, nat.x, nat.y, nat.w, nat.h, 0, 0, nat.w, nat.h);
    setCopiedRegion(canvas.toDataURL('image/png'));
  }, [selection, selectedImage, screenToNaturalCoords]);

  // ── Crop / Select overlay mouse handlers ─────────────────────────────────
  const getImageRelativeCoords = (e: React.MouseEvent): { x: number; y: number } => {
    if (!imgRef.current) return { x: 0, y: 0 };
    const rect = imgRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left,  rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top,   rect.height)),
    };
  };

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const coords = getImageRelativeCoords(e);
    setDragStart(coords);
    setSelection(null);
    setIsDragging(true);
  };

  const handleOverlayMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    const curr = getImageRelativeCoords(e);
    let w = curr.x - dragStart.x;
    let h = curr.y - dragStart.y;

    if (activeAspect === '1:1') {
      const s = Math.min(Math.abs(w), Math.abs(h));
      w = Math.sign(w || 1) * s;
      h = Math.sign(h || 1) * s;
    }
    if (activeAspect === '16:9') h = w * (9 / 16);
    if (activeAspect === '4:3')  h = w * (3 / 4);

    setSelection({
      x: w < 0 ? dragStart.x + w : dragStart.x,
      y: h < 0 ? dragStart.y + h : dragStart.y,
      w: Math.abs(w),
      h: Math.abs(h),
    });
  };

  const handleOverlayMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // ── Preview transform string ──────────────────────────────────────────────
  const buildTransform = () => {
    const parts: string[] = [];
    if (previewFilter.rotation !== 0) parts.push(`rotate(${previewFilter.rotation}deg)`);
    if (previewFilter.flipH)          parts.push('scaleX(-1)');
    if (previewFilter.flipV)          parts.push('scaleY(-1)');
    return parts.length > 0 ? parts.join(' ') : undefined;
  };

  // ── Tool category booleans ────────────────────────────────────────────────
  const isManualTool  = MANUAL_TOOLS.includes(activeTool);
  const isAiTool      = AI_TOOLS.includes(activeTool);
  const isOverlayTool = OVERLAY_TOOLS.includes(activeTool);
  const isExportTool  = activeTool === 'export';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden bg-black/20 backdrop-blur-3xl w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* ── Center: Image canvas ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col w-0 min-w-0 overflow-hidden relative border-r border-white/5">
        {/* Toolbar */}
        <div className="h-16 border-b border-white/5 flex items-center px-4 lg:px-6 bg-black/40 backdrop-blur-xl relative z-30 shadow-2xl gap-3">
          <div className="flex flex-col shrink-0">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">SolventSee</span>
            <span className="text-white font-black text-[11px] uppercase tracking-tight truncate max-w-[150px]">
              {selectedImage ? 'Image Loaded' : 'No Image'}
            </span>
          </div>

          <div className="h-6 w-[1px] bg-white/10 shrink-0" />

          {/* Active tool badge */}
          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest shrink-0">
            <span className="text-slate-600">Tool:</span>
            <span className="text-white capitalize">{activeTool}</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Upload button — moved from old sidebar */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border bg-white/5 border-white/5 text-slate-400 hover:text-white hover:border-white/10"
            >
              <Upload size={14} />
              <span className="hidden sm:inline">Upload</span>
            </button>

            {/* Clear button — only when image loaded */}
            {selectedImage && (
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setSelection(null);
                  setPreviewFilter({ cssFilter: 'none', rotation: 0, flipH: false, flipV: false });
                }}
                className="p-2 rounded-xl bg-rose-500/5 border border-rose-500/10 text-rose-500/60 hover:text-rose-400 hover:border-rose-500/20 transition-all"
                title="Clear image"
              >
                <X size={14} />
              </button>
            )}

            {/* Tools panel toggle */}
            <button
              onClick={() => setShowPanel(!showPanel)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border',
                showPanel
                  ? 'bg-jb-accent/10 border-jb-accent/20 text-jb-accent'
                  : 'bg-white/5 border-white/5 text-slate-400',
              )}
            >
              <SlidersHorizontal size={14} />
              <span className="hidden sm:inline">Tools</span>
            </button>
          </div>
        </div>

        {/* The Stage */}
        <div
          className="flex-1 relative overflow-hidden flex items-center justify-center p-6 md:p-12"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div className="absolute inset-0 neural-grid opacity-[0.03] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-jb-orange/[0.02] via-transparent to-jb-accent/[0.02] pointer-events-none" />

          {selectedImage ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedImage.slice(-20)}
                  initial={{ opacity: 0, scale: 0.9, filter: 'blur(20px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="relative group max-w-full max-h-full"
                >
                  {/* Processing overlay */}
                  {(isProcessing || imageLoading) && (
                    <div className="absolute inset-0 z-20 rounded-3xl overflow-hidden pointer-events-none">
                      <motion.div
                        initial={{ top: '-10%' }}
                        animate={{ top: '110%' }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-jb-orange to-transparent shadow-[0_0_20px_rgba(251,146,60,1)] z-30"
                      />
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center">
                        <Loader2 size={40} className="text-jb-orange animate-spin mb-4" />
                        <span className="text-[11px] font-black text-jb-orange uppercase tracking-[0.5em] animate-pulse">Processing...</span>
                      </div>
                    </div>
                  )}

                  {/* Image */}
                  <img
                    ref={imgRef}
                    src={selectedImage}
                    onLoad={() => setImageLoading(false)}
                    className={cn(
                      'max-w-full max-h-[75vh] rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/10 object-contain transition-all duration-300',
                      (isProcessing || imageLoading) ? 'brightness-50 grayscale contrast-125' : 'brightness-100 grayscale-0 contrast-100',
                    )}
                    style={{
                      filter:    previewFilter.cssFilter !== 'none' ? previewFilter.cssFilter : undefined,
                      transform: buildTransform(),
                    }}
                  />

                  {/* Crop / Select overlay — renders on top of image */}
                  {isOverlayTool && previewFilter.rotation === 0 && (
                    <div
                      className="absolute inset-0 cursor-crosshair rounded-[2.5rem] overflow-hidden"
                      onMouseDown={handleOverlayMouseDown}
                      onMouseMove={handleOverlayMouseMove}
                      onMouseUp={handleOverlayMouseUp}
                      onMouseLeave={handleOverlayMouseUp}
                    >
                      {selection && (
                        <>
                          {/* Mask — four dark rectangles outside selection */}
                          <div className="absolute bg-black/55 pointer-events-none" style={{ top: 0, left: 0, right: 0, height: selection.y }} />
                          <div className="absolute bg-black/55 pointer-events-none" style={{ top: selection.y + selection.h, left: 0, right: 0, bottom: 0 }} />
                          <div className="absolute bg-black/55 pointer-events-none" style={{ top: selection.y, left: 0, width: selection.x, height: selection.h }} />
                          <div className="absolute bg-black/55 pointer-events-none" style={{ top: selection.y, left: selection.x + selection.w, right: 0, height: selection.h }} />

                          {/* Selection border */}
                          <div
                            className="absolute border-2 border-white/80 pointer-events-none"
                            style={{ left: selection.x, top: selection.y, width: selection.w, height: selection.h }}
                          />

                          {/* Corner handles */}
                          {[
                            { left: selection.x - 4,               top: selection.y - 4               },
                            { left: selection.x + selection.w - 4,  top: selection.y - 4               },
                            { left: selection.x - 4,               top: selection.y + selection.h - 4  },
                            { left: selection.x + selection.w - 4,  top: selection.y + selection.h - 4  },
                          ].map((pos, i) => (
                            <div
                              key={i}
                              className="absolute w-2 h-2 bg-white border border-black/40 rounded-sm pointer-events-none shadow-sm"
                              style={pos}
                            />
                          ))}
                        </>
                      )}
                    </div>
                  )}

                  {/* Rotation guard — overlay tools require flat image */}
                  {isOverlayTool && previewFilter.rotation !== 0 && (
                    <div className="absolute inset-0 rounded-[2.5rem] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 pointer-events-none">
                      <span className="text-[11px] font-black text-amber-400 uppercase tracking-widest">Apply rotation first</span>
                      <span className="text-[11px] text-slate-500">Use the Apply button in Transform before cropping.</span>
                    </div>
                  )}

                  {/* Hover download/expand controls */}
                  <AnimatePresence>
                    {!isProcessing && !imageLoading && !isOverlayTool && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                        className="absolute inset-0 rounded-[2.5rem] bg-black/20 pointer-events-none group-hover:pointer-events-auto transition-all duration-500 flex items-start justify-end p-6 gap-3"
                      >
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href     = selectedImage;
                            link.download = 'solvent-image.png';
                            link.click();
                          }}
                          className="p-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 text-white hover:bg-jb-orange hover:text-black transition-all shadow-2xl"
                          title="Download"
                        >
                          <Download size={18} />
                        </button>
                        <button
                          onClick={() => window.open(selectedImage, '_blank')}
                          className="p-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 text-white hover:bg-jb-accent hover:text-white transition-all shadow-2xl"
                          title="Full Resolution"
                        >
                          <Maximize2 size={18} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Corner bracket decorations */}
                  <div className="absolute inset-0 rounded-[2.5rem] border border-white/5 pointer-events-none group-hover:border-jb-orange/20 transition-colors duration-700" />
                  <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-jb-orange/30 rounded-tl-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-500 transform group-hover:-translate-x-2 group-hover:-translate-y-2" />
                  <div className="absolute -top-2 -right-2 w-8 h-8 border-t-2 border-r-2 border-jb-orange/30 rounded-tr-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-500 transform group-hover:translate-x-2 group-hover:-translate-y-2" />
                  <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-2 border-l-2 border-jb-orange/30 rounded-bl-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-500 transform group-hover:-translate-x-2 group-hover:translate-y-2" />
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-jb-orange/30 rounded-br-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-500 transform group-hover:translate-x-2 group-hover:translate-y-2" />
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            /* Drop Zone */
            <motion.div
              animate={{ scale: isHovering ? 1.01 : 1 }}
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-4xl aspect-video rounded-[3rem] border-2 border-dashed border-white/10 bg-black/40 backdrop-blur-2xl flex flex-col items-center justify-center gap-8 relative group cursor-pointer hover:border-jb-orange/30 transition-all duration-500 shadow-2xl"
            >
              <div className="w-24 h-24 rounded-3xl bg-jb-orange/5 border border-jb-orange/10 flex items-center justify-center text-jb-orange group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-[0_0_30px_rgba(251,146,60,0.1)]">
                <Upload size={40} />
              </div>
              <div className="text-center space-y-3">
                <p className="text-2xl font-[900] text-white tracking-tighter">
                  Drop an image to <span className="text-vibrant">get started</span>
                </p>
                <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.3em]">
                  Upload, edit manually, or generate with AI
                </p>
              </div>
              <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-white/10 rounded-tl-xl" />
              <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-white/10 rounded-tr-xl" />
              <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-white/10 rounded-bl-xl" />
              <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-white/10 rounded-br-xl" />
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Right: Tools + AI Chat Panel ─────────────────────────────────── */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: panelWidth }}
            exit={{ width: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              'border-l border-white/5 bg-black/40 backdrop-blur-3xl flex flex-col relative z-40 shrink-0 overflow-hidden',
              deviceInfo.isMobile ? 'fixed inset-0 pt-20' : 'h-full',
            )}
          >
            {/* Resize handle */}
            {!deviceInfo.isMobile && (
              <div
                onMouseDown={startResizing}
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-jb-orange/40 transition-colors z-50 group"
              >
                <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-[1px] h-8 bg-white/10 group-hover:bg-jb-orange/50" />
              </div>
            )}

            <div className="h-full flex flex-col overflow-hidden w-full">
              {/* Panel header */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-jb-orange/10 border border-jb-orange/20 text-jb-orange">
                    <SlidersHorizontal size={16} />
                  </div>
                  <div>
                    <span className="text-[11px] font-black text-white uppercase tracking-[0.2em] block">Tools</span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 block">SolventSee Studio</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowPanel(false)}
                  className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">

                {/* ── Tool Grid (always at top) ──────────────────────────── */}
                <ToolGridComponent
                  activeTool={activeTool}
                  setActiveTool={setActiveTool}
                  setSelection={setSelection}
                />

                {/* Divider */}
                <div className="h-[1px] bg-white/5" />

                {/* ── Context-sensitive controls ─────────────────────────── */}
                {isManualTool && (
                  <ManualEditTools
                    activeTab={activeTool as 'adjust' | 'filters' | 'transform'}
                    onPreviewChange={(cssFilter, rotation, flipH, flipV) =>
                      setPreviewFilter({ cssFilter, rotation, flipH, flipV })
                    }
                    onApply={handleApplyEdits}
                    disabled={!selectedImage || isProcessing}
                  />
                )}

                {isOverlayTool && activeTool === 'crop' && (
                  <CropTool
                    mode="crop"
                    selection={selection}
                    activeAspect={activeAspect}
                    onAspectChange={setActiveAspect}
                    onApply={handleApplyCrop}
                    onCancel={() => setSelection(null)}
                    disabled={!selectedImage || isProcessing}
                  />
                )}

                {isOverlayTool && activeTool === 'select' && (
                  <CropTool
                    mode="select"
                    selection={selection}
                    onCut={handleCutSelection}
                    onCopy={handleCopySelection}
                    onCancel={() => setSelection(null)}
                    disabled={!selectedImage || isProcessing}
                  />
                )}

                {isExportTool && (
                  <ExportTool
                    selectedImage={selectedImage}
                    disabled={isProcessing}
                  />
                )}

                {isAiTool && (
                  <VisionToolControls
                    activeTool={activeTool}
                    onAction={handleToolAction}
                    isProcessing={isProcessing}
                  />
                )}

                {/* ── Image provider selector ────────────────────────────── */}
                <ImageProviderSelector localLoaded={localStatus.loaded} />

                {/* ── AI Chat history (AI tools only) ───────────────────── */}
                {isAiTool && (
                  <div className="flex flex-col space-y-2">
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em]">AI Chat</label>
                    <div className="h-64 border border-white/5 rounded-[1.5rem] bg-black/20 overflow-hidden flex flex-col">
                      <MessageList />
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom action area */}
              <div className="p-4 bg-black/60 border-t border-white/5 space-y-3 shrink-0">
                <div className="relative">
                  <input
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="Ask AI to edit or analyze this image..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-[11px] font-bold text-white outline-none focus:border-jb-orange/40 transition-all placeholder:text-slate-700"
                    onKeyDown={(e) => e.key === 'Enter' && handleSendInstruction()}
                  />
                  <button
                    onClick={handleSendInstruction}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white text-black rounded-lg hover:bg-jb-accent hover:text-white transition-all shadow-xl"
                  >
                    <Send size={12} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleGenerate}
                    disabled={!instruction.trim() || isProcessing}
                    className="flex items-center justify-center gap-2 py-2.5 bg-jb-orange/10 border border-jb-orange/20 text-jb-orange rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-jb-orange hover:text-black transition-all disabled:opacity-20"
                  >
                    <Sparkles size={12} /> Generate
                  </button>
                  <button
                    onClick={() => selectedImage && handleAnalyze(selectedImage)}
                    disabled={!selectedImage || isProcessing}
                    className="flex items-center justify-center gap-2 py-2.5 bg-jb-accent/10 border border-jb-accent/20 text-jb-accent rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-jb-accent hover:text-white transition-all disabled:opacity-20"
                  >
                    <ScanEye size={12} /> Analyze
                  </button>
                </div>

                <p className="text-[11px] text-slate-700 text-center font-medium">
                  More tools coming soon
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
