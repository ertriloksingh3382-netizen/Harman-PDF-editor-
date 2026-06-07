/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { 
  FileUp, 
  Download, 
  Eye, 
  Edit3, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Sparkles,
  FileText,
  Loader2,
  Undo2,
  Redo2,
  Printer
} from 'lucide-react';

interface HeaderProps {
  fileName: string | null;
  mode: 'view' | 'edit';
  setMode: (mode: 'view' | 'edit') => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: () => void;
  onLoadSample: () => void;
  onReset: () => void;
  hasEdits: boolean;
  isProcessing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPrint: () => void;
}

export default function Header({
  fileName,
  mode,
  setMode,
  zoom,
  setZoom,
  onUpload,
  onDownload,
  onLoadSample,
  onReset,
  hasEdits,
  isProcessing,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPrint
}: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 0.15, 2.5));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 0.15, 0.5));
  };

  const handleZoomReset = () => {
    setZoom(1.0);
  };

  return (
    <header className="bg-white border-b border-gray-200 text-slate-800 shadow-xs select-none sticky top-0 z-50 px-6 py-3.5" id="app_header">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Brand Logo & Loaded File Info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold select-none text-sm leading-none shrink-0" id="header_symbol_badge">
            H
          </div>
          <div>
            <h1 className="font-sans font-bold tracking-tight text-base text-gray-800 flex items-center gap-1.5">
              Harman PDF Editor
              <span className="text-[10px] font-mono tracking-widest bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 font-bold">PRO</span>
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5" id="file_status">
              {fileName ? (
                <>
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs text-slate-600 font-medium truncate max-w-[180px] md:max-w-[280px]">
                    {fileName}
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-400">No document loaded</span>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Action Buttons / Toolbar */}
        <div className="flex flex-wrap items-center gap-3 md:gap-4 justify-start md:justify-end">
          
          {/* File Picker Wrapper */}
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              id="pdf_file_uploader_input" 
              accept=".pdf" 
              className="hidden" 
              onChange={onUpload}
            />
            
            <button
              id="upload_button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 active:bg-gray-200/80 text-gray-700 rounded-lg transition cursor-pointer border border-gray-200/50"
            >
              <FileUp className="w-4 h-4 text-blue-600" />
              Upload PDF
            </button>

            {!fileName && (
              <button
                id="load_sample_button"
                onClick={onLoadSample}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 active:bg-blue-100/80 text-blue-600 rounded-lg border border-blue-200 transition cursor-pointer"
                title="Generates a mock vector invoice style document instantly"
              >
                <Sparkles className="w-4 h-4 text-blue-500" />
                Try Sample
              </button>
            )}
          </div>

          {fileName && (
            <>
              {/* Zoom Controls */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200/50 shrink-0">
                <button
                  id="zoom_out"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  className="px-2.5 py-1.5 text-gray-500 hover:bg-white hover:shadow-xs rounded disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  id="zoom_reset"
                  onClick={handleZoomReset}
                  className="px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-white hover:shadow-xs rounded transition cursor-pointer min-w-[50px] text-center"
                  title="Reset Zoom to 100%"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  id="zoom_in"
                  onClick={handleZoomIn}
                  disabled={zoom >= 2.5}
                  className="px-2.5 py-1.5 text-gray-500 hover:bg-white hover:shadow-xs rounded disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Mode Toggle Button */}
              <div className="flex items-center bg-gray-100 p-0.5 rounded-full border border-gray-200/60 shrink-0">
                <button
                  id="mode_view_toggle"
                  onClick={() => setMode('view')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                    mode === 'view' 
                      ? 'bg-white text-blue-600 shadow-xs font-bold border border-gray-200/30' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Mode
                </button>
                <button
                  id="mode_edit_toggle"
                  onClick={() => setMode('edit')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                    mode === 'edit' 
                      ? 'bg-blue-600 text-white shadow-xs font-bold' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Mode
                </button>
              </div>

              {/* Undo / Redo Controls */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200/50 shrink-0">
                <button
                  id="undo_button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="px-2.5 py-1.5 text-gray-500 hover:bg-white hover:text-blue-600 hover:shadow-xs rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500 transition cursor-pointer flex items-center justify-center"
                  title="Undo last text edit (Ctrl + Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  id="redo_button"
                  onClick={onRedo}
                  disabled={!canRedo}
                  className="px-2.5 py-1.5 text-gray-500 hover:bg-white hover:text-blue-600 hover:shadow-xs rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500 transition cursor-pointer flex items-center justify-center"
                  title="Redo last change (Ctrl + Y)"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>

              {/* Reset/Discard Edits */}
              {hasEdits && (
                <button
                  id="reset_edits_button"
                  onClick={onReset}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50 active:bg-rose-100 rounded-lg border border-rose-200 transition cursor-pointer shrink-0"
                  title="Clear all page text edits"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Discard Updates
                </button>
              )}

              {/* Print Button */}
              <button
                id="print_pdf_button"
                onClick={onPrint}
                disabled={isProcessing}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white rounded-lg shadow-sm transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer shrink-0"
                title="Open browser print setup for compiled document"
              >
                <Printer className="w-4 h-4 text-slate-300" />
                Print PDF
              </button>

              {/* Export Button */}
              <button
                id="export_button"
                onClick={onDownload}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg shadow-sm transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer shrink-0"
                title="Saves edits and compiles vector-perfect PDF for download"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export PDF
                  </>
                )}
              </button>
            </>
          )}

        </div>
      </div>
    </header>
  );
}
