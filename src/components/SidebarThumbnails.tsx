/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Layers, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { AllEdits } from '../types';

interface SidebarThumbnailsProps {
  pdfDoc: any; // pdfjs document object
  numPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  edits: AllEdits;
  onDeletePage?: (page: number) => void;
}

export default function SidebarThumbnails({
  pdfDoc,
  numPages,
  currentPage,
  setCurrentPage,
  edits,
  onDeletePage
}: SidebarThumbnailsProps) {
  return (
    <div className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col h-[calc(100vh-62px)] shrink-0 select-none overflow-hidden" id="thumbnails_sidebar">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h3 className="font-sans font-bold text-xs text-gray-800 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-gray-400" />
          Pages Directory
        </h3>
        <p className="text-[10px] text-gray-400 font-semibold uppercase mt-1">
          {numPages} {numPages === 1 ? 'page' : 'pages'} total
        </p>
      </div>

      {/* Pages List Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-gray-50/50">
        {Array.from({ length: numPages }, (_, index) => {
          const pageNum = index + 1;
          const pageEdits = edits[pageNum] || {};
          const editCount = Object.keys(pageEdits).length;
          const isActive = currentPage === pageNum;

          return (
            <div
              key={pageNum}
              onClick={() => setCurrentPage(pageNum)}
              id={`thumbnail_page_card_${pageNum}`}
              className={`relative flex flex-col group transition-all duration-150 cursor-pointer ${
                isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {/* Active Indicator Strip */}
              {isActive && (
                <div className="absolute -left-2 top-0 bottom-6 w-1 bg-blue-600 rounded-full" />
              )}

              {/* Delete Icon Button overlay */}
              {onDeletePage && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePage(pageNum);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 border border-red-200 hover:border-red-300 rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-155 z-10 cursor-pointer"
                  title={`Permanently delete Page ${pageNum}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Aspect-ratio paper-like card mockup */}
              <div 
                className={`w-full aspect-[1/1.414] bg-white rounded-md p-3 border-2 transition-all flex flex-col justify-between shadow-xs ${
                  isActive 
                    ? 'border-blue-600 ring-2 ring-blue-500/10' 
                    : 'border-gray-200 group-hover:border-gray-450'
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
      <div className="p-4 bg-white border-t border-gray-200 text-[10px] text-gray-400 space-y-1.5">
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
