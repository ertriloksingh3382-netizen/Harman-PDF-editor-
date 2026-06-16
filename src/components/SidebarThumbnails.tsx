/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Layers, CheckCircle2, AlertCircle, Trash2, Eye, Loader2 } from 'lucide-react';
import { AllEdits } from '../types';

interface SidebarThumbnailsProps {
  pdfDoc: any; // pdfjs document object
  numPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  edits: AllEdits;
  onDeletePage?: (page: number) => void;
}

interface PdfPageThumbnailProps {
  pdfDoc: any;
  pageNum: number;
}

// Low-resolution rendering component for individual page preview inside the sidebar
function PdfPageThumbnail({ pdfDoc, pageNum }: PdfPageThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [errorOccurred, setErrorOccurred] = useState(false);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    if (!pdfDoc) return;
    let isSubscribed = true;

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (!isSubscribed) return;

        // Render at a small scale (0.3) for high-performance thumbnail previews
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          background: 'rgb(255, 255, 255)'
        };

        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;

        if (isSubscribed) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Sidebar thumbnail rendering error:', err);
        if (isSubscribed) {
          setErrorOccurred(true);
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
  }, [pdfDoc, pageNum]);

  if (errorOccurred) {
    return (
      <div className="w-full aspect-[1/1.414] bg-rose-50 border border-rose-100 rounded flex flex-col items-center justify-center p-2 text-center">
        <AlertCircle className="w-4 h-4 text-rose-500 mb-1" />
        <span className="text-[8px] font-bold text-rose-600">PREVIEW FAIL</span>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[1/1.414] bg-white rounded overflow-hidden shadow-xs border border-gray-150">
      {loading && (
        <div className="absolute inset-0 bg-gray-50/80 flex items-center justify-center">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-full object-contain block" />
    </div>
  );
}

export default function SidebarThumbnails({
  pdfDoc,
  numPages,
  currentPage,
  setCurrentPage,
  edits,
  onDeletePage
}: SidebarThumbnailsProps) {
  const [globalPreviewMode, setGlobalPreviewMode] = useState(false);
  const [previewPages, setPreviewPages] = useState<Record<number, boolean>>({});

  const hasPagePreviewActive = globalPreviewMode || Object.values(previewPages).some(Boolean);
  const sidebarWidthClass = hasPagePreviewActive ? 'w-80' : 'w-56';

  return (
    <div className={`${sidebarWidthClass} bg-gray-50 border-r border-gray-200 flex flex-col h-[calc(100vh-62px)] shrink-0 select-none overflow-hidden transition-all duration-200`} id="thumbnails_sidebar">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200 bg-white space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-sans font-bold text-xs text-gray-800 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-gray-400" />
            Pages Directory
          </h3>
          <span className="text-[9px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded-full">
            {numPages} {numPages === 1 ? 'Page' : 'Pages'}
          </span>
        </div>

        {/* Global Page Preview Toggle Switch */}
        <div className="bg-gray-50 p-2 rounded-xl border border-gray-150 flex items-center justify-between shadow-xs">
          <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-blue-500" />
            Page Preview
          </span>
          <button
            type="button"
            onClick={() => setGlobalPreviewMode(!globalPreviewMode)}
            className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
              globalPreviewMode ? 'bg-blue-600' : 'bg-gray-250'
            }`}
            id="global_page_preview_toggle"
            title="Toggle full page drawing previews on all document thumbnails"
          >
            <span
              className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-250 ease-in-out ${
                globalPreviewMode ? 'translate-x-3.5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Pages List Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-gray-50/50">
        {Array.from({ length: numPages }, (_, index) => {
          const pageNum = index + 1;
          const pageEdits = edits[pageNum] || {};
          const editCount = Object.keys(pageEdits).length;
          const isActive = currentPage === pageNum;
          const isPagePreviewActive = globalPreviewMode || !!previewPages[pageNum];

          return (
            <div
              key={pageNum}
              onClick={() => setCurrentPage(pageNum)}
              id={`thumbnail_page_card_${pageNum}`}
              className={`relative flex flex-col group transition-all duration-150 cursor-pointer ${
                isActive ? 'opacity-100' : 'opacity-75 hover:opacity-100'
              }`}
            >
              {/* Active Indicator Strip */}
              {isActive && (
                <div className="absolute -left-2 top-0 bottom-6 w-1 bg-blue-600 rounded-full" />
              )}

              {/* Toggles Container (Delete + Individual Preview Button) */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-155 z-10">
                {/* Individual Preview Toggle Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewPages(prev => ({
                      ...prev,
                      [pageNum]: !prev[pageNum]
                    }));
                  }}
                  className={`p-1 rounded shadow-sm border transition-all cursor-pointer ${
                    previewPages[pageNum]
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-750'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                  title={`${previewPages[pageNum] ? 'Exit' : 'Enter'} Page Preview for page ${pageNum}`}
                >
                  <Eye className="w-3 h-3" />
                </button>

                {/* Delete Icon Button */}
                {onDeletePage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePage(pageNum);
                    }}
                    className="p-1 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 border border-red-100 rounded shadow-sm cursor-pointer"
                    title={`Permanently delete Page ${pageNum}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Aspect-ratio wrapper container */}
              {isPagePreviewActive ? (
                /* High-Fidelity rendered PDF page canvas option */
                <div 
                  className={`w-full bg-white rounded-md p-1.5 border-2 transition-all shadow-xs ${
                    isActive 
                      ? 'border-blue-600 ring-2 ring-blue-500/10' 
                      : 'border-gray-200 group-hover:border-gray-300'
                  }`}
                >
                  {/* Top metadata info bar for canvas preview */}
                  <div className="flex justify-between items-center mb-1.5 px-0.5 pt-0.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold ${
                      isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {pageNum}
                    </span>
                    {editCount > 0 && (
                      <span className="text-[7.5px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 rounded" title={`${editCount} modifications`}>
                        {editCount} EDITS
                      </span>
                    )}
                  </div>

                  {/* PDF Canvas Component */}
                  <PdfPageThumbnail pdfDoc={pdfDoc} pageNum={pageNum} />
                </div>
              ) : (
                /* Standard mock page preview code */
                <div 
                  className={`w-full aspect-[1/1.414] bg-white rounded-md p-3 border-2 transition-all flex flex-col justify-between shadow-xs ${
                    isActive 
                      ? 'border-blue-600 ring-2 ring-blue-500/10' 
                      : 'border-gray-200 group-hover:border-gray-300'
                  }`}
                >
                  {/* Simulated inner document structure */}
                  <div className="w-full flex justify-between items-start">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {pageNum}
                    </div>
                    
                    {editCount > 0 && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5" title={`${editCount} modifications applied`}>
                        <span className="text-[8px] font-bold text-emerald-600 leading-none">
                          MODIFIED
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Simulated text lines */}
                  <div className="space-y-1.5 mt-auto">
                    <div className={`h-1.5 rounded-sm w-3/4 ${isActive ? 'bg-blue-100' : 'bg-gray-100'}`} />
                    <div className={`h-1.5 rounded-sm w-full ${isActive ? 'bg-blue-50' : 'bg-gray-50'}`} />
                    <div className="h-1 rounded-sm w-1/2 bg-gray-50/50" />
                  </div>
                </div>
              )}

              {/* Label underneath */}
              <span className={`block text-[10px] text-center mt-2.5 font-bold uppercase tracking-wider ${
                isActive ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-800'
              }`}>
                Page {pageNum}
              </span>
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer Info */}
      <div className="p-4 bg-white border-t border-gray-200 text-[10px] text-gray-400 space-y-1.5 shrink-0">
        <div className="flex items-center gap-1.5 font-bold text-gray-500 uppercase tracking-wider">
          <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span>Vector Workspace</span>
        </div>
        <p className="leading-relaxed text-gray-400">
          Edits overlay onto high-fidelity PDF object streams instantly.
        </p>
      </div>
    </div>
  );
}
