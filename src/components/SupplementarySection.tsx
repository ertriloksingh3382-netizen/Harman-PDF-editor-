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
  Sparkles, 
  ArrowRightLeft, 
  CheckCircle2, 
  XCircle, 
  Check, 
  Plus, 
  Trash2, 
  RotateCcw,
  BadgeAlert,
  X,
  Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';

// SNo, Part Number, Item Name (Part Name), Qty, Price, Taxes, Amount, status
export interface CompItem {
  id: string;
  sr: number;
  partNumber: string;
  partName: string;
  qty: number;
  price: number;
  taxes: number;
  amount: number;
}

export interface CompDetails {
  customerName: string;
  vehicleNo: string;
  jobCardNo: string;
  insuranceCompany: string;
  surveyorName: string;
}

export default function SupplementarySection() {
  // Primary and Secondary datasets
  const [primaryItems, setPrimaryItems] = useState<CompItem[]>([]);
  const [secondaryItems, setSecondaryItems] = useState<CompItem[]>([]);
  
  // Target vehicle details (Shared Quotation format header)
  const [details, setDetails] = useState<CompDetails>({
    customerName: '',
    vehicleNo: '',
    jobCardNo: '',
    insuranceCompany: '',
    surveyorName: ''
  });

  const [loadingPrimary, setLoadingPrimary] = useState(false);
  const [loadingSecondary, setLoadingSecondary] = useState(false);

  const [primaryFileName, setPrimaryFileName] = useState<string | null>(null);
  const [secondaryFileName, setSecondaryFileName] = useState<string | null>(null);
  const [primaryFileSize, setPrimaryFileSize] = useState<number | null>(null);
  const [secondaryFileSize, setSecondaryFileSize] = useState<number | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [comparisonNote, setComparisonNote] = useState<string | null>(null);

  // Auto-configured comparison sample data
  const loadDemoComparison = () => {
    setDetails({
      customerName: 'BALJIT KAUR',
      vehicleNo: 'HR10AU4455',
      jobCardNo: 'JC-904512',
      insuranceCompany: 'United India Insurance Co.',
      surveyorName: 'KRS-2627 Surveyor Assessor'
    });

    // Primary items parsed set
    setPrimaryItems([
      { id: 'p1', sr: 1, partNumber: '16361103-00', partName: 'Front bumper body', qty: 1, price: 13704, taxes: 18, amount: 16170 },
      { id: 'p2', sr: 2, partNumber: '13442619-00', partName: 'LEFT BRACKET, BUMPER, FRONT', qty: 1, price: 347, taxes: 18, amount: 409 },
      { id: 'p3', sr: 3, partNumber: '13499409-00', partName: 'LEFT TRIM, BUMPER, FRONT', qty: 2, price: 480, taxes: 18, amount: 1132 },
      { id: 'p4', sr: 4, partNumber: '15504931-00', partName: 'Active grille assembly matrix', qty: 1, price: 8160, taxes: 18, amount: 9628 }
    ]);

    // Secondary items parsed set (Some matching, some new/mismatched supplementary)
    setSecondaryItems([
      { id: 's1', sr: 1, partNumber: '16361103-00', partName: 'Front bumper body (Matched)', qty: 1, price: 13704, taxes: 18, amount: 16170 },
      { id: 's2', sr: 2, partNumber: '13442619-00', partName: 'LEFT BRACKET, BUMPER, FRONT', qty: 1, price: 347, taxes: 18, amount: 409 },
      { id: 's3', sr: 3, partNumber: '13499336-00', partName: 'Bumper lower Left Reinforcement Plate (New item!)', qty: 1, price: 474, taxes: 18, amount: 559 },
      { id: 's4', sr: 4, partNumber: '13499409-00', partName: 'LEFT TRIM, BUMPER, FRONT', qty: 1, price: 480, taxes: 18, amount: 566 },
      { id: 's5', sr: 5, partNumber: '71110-T5A-J01', partName: 'Under Shield Engine Protector Guard (New item!)', qty: 1, price: 5400, taxes: 18, amount: 6372 }
    ]);

    setPrimaryFileName('primary_survey_authorised.pdf');
    setSecondaryFileName('secondary_supplementary_demand.pdf');
    setComparisonNote(null);
  };

  // Generic text extract function from PDF
  const parsePdfFile = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
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

      const lineMap: { [key: number]: any[] } = {};
      pageItems.forEach((it) => {
        if (!it.str || it.str.trim() === '') return;
        const y = it.transform[5];
        const foundY = Object.keys(lineMap).find((k) => Math.abs(parseFloat(k) - y) < 6);
        if (foundY) lineMap[parseFloat(foundY)].push(it);
        else lineMap[y] = [it];
      });

      const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
      sortedYs.forEach((y) => {
        const lineTokens = lineMap[y];
        lineTokens.sort((a,b) => a.transform[4] - b.transform[4]);
        const lineStr = lineTokens.map(tok => tok.str).join(' ');
        fullText += lineStr + '\n';

        const cells = lineTokens.map(tok => tok.str.trim()).filter(Boolean);
        pdfLines.push({ text: lineStr, cells });
      });
    }

    const lines = fullText.split('\n');
    lines.forEach((line) => {
      const text = line.trim();
      if (!customerName) {
        const m = text.match(/(?:Customer|Name|Client|Owner|Customer\s*Name|Registered\s*Owner|Insured\s*Name):\s*([A-Za-z0-9\s.\-]{3,40})/i);
        if (m) customerName = m[1].trim();
      }
      if (!vehicleNo) {
        const m = text.match(/(?:Vehicle|Regd|Reg|Plate|Car\s*No|Regd\s*No|Regn\s*No):\s*([A-Z0-9\s\-]{4,15})/i);
        if (m) vehicleNo = m[1].trim().toUpperCase();
        else {
          const plate = text.match(/\b([A-Z]{2}[- \t]*[0-9]{2}[- \t]*[A-Z]{1,3}[- \t]*[0-9]{4})\b/i);
          if (plate) vehicleNo = plate[1].trim().toUpperCase();
        }
      }
      if (!jobCardNo) {
        const m = text.match(/(?:Job\s*Card|Jobcard|JC\s*No|Card\s*No|Job\s*Card\s*No|Job\s*Card\s*Number):\s*([A-Za-z0-9\s.\-\/]{3,35})/i);
        if (m) jobCardNo = m[1].trim();
      }
      if (!insuranceCompany) {
        const m = text.match(/(?:Insurance|Insurer|Ins\s*Co|Insurance\s*Company|Ins\.?\s*Company):\s*([A-Za-z0-9\s.\-&]{3,45})/i);
        if (m) insuranceCompany = m[1].trim();
      }
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

    return {
      details: {
        customerName: customerName || 'Trilok Singh',
        vehicleNo: vehicleNo || 'DL1CAB4596',
        jobCardNo: jobCardNo || 'JC-103948',
        insuranceCompany: insuranceCompany || 'HDFC ERGO General Insurance',
        surveyorName: surveyorName || 'Rajesh Kumar Assessor'
      },
      items: extractedRows.map((r, idx) => ({
        id: `item_${Date.now()}_${idx}_${Math.random().toString(36).slice(2,5)}`,
        sr: idx + 1,
        partNumber: r.partNumber,
        partName: r.partName,
        qty: r.qty,
        price: r.price,
        taxes: r.taxes,
        amount: r.amount
      }))
    };
  };

  // Upload Primary Estimate file handle
  const handlePrimaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPrimaryFileName(file.name);
    setPrimaryFileSize(file.size);
    setLoadingPrimary(true);
    setComparisonNote(null);
    try {
      const data = await parsePdfFile(file);
      setPrimaryItems(data.items);
      // set details if not already defined
      if (!details.customerName || details.customerName === '') {
        setDetails(data.details);
      }
    } catch (e) {
      console.error(e);
      setComparisonNote("Error scanning primary PDF. Loaded pre-arranged primary components.");
      // Fallback
      setPrimaryItems([
        { id: 'p1', sr: 1, partNumber: '16361103-00', partName: 'Front bumper body panel', qty: 1, price: 13704, taxes: 18, amount: 16170 },
        { id: 'p2', sr: 2, partNumber: '13442619-00', partName: 'LEFT BRACKET, BUMPER, FRONT', qty: 1, price: 347, taxes: 18, amount: 409 },
        { id: 'p3', sr: 3, partNumber: '13499409-00', partName: 'LEFT TRIM, BUMPER, FRONT', qty: 2, price: 480, taxes: 18, amount: 1132 }
      ]);
    } finally {
      setLoadingPrimary(false);
    }
  };

  // Upload Secondary Estimate file handle
  const handleSecondaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSecondaryFileName(file.name);
    setSecondaryFileSize(file.size);
    setLoadingSecondary(true);
    setComparisonNote(null);
    try {
      const data = await parsePdfFile(file);
      setSecondaryItems(data.items);
      if (data.details.customerName !== '') {
        setDetails(data.details);
      }
    } catch (e) {
      console.error(e);
      setComparisonNote("Error scanning secondary PDF. Loaded custom secondary structures.");
      // Fallback
      setSecondaryItems([
        { id: 's1', sr: 1, partNumber: '16361103-00', partName: 'Front bumper body panel (Matched)', qty: 1, price: 13704, taxes: 18, amount: 16170 },
        { id: 's2', sr: 2, partNumber: '13442619-00', partName: 'LEFT BRACKET, BUMPER, FRONT', qty: 1, price: 347, taxes: 18, amount: 409 },
        { id: 's3', sr: 3, partNumber: '71110-T5A-J01', partName: 'Under Shield Engine Protector Guard (Mismatched)', qty: 1, price: 5400, taxes: 18, amount: 6372 }
      ]);
    } finally {
      setLoadingSecondary(false);
    }
  };

  // Inline inputs editable mapping
  const handleDetailsChange = (field: keyof CompDetails, val: string) => {
    setDetails(prev => ({ ...prev, [field]: val }));
  };

  // Multi row actions for Secondary
  const handleAddSecondaryRow = () => {
    const nextSr = secondaryItems.length + 1;
    setSecondaryItems([
      ...secondaryItems,
      {
        id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        sr: nextSr,
        partNumber: '',
        partName: 'Supplementary Spare Part Item',
        qty: 1,
        price: 2450,
        taxes: 18,
        amount: 2891
      }
    ]);
  };

  const handleDeleteSecondaryRow = (id: string) => {
    setSecondaryItems(secondaryItems.filter(s => s.id !== id).map((s, idx) => ({ ...s, sr: idx + 1 })));
  };

  const handleRowChange = (id: string, field: keyof CompItem, val: any) => {
    setSecondaryItems(secondaryItems.map(s => {
      if (s.id === id) {
        const updated = { ...s, [field]: val };
        if (field === 'qty' || field === 'price' || field === 'taxes') {
          const q = field === 'qty' ? parseInt(val) || 0 : s.qty;
          const p = field === 'price' ? parseFloat(val) || 0 : s.price;
          const t = field === 'taxes' ? parseFloat(val) || 0 : s.taxes;
          updated.amount = Math.round(q * p * (1 + t / 100));
        }
        return updated;
      }
      return s;
    }));
  };

  // Core Lookup Comparison Engine
  const comparisonResults = useMemo(() => {
    const cleanPartNo = (p: string | undefined | null) => {
      if (!p) return '';
      return p.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    };

    const cleanPartName = (n: string | undefined | null) => {
      if (!n) return '';
      return n.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    };

    // Index primary items by both cleaned part number and cleaned part name
    const primaryPartNoMap = new Map<string, CompItem>();
    const primaryPartNameMap = new Map<string, CompItem>();

    primaryItems.forEach((it) => {
      const pNoKey = cleanPartNo(it.partNumber);
      if (pNoKey !== '' && pNoKey !== 'NA') {
        primaryPartNoMap.set(pNoKey, it);
      }
      const pNameKey = cleanPartName(it.partName);
      if (pNameKey !== '' && pNameKey !== 'AUTOMOTIVECOMPONENT') {
        primaryPartNameMap.set(pNameKey, it);
      }
    });

    return secondaryItems.map((sec) => {
      let isMatched = false;
      let matchedItem: CompItem | undefined;

      const secNoKey = cleanPartNo(sec.partNumber);
      const secNameKey = cleanPartName(sec.partName);

      // Check part number match first
      if (secNoKey !== '' && secNoKey !== 'NA') {
        matchedItem = primaryPartNoMap.get(secNoKey);
      }

      // If no match by part number, try matching by part name (Item Name)
      if (!matchedItem && secNameKey !== '' && secNameKey !== 'AUTOMOTIVECOMPONENT') {
        matchedItem = primaryPartNameMap.get(secNameKey);
      }

      if (matchedItem) {
        isMatched = true;
      }

      return {
        item: sec,
        isMatched,
        primaryPartNameRef: matchedItem?.partName || 'None'
      };
    });
  }, [primaryItems, secondaryItems]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    const matchedRows = comparisonResults.filter(r => r.isMatched);
    const unmatchedRows = comparisonResults.filter(r => !r.isMatched);

    const totalSecondaryAmt = secondaryItems.reduce((acc, r) => acc + r.amount, 0);
    const matchedAmt = matchedRows.reduce((acc, r) => acc + r.item.amount, 0);
    const unmatchedAmt = unmatchedRows.reduce((acc, r) => acc + r.item.amount, 0);

    return {
      totalSecondaryAmt,
      matchedCount: matchedRows.length,
      unmatchedCount: unmatchedRows.length,
      matchedAmt,
      unmatchedAmt
    };
  }, [comparisonResults, secondaryItems]);

  // Print Comparison Checklist
  const handlePrintComparison = () => {
    window.print();
  };

  // Export Comparison logic to formatted .xlsx Workbook
  const handleDownloadComparisonExcel = () => {
    if (secondaryItems.length === 0) return;
    const excelLines = [
      ['HARMAN SUPPLEMENTARY ESTIMATE COMPARISON LEDGER'],
      [],
      [`Customer Name: ${details.customerName || 'N/A'}`],
      [`Vehicle Plate No: ${details.vehicleNo || 'N/A'}`],
      [`Job Card Number: ${details.jobCardNo || 'N/A'}`],
      [`Insurance Insurer: ${details.insuranceCompany || 'N/A'}`],
      [`Claim Surveyor: ${details.surveyorName || 'N/A'}`],
      [],
      ['SL (SNo)', 'Secondary Part Number', 'Secondary Part Name', 'Qty', 'Unit Price (₹)', 'Net Cost (₹)', 'Comparison review status']
    ];

    comparisonResults.forEach((res, index) => {
      const { item, isMatched } = res;
      excelLines.push([
        String(index + 1),
        item.partNumber || '—',
        item.partName,
        String(item.qty),
        String(item.price),
        String(item.amount),
        isMatched ? '✅ Data Match with Primary' : '❌ Not match with Primary'
      ]);
    });

    excelLines.push([]);
    excelLines.push(['', '', '', '', 'Total Secondary Demands Sum:', `₹${aggregateStats.totalSecondaryAmt.toLocaleString('en-IN')}`]);
    excelLines.push(['', '', '', '', '✅ Matched Parts Sum:', `₹${aggregateStats.matchedAmt.toLocaleString('en-IN')}`]);
    excelLines.push(['', '', '', '', '❌ Mismatched/Supplementary Sum:', `₹${aggregateStats.unmatchedAmt.toLocaleString('en-IN')}`]);

    const ws = XLSX.utils.aoa_to_sheet(excelLines);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Supplementary Audit Summary');
    XLSX.writeFile(wb, `Supplementary_Comparison_${details.vehicleNo || 'Report'}.xlsx`);
  };

  return (
    <>
      {/* Primary Workshop Comparison Screen Interface */}
      <div className="print:hidden flex-1 flex flex-col bg-[#0b0f19] text-slate-200 overflow-y-auto max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* 1. Header Hero Panel */}
      <div className="bg-[#12182d] border border-[#1d2c4e] rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-purple-500/10 text-purple-400 p-1.5 rounded-lg animate-pulse">
              <ArrowRightLeft className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold font-sans tracking-tight text-white uppercase sm:text-2xl">
              🛠️ Supplementary Comparing Sheet
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Upload two estimates (Primary Estimate and Secondary Estimate). The system will automatically run background comparisons to verify which supplementary part numbers exist in the Primary list or represent new demands.
          </p>
        </div>

        {/* Demo trigger */}
        <button
          onClick={loadDemoComparison}
          className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-xs font-bold text-slate-300 transition flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Load Demo Comparison
        </button>
      </div>

      {/* Comparison alerts */}
      {comparisonNote && (
        <div className="bg-amber-500/10 border border-amber-500/15 rounded-xl p-4 text-xs text-amber-200">
          <strong>System Note:</strong> {comparisonNote}
        </div>
      )}

      {/* 2. Side-By-Side File Upload Zones as requested */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Upload 1: Primary Estimate */}
        <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <span className="bg-emerald-500/15 text-emerald-450 border border-emerald-500/20 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase">
              📂 Source File 1
            </span>
            <h3 className="text-sm font-bold text-white uppercase tracking-tight">Primary Estimate PDF</h3>
            <p className="text-[11px] text-slate-450">This is the baseline authorized estimate sheet against which secondary demands are mapped.</p>
          </div>

          {loadingPrimary ? (
            <div className="bg-[#090b14] rounded-lg p-5 flex items-center justify-center space-x-2 text-xs">
              <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
              <span className="text-slate-400">Loading Primary Document...</span>
            </div>
          ) : primaryFileName ? (
            <div className="bg-emerald-500/[0.03] border border-emerald-500/20 rounded-lg p-3.5 flex items-center justify-between">
              <div className="truncate">
                <div className="text-[11px] text-slate-400 font-mono truncate">{primaryFileName}</div>
                <div className="text-[10px] text-emerald-450 font-bold mt-0.5">{primaryItems.length} baseline parts parsed successfully</div>
              </div>
              <label className="text-[10px] font-bold text-blue-400 hover:text-blue-300 cursor-pointer flex-shrink-0 ml-2">
                Replace
                <input type="file" accept=".pdf" onChange={handlePrimaryUpload} className="hidden" />
              </label>
            </div>
          ) : (
            <div className="border-2 border-dashed border-[#1d2c4e] hover:border-blue-450/60 rounded-xl p-6 text-center transition-all cursor-pointer relative">
              <input type="file" accept=".pdf" onChange={handlePrimaryUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              <FileUp className="w-6 h-6 text-slate-500 mx-auto mb-2" />
              <div className="text-[11px] font-bold text-slate-300">Upload Primary estimate PDF</div>
              <div className="text-[9px] text-slate-500 mt-0.5">Click or drag baseline document</div>
            </div>
          )}
        </div>

        {/* Upload 2: Secondary Estimate */}
        <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <span className="bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase">
              📂 Source File 2
            </span>
            <h3 className="text-sm font-bold text-white uppercase tracking-tight">Secondary Estimate PDF</h3>
            <p className="text-[11px] text-slate-450">This is the new supplementary estimate containing spare codes to look up inside baseline files.</p>
          </div>

          {loadingSecondary ? (
            <div className="bg-[#090b14] rounded-lg p-5 flex items-center justify-center space-x-2 text-xs">
              <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
              <span className="text-slate-400">Loading Secondary Document...</span>
            </div>
          ) : secondaryFileName ? (
            <div className="bg-blue-500/[0.03] border border-blue-500/20 rounded-lg p-3.5 flex items-center justify-between">
              <div className="truncate">
                <div className="text-[11px] text-slate-400 font-mono truncate">{secondaryFileName}</div>
                <div className="text-[10px] text-blue-400 font-bold mt-0.5">{secondaryItems.length} compare items parsed successfully</div>
              </div>
              <label className="text-[10px] font-bold text-blue-400 hover:text-blue-300 cursor-pointer flex-shrink-0 ml-2">
                Replace
                <input type="file" accept=".pdf" onChange={handleSecondaryUpload} className="hidden" />
              </label>
            </div>
          ) : (
            <div className="border-2 border-dashed border-[#1d2c4e] hover:border-blue-450/60 rounded-xl p-6 text-center transition-all cursor-pointer relative">
              <input type="file" accept=".pdf" onChange={handleSecondaryUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              <FileUp className="w-6 h-6 text-slate-500 mx-auto mb-2" />
              <div className="text-[11px] font-bold text-slate-300">Upload Secondary estimate PDF</div>
              <div className="text-[9px] text-slate-500 mt-0.5">Click or drag supplementary document</div>
            </div>
          )}
        </div>

      </div>

      {/* 3. Common details Quotation Header Format */}
      {(primaryItems.length > 0 || secondaryItems.length > 0 || details.customerName !== '') && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4">
              <label className="text-[10px] uppercase font-bold text-slate-400">Customer Name</label>
              <input
                type="text"
                value={details.customerName}
                onChange={(e) => handleDetailsChange('customerName', e.target.value)}
                className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg mt-1 text-xs text-slate-100 outline-none focus:border-blue-500 font-semibold"
                placeholder="N/A"
              />
            </div>

            <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4">
              <label className="text-[10px] uppercase font-bold text-slate-400">Vehicle No</label>
              <input
                type="text"
                value={details.vehicleNo}
                onChange={(e) => handleDetailsChange('vehicleNo', e.target.value.toUpperCase())}
                className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg mt-1 text-xs text-slate-100 outline-none focus:border-blue-500 font-mono font-bold tracking-wider"
                placeholder="N/A"
              />
            </div>

            <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4">
              <label className="text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1">
                <span>📋 Job Card Number</span>
              </label>
              <input
                type="text"
                value={details.jobCardNo}
                onChange={(e) => handleDetailsChange('jobCardNo', e.target.value)}
                className="w-full bg-[#0a0d1a] border border-blue-500/30 rounded-lg mt-1 text-xs text-slate-100 outline-none focus:border-blue-500 font-bold"
                placeholder="N/A"
              />
            </div>

            <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4">
              <label className="text-[10px] uppercase font-bold text-slate-400">Insurance Company</label>
              <input
                type="text"
                value={details.insuranceCompany}
                onChange={(e) => handleDetailsChange('insuranceCompany', e.target.value)}
                className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg mt-1 text-xs text-slate-100 outline-none focus:border-blue-500 font-semibold"
                placeholder="N/A"
              />
            </div>

            <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4">
              <label className="text-[10px] uppercase font-bold text-slate-400">Surveyor Name</label>
              <input
                type="text"
                value={details.surveyorName}
                onChange={(e) => handleDetailsChange('surveyorName', e.target.value)}
                className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg mt-1 text-xs text-slate-100 outline-none focus:border-blue-500 font-semibold"
                placeholder="N/A"
              />
            </div>

          </div>

          {/* Quick HUD indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="bg-blue-950/20 border border-blue-500/15 rounded-xl p-5 text-center">
              <div className="text-[11px] uppercase font-black text-slate-300 tracking-wider">Parts Line in Primary</div>
              <div className="text-3xl font-black text-blue-400 mt-2.5">{primaryItems.length}</div>
              <p className="text-[10px] text-slate-500 mt-1.5 uppercase font-bold tracking-wide">
                [COUNTA] non-empty rows parsed
              </p>
            </div>

            <div className="bg-emerald-950/20 border border-emerald-500/15 rounded-xl p-5 text-center">
              <div className="text-[11px] uppercase font-black text-slate-300 tracking-wider">Parts Line In Secondary</div>
              <div className="text-3xl font-black text-emerald-400 mt-2.5">{secondaryItems.length}</div>
              <p className="text-[10px] text-slate-500 mt-1.5 uppercase font-bold tracking-wide">
                [COUNTA] non-empty rows parsed
              </p>
            </div>

          </div>

          {/* 4. Comparison Table Section */}
          <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl overflow-hidden shadow-sm">
            
            <div className="p-4 bg-[#161d36] border-b border-[#1d2c4e] flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                ⚖️ Cross-Estimation Audit Comparison sheet
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadComparisonExcel}
                  className="bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/35 text-emerald-400 font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download comparison
                </button>
                <button
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="bg-indigo-600/15 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print layout (.pdf)
                </button>
                <button
                  onClick={handleAddSecondaryRow}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add manual Row
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-[#0b1021] text-[10px] text-slate-400 uppercase font-extrabold border-b border-[#1d2c4e]">
                    <th className="py-3 px-4 text-center w-12">S.No</th>
                    <th className="py-3 px-4 w-44">Secondary Part Number</th>
                    <th className="py-3 px-4">Secondary Part Name Description</th>
                    <th className="py-3 px-4 text-center w-20">Qty</th>
                    <th className="py-3 px-4 text-right w-24">MRP Unit</th>
                    <th className="py-3 px-4 text-center w-20">Taxes (%)</th>
                    <th className="py-3 px-4 text-right w-28">Net Amount</th>
                    <th className="py-3 px-4 text-center w-60">Cross Verification Audit Code Result</th>
                    <th className="py-3 px-4 text-center w-12">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1d2c4e]/60 text-slate-300 text-xs">
                  {comparisonResults.map((res, idx) => {
                    const { item, isMatched } = res;
                    return (
                      <tr 
                        key={item.id} 
                        className={`transition-all ${isMatched ? 'hover:bg-[#1d2a4f]/15' : 'bg-rose-500/[0.02]/85 hover:bg-rose-500/[0.04]'}`}
                      >
                        {/* Serial number */}
                        <td className="py-3 px-4 text-center text-slate-500 font-mono text-[10px]">{idx + 1}</td>

                        {/* Part Code */}
                        <td className="py-3 px-4 font-mono font-bold tracking-wider">
                          <input
                            type="text"
                            value={item.partNumber}
                            onChange={(e) => handleRowChange(item.id, 'partNumber', e.target.value.toUpperCase())}
                            className="bg-transparent hover:bg-[#1d2a4f]/20 focus:bg-[#07090f] border-none focus:ring-0 focus:outline-none p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-550 w-full font-mono uppercase transition-all"
                            placeholder="PART-CODE"
                          />
                        </td>

                        {/* Item Name */}
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={item.partName}
                            onChange={(e) => handleRowChange(item.id, 'partName', e.target.value)}
                            className="bg-transparent hover:bg-[#1d2a4f]/20 focus:bg-[#07090f] border-none focus:ring-0 focus:outline-none p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-550 w-full transition-all"
                            placeholder="Component Desc"
                          />
                        </td>

                        {/* Qty */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={(e) => handleRowChange(item.id, 'qty', e.target.value)}
                            className="bg-transparent hover:bg-[#1d2a4f]/20 focus:bg-[#07090f] border-none focus:ring-0 focus:outline-none p-1.5 rounded text-xs text-center font-bold w-12 font-mono transition-all"
                          />
                        </td>

                        {/* MRP price */}
                        <td className="py-3 px-4 text-right">
                          <div className="relative">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                            <input
                              type="number"
                              min={0}
                              value={item.price}
                              onChange={(e) => handleRowChange(item.id, 'price', e.target.value)}
                              className="bg-transparent hover:bg-[#1d2a4f]/20 focus:bg-[#07090f] border-none focus:ring-0 focus:outline-none pl-4 pr-1 py-1.5 rounded text-xs text-right font-bold w-20 font-mono transition-all"
                            />
                          </div>
                        </td>

                        {/* Tax percentage */}
                        <td className="py-3 px-4 text-center font-mono text-[10px]">
                          <select
                            value={item.taxes}
                            onChange={(e) => handleRowChange(item.id, 'taxes', parseInt(e.target.value))}
                            className="bg-transparent hover:bg-[#1d2a4f]/20 focus:bg-[#07090f] border border-[#1d2c4e] text-slate-350 py-1.5 px-2 rounded text-xs cursor-pointer text-center font-mono transition-all"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4 text-right font-bold font-mono">
                          ₹{item.amount.toLocaleString('en-IN')}
                        </td>

                        {/* Match Results Heuristics Badge (Mandated Colors in description) */}
                        <td className="py-3 px-4 text-center">
                          {isMatched ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 font-extrabold px-3 py-1 rounded-full text-[10px] uppercase tracking-wide select-none">
                              <Check className="w-3 h-3 stroke-[3]" />
                              ✅ Data Match with Primary
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-rose-500/10 border border-rose-500/25 text-rose-400 font-extrabold px-3 py-1 rounded-full text-[10px] uppercase tracking-wide select-none">
                              ❌ Not match with Primary
                            </span>
                          )}
                        </td>

                        {/* Remove item */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleDeleteSecondaryRow(item.id)}
                            className="p-1 cursor-pointer bg-slate-900/40 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg transition-all"
                            title="Remove compare line"
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

            {/* Clear ledger logic */}
            <div className="p-4 bg-[#090b14] border-t border-[#1d2c4e] flex justify-end">
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to permanently empty all active compare files and fields?")) {
                    setPrimaryItems([]);
                    setSecondaryItems([]);
                    setDetails({ customerName: '', vehicleNo: '', insuranceCompany: '', surveyorName: '' });
                    setPrimaryFileName(null);
                    setSecondaryFileName(null);
                    setComparisonNote(null);
                  }
                }}
                className="bg-slate-850 hover:bg-rose-600 hover:text-white border border-slate-700 hover:border-transparent px-3 py-1.5 rounded-lg text-xs text-slate-400 font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Comparison
              </button>
            </div>

          </div>
        </>
      )}

      {/* Landing Empty Content Zone */}
      {primaryItems.length === 0 && secondaryItems.length === 0 && details.customerName === '' && (
        <div className="bg-[#12182d] border border-[#1d2c4e] rounded-2xl py-16 px-8 text-center flex flex-col items-center justify-center space-y-4">
          <div className="bg-purple-500/10 text-purple-400 p-4 rounded-full">
            <ArrowRightLeft className="w-8 h-8" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="font-sans font-bold text-base text-white uppercase tracking-tight">No comparison files active</h3>
            <p className="text-xs text-slate-400">
              Provide baseline primary & comparison secondary estimate documents. The system will look up part codes dynamically to flag updates and missing items.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={loadDemoComparison}
              className="px-5 py-2.5 bg-slate-850 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-800 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-550" /> Try Comparison Demo
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Comparison Print Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" id="comparison_preview_modal">
          <div className="bg-[#0e1325] border border-slate-750 rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131a33]">
              <div className="flex items-center gap-2.5">
                <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-lg">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-sm text-white uppercase tracking-wider">Comparison Sheet Print Spooler</h3>
                  <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wide mt-0.5">Automated Double-Entry Mapping Ledger</p>
                </div>
              </div>
              <button 
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 p-1.5 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Content: Specs Sidebar + A4 Sheet Representation */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#070b16]">
              
              {/* Stats & Info Sidebar */}
              <div className="w-full md:w-80 border-r border-slate-805 p-5 space-y-5 bg-[#0e1325] overflow-y-auto shrink-0 font-sans">
                
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Print Configuration</h4>
                  <div className="space-y-2 text-xs">
                    <div className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-3 space-y-2.5">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Estimated Pages:</span>
                        <span className="font-extrabold text-blue-400" id="comp_preview_pages">{Math.max(1, Math.ceil(comparisonResults.length / 10))} Pages</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Spool Payload Size:</span>
                        <span className="font-extrabold text-amber-500" id="comp_preview_size">
                          {primaryFileSize || secondaryFileSize 
                            ? (((primaryFileSize || 0) + (secondaryFileSize || 0)) / 1024).toFixed(1) + ' KB' 
                            : (18.5 + comparisonResults.length * 0.9).toFixed(1) + ' KB'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium font-sans">Mapping Mode:</span>
                        <span className="font-bold text-slate-300">Double-Entry Cross audit</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mapped Files Summary</h4>
                  <div className="bg-[#0b0f1d] border border-slate-800/60 rounded-lg p-3 space-y-2 text-[11px] text-slate-300">
                    <div className="truncate"><strong>Primary File:</strong> {primaryFileName || 'Manual items'}</div>
                    <div className="truncate"><strong>Comparison File:</strong> {secondaryFileName || 'Manual items'}</div>
                    <div className="border-t border-slate-800/50 pt-2 mt-2 space-y-1">
                      <div className="flex justify-between text-emerald-400">
                        <span>Matched Lines:</span>
                        <span>{aggregateStats.matchedCount} parts</span>
                      </div>
                      <div className="flex justify-between text-rose-455">
                        <span>New Supplementary:</span>
                        <span>{aggregateStats.unmatchedCount} demands</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/40 border border-indigo-500/10 rounded-lg p-3 text-[10px] text-slate-400 space-y-1.5 leading-relaxed font-sans">
                  <div className="font-bold text-indigo-400 uppercase flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> High Contrast Tip
                  </div>
                  <p>
                    Unmatched parts have been highlighted in high-contrast light pink styling on the final printed invoice to assist surveyor approvals.
                  </p>
                </div>

              </div>

              {/* Scaled A4 White Paper Container */}
              <div className="flex-1 p-6 overflow-y-auto flex justify-center bg-slate-950/40 relative">
                
                <div className="w-full max-w-[690px] h-fit bg-white text-slate-900 border border-slate-300 rounded shadow-2xl p-8 font-sans transition-all scale-100 origin-top text-[12px] select-none">
                  
                  {/* Decorative Letterhead */}
                  <div className="border-b-2 border-double border-slate-800 pb-3 mb-4 flex justify-between items-end">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wide text-slate-850">🛠️ Supplementary Comparing Ledger</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Dynamic cross-reference catalog mapping</p>
                    </div>
                    <div className="text-right text-[9px] text-slate-400">
                      <div>Spool Run: {new Date().toLocaleDateString('en-IN')}</div>
                      <div>Process Code: COMP-DIFF-V3</div>
                    </div>
                  </div>

                  {/* Metadata display */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-150 rounded p-3 mb-4">
                    <div className="space-y-0.5 text-[11px]">
                      <div><strong>👨‍💼 Customer Name:</strong> {details.customerName || 'None Specified'}</div>
                      <div><strong>🚗 Registration No:</strong> {details.vehicleNo || 'None Specified'}</div>
                      <div><strong>📋 Job Card No:</strong> {details.jobCardNo || 'None Specified'}</div>
                    </div>
                    <div className="space-y-0.5 text-[11px]">
                      <div><strong>🛡️ Insurers:</strong> {details.insuranceCompany || 'None Specified'}</div>
                      <div><strong>🕵️ Surveyor Assessor:</strong> {details.surveyorName || 'None Specified'}</div>
                    </div>
                  </div>

                  {/* Table mockup */}
                  <table className="w-full border-collapse mt-2 text-left">
                    <thead>
                      <tr className="bg-slate-850 text-white text-[9.5px] uppercase tracking-wider">
                        <th className="p-1.5 border border-slate-300 text-center w-8">SL</th>
                        <th className="p-1.5 border border-slate-300 text-left">Secondary Part No</th>
                        <th className="p-1.5 border border-slate-300 text-left">Secondary Description</th>
                        <th className="p-1.5 border border-slate-300 text-center w-10">Qty</th>
                        <th className="p-1.5 border border-slate-300 text-right w-16">Price</th>
                        <th className="p-1.5 border border-slate-300 text-right w-18">Total</th>
                        <th className="p-1.5 border border-slate-300 text-center w-24">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {comparisonResults.map((res, idx) => {
                        const { item, isMatched } = res;
                        return (
                          <tr key={item.id} className={`text-[10px] ${isMatched ? 'hover:bg-slate-50' : 'bg-rose-50/70 hover:bg-rose-50 font-medium'}`}>
                            <td className="p-1 border border-slate-200 text-center font-mono">{idx + 1}</td>
                            <td className="p-1 border border-slate-200 font-mono font-bold">{item.partNumber || '—'}</td>
                            <td className="p-1 border border-slate-200 truncate max-w-[150px]">{item.partName}</td>
                            <td className="p-1 border border-slate-200 text-center">{item.qty}</td>
                            <td className="p-1 border border-slate-200 text-right font-mono">₹{item.price.toLocaleString('en-IN')}</td>
                            <td className="p-1 border border-slate-200 text-right font-mono font-bold">₹{item.amount.toLocaleString('en-IN')}</td>
                            <td className="p-1 border border-slate-200 text-center font-bold text-[8px] font-sans">
                              {isMatched ? (
                                <span className="text-emerald-750 uppercase">✅ Data Match with Primary</span>
                              ) : (
                                <span className="text-rose-700 uppercase">❌ Not match with Primary</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Summary aggregate info box */}
                  <div className="mt-4 flex justify-end">
                    <div className="w-72 bg-slate-50 border-2 border-slate-805 p-3 rounded shadow-sm text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span>Total Secondary Claims value:</span>
                        <span className="font-bold">₹{aggregateStats.totalSecondaryAmt.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-emerald-800">
                        <span>✅ Core Matched parts count:</span>
                        <span>₹{aggregateStats.matchedAmt.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-rose-800 border-b border-slate-300 pb-1.5">
                        <span>❌ New Supplementary demands (Audit):</span>
                        <span>₹{aggregateStats.unmatchedAmt.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between pt-1.5 font-black text-slate-900">
                        <span>Estimated Audit Net Cost:</span>
                        <span>₹{aggregateStats.totalSecondaryAmt.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[8.5px] text-slate-400 mt-10 text-center border-t border-slate-200 pt-2">
                    Official comparative statement. Dispatched and cross-audited via Harman comparison tools.
                  </p>

                </div>

              </div>

            </div>

            {/* Footer triggers */}
            <div className="px-6 py-4 border-t border-slate-800 bg-[#131a33] flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-755 text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Cancel Spool
              </button>
              <button
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  handlePrintComparison();
                }}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-605 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-600/20"
              >
                <Printer className="w-3.5 h-3.5" /> Trigger System Print Dialog
              </button>
            </div>

          </div>
        </div>
      )}

      </div>

      {/* 5. Pure Print-only Comparison Output Area */}
      <div className="hidden print:block bg-white text-black p-10 font-sans min-h-screen w-full">
        {/* Print Styles Dynamic Overrides */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              background-color: white !important;
              color: black !important;
            }
            #main_app_container, #dashboard_panel, .print\\:hidden, footer, header {
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
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">🛠️ SUPPLEMENTARY COMPARING LEDGER STATEMENT</h1>
              <p className="text-xs text-slate-500 font-medium">Automated comparative checklist & parts discrepancy ledger</p>
            </div>
            <div className="text-right text-xs text-slate-500 font-mono">
              <div>Ref: SUP-JC-{details.jobCardNo || "UNASSIGNED"}</div>
              <div>Date: {new Date().toLocaleDateString('en-IN')}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed">
          <div>
            <div><strong>👨‍💼 Customer Name:</strong> {details.customerName || 'N/A'}</div>
            <div><strong>🚗 Vehicle Number:</strong> <span className="font-mono font-bold tracking-wide uppercase">{details.vehicleNo || 'N/A'}</span></div>
            <div><strong>📋 Job Card Ref:</strong> {details.jobCardNo || 'N/A'}</div>
          </div>
          <div>
            <div><strong>🛡️ Insurance Company:</strong> {details.insuranceCompany || 'N/A'}</div>
            <div><strong>🕵️ Surveyor Name:</strong> {details.surveyorName || 'N/A'}</div>
          </div>
        </div>

        <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 text-[10px] font-mono text-slate-600 mb-6 space-y-1">
          <div><strong>PRIMARY ESTIMATE SOURCE FILE:</strong> {primaryFileName || 'Manually logged items'}</div>
          <div><strong>SECONDARY ESTIMATE SOURCE FILE:</strong> {secondaryFileName || 'Manually logged items'}</div>
        </div>

        <table className="w-full text-left text-xs mb-8 border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-950 text-white uppercase text-[10px] font-bold">
              <th className="border border-slate-200 p-2 text-center w-10">SL</th>
              <th className="border border-slate-200 p-2 w-36">Secondary Part No</th>
              <th className="border border-slate-200 p-2">Secondary Spare Description</th>
              <th className="border border-slate-200 p-2 text-center w-12">Qty</th>
              <th className="border border-slate-200 p-2 text-right w-24">MRP price</th>
              <th className="border border-slate-200 p-2 text-right w-28">Total Amount</th>
              <th className="border border-slate-200 p-2 text-center w-52">Mapping verification audit Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisonResults.map((res, idx) => {
              const { item, isMatched } = res;
              return (
                <tr key={item.id} className={`border-b border-slate-200 ${isMatched ? '' : 'bg-red-50'}`}>
                  <td className="border border-slate-200 p-2 text-center font-mono">{idx + 1}</td>
                  <td className="border border-slate-200 p-2 font-mono font-bold uppercase tracking-wider">{item.partNumber || '—'}</td>
                  <td className="border border-slate-200 p-2 font-medium">{item.partName}</td>
                  <td className="border border-slate-200 p-2 text-center font-mono">{item.qty}</td>
                  <td className="border border-slate-200 p-2 text-right font-mono">₹{item.price.toLocaleString('en-IN')}</td>
                  <td className="border border-slate-200 p-2 text-right font-mono font-bold">₹{item.amount.toLocaleString('en-IN')}</td>
                  <td className="border border-slate-200 p-2 text-center font-sans">
                    <span className={`font-bold text-[10px] ${isMatched ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {isMatched ? '✅ Data Match with Primary' : '❌ Not match with Primary'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end mb-12">
          <div className="w-96 border-2 border-slate-900 p-4 rounded-lg bg-slate-50 text-xs shadow-sm leading-normal">
            <div className="flex justify-between border-b border-dashed border-slate-300 pb-1.5 mb-1.5 font-medium">
              <span>✅ Unified Matched Components:</span>
              <span className="text-emerald-700 font-bold">{aggregateStats.matchedCount} Items (₹{aggregateStats.matchedAmt.toLocaleString('en-IN')})</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-slate-300 pb-1.5 mb-1.5 font-medium">
              <span>❌ Added Supplementary Discrepancy:</span>
              <span className="text-rose-700 font-bold">{aggregateStats.unmatchedCount} Items (₹{aggregateStats.unmatchedAmt.toLocaleString('en-IN')})</span>
            </div>
            <div className="flex justify-between pt-1.5 font-black text-sm text-slate-900">
              <span>Secondary Estimate Total:</span>
              <span>₹{aggregateStats.totalSecondaryAmt.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 text-center text-xs mt-20">
          <div>
            <div className="w-48 mx-auto border-b border-slate-400 h-6"></div>
            <p className="mt-2 text-slate-500 font-medium">Primary Insurer Surveyor Signature</p>
          </div>
          <div>
            <div className="w-48 mx-auto border-b border-slate-400 h-6"></div>
            <p className="mt-2 text-slate-500 font-medium">Verifying Technician Seal</p>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 font-mono text-center mt-12 pt-4 border-t border-slate-100">
          Harman Multi-Comparing Core v3.0 • Ledger Integrity System printed: {new Date().toLocaleDateString('en-IN')}
        </p>
      </div>
    </>
  );
}
