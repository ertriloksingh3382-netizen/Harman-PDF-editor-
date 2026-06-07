/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  Loader2, 
  FilePenLine, 
  Eye, 
  AlertCircle, 
  Info, 
  Maximize,
  Type,
  Bold,
  Italic,
  Check,
  X,
  EyeOff
} from 'lucide-react';
import { PdfTextBlock, AllEdits, PdfEdit } from '../types';

interface PdfWorkspaceProps {
  pdfDoc: any; // PDFjs Document object
  currentPage: number;
  zoom: number;
  mode: 'view' | 'edit';
  edits: AllEdits;
  onEditBlock: (block: PdfTextBlock) => void;
  onSaveInlineEdit?: (block: PdfTextBlock, edit: PdfEdit) => void;
}

// Ensure PDF.js worker is properly targeted
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export default function PdfWorkspace({
  pdfDoc,
  currentPage,
  zoom,
  mode,
  edits,
  onEditBlock,
  onSaveInlineEdit
}: PdfWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  const [textBlocks, setTextBlocks] = useState<PdfTextBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewport, setViewport] = useState<any>(null);
  const [hoveredBlock, setHoveredBlock] = useState<PdfTextBlock | null>(null);

  // Active Inline State Managers
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingFontSize, setEditingFontSize] = useState(12);
  const [editingFontFamily, setEditingFontFamily] = useState('Helvetica');
  const [editingTextColor, setEditingTextColor] = useState('#000000');
  const [editingBackgroundColor, setEditingBackgroundColor] = useState('transparent');
  const [editingIsBold, setEditingIsBold] = useState(false);
  const [editingIsItalic, setEditingIsItalic] = useState(false);
  const [activeEditingBlock, setActiveEditingBlock] = useState<PdfTextBlock | null>(null);

  // Trigger inline config when blocks get double clicked or single clicked
  const startInlineEdit = (block: PdfTextBlock) => {
    const pageEdits = edits[currentPage] || {};
    const existingEdit = pageEdits[block.id];
    
    setEditingBlockId(block.id);
    setActiveEditingBlock(block);
    
    if (existingEdit) {
      setEditingText(existingEdit.text);
      setEditingFontSize(existingEdit.fontSize);
      setEditingFontFamily(existingEdit.fontFamily);
      setEditingTextColor(existingEdit.textColor);
      setEditingBackgroundColor(existingEdit.backgroundColor);
      setEditingIsBold(existingEdit.isBold);
      setEditingIsItalic(existingEdit.isItalic);
    } else {
      setEditingText(block.text);
      setEditingFontSize(block.fontSize);
      setEditingFontFamily(
        block.fontFamily.toLowerCase().includes('times') || block.fontFamily.toLowerCase().includes('roman')
          ? 'Times'
          : block.fontFamily.toLowerCase().includes('courier') || block.fontFamily.toLowerCase().includes('mono')
            ? 'Courier'
            : 'Helvetica'
      );
      setEditingTextColor('#000000');
      setEditingBackgroundColor('transparent');
      setEditingIsBold(false);
      setEditingIsItalic(false);
    }
  };

  const saveInlineChange = () => {
    if (!editingBlockId || !activeEditingBlock) return;
    
    const modifiedEdit: PdfEdit = {
      text: editingText,
      fontSize: editingFontSize,
      fontFamily: editingFontFamily,
      textColor: editingTextColor,
      backgroundColor: editingBackgroundColor,
      isBold: editingIsBold,
      isItalic: editingIsItalic
    };
    
    if (onSaveInlineEdit) {
      onSaveInlineEdit(activeEditingBlock, modifiedEdit);
    } else {
      onEditBlock(activeEditingBlock);
    }
    
    setEditingBlockId(null);
    setActiveEditingBlock(null);
  };

  const cancelInlineChange = () => {
    setEditingBlockId(null);
    setActiveEditingBlock(null);
  };

  // Render the PDF page canvas and parse text blocks
  useEffect(() => {
    if (!pdfDoc) return;

    let isSubscribed = true;

    async function renderPage() {
      if (!canvasRef.current) return;
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1. Get the page object
        const page = await pdfDoc.getPage(currentPage);
        if (!isSubscribed) return;

        // 2. Define the viewport based on page rotation and zoom
        const viewport = page.getViewport({ scale: zoom });
        setViewport(viewport);
        setCanvasSize({ width: viewport.width, height: viewport.height });

        // 3. Prepare canvas Context
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Could not get 2D canvas context');

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Cancel previous render task if active
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {
            // Ignore cancel errors of finished tasks
          }
        }

        // 4. Render visual PDF content inside canvas context
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          background: 'rgb(255, 255, 255)'
        };
        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;
        
        if (!isSubscribed) return;

        // 5. Query layout, text elements, and font metrics
        const textContent = await page.getTextContent();
        if (!isSubscribed) return;

        // Try to resolve human readable font families from page resources
        const commonObjs = page.commonObjs;

        // Map PDF.js text items into our generic PdfTextBlock format
        const blocks: PdfTextBlock[] = textContent.items.map((item: any, idx: number) => {
          const fontNameKey = item.fontName;
          let fontNameResolved = 'Helvetica';
          
          if (commonObjs && commonObjs.has(fontNameKey)) {
            const fontObj = commonObjs.get(fontNameKey);
            fontNameResolved = fontObj?.name || 'Helvetica';
          }

          const scaleX = Math.abs(item.transform[0]);
          const scaleY = Math.abs(item.transform[3]);
          const fontSize = Math.max(scaleX, scaleY) || 10;

          return {
            id: `page_${currentPage}_block_${idx}`,
            pageNumber: currentPage,
            itemIndex: idx,
            text: item.str,
            width: item.width,
            height: item.height || fontSize,
            x: item.transform[4], // Native PDF bottom-left coordinate
            y: item.transform[5], // Native PDF bottom-left coordinate
            fontSize: fontSize,
            fontName: fontNameKey,
            fontFamily: fontNameResolved,
            transform: item.transform
          };
        });

        // Filter out empty spaces or pure layout artifacts to avoid visual clutter
        const meaningfulBlocks = blocks.filter(b => b.text && b.text.trim().length > 0);
        
        if (isSubscribed) {
          setTextBlocks(meaningfulBlocks);
          setLoading(false);
        }

      } catch (err: any) {
        if (err.name === 'RenderingCancelledException' || err.message?.includes('cancelled')) {
          // Normal case during Zoom or page switches
          return;
        }
        console.error('Error rendering page:', err);
        if (isSubscribed) {
          setErrorMsg(`Error loading Page ${currentPage}: ${err.message || err}`);
          setLoading(false);
        }
      }
    }

    renderPage();

    return () => {
      isSubscribed = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
      }
    };
  }, [pdfDoc, currentPage, zoom]);

  // Translate a PDF block point (bottom-left) to browser viewport pixel coords
  const textCoordinates = (block: PdfTextBlock) => {
    if (!pdfDoc || !viewport) return { left: 0, top: 0, width: 0, height: 0, fontSize: 0 };

    try {
      // Coordinate converter converts (x, y) bottom-left origin to (x, y) top-left browser viewport coordinates
      const [left, top] = viewport.convertToViewportPoint(block.x, block.y);

      // Scale font size and bounding box widths to current zoom scale
      const fontSizeInPixels = block.fontSize * zoom;
      const boxWidthInPixels = block.width * zoom;
      const boxHeightInPixels = (block.height || block.fontSize) * zoom;
      
      // Since 'top' is centered at the textual baseline, we shift upwards by font size to align block top bounds
      // Include fallback shift to align perfectly on canvas
      const alignedTop = top - (fontSizeInPixels * 0.9);

      return {
        left: left,
        top: alignedTop,
        width: boxWidthInPixels + 4, // modest safety padding
        height: Math.max(fontSizeInPixels, boxHeightInPixels) * 1.15,
        fontSize: fontSizeInPixels
      };
    } catch (e) {
      // Fallback
      return { left: 0, top: 0, width: 0, height: 0, fontSize: 0 };
    }
  };

  const pageEdits = edits[currentPage] || {};

  return (
    <div className="flex-1 overflow-auto bg-[#F3F4F6] flex flex-col items-center p-8 relative min-h-[calc(100vh-62px)] select-none" id="workspace_viewport_container">
      
      {/* Visual Instruction Banner */}
      <div className="mb-6 bg-white/90 backdrop-blur-md text-gray-700 font-sans border border-gray-200/80 px-5 py-3 rounded-xl shadow-xs max-w-xl text-center flex items-center gap-3 text-xs">
        <Info className="w-4 h-4 text-blue-500 shrink-0" />
        {mode === 'edit' ? (
          <span className="leading-relaxed">
            <strong>Edit Mode Active:</strong> Double-click any highlighted word or text block directly on the page to change its content, size, style, or color.
          </span>
        ) : (
          <span className="leading-relaxed">
            <strong>View Mode Active:</strong> Reading page layout. Click the <strong>Edit Mode</strong> button on the top toolbar to start editing.
          </span>
        )}
      </div>

      {loading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 bg-gray-900/90 text-white rounded-2xl p-4 flex items-center gap-3 shadow-2xl">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <span className="text-xs font-bold font-sans">Processing PDF Streams...</span>
        </div>
      )}

      {errorMsg ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-xl shadow-sm text-center max-w-md my-12" id="canvas_error_box">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h4 className="font-sans font-bold text-sm">Failed to Load Page Layout</h4>
          <p className="text-xs mt-1 text-rose-600">{errorMsg}</p>
        </div>
      ) : (
        /* The Canvas Wrapper container holds both layer dimensions matching the original PDF */
        <div 
          ref={containerRef}
          className="relative bg-white shadow-2xl rounded-xs group/viewport overflow-visible border border-gray-300/60 select-none transition-shadow mb-12"
          id="pdf_canvas_scaled_wrapper"
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
          {/* Base Layer: Rendered PDF Canvas */}
          <canvas 
            ref={canvasRef} 
            className="block select-none pointer-events-none"
            id={`pdf_render_canvas_page_${currentPage}`}
          />

          {/* Top Layer: Interactive Editable Blocks HTML Layer */}
          <div 
            className="absolute inset-0 z-20 pointer-events-auto"
            id={`interactive_edit_blocks_page_${currentPage}`}
          >
            {textBlocks.map((block) => {
              const coords = textCoordinates(block);
              const isEdited = !!pageEdits[block.id];
              const editObj: PdfEdit | undefined = pageEdits[block.id];

              // Inline custom styling for modified text overlays
              const fontStyleClass = editObj ? (
                editObj.fontFamily === 'Courier' 
                  ? 'font-mono' 
                  : editObj.fontFamily === 'Times' 
                    ? 'font-serif' 
                    : 'font-sans'
              ) : (
                block.fontFamily.toLowerCase().includes('times') || block.fontFamily.toLowerCase().includes('roman')
                  ? 'font-serif'
                  : block.fontFamily.toLowerCase().includes('courier') || block.fontFamily.toLowerCase().includes('mono')
                    ? 'font-mono'
                    : 'font-sans'
              );

              const isEditingInline = mode === 'edit' && editingBlockId === block.id;

              if (isEditingInline) {
                return (
                  <div
                    key={block.id}
                    className={`absolute z-40 bg-white ring-2 ring-blue-500 rounded p-1.5 shadow-xl flex flex-col ${fontStyleClass}`}
                    style={{
                      left: coords.left - 6,
                      top: coords.top - 6,
                      width: Math.max(coords.width + 36, 260),
                      minHeight: coords.height + 14,
                      height: 'auto',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Size badge overlay */}
                    <div className="absolute right-2 -top-4 bg-slate-900 text-white font-mono text-[9px] px-1 rounded select-none font-bold shadow-sm">
                      {editingFontSize} pt
                    </div>

                    <textarea
                      autoFocus
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          saveInlineChange();
                        } else if (e.key === 'Escape') {
                          cancelInlineChange();
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-250 rounded p-1 text-slate-800 outline-none focus:bg-white focus:border-blue-500 font-sans tracking-tight leading-normal"
                      style={{
                        fontSize: `${editingFontSize * zoom}px`,
                        fontWeight: editingIsBold ? 'bold' : 'normal',
                        fontStyle: editingIsItalic ? 'italic' : 'normal',
                        color: editingTextColor,
                        fontFamily: editingFontFamily === 'Courier' ? 'monospace' : editingFontFamily === 'Times' ? 'serif' : 'sans-serif',
                        minHeight: '38px',
                        resize: 'none'
                      }}
                    />

                    {/* Inline tool controls toolbar */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-1.5 border-t border-slate-100 text-xs">
                      
                      {/* Font selector */}
                      <select
                        value={editingFontFamily}
                        onChange={(e) => setEditingFontFamily(e.target.value)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] rounded px-1.5 py-0.5 outline-none border border-slate-250 cursor-pointer font-bold shrink-0"
                      >
                        <option value="Helvetica">Helvetica</option>
                        <option value="Times">Times Roman</option>
                        <option value="Courier">Courier</option>
                      </select>

                      {/* Font Size input */}
                      <div className="flex items-center space-x-0.5 bg-slate-100 rounded px-1.5 py-0.5 border border-slate-250 font-mono text-[10px] text-slate-750">
                        <Type className="w-3 h-3 text-slate-450 mr-0.5" />
                        <input
                          type="number"
                          value={editingFontSize}
                          min="1"
                          max="120"
                          onChange={(e) => setEditingFontSize(Math.max(1, parseInt(e.target.value) || 12))}
                          className="w-6 text-center bg-transparent text-slate-800 font-bold outline-none"
                        />
                        <span>pt</span>
                      </div>

                      {/* Styling tags */}
                      <div className="flex items-center bg-slate-150 rounded p-0.5 gap-0.5 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setEditingIsBold(!editingIsBold)}
                          className={`p-1 rounded text-xs transition leading-none flex items-center justify-center ${
                            editingIsBold ? 'bg-blue-600 text-white font-bold' : 'text-slate-500 hover:text-slate-800'
                          }`}
                          title="Toggle Bold"
                        >
                          <Bold className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIsItalic(!editingIsItalic)}
                          className={`p-1 rounded text-xs transition leading-none flex items-center justify-center ${
                            editingIsItalic ? 'bg-blue-600 text-white font-bold' : 'text-slate-500 hover:text-slate-800'
                          }`}
                          title="Toggle Italic"
                        >
                          <Italic className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Colors strip */}
                      <div className="flex items-center gap-1 shrink-0 ml-0.5">
                        {['#000000', '#2563EB', '#DC2626', '#16A34A', '#FFFFFF'].map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setEditingTextColor(color)}
                            className={`w-3.5 h-3.5 rounded-full border border-slate-350 transition ${
                              editingTextColor === color ? 'ring-2 ring-blue-500 scale-110' : 'hover:scale-105'
                            }`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>

                      {/* Cover box mask toggle */}
                      <button
                        type="button"
                        onClick={() => setEditingBackgroundColor(editingBackgroundColor === 'transparent' ? '#FFFFFF' : 'transparent')}
                        className={`p-1 rounded border transition flex items-center justify-center ${
                          editingBackgroundColor !== 'transparent' 
                            ? 'bg-blue-600 border-blue-600 text-white' 
                            : 'bg-white border-slate-250 text-slate-500 hover:text-slate-700'
                        }`}
                        title="Toggle Cover Mask (opaque background)"
                      >
                        <EyeOff className="w-3 h-3" />
                      </button>

                      <div className="flex items-center gap-1 ml-auto shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={saveInlineChange}
                          className="p-1 px-1.5 rounded bg-emerald-600 hover:bg-emerald-750 text-white transition font-bold flex items-center gap-0.5 text-[9px]"
                          title="Apply Changes"
                        >
                          <Check className="w-2.5 h-2.5" />
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={cancelInlineChange}
                          className="p-1 rounded bg-slate-200 hover:bg-slate-350 text-slate-600 transition"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={block.id}
                  id={block.id}
                  onClick={() => mode === 'edit' && startInlineEdit(block)}
                  onDoubleClick={() => mode === 'edit' && startInlineEdit(block)}
                  onMouseEnter={() => mode === 'edit' && setHoveredBlock(block)}
                  onMouseLeave={() => mode === 'edit' && setHoveredBlock(null)}
                  className={`absolute leading-none transition-all outline-none flex items-center ${fontStyleClass} ${
                    mode === 'edit'
                      ? 'cursor-pointer hover:bg-blue-50/50 hover:ring-1 hover:ring-blue-400 hover:shadow-xs hover:z-30 rounded-xs'
                      : ''
                  } ${isEdited ? 'shadow-xs border border-emerald-500/10' : ''}`}
                  style={{
                    left: coords.left,
                    top: coords.top,
                    width: coords.width,
                    height: coords.height,
                    fontSize: editObj ? `${editObj.fontSize * zoom}px` : `${coords.fontSize}px`,
                    fontWeight: editObj ? (editObj.isBold ? 'bold' : 'normal') : 'normal',
                    fontStyle: editObj ? (editObj.isItalic ? 'italic' : 'normal') : 'normal',
                    color: editObj ? editObj.textColor : 'rgba(0, 0, 0, 0.04)', // Slight opacity for invisible text selection overlay when unedited
                    backgroundColor: editObj ? editObj.backgroundColor : 'transparent',
                    textShadow: editObj ? 'none' : 'none',
                    padding: '0 2px',
                    whiteSpace: 'nowrap',
                    overflow: 'visible'
                  }}
                  title={mode === 'edit' ? 'Click once to edit text' : undefined}
                >
                  {/* Visual indication showing modified blocks to easily inspect edited nodes */}
                  {isEdited && mode === 'edit' && (
                    <div className="absolute -top-1.5 -right-1 z-30 bg-emerald-500 text-white rounded-full p-0.5 shadow-md shadow-emerald-950/20 leading-none flex items-center justify-center">
                      <div className="w-1.5 h-1.5" />
                    </div>
                  )}

                  {/* Text value inside block */}
                  <span className="leading-none pointer-events-none tracking-tight select-none truncate w-full">
                    {editObj ? editObj.text : block.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contextual Tooltip (Active Editing System Metrics HUD) */}
      {mode === 'edit' && (
        <div className="absolute bottom-6 right-6 bg-white border border-gray-200/80 shadow-lg rounded-xl p-3 w-52 z-40 transition-all duration-200 select-none">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-2 mb-2">
             <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></div>
             <span className="text-[10px] font-bold text-gray-700 tracking-wider">LIVE METRICS HUD</span>
          </div>
          {hoveredBlock ? (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-400 font-semibold uppercase text-[8px]">Font family:</span>
                <span className="font-bold text-gray-700 truncate max-w-[110px] uppercase text-right" title={hoveredBlock.fontFamily}>
                  {hoveredBlock.fontFamily.includes('+') ? hoveredBlock.fontFamily.split('+')[1] : hoveredBlock.fontFamily}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-400 font-semibold uppercase text-[8px]">Render size:</span>
                <span className="font-bold text-gray-700">{Math.round(hoveredBlock.fontSize)} px</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-400 font-semibold uppercase text-[8px]">Coordinates:</span>
                <span className="font-mono text-[9px] font-bold text-gray-700">X:{Math.round(hoveredBlock.x)} Y:{Math.round(hoveredBlock.y)}</span>
              </div>
              <div className="flex justify-between items-center text-[9px] pt-1.5 border-t border-gray-100/60 mt-1">
                <span className="text-blue-600 font-bold uppercase tracking-wider block text-center w-full">Double-click to edit</span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-gray-400 leading-normal font-semibold text-center py-1">
              Hover any text block on the page to view live font & point properties
            </div>
          )}
        </div>
      )}
    </div>
  );
}
