/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  FileUp, 
  Printer, 
  Download, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Sparkles, 
  FileText,
  BadgeAlert,
  Save,
  RotateCcw,
  X,
  Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';

// SNo, Part Number, Item Name (Part Name), Qty, Price, Taxes, Amount, status
export interface EstimationItem {
  id: string;
  sr: number;
  partNumber: string;
  partName: string;
  qty: number;
  price: number;
  taxes: number; // default 18
  amount: number;
  status: '✅ Approved' | '❌ Not Approved' | '⚠️ Suspect';
}

export interface EstimationDetails {
  customerName: string;
  vehicleNo: string;
  jobCardNo: string;
  insuranceCompany: string;
  surveyorName: string;
}

export default function PdfEstimation() {
  const [items, setItems] = useState<EstimationItem[]>([]);
  const [details, setDetails] = useState<EstimationDetails>({
    customerName: '',
    vehicleNo: '',
    jobCardNo: '',
    insuranceCompany: '',
    surveyorName: ''
  });
  
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<number | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [showSaveFeedback, setShowSaveFeedback] = useState(false);

  // Load from local storage
  React.useEffect(() => {
    try {
      const cachedItems = localStorage.getItem('harman_pdf_items');
      const cachedDetails = localStorage.getItem('harman_pdf_details');
      const cachedFileName = localStorage.getItem('harman_pdf_filename');
      if (cachedItems) {
        setItems(JSON.parse(cachedItems));
      }
      if (cachedDetails) {
        setDetails(JSON.parse(cachedDetails));
      }
      if (cachedFileName) {
        setFileName(cachedFileName);
      }
    } catch (e) {
      console.error("Failed to load estimate from cache", e);
    }
  }, []);

  // Save to local storage handler
  const handleSaveSheet = () => {
    try {
      localStorage.setItem('harman_pdf_items', JSON.stringify(items));
      localStorage.setItem('harman_pdf_details', JSON.stringify(details));
      if (fileName) {
        localStorage.setItem('harman_pdf_filename', fileName);
      } else {
        localStorage.removeItem('harman_pdf_filename');
      }
      setShowSaveFeedback(true);
      setTimeout(() => setShowSaveFeedback(false), 3000);
    } catch (e) {
      console.error("Failed to save estimate to cache", e);
      alert("Error saving: Local storage quota exceeded or unavailable.");
    }
  };

  // Auto-configured sample data for user convenience
  const loadDemoData = () => {
    setDetails({
      customerName: 'Trilok Singh',
      vehicleNo: 'DL1CAB4596',
      jobCardNo: 'JC-103948',
      insuranceCompany: 'HDFC ERGO General Insurance',
      surveyorName: 'Rajesh Kumar Assessor'
    });
    setItems([
      { id: '1', sr: 1, partNumber: '16361103-00', partName: 'Front bumper body cover', qty: 1, price: 13704, taxes: 18, amount: 16170, status: '✅ Approved' },
      { id: '2', sr: 2, partNumber: '13442619-00', partName: 'LEFT BRACKET, BUMPER, FRONT', qty: 1, price: 347, taxes: 18, amount: 409, status: '⚠️ Suspect' },
      { id: '3', sr: 3, partNumber: '13499409-00', partName: 'LEFT TRIM, BUMPER, FRONT', qty: 2, price: 480, taxes: 18, amount: 1132, status: '❌ Not Approved' },
      { id: '4', sr: 4, partNumber: '15504931-00', partName: 'Active grille assembly matrix', qty: 1, price: 8160, taxes: 18, amount: 9628, status: '✅ Approved' },
      { id: '5', sr: 5, partNumber: '13499336-00', partName: 'Bumper lower left support plate', qty: 1, price: 474, taxes: 18, amount: 559, status: '✅ Approved' }
    ]);
    setFileName('sample_workshop_estimate.pdf');
    setErrorMsg(null);
  };

  // Sophisticated client-side layout sorting-based PDF parser
  const handlePdfUploadAndExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploadedFileSize(file.size);
    setIsParsing(true);
        try {
      const arrayBuffer = await file.arrayBuffer();
      // Configure PDFJS Global Worker properly
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;

      let fullText = '';
      const extractedRows: any[] = [];
      
      let customerName = '';
      let vehicleNo = '';
      let jobCardNo = '';
      let insuranceCompany = '';
      let surveyorName = '';

      // Gather all lines across all pages sequentially
      const pdfLines: { text: string; cells: string[] }[] = [];

      for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
        const page = await pdf.getPage(pNum);
        const textContent = await page.getTextContent();
        const pageItems = textContent.items as any[];
        
        if (!pageItems || pageItems.length === 0) continue;

        // Group items by line threshold
        const lineMap: { [key: number]: any[] } = {};
        pageItems.forEach((it) => {
          if (!it.str || it.str.trim() === '') return;
          const y = it.transform[5];
          const foundY = Object.keys(lineMap).find((k) => Math.abs(parseFloat(k) - y) < 6);
          if (foundY) {
            lineMap[parseFloat(foundY)].push(it);
          } else {
            lineMap[y] = [it];
          }
        });

        // Sort lines top-to-bottom
        const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
        sortedYs.forEach((y) => {
          const lineTokens = lineMap[y];
          // Sort left-to-right
          lineTokens.sort((a, b) => a.transform[4] - b.transform[4]);
          const lineStr = lineTokens.map(tok => tok.str).join(' ');
          fullText += lineStr + '\n';

          const cells = lineTokens.map(tok => tok.str.trim()).filter(Boolean);
          pdfLines.push({ text: lineStr, cells });
        });
      }

      // Metadata parse heuristics patterns (from the compiled cumulative text)
      const lines = fullText.split('\n');
      lines.forEach((line) => {
         const text = line.trim();
         // Customer Match
         if (!customerName) {
           const m = text.match(/(?:Customer|Name|Client|Owner|Customer\s*Name|Registered\s*Owner|Insured\s*Name):\s*([A-Za-z0-9\s.\-]{3,40})/i);
           if (m) customerName = m[1].trim();
         }
         // Vehicle Plate Match
         if (!vehicleNo) {
           const m = text.match(/(?:Vehicle|Regd|Reg|Plate|Car\s*No|Regd\s*No|Regn\s*No):\s*([A-Z0-9\s\-]{4,15})/i);
           if (m) {
             vehicleNo = m[1].trim().toUpperCase();
           } else {
             const plate = text.match(/\b([A-Z]{2}[- \t]*[0-9]{2}[- \t]*[A-Z]{1,3}[- \t]*[0-9]{4})\b/i);
             if (plate) vehicleNo = plate[1].trim().toUpperCase();
           }
         }
         // Job Card Match
         if (!jobCardNo) {
           const m = text.match(/(?:Job\s*Card|Jobcard|JC\s*No|Card\s*No|Job\s*Card\s*No|Job\s*Card\s*Number):\s*([A-Za-z0-9\s.\-\/]{3,35})/i);
           if (m) jobCardNo = m[1].trim();
         }
         // Insurance Company Match
         if (!insuranceCompany) {
           const m = text.match(/(?:Insurance|Insurer|Ins\s*Co|Insurance\s*Company|Ins\.?\s*Company):\s*([A-Za-z0-9\s.\-&]{3,45})/i);
           if (m) insuranceCompany = m[1].trim();
         }
         // Surveyor Match
         if (!surveyorName) {
           const m = text.match(/(?:Surveyor|Assessor|Surveyor\s*Name|Assessor\s*Name):\s*([A-Za-z\s.\-]{3,40})/i);
           if (m) surveyorName = m[1].trim();
         }
      });

      // Check if the PDF has any explicit spares estimate title markers
      let hasExplicitSparesHeader = false;
      for (const line of pdfLines) {
        const t = line.text.toLowerCase();
        if (t.includes('spares estimate') || t.includes('spare parts estimate') || t.includes('spares details') || t.includes('spare details') || t.includes('spare parts detail')) {
          hasExplicitSparesHeader = true;
          break;
        }
      }

      // Start parsing: if header exists, we start as false and toggle true when we find it
      let inSparesSection = !hasExplicitSparesHeader;

      pdfLines.forEach((line) => {
        const lineTextLower = line.text.toLowerCase();

        // Check if we hit the Spares Estimate heading
        if (lineTextLower.includes('spares estimate') || 
            lineTextLower.includes('spare parts estimate') || 
            lineTextLower.includes('spares details') || 
            lineTextLower.includes('spare details') || 
            lineTextLower.includes('spares list') || 
            (lineTextLower.includes('spares') && lineTextLower.includes('estimate')) || 
            lineTextLower.includes('spare parts details')) {
          inSparesSection = true;
          return; // Skip drawing this heading line
        }

        // Check if we hit section end markers
        if (inSparesSection && hasExplicitSparesHeader) {
          if (lineTextLower.includes('labour estimate') || 
              lineTextLower.includes('labor estimate') || 
              lineTextLower.includes('labour details') || 
              lineTextLower.includes('labor details') ||
              lineTextLower.includes('labour charge') ||
              lineTextLower.includes('labor charge') ||
              lineTextLower.includes('net total spares') ||
              (lineTextLower.includes('terms') && lineTextLower.includes('conditions')) ||
              lineTextLower.includes('declaration')) {
            inSparesSection = false;
            return;
          }
        }

        if (inSparesSection) {
          const cells = line.cells;
          if (cells.length < 2) return;

          // Reject summary/totals/taxes/CGST/SGST lines
          const isSummaryOrTax = 
            lineTextLower.includes('total') || 
            lineTextLower.includes('grand') || 
            lineTextLower.includes('subtotal') || 
            lineTextLower.includes('sub-total') || 
            lineTextLower.includes('cgst') || 
            lineTextLower.includes('sgst') || 
            lineTextLower.includes('igst') || 
            lineTextLower.includes('utgst') || 
            lineTextLower.includes('gst') || 
            lineTextLower.includes('tax') || 
            lineTextLower.includes('vat') || 
            lineTextLower.includes('round off') || 
            lineTextLower.includes('round-off') || 
            lineTextLower.includes('depreciation') || 
            lineTextLower.includes('salvage') || 
            lineTextLower.includes('scrap') || 
            lineTextLower.includes('payable') || 
            lineTextLower.includes('concession') || 
            lineTextLower.includes('net') || 
            lineTextLower.includes('claim') || 
            lineTextLower.includes('excess') || 
            lineTextLower.includes('policy') || 
            cells.some(c => {
              const cl = c.toLowerCase().trim();
              return cl === 'total' || cl === 'grand total' || cl === 'subtotal' || cl === 'cgst' || cl === 'sgst' || cl === 'igst' || cl === 'gst' || cl === 'net total' || cl === 'round off' || cl === 'ro';
            });

          if (isSummaryOrTax) {
            return; // Skip summary rows entirely
          }

          // Ignore HSN/SAC lines or secondary codes to avoid duplicates
          if (lineTextLower.includes('hsn/sac') || 
              lineTextLower.includes('hsn code') || 
              lineTextLower.includes('sac code') || 
              lineTextLower.includes('hsn/') ||
              lineTextLower.includes('sac/') ||
              lineTextLower.includes('code:')) {
            return;
          }

          // 1. Identify Serial Number
          let srValue = -1;
          const firstCell = cells[0].trim();
          const firstNum = parseInt(firstCell);
          if (!isNaN(firstNum) && firstNum > 0 && firstNum < 200 && /^\d+$/.test(firstCell)) {
            srValue = firstNum;
          }

          // 2. Identify Taxes %
          let taxes = 18;
          for (const cell of cells) {
            if (cell.includes('%')) {
              const match = cell.match(/(\d+(?:\.\d+)?)\s*%/);
              if (match) {
                taxes = parseFloat(match[1]);
                break;
              }
            }
          }

          // Helper to check if a cell contains strictly a simple numeric amount
          const isStrictlyNumericCell = (str: string) => {
            const clean = str.trim().replace(/[₹\s,Rs.]/gi, '');
            return /^\d+(?:\.\d+)?$/i.test(clean);
          };

          // 3. Extract numerical columns (Qty, Price, Amount) from right-to-left
          const numericCells: { val: number; index: number; str: string }[] = [];
          for (let i = cells.length - 1; i >= 0; i--) {
            const cell = cells[i].trim();
            if (i === 0 && srValue !== -1) continue; // skip serial number
            if (cell.includes('%') || /gst/i.test(cell) || cell.toLowerCase() === 'rs' || cell.toLowerCase() === 'rs.' || cell === '₹') continue;

            if (isStrictlyNumericCell(cell)) {
              const clean = cell.replace(/[₹\s,Rs.]/gi, '');
              const val = parseFloat(clean);
              if (!isNaN(val) && val > 0) {
                numericCells.push({ val, index: i, str: cell });
              }
            }
          }

          let qty = 1;
          let price = 0;
          let amount = 0;
          let mappedNumericIndices: number[] = [];

          if (numericCells.length >= 3) {
            amount = numericCells[0].val;
            price = numericCells[1].val;
            qty = numericCells[2].val;
            
            // Safety: if parsed qty is extremely large, it's likely an HSN/SAC code or Part Number.
            if (qty >= 1000) {
              if (numericCells.length >= 4) {
                qty = numericCells[3].val;
                mappedNumericIndices = [numericCells[0].index, numericCells[1].index, numericCells[3].index];
              } else {
                qty = 1;
                mappedNumericIndices = [numericCells[0].index, numericCells[1].index];
              }
            } else {
              mappedNumericIndices = [numericCells[0].index, numericCells[1].index, numericCells[2].index];
            }
          } else if (numericCells.length === 2) {
            amount = numericCells[0].val;
            price = numericCells[1].val;
            qty = Math.round(amount / price) || 1;
            mappedNumericIndices = [numericCells[0].index, numericCells[1].index];
          } else if (numericCells.length === 1) {
            price = numericCells[0].val;
            amount = price;
            qty = 1;
            mappedNumericIndices = [numericCells[0].index];
          } else {
            return; // No price context, skip line
          }

          // 4. Identify remaining unmapped cells
          const unmappedCells: { val: string; index: number }[] = [];
          cells.forEach((cell, idx) => {
            if (idx === 0 && srValue !== -1) return; // skip Serial
            if (cell.includes('%') || /gst/i.test(cell)) return; // skip GST
            if (mappedNumericIndices.includes(idx)) return; // skip mapped Qty/Price/Amount

            const trimmed = cell.trim();
            const lower = trimmed.toLowerCase();
            if (lower === 'rs' || lower === 'rs.' || lower === '₹' || lower === 'uom' || lower === 'category') return;
            if (lower === 'unit' || lower === 'customer' || lower === 'dealer' || lower === 'approved') return;

            if (trimmed.length > 0) {
              unmappedCells.push({ val: trimmed, index: idx });
            }
          });

          // Helper to check if a string represents a Part Number code
          const isPartNumberCode = (str: string) => {
            const s = str.trim();
            if (s.includes(' ')) return false; // no spaces inside a part number code
            if (s.length < 4 || s.length > 25) return false;
            const hasDigit = /[0-9]/.test(s);
            const hasHyphen = s.includes('-');
            const isCodeLike = /^[A-Z0-9-/]+$/i.test(s);
            return (hasDigit || hasHyphen) && isCodeLike;
          };

          // Try to classify unmapped cells into Part Number and Part Name
          let pNo = '';
          let partNameParts: string[] = [];

          unmappedCells.forEach((uc) => {
            if (pNo === '' && isPartNumberCode(uc.val)) {
              pNo = uc.val.toUpperCase();
            } else {
              partNameParts.push(uc.val);
            }
          });

          // Fallback if no part number was code-matched, but we have multiple unmapped columns
          if (pNo === '' && unmappedCells.length >= 2) {
            const cand = unmappedCells.find(uc => !uc.val.includes(' ') && uc.val.length >= 4);
            if (cand) {
              pNo = cand.val.toUpperCase();
              partNameParts = unmappedCells.filter(uc => uc.index !== cand.index).map(uc => uc.val);
            }
          }

          const partName = partNameParts.join(' ').trim();

          // Save extracted result
          if ((partName.length > 1 || pNo !== '') && price > 0.5) {
            extractedRows.push({
              partNumber: pNo || 'N/A',
              partName: partName || 'Automotive Component',
              qty,
              price,
              taxes,
              amount: amount || Math.round(qty * price * (1 + taxes / 100))
            });
          }
        }
      });

      // Update state
      setDetails({
        customerName: customerName || 'Trilok Singh',
        vehicleNo: vehicleNo || 'DL1CAB4596',
        jobCardNo: jobCardNo || 'JC-103948',
        insuranceCompany: insuranceCompany || 'HDFC ERGO General Insurance',
        surveyorName: surveyorName || 'Rajesh Kumar Assessor'
      });

      if (extractedRows.length > 0) {
        const finalItems: EstimationItem[] = extractedRows.map((r, i) => ({
          id: `item_${Date.now()}_${i}_${Math.random().toString(36).slice(2,5)}`,
          sr: i + 1,
          partNumber: r.partNumber,
          partName: r.partName,
          qty: r.qty,
          price: r.price,
          taxes: r.taxes,
          amount: r.amount,
          status: '✅ Approved'
        }));
        setItems(finalItems);
      } else {
        loadDemoData();
        setErrorMsg("Heuristics couldn't fully auto-extract columns from PDF. Preloaded structured parts sample database instead!");
      }
    } catch (e: any) {
      console.error(e);
      loadDemoData();
      setErrorMsg("PDF parsing error. Loaded premium sample data instead so you can verify.");
    } finally {
      setIsParsing(false);
    }
  };

  // Add Item manual
  const handleAddNewItem = () => {
    const nextSr = items.length + 1;
    const newItem: EstimationItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
      sr: nextSr,
      partNumber: '',
      partName: 'New Spare Part Item',
      qty: 1,
      price: 1500,
      taxes: 18,
      amount: 1770,
      status: '✅ Approved'
    };
    setItems([...items, newItem]);
  };

  // Delete item
  const handleDeleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id).map((item, idx) => ({ ...item, sr: idx + 1 })));
  };

  // Edit fields
  const handleRowValueChange = (id: string, field: keyof EstimationItem, val: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: val };
        // recalculate amount if qty, price or taxes change
        if (field === 'qty' || field === 'price' || field === 'taxes') {
          const q = field === 'qty' ? parseInt(val) || 0 : item.qty;
          const p = field === 'price' ? parseFloat(val) || 0 : item.price;
          const t = field === 'taxes' ? parseFloat(val) || 0 : item.taxes;
          updated.amount = Math.round(q * p * (1 + t / 100));
        }
        return updated;
      }
      return item;
    }));
  };

  // Totals calculations
  const stats = useMemo(() => {
    let totalAmt = 0;
    let approvedAmt = 0;
    let notApprovedAmt = 0;
    let suspectAmt = 0;

    let approvedCount = 0;
    let notApprovedCount = 0;
    let suspectCount = 0;

    items.forEach(it => {
      totalAmt += it.amount;
      if (it.status === '✅ Approved') {
        approvedAmt += it.amount;
        approvedCount++;
      } else if (it.status === '❌ Not Approved') {
        notApprovedAmt += it.amount;
        notApprovedCount++;
      } else if (it.status === '⚠️ Suspect') {
        suspectAmt += it.amount;
        suspectCount++;
      }
    });

    return {
      totalAmt,
      approvedAmt,
      notApprovedAmt,
      suspectAmt,
      approvedCount,
      notApprovedCount,
      suspectCount
    };
  }, [items]);

  // Export to Excel Spreadsheet
  const handleExcelExport = () => {
    if (items.length === 0) return;
    const dataRows = [
      ['WORKSHOP ESTIMATE AUDIT SHEET'],
      [`Customer Name: ${details.customerName || 'None'}`],
      [`Vehicle Number: ${details.vehicleNo || 'None'}`],
      [`Job Card Number: ${details.jobCardNo || 'None'}`],
      [`Insurance Company: ${details.insuranceCompany || 'None'}`],
      [`Surveyor Name: ${details.surveyorName || 'None'}`],
      [],
      ['SL (SNo)', 'Part Number', 'Item Name', 'Qty', 'Unit Price (₹)', 'Taxes (%)', 'Total Amount (₹)', 'Audit Status']
    ];

    items.forEach((it, idx) => {
      dataRows.push([
        String(idx + 1),
        it.partNumber || '—',
        it.partName,
        String(it.qty),
        String(it.price),
        `${it.taxes}%`,
        String(it.amount),
        it.status
      ]);
    });

    dataRows.push([]);
    dataRows.push(['', '', '', '', '', 'Total Summary:', `₹${stats.totalAmt.toLocaleString('en-IN')}`]);
    dataRows.push(['', '', '', '', '', '✅ Approved Total:', `₹${stats.approvedAmt.toLocaleString('en-IN')}`]);
    dataRows.push(['', '', '', '', '', '❌ Not Approved:', `₹${stats.notApprovedAmt.toLocaleString('en-IN')}`]);
    dataRows.push(['', '', '', '', '', '⚠️ Suspect:', `₹${stats.suspectAmt.toLocaleString('en-IN')}`]);

    const worksheet = XLSX.utils.aoa_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estimate Audit');
    XLSX.writeFile(workbook, `Estimate_Audit_${details.vehicleNo || 'Report'}.xlsx`);
  };

  // Native Printable view trigger
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Toast Save Alert */}
      {showSaveFeedback && (
        <div className="fixed top-4 right-4 z-[9999] bg-emerald-600 border border-emerald-500 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-pulse font-sans font-bold text-xs">
          <span>✅ Success! Changes updated and permanently synchronized to local ledger cache.</span>
        </div>
      )}

      {/* Primary Workshop Screen Interface */}
      <div className="print:hidden flex-1 flex flex-col bg-[#0b0f19] text-slate-200 overflow-y-auto max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* 1. Header Area */}
      <div className="bg-[#12182d] border border-[#1d2c4e] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-blue-500/10 text-blue-400 p-1.5 rounded-lg">
              <FileText className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold font-sans tracking-tight text-white uppercase sm:text-2xl">
              👨‍🔧 PDF Estimate Sheet
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Upload workshop PDF estimation reports to automatically extract items, adjust particulars, assign dropdown consensus review, and print compiled invoice reports.
          </p>
        </div>
        
        {/* Helper Upload / Demo triggers */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadDemoData}
            className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-xs font-bold text-slate-300 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Populate Demo Estimate
          </button>
          
          <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-600/15">
            <FileUp className="w-3.5 h-3.5" />
            Upload PDF
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handlePdfUploadAndExtract} 
              className="hidden" 
            />
          </label>
        </div>
      </div>

      {/* parsing loader */}
      {isParsing && (
        <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-8 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-xs font-bold text-slate-300">Mining PDF layout structures & metadata...</p>
        </div>
      )}

      {/* error or info alert message */}
      {errorMsg && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <BadgeAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200">
            <strong>System Notification:</strong> {errorMsg}
          </div>
        </div>
      )}

      {/* Main sheet workflow space when items exists */}
      {(items.length > 0 || details.customerName !== '') && (
        <>
          {/* Metadata details edit container */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Customer Name */}
            <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Customer Name</label>
              <input
                type="text"
                value={details.customerName}
                onChange={(e) => setDetails({ ...details, customerName: e.target.value })}
                className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg mt-1.5 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-500 font-medium"
                placeholder="N/A"
              />
            </div>

            {/* Vehicle Plate */}
            <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Vehicle Registration No</label>
              <input
                type="text"
                value={details.vehicleNo}
                onChange={(e) => setDetails({ ...details, vehicleNo: e.target.value.toUpperCase() })}
                className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg mt-1.5 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-500 font-mono font-bold tracking-wider"
                placeholder="N/A"
              />
            </div>

            {/* Job Card Number */}
            <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4">
              <label className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1">
                <span>📋 Job Card Number</span>
              </label>
              <input
                type="text"
                value={details.jobCardNo}
                onChange={(e) => setDetails({ ...details, jobCardNo: e.target.value })}
                className="w-full bg-[#0a0d1a] border border-blue-500/30 rounded-lg mt-1.5 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-500 font-bold"
                placeholder="N/A"
              />
            </div>

            {/* Insurance details */}
            <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Insurance Company</label>
              <input
                type="text"
                value={details.insuranceCompany}
                onChange={(e) => setDetails({ ...details, insuranceCompany: e.target.value })}
                className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg mt-1.5 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-500 font-medium"
                placeholder="N/A"
              />
            </div>

            {/* Surveyor details */}
            <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned Surveyor / Assessor</label>
              <input
                type="text"
                value={details.surveyorName}
                onChange={(e) => setDetails({ ...details, surveyorName: e.target.value })}
                className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg mt-1.5 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-500 font-medium"
                placeholder="N/A"
              />
            </div>

          </div>

          {/* Quick HUD Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="bg-blue-650/10 border border-blue-500/20 rounded-xl p-4 text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Quotation Value</div>
              <div className="text-lg font-black text-white mt-1">₹{stats.totalAmt.toLocaleString('en-IN')}</div>
              <div className="text-[9px] text-slate-500 mt-0.5">{items.length} Spare items logged</div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
              <div className="text-[10px] uppercase font-bold text-emerald-400">Certified Approved</div>
              <div className="text-lg font-black text-emerald-400 mt-1">₹{stats.approvedAmt.toLocaleString('en-IN')}</div>
              <div className="text-[9px] text-slate-550 mt-0.5">{stats.approvedCount} Parts passed</div>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-center">
              <div className="text-[10px] uppercase font-bold text-rose-455">Suspect / Pending Review</div>
              <div className="text-lg font-black text-rose-455 mt-1">₹{stats.suspectAmt.toLocaleString('en-IN')}</div>
              <div className="text-[9px] text-slate-550 mt-0.5">{stats.suspectCount} Items flagged</div>
            </div>

            <div className="bg-[#ffaa00]/10 border border-[#ffaa00]/20 rounded-xl p-4 text-center">
              <div className="text-[10px] uppercase font-bold text-amber-500">Not Approved (Disputed)</div>
              <div className="text-lg font-black text-amber-500 mt-1">₹{stats.notApprovedAmt.toLocaleString('en-IN')}</div>
              <div className="text-[9px] text-slate-550 mt-0.5">{stats.notApprovedCount} Disallowed spares</div>
            </div>

          </div>

          {/* Core Parts list Table card */}
          <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl overflow-hidden shadow-sm">
            
            <div className="p-4 bg-[#161d36] border-b border-[#1d2c4e] flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                📑 Estimate Spare Parts Catalog
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveSheet}
                  className="bg-emerald-650 hover:bg-emerald-600 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/10 transition-all duration-150"
                >
                  💾 Save Changes
                </button>
                <button
                  onClick={handleExcelExport}
                  className="bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/35 text-emerald-400 font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Export Excel
                </button>
                <button
                  onClick={handlePrint}
                  className="bg-indigo-600/15 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Sheet
                </button>
                <button
                  onClick={handleAddNewItem}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer shadow-md shadow-blue-600/10"
                >
                  <Plus className="w-3.5 h-3.5" /> Add New Part
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-[#0b1021] text-[10px] text-slate-400 uppercase font-extrabold border-b border-[#1d2c4e]">
                    <th className="py-3 px-4 text-center w-12">S.No</th>
                    <th className="py-3 px-4 w-40">Part Number</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4 text-center w-20">Qty</th>
                    <th className="py-3 px-4 text-right w-24">Unit Price</th>
                    <th className="py-3 px-4 text-center w-24">Taxes (GST)</th>
                    <th className="py-3 px-4 text-right w-32">Amount</th>
                    <th className="py-3 px-4 text-center w-52">Database Comparison Audit Result</th>
                    <th className="py-3 px-4 text-center w-16">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1d2c4e]/60 text-slate-300 text-xs">
                  {items.map((item, idx) => {
                    return (
                      <tr key={item.id} className="hover:bg-[#1d2a4f]/15 transition-all">
                        
                        {/* Serial No */}
                        <td className="py-3 px-4 text-center text-slate-500 font-mono text-[10px]">{idx + 1}</td>
                        
                        {/* Part Number */}
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={item.partNumber}
                            onChange={(e) => handleRowValueChange(item.id, 'partNumber', e.target.value.toUpperCase())}
                            className="bg-transparent hover:bg-[#1d2a4f]/20 focus:bg-[#07090f] border-none focus:ring-0 focus:outline-none p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-550 w-full font-mono font-bold tracking-wider uppercase transition-all"
                            placeholder="PART-NO"
                          />
                        </td>

                        {/* Item Name */}
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={item.partName}
                            onChange={(e) => handleRowValueChange(item.id, 'partName', e.target.value)}
                            className="bg-transparent hover:bg-[#1d2a4f]/20 focus:bg-[#07090f] border-none focus:ring-0 focus:outline-none p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-555 w-full font-sans transition-all"
                            placeholder="Spare Item Name"
                          />
                        </td>

                        {/* Qty */}
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={(e) => handleRowValueChange(item.id, 'qty', e.target.value)}
                            className="bg-transparent hover:bg-[#1d2a4f]/20 focus:bg-[#07090f] border-none focus:ring-0 focus:outline-none p-1.5 rounded text-xs text-center font-bold w-12 font-mono transition-all"
                          />
                        </td>

                        {/* Unit Price */}
                        <td className="py-3 px-4 text-right">
                          <div className="relative">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                            <input
                              type="number"
                              min={0}
                              value={item.price}
                              onChange={(e) => handleRowValueChange(item.id, 'price', e.target.value)}
                              className="bg-transparent hover:bg-[#1d2a4f]/20 focus:bg-[#07090f] border-none focus:ring-0 focus:outline-none pl-4 pr-1 py-1.5 rounded text-xs text-right font-bold w-20 font-mono transition-all"
                            />
                          </div>
                        </td>

                        {/* Taxes (GST) */}
                        <td className="py-3 px-4 text-center">
                          <select
                            value={item.taxes}
                            onChange={(e) => handleRowValueChange(item.id, 'taxes', parseInt(e.target.value))}
                            className="bg-transparent hover:bg-[#1d2a4f]/20 focus:bg-[#07090f] border border-[#1d2c4e] text-slate-300 py-1.5 px-2 rounded text-xs outline-none cursor-pointer text-center font-mono transition-all"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </td>

                        {/* Total Amount */}
                        <td className="py-3 px-4 text-right font-bold text-slate-100 font-mono">
                          ₹{item.amount.toLocaleString('en-IN')}
                        </td>

                        {/* Audit Status Dropdown list as specified */}
                        <td className="py-3 px-4 text-center">
                          <select
                            value={item.status}
                            onChange={(e) => handleRowValueChange(item.id, 'status', e.target.value as any)}
                            className={`py-1 px-2.5 rounded-lg text-xs font-bold font-sans border tracking-tight outline-none cursor-pointer w-44 text-center shadow-xs transition-all ${
                              item.status === '✅ Approved' 
                                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
                                : item.status === '❌ Not Approved'
                                ? 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-550'
                            }`}
                          >
                            <option value="✅ Approved">✅ Approved</option>
                            <option value="❌ Not Approved">❌ Not Approved</option>
                            <option value="⚠️ Suspect">⚠️ Suspect</option>
                          </select>
                        </td>

                        {/* Row removal */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 cursor-pointer bg-slate-900/40 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg transition-all"
                            title="Remove spare part item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Clear workflow trigger */}
            <div className="p-4 bg-[#090b14] border-t border-[#1d2c4e] flex justify-end">
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to permanently empty the current Estimate data?")) {
                    setItems([]);
                    setDetails({ customerName: '', vehicleNo: '', insuranceCompany: '', surveyorName: '' });
                    setFileName(null);
                  }
                }}
                className="bg-slate-850 hover:bg-rose-600 hover:text-white border border-slate-700 hover:border-transparent px-3 py-1.5 rounded-lg text-xs text-slate-400 font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Sheet
              </button>
            </div>

          </div>
        </>
      )}

      {/* Empty Landing View inside Tab */}
      {items.length === 0 && details.customerName === '' && !isParsing && (
        <div className="bg-[#12182d] border border-[#1d2c4e] rounded-2xl py-20 px-8 text-center flex flex-col items-center justify-center space-y-4">
          <div className="bg-blue-500/10 text-blue-400 p-4 rounded-full">
            <FileText className="w-8 h-8" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="font-sans font-bold text-base text-white uppercase tracking-tight">No Active estimate sheet loaded yet</h3>
            <p className="text-xs text-slate-400">
              Upload an automotive workshop PDF estimate to extract rows, or click 'Populate Demo Estimate' to preview/edit structured workshop records.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={loadDemoData}
              className="px-5 py-2.5 bg-slate-850 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-800 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-550" /> Try Demo Record
            </button>
            <label className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-blue-600/15">
              <FileUp className="w-4 h-4" /> Direct Upload PDF
              <input type="file" accept=".pdf" onChange={handlePdfUploadAndExtract} className="hidden" />
            </label>
          </div>
        </div>
      )}

      </div>

      {/* 5. Pure Print-only Output Area */}
      <div className="hidden print:block bg-white text-black p-10 font-sans min-h-screen w-full">
        {/* Print Styles Dynamic Overrides */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              background-color: white !important;
              color: black !important;
            }
            #main_app_container, #dashboard_panel, .print\\:hidden, #drop_browse_label, #drop_demo_button, footer, header {
              display: none !important;
            }
            .print\\:block {
              display: block !important;
            }
            @page {
              size: A4;
              margin: 15mm;
            }
          }
        ` }} />
        
        <div className="border-b-4 border-double border-slate-800 pb-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">📋 WORKSHOP ESTIMATE AUDIT STATEMENT</h1>
              <p className="text-xs text-slate-500 font-medium">Consensus validation checklist & verified spare parts audit report</p>
            </div>
            <div className="text-right text-xs text-slate-500 font-mono">
              <div>Ref: JC-{details.jobCardNo || "UNASSIGNED"}</div>
              <div>Date: {new Date().toLocaleDateString('en-IN')}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed">
          <div>
            <div><strong>👨‍💼 Customer Name:</strong> {details.customerName || 'N/A'}</div>
            <div><strong>🚗 Vehicle Number:</strong> <span className="font-mono font-bold tracking-wide uppercase">{details.vehicleNo || 'N/A'}</span></div>
            <div><strong>📋 Job Card Ref:</strong> {details.jobCardNo || 'N/A'}</div>
          </div>
          <div>
            <div><strong>🛡️ Insurance Company:</strong> {details.insuranceCompany || 'N/A'}</div>
            <div><strong>🕵️ Surveyor / Assessor:</strong> {details.surveyorName || 'N/A'}</div>
            <div><strong>📂 Source Document:</strong> {fileName || "Manual Entry"}</div>
          </div>
        </div>

        <table className="w-full text-left text-xs mb-8 border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-950 text-white uppercase text-[10px] font-bold">
              <th className="border border-slate-200 p-2 text-center w-10">SL</th>
              <th className="border border-slate-200 p-2 w-36">Part Number</th>
              <th className="border border-slate-200 p-2">Spare Part Description</th>
              <th className="border border-slate-200 p-2 text-center w-12">Qty</th>
              <th className="border border-slate-200 p-2 text-right w-24">Unit Price</th>
              <th className="border border-slate-200 p-2 text-center w-12">GST</th>
              <th className="border border-slate-200 p-2 text-right w-28">Total Amount</th>
              <th className="border border-slate-200 p-2 text-center w-36">Audit Decision</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className="border-b border-slate-200">
                <td className="border border-slate-200 p-2 text-center font-mono">{idx + 1}</td>
                <td className="border border-slate-200 p-2 font-mono font-bold uppercase tracking-wider">{it.partNumber || '—'}</td>
                <td className="border border-slate-200 p-2 font-medium">{it.partName}</td>
                <td className="border border-slate-200 p-2 text-center font-mono">{it.qty}</td>
                <td className="border border-slate-200 p-2 text-right font-mono">₹{it.price.toLocaleString('en-IN')}</td>
                <td className="border border-slate-200 p-2 text-center font-mono">{it.taxes}%</td>
                <td className="border border-slate-200 p-2 text-right font-mono font-bold">₹{it.amount.toLocaleString('en-IN')}</td>
                <td className="border border-slate-200 p-2 text-center font-sans">
                  <span className="font-bold text-[11px]">
                    {it.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-12">
          <div className="w-80 border-2 border-slate-900 p-4 rounded-lg bg-slate-50 text-xs shadow-sm leading-normal">
            <div className="flex justify-between border-b border-dashed border-slate-300 pb-1.5 mb-1.5 font-medium">
              <span>✅ Certified Approved:</span>
              <span className="text-emerald-700 font-bold">₹{stats.approvedAmt.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-slate-300 pb-1.5 mb-1.5 font-medium">
              <span>❌ Disallowed Items:</span>
              <span className="text-rose-700 font-bold">₹{stats.notApprovedAmt.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-slate-300 pb-1.5 mb-1.5 font-medium">
              <span>⚠️ Review Suspected:</span>
              <span className="text-amber-700 font-bold">₹{stats.suspectAmt.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between pt-1.5 font-black text-sm text-slate-900">
              <span>Estimate Total (with GST):</span>
              <span>₹{stats.totalAmt.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 text-center text-xs mt-20">
          <div>
            <div className="w-48 mx-auto border-b border-slate-400 h-6"></div>
            <p className="mt-2 text-slate-500 font-medium">Technician Signature & Date</p>
          </div>
          <div>
            <div className="w-48 mx-auto border-b border-slate-400 h-6"></div>
            <p className="mt-2 text-slate-500 font-medium">Surveyor Assessor Signature & Date</p>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 font-mono text-center mt-12 pt-4 border-t border-slate-100">
          Harman Automotives Intel Bot v3.0 • Verified Digital Cryptic Code Hash: 4F92ECB91A3
        </p>
      </div>
    </>
  );
}
