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
  Cpu,
  Layers,
  Scissors,
  Minimize2,
  FileText,
  Presentation,
  FileSpreadsheet,
  FilePenLine,
  Image,
  PenTool,
  RotateCw,
  Code,
  Unlock,
  Lock,
  LayoutGrid,
  BookOpen,
  Wrench,
  Hash,
  Scan,
  FileSearch,
  Eye,
  Trash2,
  Undo2,
  Redo2,
  Printer,
  ChevronRight,
  ArrowRight,
  Sparkle,
  History,
  X,
  Copyright
} from 'lucide-react';

import Header from './components/Header';
import SidebarThumbnails from './components/SidebarThumbnails';
import PdfWorkspace from './components/PdfWorkspace';
import TextEditPopup from './components/TextEditPopup';
import PdfToolsPanel from './components/PdfToolsPanel';
import PdfEstimation from './components/PdfEstimation';
import SupplementarySection from './components/SupplementarySection';

import { PDFDocument } from 'pdf-lib';
import { PdfTextBlock, PdfEdit, AllEdits } from './types';
import { generateSamplePdf } from './utils/pdfGenerator';
import { exportModifiedPdf } from './utils/pdfModifier';

const ALL_PDF_TOOLS = [
  {
    id: 'merge',
    title: 'Merge PDF',
    desc: 'Combine PDFs in the order you want with the easiest PDF merger available.',
    icon: Layers,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    badgeColor: 'bg-orange-500/10 text-orange-600',
    category: 'organize',
    panelTab: 'organize' as const
  },
  {
    id: 'split',
    title: 'Split PDF',
    desc: 'Separate one page or a whole set for easy conversion into independent PDF files.',
    icon: Scissors,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    badgeColor: 'bg-orange-500/10 text-orange-600',
    category: 'organize',
    panelTab: 'organize' as const
  },
  {
    id: 'compress',
    title: 'Compress PDF',
    desc: 'Reduce file size while optimizing for maximal PDF quality.',
    icon: Minimize2,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    badgeColor: 'bg-emerald-500/10 text-emerald-600',
    category: 'optimize',
    panelTab: 'utilities' as const
  },
  {
    id: 'pdf-to-word',
    title: 'PDF to Word',
    desc: 'Easily convert your PDF files into easy to edit DOC and DOCX documents with almost 100% accuracy.',
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    badgeColor: 'bg-blue-500/10 text-blue-600',
    category: 'convert',
    panelTab: 'convert' as const
  },
  {
    id: 'pdf-to-ppt',
    title: 'PDF to PowerPoint',
    desc: 'Turn your PDF files into easy to edit PPT and PPTX slideshows.',
    icon: Presentation,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50/50',
    badgeColor: 'bg-orange-500/10 text-orange-600',
    category: 'convert',
    panelTab: 'convert' as const
  },
  {
    id: 'pdf-to-excel',
    title: 'PDF to Excel',
    desc: 'Pull data straight from PDFs into Excel spreadsheets in a few short seconds.',
    icon: FileSpreadsheet,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50/50',
    badgeColor: 'bg-emerald-500/10 text-emerald-600',
    category: 'convert',
    panelTab: 'convert' as const
  },
  {
    id: 'word-to-pdf',
    title: 'Word to PDF',
    desc: 'Make DOC and DOCX files easy to read by converting them to PDF.',
    icon: FileText,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50/50',
    badgeColor: 'bg-blue-500/10 text-blue-600',
    category: 'convert',
    panelTab: 'convert' as const
  },
  {
    id: 'ppt-to-pdf',
    title: 'PowerPoint to PDF',
    desc: 'Make PPT and PPTX slideshows easy to view by converting them to PDF.',
    icon: Presentation,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50/85',
    badgeColor: 'bg-orange-500/10 text-orange-600',
    category: 'convert',
    panelTab: 'convert' as const
  },
  {
    id: 'excel-to-pdf',
    title: 'Excel to PDF',
    desc: 'Make EXCEL spreadsheets easy to read by converting them to PDF.',
    icon: FileSpreadsheet,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50/85',
    badgeColor: 'bg-emerald-500/10 text-emerald-600',
    category: 'convert',
    panelTab: 'convert' as const
  },
  {
    id: 'edit-pdf',
    title: 'Edit PDF',
    desc: 'Add text, images, shapes or freehand annotations directly to your PDF document pages.',
    icon: FilePenLine,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    badgeColor: 'bg-purple-500/10 text-purple-600',
    category: 'edit',
    panelTab: 'utilities' as const,
    editorMode: 'edit' as const
  },
  {
    id: 'pdf-to-jpg',
    title: 'PDF to JPG',
    desc: 'Convert each PDF page into a high resolution JPG or extract all images contained inside.',
    icon: Image,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    badgeColor: 'bg-yellow-500/10 text-yellow-600',
    category: 'convert',
    panelTab: 'convert' as const
  },
  {
    id: 'jpg-to-pdf',
    title: 'JPG to PDF',
    desc: 'Convert JPG or PNG images to PDF in seconds. Easily adjust orientation and margins.',
    icon: Image,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50/50',
    badgeColor: 'bg-yellow-500/10 text-yellow-600',
    category: 'convert',
    panelTab: 'convert' as const
  },
  {
    id: 'sign-pdf',
    title: 'Sign PDF',
    desc: 'Add secure signatures to your documents or request electronic signing validations.',
    icon: PenTool,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    badgeColor: 'bg-sky-500/10 text-sky-600',
    category: 'security',
    panelTab: 'utilities' as const
  },
  {
    id: 'watermark',
    title: 'Watermark',
    desc: 'Stamp a customizable text banner or logo image over your PDF pages in real-time.',
    icon: Copyright,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50/50',
    badgeColor: 'bg-purple-500/10 text-purple-600',
    category: 'edit',
    panelTab: 'utilities' as const
  },
  {
    id: 'rotate-pdf',
    title: 'Rotate PDF',
    desc: 'Rotate your PDFs the way you need. Support batch rotating multiple pages at once.',
    icon: RotateCw,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    badgeColor: 'bg-pink-500/10 text-pink-600',
    category: 'edit',
    panelTab: 'utilities' as const
  },
  {
    id: 'html-to-pdf',
    title: 'HTML to PDF',
    desc: 'Convert webpages in HTML to secure PDF. Just copy, paste the URL and convert.',
    icon: Code,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    badgeColor: 'bg-red-500/10 text-red-600',
    category: 'convert',
    panelTab: 'convert' as const
  },
  {
    id: 'unlock-pdf',
    title: 'Unlock PDF',
    desc: 'Strip secure passkeys or passwords from PDF to view and print freely.',
    icon: Unlock,
    color: 'text-teal-650',
    bgColor: 'bg-teal-50',
    badgeColor: 'bg-teal-500/10 text-teal-650',
    category: 'security',
    panelTab: 'utilities' as const
  },
  {
    id: 'protect-pdf',
    title: 'Protect PDF',
    desc: 'Protect PDF files with strong passwords. Encrypt content to secure against third parties.',
    icon: Lock,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    badgeColor: 'bg-teal-500/10 text-teal-600',
    category: 'security',
    panelTab: 'utilities' as const
  },
  {
    id: 'organize-pdf',
    title: 'Organize PDF',
    desc: 'Sort, re-align, add or permanently delete selected layout pages.',
    icon: LayoutGrid,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    badgeColor: 'bg-rose-500/10 text-rose-600',
    category: 'organize',
    panelTab: 'organize' as const
  },
  {
    id: 'pdf-to-pdfa',
    title: 'PDF to PDF/A',
    desc: 'Transform your PDF onto ISO-standardized PDF/A structure for absolute long-term archiving.',
    icon: BookOpen,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    badgeColor: 'bg-blue-500/10 text-blue-600',
    category: 'convert',
    panelTab: 'convert' as const
  },
  {
    id: 'repair-pdf',
    title: 'Repair PDF',
    desc: 'Heal corrupted or partially damaged PDF byte structures instantly.',
    icon: Wrench,
    color: 'text-green-500',
    bgColor: 'bg-green-50/70',
    badgeColor: 'bg-green-500/10 text-green-600',
    category: 'optimize',
    panelTab: 'utilities' as const
  },
  {
    id: 'page-numbers',
    title: 'Page Numbers',
    desc: 'Add beautifully customized numeric labels to footers or headers of your pages automatically.',
    icon: Hash,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50/80',
    badgeColor: 'bg-purple-500/10 text-purple-600',
    category: 'edit',
    panelTab: 'utilities' as const
  },
  {
    id: 'scan-pdf',
    title: 'Scan to PDF',
    desc: 'Import scans from local file buffers and convert them to formatted PDF sheets.',
    icon: Scan,
    color: 'text-violet-650',
    bgColor: 'bg-violet-50',
    badgeColor: 'bg-violet-500/10 text-violet-600',
    category: 'organize',
    panelTab: 'organize' as const
  },
  {
    id: 'ocr-pdf',
    title: 'OCR PDF',
    desc: 'Extract textual information from images or scanned PDF sheets instantly.',
    icon: FileSearch,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    badgeColor: 'bg-green-500/10 text-green-600',
    category: 'optimize',
    panelTab: 'ai' as const
  },
  {
    id: 'ai-summarizer',
    title: 'AI Summarizer',
    desc: 'Use advanced server-side Gemini intelligence to generate multi-perspective summaries & insights.',
    icon: Sparkle,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    badgeColor: 'bg-indigo-500/10 text-indigo-600',
    category: 'intelligence',
    panelTab: 'ai' as const
  },
  {
    id: 'translate-pdf',
    title: 'Translate PDF',
    desc: 'Instantly translate text segments inside your document workspace utilizing native translation bridges.',
    icon: History,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50/40',
    badgeColor: 'bg-indigo-500/10 text-indigo-600',
    category: 'intelligence',
    panelTab: 'ai' as const
  }
];

export default function App() {
  // Navigation tabs
  const [activeView, setActiveView] = useState<'dashboard' | 'editor' | 'estimation' | 'supplementary'>('dashboard');

  // Controlled active tab state inside PdfToolsPanel
  const [toolsActiveTab, setToolsActiveTab] = useState<'convert' | 'utilities' | 'organize' | 'ai'>('convert');

  // Active selected tool for prompt modal details
  const [selectedToolForModal, setSelectedToolForModal] = useState<any | null>(null);

  // Dashboard category filter and search query
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

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
        onGoToDashboard={() => setActiveView('dashboard')}
      />

      {/* View routing selector bar */}
      <div className="bg-slate-100 border-b border-gray-200 px-6 py-2 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeView === 'dashboard'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900'
            }`}
          >
            🎛️ Toolbox Dashboard
          </button>
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
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900'
            }`}
          >
            📋 Estimate Sheet
          </button>
          <button
            onClick={() => setActiveView('supplementary')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeView === 'supplementary'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900'
            }`}
          >
            🛠️ Supplementary comparing Sheet
          </button>
        </div>
        <div className="text-[10px] text-gray-500 font-mono font-bold uppercase tracking-widest hidden sm:block">
          HARMAN AUTO BOT DEPLOYMENT PANEL v3.0
        </div>
      </div>

      {/* Main Sandbox Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {activeView === 'estimation' ? (
          <PdfEstimation />
        ) : activeView === 'supplementary' ? (
          <SupplementarySection />
        ) : activeView === 'dashboard' ? (
          <div className="flex-1 bg-slate-50 overflow-y-auto px-4 py-8 md:px-8 relative select-none flex flex-col" id="dashboard_panel">
            {/* Ambient Background Glow Decoration */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-100 rounded-full mix-blend-multiply filter blur-3xl opacity-15 pointer-events-none" />

            <div className="max-w-7xl mx-auto w-full z-10 space-y-8 flex-1 flex flex-col">
              
              {/* Promo Header Section */}
              <div className="text-center space-y-3 max-w-2xl mx-auto mt-4">
                <h2 className="font-sans font-extrabold text-3xl md:text-4xl text-gray-900 tracking-tight leading-none bg-linear-to-r from-blue-700 via-indigo-650 to-rose-600 bg-clip-text text-transparent">
                  Harman PDF Multi-Toolbox
                </h2>
                <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-xl mx-auto">
                  Every single tool you need to edit, convert, compress, sign, and organize vector-accurate PDF documents easily. Try our AI summaries, translations, or loading local demo quotes instantly.
                </p>
              </div>

              {/* Utility Filter & Search Bar */}
              <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-150 flex flex-col md:flex-row gap-4 items-center justify-between">
                
                {/* Search Input Container */}
                <div className="relative w-full md:w-80">
                  <input
                    type="text"
                    placeholder="Search for tools... (e.g. Merge, Word)"
                    value={dashboardSearchQuery}
                    onChange={(e) => setDashboardSearchQuery(e.target.value)}
                    className="w-full text-xs font-sans text-gray-750 placeholder-gray-405 bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-3.5 pr-8 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                  {dashboardSearchQuery && (
                    <button 
                      onClick={() => setDashboardSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Tags Layout */}
                <div className="flex flex-wrap items-center gap-1.5 justify-center md:justify-end w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                  {[
                    { id: 'all', label: 'All Tools' },
                    { id: 'organize', label: 'Organize' },
                    { id: 'optimize', label: 'Optimize' },
                    { id: 'convert', label: 'Convert' },
                    { id: 'edit', label: 'Edit' },
                    { id: 'security', label: 'Security' },
                    { id: 'intelligence', label: 'AI Intelligence' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryFilter(cat.id)}
                      className={`px-3.5 py-1.5 rounded-lg text-[10.5px] font-bold tracking-tight transition cursor-pointer ${
                        activeCategoryFilter === cat.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200/70 hover:text-gray-900'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of Tools Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-12">
                {ALL_PDF_TOOLS.filter(tool => {
                  const matchQuery = tool.title.toLowerCase().includes(dashboardSearchQuery.toLowerCase()) || 
                                     tool.desc.toLowerCase().includes(dashboardSearchQuery.toLowerCase());
                  const matchCategory = activeCategoryFilter === 'all' || tool.category === activeCategoryFilter;
                  return matchQuery && matchCategory;
                }).map(tool => {
                  const IconComp = tool.icon;
                  return (
                    <div
                      key={tool.id}
                      onClick={() => {
                        if (pdfDoc) {
                          setToolsActiveTab(tool.panelTab);
                          if (tool.editorMode) {
                            setMode(tool.editorMode);
                          }
                          setActiveView('editor');
                        } else {
                          setSelectedToolForModal(tool);
                        }
                      }}
                      className="group bg-white rounded-2xl border border-gray-150 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-blue-400/50 hover:scale-[1.01] transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[170px]"
                    >
                      <div className="space-y-3">
                        <div className={`w-10 h-10 ${tool.bgColor} ${tool.color} rounded-xl flex items-center justify-center shadow-2xs`}>
                          <IconComp className="w-5 h-5 stroke-[1.75]" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-sans font-bold text-sm text-gray-800 tracking-tight group-hover:text-blue-600 transition">
                            {tool.title}
                          </h3>
                          <p className="text-[10.5px] text-gray-400 font-medium leading-normal line-clamp-3">
                            {tool.desc}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 mt-1.5 border-t border-gray-100">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tool.badgeColor}`}>
                          {tool.category}
                        </span>
                        <span className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all">
                          <ArrowRight className="w-3.5 h-3.5 stroke-[2]" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
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
              propActiveTab={toolsActiveTab}
              propSetActiveTab={setToolsActiveTab}
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

      {/* Interactive Tool Launcher Popover Modal */}
      {selectedToolForModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in-50 duration-200">
            
            {/* Modal Header bar */}
            <div className="bg-slate-50 border-b border-gray-150 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg ${selectedToolForModal.bgColor} ${selectedToolForModal.color} flex items-center justify-center`}>
                  {React.createElement(selectedToolForModal.icon, { className: 'w-4 h-4' })}
                </div>
                <h3 className="font-sans font-bold text-xs text-gray-800 tracking-tight">
                  Start {selectedToolForModal.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedToolForModal(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-[10.5px] text-gray-500 font-medium leading-relaxed">
                  {selectedToolForModal.desc}
                </p>
                <p className="text-[9.5px] text-gray-400 font-medium leading-relaxed italic">
                  To get started, browse/upload a local PDF file, or load our vector-perfect Harman demo quote immediately.
                </p>
              </div>

              {/* Upload Drop Area */}
              <div 
                className="border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/20 active:bg-blue-50/40 rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition cursor-pointer relative"
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    handleFileUpload(e);
                    // Match the tool panel tab to what was clicked from dashboard
                    setToolsActiveTab(selectedToolForModal.panelTab);
                    if (selectedToolForModal.editorMode) {
                      setMode(selectedToolForModal.editorMode);
                    }
                    setSelectedToolForModal(null);
                    setActiveView('editor');
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <FileUp className="w-7 h-7 text-gray-400" />
                <span className="text-[10.5px] font-bold text-gray-700">Browse Local PDF File</span>
                <span className="text-[9px] text-gray-450">PDF documents only</span>
              </div>

              {/* Loader/Demo Button */}
              <button
                onClick={() => {
                  handleLoadSample();
                  // Match the tool panel tab to what was clicked from dashboard
                  setToolsActiveTab(selectedToolForModal.panelTab);
                  if (selectedToolForModal.editorMode) {
                    setMode(selectedToolForModal.editorMode);
                  }
                  setSelectedToolForModal(null);
                  setActiveView('editor');
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-[10.5px] font-bold shadow-xs transition cursor-pointer"
              >
                <Sparkle className="w-3.5 h-3.5 text-blue-200" />
                Try with Demo Document
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
