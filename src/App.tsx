/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  FileUp, 
  Sparkles, 
  ShieldCheck, 
  Files, 
  HelpCircle,
  TrendingUp,
  Cpu
} from 'lucide-react';

import Header from './components/Header';
import SidebarThumbnails from './components/SidebarThumbnails';
import PdfWorkspace from './components/PdfWorkspace';
import TextEditPopup from './components/TextEditPopup';
import PdfToolsPanel from './components/PdfToolsPanel';
import PdfEstimation from './components/PdfEstimation';
import SupplementarySection from './components/SupplementarySection';

import { PDFDocument } from 'pdf-lib';
import { PdfTextBlock, PdfEdit, AllEdits, PartOrder, User, Vehicle, PartsMasterItem } from './types';
import { generateSamplePdf } from './utils/pdfGenerator';
import { exportModifiedPdf } from './utils/pdfModifier';

export default function App() {
  // Navigation tabs
  const [activeView, setActiveView] = useState<'editor' | 'estimation' | 'supplementary'>('editor');

  // Supplementary Section States
  const [parts, setParts] = useState<PartOrder[]>(() => {
    try {
      const saved = localStorage.getItem('harman_supplementary_parts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    try {
      const saved = localStorage.getItem('harman_supplementary_vehicles');
      return saved ? JSON.parse(saved) : [
        { id: 'v1', regNo: 'HR10AU4455', customer: 'BALJIT KAUR', jc: 'KRS-2627', status: 'In Progress' },
        { id: 'v2', regNo: 'DL1CAB4596', customer: 'Trilok Singh', jc: 'JC-2026-089', status: 'In Progress' }
      ];
    } catch {
      return [
        { id: 'v1', regNo: 'HR10AU4455', customer: 'BALJIT KAUR', jc: 'KRS-2627', status: 'In Progress' },
        { id: 'v2', regNo: 'DL1CAB4596', customer: 'Trilok Singh', jc: 'JC-2026-089', status: 'In Progress' }
      ];
    }
  });

  const [partsMaster] = useState<PartsMasterItem[]>(() => {
    try {
      const saved = localStorage.getItem('harman_parts_master');
      return saved ? JSON.parse(saved) : [
        { id: 'm1', partNo: '16361103-00', partName: 'Front bumper body', price: 13704.30 },
        { id: 'm2', partNo: '13442619-00', partName: 'LEFT BRACKET, BUMPER, FRONT', price: 347.14 },
        { id: 'm3', partNo: '13499409-00', partName: 'LEFT TRIM, BUMPER, FRONT', price: 480.41 },
        { id: 'm4', partNo: '15504931-00', partName: 'Active grille assembly', price: 8160.99 },
        { id: 'm5', partNo: '13499336-00', partName: 'Front bumper lower intake grille left reinforcement plate', price: 474.22 }
      ];
    } catch {
      return [];
    }
  });

  const currentUser: User = {
    canWrite: true,
    canDelete: true
  };

  useEffect(() => {
    localStorage.setItem('harman_supplementary_parts', JSON.stringify(parts));
  }, [parts]);

  useEffect(() => {
    localStorage.setItem('harman_supplementary_vehicles', JSON.stringify(vehicles));
  }, [vehicles]);

  const handleSavePart = (p: PartOrder) => {
    setParts(prev => {
      const exists = prev.some(x => x.id === p.id);
      if (exists) {
        return prev.map(x => x.id === p.id ? p : x);
      }
      return [p, ...prev];
    });
  };

  const handleDeletePart = (id: string) => {
    setParts(prev => prev.map(p => p.id === id ? { ...p, isDeleted: true } : p));
  };


  // Document states
  const [originalPdfBytes, setOriginalPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  
  // Interactive View states
  const [zoom, setZoom] = useState<number>(1.15);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Edits structures
  const [edits, setEdits] = useState<AllEdits>({});
  const [blockMetadata, setBlockMetadata] = useState<{ [blockId: string]: PdfTextBlock }>({});
  const [selectedBlockForEdit, setSelectedBlockForEdit] = useState<PdfTextBlock | null>(null);

  // Undo / Redo history stack structures
  const [history, setHistory] = useState<Array<{
    edits: AllEdits;
    blockMetadata: { [blockId: string]: PdfTextBlock };
  }>>([{ edits: {}, blockMetadata: {} }]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const pushToHistory = (
    nextEdits: AllEdits,
    nextBlockMetadata: { [blockId: string]: PdfTextBlock }
  ) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    const newSnapshot = { edits: nextEdits, blockMetadata: nextBlockMetadata };
    setHistory([...updatedHistory, newSnapshot]);
    setHistoryIndex(updatedHistory.length);
    setEdits(nextEdits);
    setBlockMetadata(nextBlockMetadata);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const snapshot = history[prevIndex];
      setHistoryIndex(prevIndex);
      setEdits(snapshot.edits);
      setBlockMetadata(snapshot.blockMetadata);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const snapshot = history[nextIndex];
      setHistoryIndex(nextIndex);
      setEdits(snapshot.edits);
      setBlockMetadata(snapshot.blockMetadata);
    }
  };

  // Counter of total updates done across pages
  const [totalEditsCount, setTotalEditsCount] = useState<number>(0);

  useEffect(() => {
    let count = 0;
    Object.values(edits).forEach((pageMap) => {
      count += Object.keys(pageMap).length;
    });
    setTotalEditsCount(count);
  }, [edits]);

  // Integrated Keyboard Shortcut Commands (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (isInput) return; // let text fields process default input undoing

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl) {
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            e.preventDefault();
            handleRedo();
          } else {
            e.preventDefault();
            handleUndo();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [historyIndex, history]);

  // Render compiled edited PDF to browser printing pipeline
  const handlePrint = async () => {
    if (!originalPdfBytes) return;
    setIsProcessing(true);
    try {
      const modifiedBytes = await exportModifiedPdf(originalPdfBytes, edits, blockMetadata);
      const blob = new Blob([modifiedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.focus();
      } else {
        // Fallback for sandboxed preview iframe popups blocks
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentWindow?.print();
        };
      }
    } catch (err: any) {
      console.error('PDF compile failed for print workflow:', err);
      alert(`Print document failed: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle local PDF uploads
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      loadPdfFile(e.target.files[0]);
    }
  };

  const loadPdfFile = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          const bytes = new Uint8Array(event.target.result as ArrayBuffer);
          setOriginalPdfBytes(bytes);
          setFileName(file.name);
          setEdits({});
          setBlockMetadata({});
          setHistory([{ edits: {}, blockMetadata: {} }]);
          setHistoryIndex(0);
          setCurrentPage(1);
          setMode('view');
          
          const loadingTask = pdfjsLib.getDocument({ data: bytes });
          const pdf = await loadingTask.promise;
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      console.error('Error reading PDF file:', err);
      alert(`Unable to read PDF file: ${err.message || err}`);
    }
  };

  // Preload dynamic demo vector document for onboarding
  const handleLoadSample = async () => {
    setIsProcessing(true);
    try {
      const bytes = await generateSamplePdf();
      setOriginalPdfBytes(bytes);
      setFileName('Harman_Demo_Invoice.pdf');
      setEdits({});
      setBlockMetadata({});
      setHistory([{ edits: {}, blockMetadata: {} }]);
      setHistoryIndex(0);
      setCurrentPage(1);
      setMode('edit'); // open directly in Edit mode to promote immediate exploration!

      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
    } catch (err: any) {
      console.error('Error generating sample PDF document:', err);
      alert(`Demo generation failed: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Drag and Drop Event Wrappers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        loadPdfFile(file);
      } else {
        alert('Please drop a valid PDF document file.');
      }
    }
  };

  // Trigger vector compiler and trigger direct browser file stream download
  const handleDownload = async () => {
    if (!originalPdfBytes) return;
    setIsProcessing(true);
    try {
      const modifiedBytes = await exportModifiedPdf(originalPdfBytes, edits, blockMetadata);
      
      const blob = new Blob([modifiedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const rawName = fileName || 'document.pdf';
      const outputName = rawName.toUpperCase().endsWith('.PDF') 
        ? `${rawName.substring(0, rawName.length - 4)}_edited.pdf` 
        : `${rawName}_edited.pdf`;

      link.download = outputName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('PDF modifications writing failed:', err);
      alert(`Failed to save edits to vector PDF document: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Discard all edits of current document session
  const handleReset = () => {
    if (confirm('Are you sure you want to discard all text transformations? This cannot be undone.')) {
      setEdits({});
      setBlockMetadata({});
      setHistory([{ edits: {}, blockMetadata: {} }]);
      setHistoryIndex(0);
    }
  };

  // Open Block Dialog Modal
  const handleEditBlockClick = (block: PdfTextBlock) => {
    setSelectedBlockForEdit(block);
  };

  // Save changes from Dialog Modal
  const handleSaveBlockEdit = (modifiedEdit: PdfEdit) => {
    if (!selectedBlockForEdit) return;

    const blockId = selectedBlockForEdit.id;
    const pageNum = selectedBlockForEdit.pageNumber;

    const nextEdits = {
      ...edits,
      [pageNum]: {
        ...(edits[pageNum] || {}),
        [blockId]: modifiedEdit,
      },
    };

    const nextBlockMetadata = {
      ...blockMetadata,
      [blockId]: selectedBlockForEdit,
    };

    pushToHistory(nextEdits, nextBlockMetadata);
    setSelectedBlockForEdit(null);
  };

  // Save inline modifications directly back to page edits map
  const handleSaveInlineEdit = (block: PdfTextBlock, modifiedEdit: PdfEdit) => {
    const blockId = block.id;
    const pageNum = block.pageNumber;

    const nextEdits = {
      ...edits,
      [pageNum]: {
        ...(edits[pageNum] || {}),
        [blockId]: modifiedEdit,
      },
    };

    const nextBlockMetadata = {
      ...blockMetadata,
      [blockId]: block,
    };

    pushToHistory(nextEdits, nextBlockMetadata);
  };

  // Perform dynamic PDF stream update & redraw the active editor viewport
  const handleUpdatePdfBytes = async (bytes: Uint8Array, totalPagesCount?: number) => {
    try {
      setIsProcessing(true);
      setOriginalPdfBytes(bytes);
      
      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      
      if (totalPagesCount && totalPagesCount === 1) {
        setCurrentPage(1);
      }
    } catch (err: any) {
      console.error('Error reloading updated PDF stream:', err);
      alert(`Unable to reload updated PDF: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle deleting a specific page permanently from the structure
  const handleDeletePage = async (pageToDelete: number) => {
    if (!originalPdfBytes || !pdfDoc) return;
    if (numPages <= 1) {
      alert('Strict Rule: Cannot delete the last remaining page of the PDF layout.');
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete Page ${pageToDelete} from the layout?`)) return;
    setIsProcessing(true);
    try {
      const srcDoc = await PDFDocument.load(originalPdfBytes);
      srcDoc.removePage(pageToDelete - 1);
      const newBytes = await srcDoc.save();
      
      // Shift page edits for pages > pageToDelete
      const nextEdits: AllEdits = {};
      Object.keys(edits).forEach(keyStr => {
        const pageKey = parseInt(keyStr, 10);
        if (pageKey < pageToDelete) {
          nextEdits[pageKey] = edits[pageKey];
        } else if (pageKey > pageToDelete) {
          nextEdits[pageKey - 1] = edits[pageKey];
        }
      });
      setEdits(nextEdits);

      await handleUpdatePdfBytes(newBytes);
      
      // Adjust currentPage selection
      if (currentPage === pageToDelete) {
        setCurrentPage(Math.min(currentPage, numPages - 1));
      } else if (currentPage > pageToDelete) {
        setCurrentPage(currentPage - 1);
      }
      
      alert(`Deleted Page ${pageToDelete} successfully.`);
    } catch (err: any) {
      alert(`Page deletion failed: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden font-sans" id="main_app_container">
      
      {/* Header Panel */}
      <Header
        fileName={fileName}
        mode={mode}
        setMode={setMode}
        zoom={zoom}
        setZoom={setZoom}
        onUpload={handleFileUpload}
        onDownload={handleDownload}
        onLoadSample={handleLoadSample}
        onReset={handleReset}
        hasEdits={totalEditsCount > 0}
        isProcessing={isProcessing}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onPrint={handlePrint}
      />

      {/* View routing selector bar */}
      <div className="bg-slate-100 border-b border-gray-200 px-6 py-2 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('editor')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeView === 'editor'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900'
            }`}
          >
            📑 PDF Document Editor
          </button>
          <button
            onClick={() => setActiveView('estimation')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeView === 'estimation'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900'
            }`}
          >
            👨‍🔧 PDF Estimation & Quotations
          </button>
          <button
            onClick={() => setActiveView('supplementary')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeView === 'supplementary'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900'
            }`}
          >
            🛠️ Supplementary Parts Tracker
          </button>
        </div>
        <div className="text-[10px] text-gray-500 font-mono font-bold uppercase tracking-widest hidden sm:block">
          HARMAN AUTO BOT DEPLOYMENT PANEL v3.0
        </div>
      </div>

      {/* Main Sandbox Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {activeView === 'supplementary' ? (
          <div className="flex-1 bg-[#0a0c16] text-slate-200 overflow-y-auto p-6">
            <SupplementarySection
              parts={parts}
              partsMaster={partsMaster}
              vehicles={vehicles}
              currentUser={currentUser}
              onSavePart={handleSavePart}
              onDeletePart={handleDeletePart}
            />
          </div>
        ) : activeView === 'estimation' ? (
          <PdfEstimation />
        ) : pdfDoc ? (
          /* Editor Layout Mode */
          <>
            <SidebarThumbnails
              pdfDoc={pdfDoc}
              numPages={numPages}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              edits={edits}
              onDeletePage={handleDeletePage}
            />
            
            <PdfWorkspace
              pdfDoc={pdfDoc}
              currentPage={currentPage}
              zoom={zoom}
              mode={mode}
              edits={edits}
              onEditBlock={handleEditBlockClick}
              onSaveInlineEdit={handleSaveInlineEdit}
            />

            <PdfToolsPanel
              pdfDoc={pdfDoc}
              originalPdfBytes={originalPdfBytes}
              fileName={fileName}
              currentPage={currentPage}
              onUpdatePdfBytes={handleUpdatePdfBytes}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              onDownload={handleDownload}
              onPrint={handlePrint}
            />
          </>
        ) : (
          /* Empty Landing State & Drag Dropzone */
          <div 
            className="flex-1 flex flex-col items-center justify-center p-8 bg-[#F3F4F6] min-h-[calc(100vh-62px)] relative"
            id="drag_drop_zone_landing"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            {/* Ambient Background Glow Decoration */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none" />

            <div className="max-w-xl w-full text-center space-y-8 z-10">
              
              {/* Launcher Visual Asset Container */}
              <div 
                className={`transition-all duration-300 p-10 rounded-2xl border-2 border-dashed bg-white shadow-xl max-w-lg mx-auto flex flex-col items-center gap-5 ${
                  dragActive 
                    ? 'border-blue-600 bg-blue-50/40 scale-102 ring-4 ring-blue-500/10' 
                    : 'border-gray-300 hover:border-blue-300/60'
                }`}
              >
                <div className="bg-blue-50 text-blue-600 rounded-xl p-4 shadow-xs">
                  <FileUp className="w-10 h-10 stroke-[1.5]" />
                </div>
                
                <div className="space-y-1.5">
                  <h2 className="font-sans font-bold text-lg text-gray-800 tracking-tight">
                    Upload your Document
                  </h2>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    Drag & drop your PDF file directly into this frame, or browse your local file system to start.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full px-4">
                  {/* File Upload Trigger Button */}
                  <label 
                    id="drop_browse_label"
                    htmlFor="pdf_file_uploader_input_main" 
                    className="w-full sm:flex-1 py-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm text-center transition duration-150 cursor-pointer"
                  >
                    Browse Files
                  </label>
                  <input
                    type="file"
                    id="pdf_file_uploader_input_main"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  {/* Preloaded Demo Onboarding Trigger */}
                  <button
                    id="drop_demo_button"
                    onClick={handleLoadSample}
                    className="w-full sm:flex-1 py-3 text-xs font-bold bg-[#1E293B] hover:bg-[#0F172A] active:bg-[#020617] text-white rounded-lg shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Load Demo PDF
                  </button>
                </div>

                {/* Compatibility Footer */}
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5 mt-1">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>PRESERVES VECTOR STREAM SHARP ARCHITECTURE</span>
                </div>
              </div>

              {/* Advanced Trust badges */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-lg mx-auto" id="trust-badges">
                
                {/* Badge 1 */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 flex flex-col items-center text-center shadow-xs">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 mb-1.5" />
                  <span className="text-xs font-bold text-gray-800">100% In-Browser</span>
                  <p className="text-[10px] text-gray-400 font-medium mt-1 leading-relaxed">Processing stays client-side, fully offline and secure.</p>
                </div>

                {/* Badge 2 */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 flex flex-col items-center text-center shadow-xs">
                  <Files className="w-5 h-5 text-blue-550 mb-1.5" />
                  <span className="text-xs font-bold text-gray-800">Vector Integrity</span>
                  <p className="text-[10px] text-gray-400 font-medium mt-1 leading-relaxed">Keeps charts, text blocks, and original scales crisp.</p>
                </div>

                {/* Badge 3 */}
                <div className="bg-white p-4 rounded-xl border border-gray-200/80 flex flex-col items-center text-center shadow-xs col-span-2 md:col-span-1">
                  <TrendingUp className="w-5 h-5 text-cyan-500 mb-1.5" />
                  <span className="text-xs font-bold text-gray-800">Precise Overlays</span>
                  <p className="text-[10px] text-gray-400 font-medium mt-1 leading-relaxed">Modifies embedded font resources flawlessly.</p>
                </div>

              </div>

            </div>
          </div>
        )}

      </div>

      {/* Bottom Info Bar Status Footer */}
      <footer className="h-7 bg-white border-t border-gray-200 flex items-center justify-between px-6 shrink-0 text-[10px] text-gray-500 font-semibold uppercase tracking-wider select-none z-20">
        <div className="flex items-center space-x-5">
          <span>DOCUMENT: <span className="font-bold text-gray-850">{fileName || "None Loaded"}</span></span>
          {pdfDoc && <span>PAGES: <span className="font-bold text-gray-850">{numPages} READY</span></span>}
        </div>
        <div className="flex items-center space-x-5">
          <span>RENDERING: <span className="text-green-600 font-bold">PDF.JS CORE STREAM</span></span>
          <span>STATUS: <span className="font-bold text-blue-600">{totalEditsCount > 0 ? `${totalEditsCount} TRANSFORMS APPLIED` : "READY FOR DOWNLOAD"}</span></span>
        </div>
      </footer>

      {/* Editing Dialog Modal overlay */}
      {selectedBlockForEdit && (
        <TextEditPopup
          block={selectedBlockForEdit}
          currentEdit={(edits[selectedBlockForEdit.pageNumber] || {})[selectedBlockForEdit.id] || null}
          onSave={handleSaveBlockEdit}
          onCancel={() => setSelectedBlockForEdit(null)}
        />
      )}

    </div>
  );
}
