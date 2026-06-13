import React, { useState, useMemo, useEffect } from 'react';
import { PartOrder, User, Vehicle, PartsMasterItem } from '../types';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  Truck,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Printer,
  FileSpreadsheet,
  FileText,
  DollarSign,
  Briefcase,
  HelpCircle,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

// Configure the pdfjs worker globally
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface SupplementarySectionProps {
  parts: PartOrder[];
  partsMaster: PartsMasterItem[];
  vehicles: Vehicle[];
  currentUser: User;
  onSavePart: (p: PartOrder) => void;
  onDeletePart: (id: string) => void;
  addTrigger?: number;
  exportTrigger?: number;
}

interface SupplementaryFormRow {
  partNo: string;
  partName: string;
  qty: number;
  rate: number;
  insuranceStatus: 'Pending' | 'Approved' | 'Rejected';
  status: 'In Order' | 'In Transit' | 'Received';
  remarks: string;
}

export default function SupplementarySection({
  parts,
  partsMaster = [],
  vehicles = [],
  currentUser,
  onSavePart,
  onDeletePart,
  addTrigger = 0,
  exportTrigger = 0
}: SupplementarySectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('All');
  const [filterInsurance, setFilterInsurance] = useState('All');
  const [filterProcurement, setFilterProcurement] = useState('All');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingPartId, setEditingPartId] = useState<string | null>(null);

  // Form Fields
  const [selectedVehicleReg, setSelectedVehicleReg] = useState('');
  // Multi-row rows for "Add More" feature
  const [formRows, setFormRows] = useState<SupplementaryFormRow[]>([
    { partNo: '', partName: '', qty: 1, rate: 0, insuranceStatus: 'Pending', status: 'In Order', remarks: '' }
  ]);

  // Inventory Catalog Search States within Form Row
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [catalogSearchText, setCatalogSearchText] = useState('');

  // Sub-Tab Switching state
  const [subView, setSubView] = useState<'logs' | 'comparison' | 'ai-parser'>('comparison');

  // Floating Confirmation Toasts state
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'warning' | 'info' }>>([]);

  const addToast = (message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // AI Parser States
  const [isParsingAI, setIsParsingAI] = useState<boolean>(false);
  const [aiFileName, setAiFileName] = useState<string>('');
  const [aiParsedDetails, setAiParsedDetails] = useState<any>(null);
  const [aiExtractedItems, setAiExtractedItems] = useState<any[]>([]);
  const [aiSelectedVehicleReg, setAiSelectedVehicleReg] = useState<string>('');
  const [aiAutoSave, setAiAutoSave] = useState<boolean>(false);
  const [aiParseError, setAiParseError] = useState<string>('');
  const [aiSelectedIndices, setAiSelectedIndices] = useState<{ [key: number]: boolean }>({});

  // PDF Estimation Comparison States
  const [primaryItems, setPrimaryItems] = useState<any[]>([]);
  const [primaryFileName, setPrimaryFileName] = useState<string>('');
  const [isParsingPrimary, setIsParsingPrimary] = useState<boolean>(false);

  const [secondaryItems, setSecondaryItems] = useState<any[]>([]);
  const [secondaryFileName, setSecondaryFileName] = useState<string>('');
  const [isParsingSecondary, setIsParsingSecondary] = useState<boolean>(false);

  // Meta details similar to Quotation/Estimate layout
  const [compCustomer, setCompCustomer] = useState<string>('');
  const [compVehicle, setCompVehicle] = useState<string>('');
  const [compInsurance, setCompInsurance] = useState<string>('');
  const [compSurveyor, setCompSurveyor] = useState<string>('');

  // PDF Parser compiler
  const parsePdfFile = async (file: File) => {
    return new Promise<{ extractedItems: any[], foundDetails: any }>((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        try {
          if (!event.target?.result) {
            throw new Error('File reading resulted in empty buffer.');
          }
          const bytes = new Uint8Array(event.target.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

          let extractedItems: any[] = [];
          let foundDetails: any = {
            customerName: '',
            vehicleNo: '',
            insuranceCompany: '',
            surveyorName: ''
          };
          let fullCombinedText = '';
          let tempSrCounter = 1;
          let currentItem: any = null;

          // Dynamic table column index auto-mapping (e.g. mapping "Item Name" directly to Part Name and "Part Number" exclusively to Part Number column)
          let columnMapping: {
            srIdx?: number;
            partNumberIdx?: number;
            partNameIdx?: number;
            qtyIdx?: number;
            priceIdx?: number;
            amountIdx?: number;
          } | null = null;

          const isHeaderRow = (cells: string[]) => {
            let matches = 0;
            cells.forEach((cell) => {
              const clean = cell ? String(cell).toLowerCase().trim() : '';
              if (!clean) return;
              if (
                clean === 'sr' || clean === 'sr.' || clean === 's.no' || clean === 'sno' || clean.includes('serial') || clean.includes('sno') || clean === 's. no.' || clean === 'sr no' || clean === 'sr. no'
              ) matches++;
              else if (
                clean.includes('part number') || clean.includes('part no') || clean === 'partnumber' || clean === 'partno' || clean.includes('item code') || clean.includes('part code') || clean.includes('slpart')
              ) matches++;
              else if (
                clean.includes('item name') || clean.includes('part name') || clean.includes('description') || clean.includes('particular') || clean.includes('spare name') || clean.includes('glass/spare')
              ) matches++;
              else if (
                clean === 'qty' || clean === 'quantity' || clean === 'qnty' || clean.includes('qty')
              ) matches++;
              else if (
                clean === 'price' || clean === 'rate' || clean.includes('unit price') || clean.includes('unit rate') || clean.includes('price') || clean.includes('rate')
              ) matches++;
              else if (
                clean === 'amount' || clean === 'total' || clean.includes('net amt') || clean.includes('net amount') || clean.includes('amount')
              ) matches++;
            });
            return matches >= 2;
          };

          const extractColumnMapping = (cells: string[]) => {
            const mapping: any = {};
            let mappedCount = 0;
            cells.forEach((cell, idx) => {
              const clean = cell ? String(cell).toLowerCase().trim() : '';
              if (!clean) return;
              if (
                clean === 'sr' || clean === 'sr.' || clean === 's.no' || clean === 'sno' || clean.includes('serial') || clean.includes('sno') || clean === 's. no.' || clean === 'sr no' || clean === 'sr. no'
              ) {
                mapping.srIdx = idx;
                mappedCount++;
              } else if (
                clean.includes('part number') || clean.includes('part no') || clean === 'partnumber' || clean === 'partno' || clean.includes('item code') || clean.includes('part code') || clean.includes('slpart')
              ) {
                mapping.partNumberIdx = idx;
                mappedCount++;
              } else if (
                clean.includes('item name') || clean.includes('part name') || clean.includes('description') || clean.includes('particular') || clean.includes('spare name') || clean.includes('glass/spare')
              ) {
                mapping.partNameIdx = idx;
                mappedCount++;
              } else if (
                clean === 'qty' || clean === 'quantity' || clean === 'qnty' || clean.includes('qty')
              ) {
                mapping.qtyIdx = idx;
                mappedCount++;
              } else if (
                clean === 'price' || clean === 'rate' || clean.includes('unit price') || clean.includes('unit rate') || clean.includes('price') || clean.includes('rate')
              ) {
                mapping.priceIdx = idx;
                mappedCount++;
              } else if (
                clean === 'amount' || clean === 'total' || clean.includes('net amt') || clean.includes('net amount') || clean.includes('amount')
              ) {
                mapping.amountIdx = idx;
                mappedCount++;
              }
            });

            const hasIdentifier = mapping.partNumberIdx !== undefined || mapping.partNameIdx !== undefined;
            const hasNumeric = mapping.qtyIdx !== undefined || mapping.priceIdx !== undefined || mapping.amountIdx !== undefined;

            if (mappedCount >= 2 && hasIdentifier && hasNumeric) {
              return mapping;
            }
            return null;
          };

          const saveCurrentItemFallback = () => {
            if (currentItem) {
              if (!currentItem.partNo || currentItem.partNo === '') {
                currentItem.partNo = 'N/A';
              }
              if (!currentItem.partName || currentItem.partName === '') {
                currentItem.partName = 'Automotive Component';
              }

              const isDuplicated = extractedItems.some(
                (item) => item.sr === currentItem.sr && item.partNo === currentItem.partNo
              );
              if (!isDuplicated) {
                extractedItems.push({
                  id: Math.random().toString(36).substring(2, 9),
                  sr: currentItem.sr,
                  partNumber: currentItem.partNo.trim(),
                  partName: currentItem.partName.trim(),
                  qty: currentItem.qty || 1,
                  price: currentItem.price || 0,
                  taxes: currentItem.taxes || 18,
                  amount: currentItem.amount || ((currentItem.qty || 1) * (currentItem.price || 0))
                });
              }
            }
            currentItem = null;
          };

          for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
            const page = await pdf.getPage(pNum);
            const textContent = await page.getTextContent();
            const pageTextRaw = textContent.items.map((it: any) => it.str).join(' ');
            fullCombinedText += pageTextRaw + '\n';

            // Heuristic metadata extraction
            if (!foundDetails.customerName) {
              const custMatch = pageTextRaw.match(/(?:Customer|Name|Client|Owner|Customer\s*Name|Registered\s*Owner):\s*([A-Za-z\s.\-]{3,35})/i);
              if (custMatch) foundDetails.customerName = custMatch[1].trim();
            }
            if (!foundDetails.vehicleNo) {
              const vehMatch = pageTextRaw.match(/(?:Vehicle|Reg|Plate|Car\s*No|Regd\s*No|Regn\s*No):\s*([A-Z0-9\s\-]{6,15})/i);
              if (vehMatch) foundDetails.vehicleNo = vehMatch[1].replace(/\s+/g, ' ').trim().toUpperCase();
            }
            if (!foundDetails.insuranceCompany) {
              const insMatch = pageTextRaw.match(/(?:Insurance|InsCo|Insurer|Ins\s*Co|Insurance\s*Company):\s*([A-Za-z0-0\s.\-]{3,40})/i);
              if (insMatch) foundDetails.insuranceCompany = insMatch[1].trim();
            }
            if (!foundDetails.surveyorName) {
              const survMatch = pageTextRaw.match(/(?:Surveyor|Assessor|Surveyor\s*Name):\s*([A-Za-z\s.\-]{3,35})/i);
              if (survMatch) foundDetails.surveyorName = survMatch[1].trim();
            }

            const pageItems: any[] = [];
            textContent.items.forEach((item: any) => {
              if (item.str && item.str.trim() !== '') {
                pageItems.push(item);
              }
            });

            pageItems.sort((a, b) => b.transform[5] - a.transform[5]);

            const dynamicYRows: any[][] = [];
            pageItems.forEach((item) => {
              const y = item.transform[5];
              let matchedRow = dynamicYRows.find((r) => Math.abs(r[0].transform[5] - y) < 13.5);
              if (matchedRow) {
                matchedRow.push(item);
              } else {
                dynamicYRows.push([item]);
              }
            });

            dynamicYRows.forEach((rawRow) => {
              rawRow.sort((cellA, cellB) => cellA.transform[4] - cellB.transform[4]);

              const rawMergedCells: string[] = [];
              let currentCellText = '';
              let lastX = -999;

              rawRow.forEach((cell) => {
                const x = cell.transform[4];
                if (lastX !== -999 && x - lastX > 15) {
                  if (currentCellText.trim()) rawMergedCells.push(currentCellText.trim());
                  currentCellText = cell.str;
                } else {
                  currentCellText += (currentCellText ? ' ' : '') + cell.str;
                }
                lastX = x + cell.width;
              });
              if (currentCellText.trim()) rawMergedCells.push(currentCellText.trim());

              // Pre-split any columns that got horizontally merged due to narrow padding (e.g. "1 16526999-" or "1.000Unit")
              const mergedCells: string[] = [];
              rawMergedCells.forEach((cell) => {
                const trimmed = cell.trim();
                
                // 1. Serial + Part Number: e.g. "1 16526999-00" or "1 16526999-"
                const srPn = trimmed.match(/^(\d+)\s+([A-Za-z0-9-]{5,25})$/);
                if (srPn) {
                  mergedCells.push(srPn[1]);
                  mergedCells.push(srPn[2]);
                  return;
                }

                // 2. Contains quantity + unit + rest: e.g. "1.000Unit Customer 47,734.09 GST"
                const hasNumber = /\d/.test(trimmed);
                const hasThreeOrMoreSpaces = (trimmed.match(/\s/g) || []).length >= 2;
                if (hasNumber && hasThreeOrMoreSpaces && (trimmed.toLowerCase().includes('unit') || trimmed.toLowerCase().includes('customer') || trimmed.toLowerCase().includes('gst') || trimmed.toLowerCase().includes('%'))) {
                  const parts = trimmed.split(/\s+/);
                  parts.forEach(p => {
                    const qtyUnit = p.match(/^(\d+(?:\.\d+)?)([A-Za-z]+)$/);
                    if (qtyUnit) {
                      mergedCells.push(qtyUnit[1]);
                      mergedCells.push(qtyUnit[2]);
                    } else {
                      mergedCells.push(p);
                    }
                  });
                  return;
                }

                // 3. Single mixed word: e.g. "1.000Unit"
                const qtyUnit = trimmed.match(/^(\d+(?:\.\d+)?)([A-Za-z]{3,10})$/);
                if (qtyUnit) {
                  mergedCells.push(qtyUnit[1]);
                  mergedCells.push(qtyUnit[2]);
                  return;
                }

                mergedCells.push(cell);
              });

              const joinedStr = mergedCells.join(' ').trim();
              if (joinedStr.length < 2) return;

              const joinedLower = joinedStr.toLowerCase();
              const isMetadataNoise = 
                joinedLower.includes('spares estimate') ||
                joinedLower.includes('customer & vehicle') ||
                joinedLower.includes('demanded repair') ||
                joinedLower.includes('registered name') ||
                joinedLower.includes('office add') ||
                joinedLower.includes('gstin') ||
                joinedLower.includes('email') ||
                joinedLower.includes('page:') ||
                joinedLower.includes('tax invoice') ||
                joinedLower.includes('proforma invoice') ||
                joinedLower.includes('job card') ||
                joinedLower.includes('jobcard') ||
                joinedLower.includes('subtotal') ||
                joinedLower.includes('grand total') ||
                joinedLower.includes('surveyor name') ||
                joinedLower.includes('authorized signatory') ||
                joinedLower.includes('hsn/sac') ||
                joinedLower.includes('sac code') ||
                joinedLower.includes('total (inr)') ||
                joinedLower.includes('estimate copy') ||
                joinedLower.includes('parts checklist') ||
                joinedLower.includes('order details');

              if (isMetadataNoise) return;

              if (isHeaderRow(mergedCells)) {
                const newMapping = extractColumnMapping(mergedCells);
                if (newMapping) {
                  columnMapping = newMapping;
                }
                return;
              }

              // Parse using centralized robust mapper
              const cellToVal = (valStr: string) => valStr ? String(valStr).trim() : '';

              // Extract parsed results using column index mapping or content heuristics
              let srVal = tempSrCounter;
              let partNumber = '';
              let partName = '';
              let qty = 1;
              let price = 0;
              let taxes = 18;
              let amount = 0;
              let unitCategory = 'PCS';

              const srMatch = (mergedCells[0] !== null && mergedCells[0] !== undefined) ? String(mergedCells[0]).trim().match(/^(\d+)$/) : null;

              if (columnMapping) {
                if (columnMapping.srIdx !== undefined && mergedCells[columnMapping.srIdx] !== undefined) {
                  const val = parseInt(cellToVal(mergedCells[columnMapping.srIdx]), 10);
                  if (!isNaN(val)) srVal = val;
                } else if (srMatch) {
                  srVal = parseInt(srMatch[1], 10);
                }

                if (columnMapping.partNumberIdx !== undefined && mergedCells[columnMapping.partNumberIdx] !== undefined) {
                  const cleaned = cellToVal(mergedCells[columnMapping.partNumberIdx])
                    .replace(/[\[\(\{\}\)\]]/g, '')
                    .trim()
                    .toUpperCase();
                  if (cleaned && cleaned !== 'N/A' && cleaned !== 'PART NUMBER' && cleaned !== 'PART NO') {
                    partNumber = cleaned;
                  }
                }

                if (columnMapping.partNameIdx !== undefined && mergedCells[columnMapping.partNameIdx] !== undefined) {
                  const val = cellToVal(mergedCells[columnMapping.partNameIdx]);
                  if (val && val !== 'ITEM NAME' && val !== 'PART NAME' && val !== 'DESCRIPTION' && val !== 'PARTICULARS') {
                    partName = val;
                  }
                }

                if (columnMapping.qtyIdx !== undefined && mergedCells[columnMapping.qtyIdx] !== undefined) {
                  const val = parseFloat(cellToVal(mergedCells[columnMapping.qtyIdx]).replace(/[^\d.]/g, ''));
                  if (!isNaN(val) && val > 0) qty = val;
                }

                if (columnMapping.priceIdx !== undefined && mergedCells[columnMapping.priceIdx] !== undefined) {
                  const val = parseFloat(cellToVal(mergedCells[columnMapping.priceIdx]).replace(/[^\d.]/g, ''));
                  if (!isNaN(val)) price = val;
                }

                if (columnMapping.amountIdx !== undefined && mergedCells[columnMapping.amountIdx] !== undefined) {
                  const val = parseFloat(cellToVal(mergedCells[columnMapping.amountIdx]).replace(/[^\d.]/g, ''));
                  if (!isNaN(val)) amount = val;
                }
              }

              // Fallback heuristic for part number if column auto-mapping wasn't successful or partsNumber was empty
              if (!partNumber) {
                let detectedPn = '';
                const hyphenPattern = /\b([A-Za-z0-9]{3,12}-[A-Za-z0-9]{1,5})\b/;
                const pureNumericPattern = /\b(\d{8,11})\b/;
                const alphanumericPattern = /\b(?=[A-Za-z]*\d)(?=\d*[A-Za-z])([A-Za-z0-9]{6,15})\b/;

                for (let i = 0; i < mergedCells.length; i++) {
                  if (columnMapping && (i === columnMapping.qtyIdx || i === columnMapping.priceIdx || i === columnMapping.amountIdx)) continue;
                  const cellText = cellToVal(mergedCells[i]);
                  const match = cellText.match(hyphenPattern) || cellText.match(pureNumericPattern) || cellText.match(alphanumericPattern);
                  if (match) {
                    const foundPn = match[1].trim();
                    const isDate = /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(foundPn);
                    const isUnitOrTax = /^(pcs|set|unit|ltr|kg|box|nos|no|qty|gst|tax|hsn|sac)\d*%?$/i.test(foundPn);
                    const isDecimalFloat = /^\d+\.\d+$/.test(foundPn);

                    if (!isDate && !isUnitOrTax && !isDecimalFloat) {
                      detectedPn = foundPn.toUpperCase();
                      break;
                    }
                  }
                }
                partNumber = detectedPn;
              }

              // Parse leftover texts as Part Name if was not clearly extracted via columns
              const cleanedCellsFromPn: string[] = [];
              mergedCells.forEach((cell, idx) => {
                if (columnMapping) {
                  if (idx === columnMapping.srIdx || idx === columnMapping.qtyIdx || idx === columnMapping.priceIdx || idx === columnMapping.amountIdx) return;
                }
                let cellText = cellToVal(cell);
                if (!cellText) return;

                if (srMatch && cellText === srMatch[1]) return;
                if (partNumber && cellText.toUpperCase().includes(partNumber)) {
                  cellText = cellText.replace(new RegExp(partNumber, 'gi'), '').trim();
                }

                const isUnit = /^(pcs|set|unit|ltr|kg|box|nos|no|qty)$/i.test(cellText);
                if (isUnit) {
                  unitCategory = cellText.toUpperCase();
                  return;
                }

                const isTax = /^\d+%\s*$/i.test(cellText) || /^gst\s*\d+%\s*$/i.test(cellText);
                if (isTax) {
                  const match = cellText.match(/(\d+)/);
                  if (match) taxes = parseInt(match[1], 10);
                  return;
                }

                const cleanNumStr = cellText.replace(/[^\d.]/g, '');
                const numVal = parseFloat(cleanNumStr);
                if (!isNaN(numVal) && numVal > 0 && cleanNumStr.length < 9) return;

                if (cellText) cleanedCellsFromPn.push(cellText);
              });

              if (!partName) {
                partName = cleanedCellsFromPn.join(' ').trim();
              }

              // Extract pure numeric fallback list if not direct column indexes mapped
              if (!price || !amount || (price <= 5 && amount > 100)) {
                const numbersInRow: number[] = [];
                mergedCells.forEach((cell, cellIdx) => {
                  if (columnMapping && (cellIdx === columnMapping.srIdx || cellIdx === columnMapping.qtyIdx || cellIdx === columnMapping.priceIdx || cellIdx === columnMapping.amountIdx)) return;
                  const cellCleanVal = cellToVal(cell);
                  if (cellCleanVal.includes('%')) return;
                  if (/^(pcs|set|unit|ltr|kg|box|nos|no|qty|hsn|sac|gst|tax)$/i.test(cellCleanVal)) return;

                  const cleanDigitsStr = cellCleanVal.replace(/[^\d.]/g, '');
                  const val = parseFloat(cleanDigitsStr);
                  if (!isNaN(val) && val > 0 && cleanDigitsStr.length < 9) {
                    numbersInRow.push(val);
                  }
                });

                if (numbersInRow.length >= 3) {
                  if (!qty) qty = numbersInRow[0];
                  if (!price) price = numbersInRow[1];
                  if (!amount) amount = numbersInRow[2];
                } else if (numbersInRow.length === 2) {
                  if (!price) price = numbersInRow[0];
                  if (!amount) amount = numbersInRow[1];
                  qty = Math.max(1, Math.round(amount / price));
                } else if (numbersInRow.length === 1) {
                  if (!price) price = numbersInRow[0];
                  amount = price * qty;
                }
              }

              if (!amount && price) {
                amount = price * qty;
              }

              // A row constitutes a new part line item if:
              // - It has an explicit Serial Number prefix
              // - Or we found an alphanumeric part number
              // - Or we have numbers like Price and Qty
              const numbersList: number[] = [];
              mergedCells.forEach((cell) => {
                const cleanDigitsStr = cellToVal(cell).replace(/[^\d.]/g, '');
                const val = parseFloat(cleanDigitsStr);
                if (!isNaN(val) && val > 0 && cleanDigitsStr.length < 9 && !cellToVal(cell).includes('%')) {
                  numbersList.push(val);
                }
              });

              const isNewItem = srMatch || (partNumber && partNumber !== 'N/A') || numbersList.length >= 2;

              if (isNewItem) {
                saveCurrentItemFallback();

                if (srMatch) {
                  srVal = parseInt(srMatch[1], 10);
                  tempSrCounter = srVal + 1;
                } else {
                  srVal = tempSrCounter;
                  tempSrCounter++;
                }

                currentItem = {
                  sr: srVal,
                  partNo: partNumber || 'N/A',
                  partName: partName || 'Automotive Component',
                  qty: qty || 1,
                  unitCategory: unitCategory || 'PCS',
                  price: price || 0,
                  taxes: taxes || 18,
                  amount: amount || ((qty || 1) * (price || 0))
                };
              } else if (currentItem) {
                const cleanJoinedStr = cleanedCellsFromPn.join(' ').trim();
                if (cleanJoinedStr.replace(/[^A-Za-z]/g, '').length > 2) {
                  currentItem.partName += ' ' + cleanJoinedStr;
                }
              }
            });
          }

          saveCurrentItemFallback();

          // Regex double-space fallback if zero items found
          if (extractedItems.length === 0) {
            const allTextLines = fullCombinedText.split('\n');
            let fallbackSrVal = 1;
            allTextLines.forEach((line) => {
              const trimmed = line.trim();
              if (trimmed.length < 5) return;
              
              const spaceCells = trimmed.split(/\s{2,}/);
              if (spaceCells.length >= 3) {
                const joinedLower = trimmed.toLowerCase();
                if (
                  joinedLower.includes('subtotal') || 
                  joinedLower.includes('grand total') || 
                  joinedLower.includes('job card') || 
                  joinedLower.includes('insurance') ||
                  joinedLower.includes('invoice') ||
                  joinedLower.includes('vehicle') ||
                  joinedLower.includes('page:')
                ) return;

                const srMatch = spaceCells[0].trim().match(/^(\d+)$/);
                let srVal = srMatch ? parseInt(srMatch[1], 10) : fallbackSrVal;
                if (!srMatch) fallbackSrVal++;
                else fallbackSrVal = srVal + 1;

                const rightCells = spaceCells.slice(srMatch ? 1 : 0);
                const numbers: number[] = [];
                let partNum = 'N/A';
                const nameWords: string[] = [];
                let unitCategory = 'PCS';

                rightCells.forEach(cell => {
                  const valTrim = cell.trim();
                  if (valTrim === '') return;
                  
                  // Robust part number candidate validation for fallback
                  const hasDigits = /[0-9]/.test(valTrim);
                  const isProbablePn = valTrim.length >= 5 && valTrim.length <= 25 && !valTrim.includes(' ') && !valTrim.includes('%');
                  const isDate = /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(valTrim);
                  const isUnitOrTax = /^(pcs|set|unit|ltr|kg|box|nos|no|qty|gst|tax|hsn|sac)\d*%?$/i.test(valTrim);
                  const isDecimalFloat = /^\d+\.\d+$/.test(valTrim);

                  if (hasDigits && isProbablePn && !isDate && !isUnitOrTax && !isDecimalFloat) {
                    partNum = valTrim.toUpperCase();
                    return;
                  }

                  const isUnit = /^(pcs|set|unit|ltr|kg|box|nos|no|qty)$/i.test(valTrim);
                  if (isUnit) {
                    unitCategory = valTrim.toUpperCase();
                    return;
                  }

                  const cleanNum = valTrim.replace(/[^\d.]/g, '');
                  const num = parseFloat(cleanNum);
                  if (!isNaN(num) && num > 0 && !valTrim.includes('%') && valTrim.replace(/[^\d.]/g, '').length === valTrim.length) {
                    numbers.push(num);
                    return;
                  }
                  
                  nameWords.push(valTrim);
                });

                if (numbers.length >= 1) {
                  let qty = 1;
                  let price = numbers[0];
                  let amount = price * qty;
                  if (numbers.length >= 2) {
                    price = numbers[0];
                    amount = numbers[1];
                    qty = Math.max(1, Math.round(amount / price));
                  }
                  if (numbers.length >= 3) {
                    qty = numbers[0];
                    price = numbers[1];
                    amount = numbers[2];
                  }

                  extractedItems.push({
                    id: Math.random().toString(36).substring(2, 9),
                    sr: srVal,
                    partNumber: partNum,
                    partName: nameWords.join(' ') || 'Automotive Component',
                    qty,
                    unitCategory,
                    price,
                    taxes: 18,
                    amount
                  });
                }
              }
            });
          }

          resolve({ extractedItems, foundDetails });
        } catch (err: any) {
          reject(err);
        }
      };
      fileReader.onerror = (e) => reject(e);
      fileReader.readAsArrayBuffer(file);
    });
  };

  const extractFullTextFromPdf = async (file: File): Promise<string> => {
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        if (event.target?.result) {
          resolve(new Uint8Array(event.target.result as ArrayBuffer));
        } else {
          reject(new Error("Empty file data"));
        }
      };
      fileReader.onerror = reject;
      fileReader.readAsArrayBuffer(file);
    });

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    let combinedText = '';
    for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
      const page = await pdf.getPage(pNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((it: any) => it.str).join(' ');
      combinedText += pageText + '\n';
    }
    return combinedText;
  };

  const handleAiPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiParseError('');
    setIsParsingAI(true);
    setAiFileName(file.name);
    setAiParsedDetails(null);
    setAiExtractedItems([]);

    try {
      // 1. Extract Full PDF text
      const rawText = await extractFullTextFromPdf(file);
      
      // 2. Call backend express proxy route
      const response = await fetch('/api/parse-estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: rawText })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze the estimate PDF.');
      }

      const data = await response.json();
      
      // Update parsed storage
      setAiParsedDetails(data.estimationDetails || {});
      const rawItems = data.items || [];
      
      // 3. Dynamic Real-time comparison with partsMaster database catalog!
      const itemsWithMasterComparison = rawItems.map((item: any) => {
        // Clean strings for robust matching
        const cleanPn = (str: string) => (str || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const extractedPnClean = cleanPn(item.partNo);
        
        let foundInMaster = false;
        let masterPrice = 0;
        let masterPartName = '';
        
        if (extractedPnClean && extractedPnClean !== 'NA' && extractedPnClean !== 'N/A') {
          const matchedItem = partsMaster.find(m => cleanPn(m.partNo) === extractedPnClean);
          if (matchedItem) {
            foundInMaster = true;
            masterPrice = matchedItem.price || 0;
            masterPartName = matchedItem.partName || '';
          }
        }
        
        // Fallback name search
        if (!foundInMaster) {
          const itemNmClean = (item.name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          const matchedItem = partsMaster.find(m => {
            const masterNmClean = (m.partName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            return itemNmClean && masterNmClean && itemNmClean === masterNmClean;
          });
          if (matchedItem) {
            foundInMaster = true;
            masterPrice = matchedItem.price || 0;
            masterPartName = matchedItem.partName || '';
          }
        }
        
        let comparisonRemarks = '';
        let matchedStatus: 'match' | 'mismatch' | 'unknown' = 'unknown';
        
        if (foundInMaster) {
          const priceDiff = Math.abs(masterPrice - (item.rate || 0));
          if (priceDiff < 1.5) {
            comparisonRemarks = "✅ Data Match: Part number & Price matched with Database Parts catalog.";
            matchedStatus = 'match';
          } else {
            comparisonRemarks = `✅ Data Match (Rate Mismatch): Part number matched but price differs (Master Price: ₹${masterPrice}, Estimate Price: ₹${item.rate}).`;
            matchedStatus = 'mismatch';
          }
        } else {
          comparisonRemarks = "❌ Data Not Match: This part number does not exist in our catalog directory.";
          matchedStatus = 'unknown';
        }
        
        // Combine any existing remarks with our database verification outcome
        const originalRemarks = item.remarks && item.remarks !== 'N/A' ? item.remarks : '';
        const combinedRemarks = originalRemarks 
          ? `${originalRemarks} | ${comparisonRemarks}`
          : comparisonRemarks;
          
        return {
          ...item,
          remarks: combinedRemarks,
          comparisonRemarks,
          matchedStatus,
          masterPrice,
          originalRemarks
        };
      });

      setAiExtractedItems(itemsWithMasterComparison);
      
      // Pre-select all items
      const selections: { [key: number]: boolean } = {};
      itemsWithMasterComparison.forEach((_: any, idx: number) => {
        selections[idx] = true;
      });
      setAiSelectedIndices(selections);

      // Auto vehicle registration selection matching
      const extractedVehNo = data.estimationDetails?.vehicleNo || '';
      if (extractedVehNo) {
        const cleanExtracted = extractedVehNo.trim().toUpperCase().replace(/\s+/g, '');
        // Search if we can find a matching existing vehicle
        const match = vehicles.find(v => v.regNo.trim().toUpperCase().replace(/\s+/g, '') === cleanExtracted);
        if (match) {
          setAiSelectedVehicleReg(match.regNo);
        } else {
          setAiSelectedVehicleReg(cleanExtracted);
        }
      }

      // Check auto save parameter or directly save
      if (aiAutoSave && itemsWithMasterComparison.length > 0) {
        let savedCount = 0;
        itemsWithMasterComparison.forEach((item) => {
          const p: PartOrder = {
            id: 'supp_' + Date.now().toString() + '_' + Math.random().toString(36).slice(2, 6) + '_' + savedCount,
            regNo: (extractedVehNo || 'CUSTOM-AI').trim().toUpperCase(),
            partNo: (item.partNo || 'N/A').toUpperCase(),
            partName: item.name,
            orderNo: 'SUPP-AI-' + Date.now().toString().slice(-6),
            orderDate: new Date().toISOString().slice(0, 10),
            qty: item.qty || 1,
            status: 'In Order',
            isSupplementary: true,
            rate: item.rate || 0,
            insuranceStatus: item.insuranceStatus || 'Pending',
            remarks: item.remarks || '',
            updatedAt: Date.now()
          };
          onSavePart(p);
          savedCount++;
        });
        addToast(`AI Auto-Save: Clean-scanned & saved ${savedCount} spare parts directly to database!`, 'success');
      } else {
        addToast("Spares Estimate scanned & compared with Part Master successfully!", "success");
      }

    } catch (err: any) {
      console.error(err);
      setAiParseError(err.message || 'Error occurred during AI PDF estimation scanning.');
      addToast(err.message || "Failed to parse estimate PDF.", "warning");
    } finally {
      setIsParsingAI(false);
    }
  };

  const handleSaveSelectedAI = () => {
    const activeReg = aiSelectedVehicleReg || aiParsedDetails?.vehicleNo || 'UNKNOWN';
    if (!activeReg) {
      alert("Please select or enter a valid vehicle registration number.");
      return;
    }

    const itemsToSave = aiExtractedItems.filter((_, idx) => aiSelectedIndices[idx]);
    if (itemsToSave.length === 0) {
      alert("No parts or labor items are selected for saving.");
      return;
    }

    let savedCount = 0;
    itemsToSave.forEach((item) => {
      const isLabor = item.type === 'labor';
      const p: PartOrder = {
        id: 'supp_' + Date.now().toString() + '_' + Math.random().toString(36).slice(2, 6) + '_' + savedCount,
        regNo: activeReg.trim().toUpperCase(),
        partNo: isLabor ? 'LABOR' : (item.partNo || 'N/A').toUpperCase(),
        partName: item.name,
        orderNo: 'SUPP-AI-' + Date.now().toString().slice(-6),
        orderDate: new Date().toISOString().slice(0, 10),
        qty: item.qty || 1,
        status: isLabor ? 'Received' : 'In Order',
        isSupplementary: true,
        rate: item.rate || 0,
        insuranceStatus: item.insuranceStatus || 'Pending',
        remarks: item.remarks || '',
        updatedAt: Date.now()
      };
      onSavePart(p);
      savedCount++;
    });

    addToast(`Successfully saved ${savedCount} entries (parts/labor) to Supplementary Register!`, 'success');
    
    // Clear selections so they aren't double saved
    const clearedSelections: { [key: number]: boolean } = {};
    aiExtractedItems.forEach((_, idx) => {
      if (!aiSelectedIndices[idx]) {
        clearedSelections[idx] = false;
      }
    });
    setAiSelectedIndices(clearedSelections);
  };

  const handlePrimaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPrimaryFileName(file.name);
    setIsParsingPrimary(true);
    try {
      const res = await parsePdfFile(file);
      setPrimaryItems(res.extractedItems);
      
      // Auto pre-populate if found
      if (res.foundDetails.customerName) setCompCustomer(res.foundDetails.customerName);
      if (res.foundDetails.vehicleNo) setCompVehicle(res.foundDetails.vehicleNo);
      if (res.foundDetails.insuranceCompany) setCompInsurance(res.foundDetails.insuranceCompany);
      if (res.foundDetails.surveyorName) setCompSurveyor(res.foundDetails.surveyorName);
    } catch (err: any) {
      alert("Error parsing primary PDF: " + err.message);
    } finally {
      setIsParsingPrimary(false);
    }
  };

  const handleSecondaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSecondaryFileName(file.name);
    setIsParsingSecondary(true);
    try {
      const res = await parsePdfFile(file);
      setSecondaryItems(res.extractedItems);
      
      // Auto pre-populate if not yet filled
      if (res.foundDetails.customerName && !compCustomer) setCompCustomer(res.foundDetails.customerName);
      if (res.foundDetails.vehicleNo && !compVehicle) setCompVehicle(res.foundDetails.vehicleNo);
      if (res.foundDetails.insuranceCompany && !compInsurance) setCompInsurance(res.foundDetails.insuranceCompany);
      if (res.foundDetails.surveyorName && !compSurveyor) setCompSurveyor(res.foundDetails.surveyorName);
    } catch (err: any) {
      alert("Error parsing secondary PDF: " + err.message);
    } finally {
      setIsParsingSecondary(false);
    }
  };

  const comparedItems = useMemo(() => {
    if (secondaryItems.length === 0) return [];
    
    const cleanStr = (s: string) => {
      if (!s) return '';
      return s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    };

    const primaryPartNumbersClean = primaryItems
      .map(item => cleanStr(item.partNumber))
      .filter(pn => pn !== '' && pn !== 'NA' && pn !== 'N/A');

    const primaryPartNamesClean = primaryItems
      .map(item => cleanStr(item.partName))
      .filter(name => name !== '');

    return secondaryItems.map((item, index) => {
      const itemPnClean = cleanStr(item.partNumber);
      const itemNmClean = cleanStr(item.partName);
      
      let isMatched = false;
      if (itemPnClean && itemPnClean !== 'NA' && itemPnClean !== 'N/A') {
        isMatched = primaryPartNumbersClean.includes(itemPnClean);
      }
      if (!isMatched && itemNmClean) {
        isMatched = primaryPartNamesClean.includes(itemNmClean);
      }

      return {
        ...item,
        sr: index + 1,
        matchStatus: isMatched ? 'match' : 'mismatch'
      };
    });
  }, [primaryItems, secondaryItems]);

  const exportComparisonToExcel = () => {
    const cols = [
      'S.No',
      'Part Number',
      'Spare Part Particle',
      'Quantity',
      'Rate (₹)',
      'Amount (₹)',
      'Comparison Audit Status'
    ];

    const rows = comparedItems.map((item, idx) => [
      idx + 1,
      item.partNumber || '—',
      item.partName || '',
      item.qty || 1,
      item.price || 0,
      (item.price || 0) * (item.qty || 1),
      item.matchStatus === 'match' 
        ? '✔️ Match with Primary Estimate' 
        : '❌ Not in Primary Estimate'
    ]);

    const metadataRows = [
      ['Estimation Comparison Audit Report'],
      ['Customer Name', compCustomer || 'N/A'],
      ['Vehicle No', compVehicle || 'N/A'],
      ['Insurance Company', compInsurance || 'N/A'],
      ['Surveyor Name', compSurveyor || 'N/A'],
      [], // separator
    ];

    const ws = XLSX.utils.aoa_to_sheet([...metadataRows, cols, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Compared Estimate Audit');
    XLSX.writeFile(wb, `Estimate_Comparison_${compVehicle || 'Audit'}.xlsx`);
  };

  const handlePrintComparison = () => {
    const tableRows = comparedItems.map((it) => {
      const isMatch = it.matchStatus === 'match';
      const statusText = isMatch ? '✔️ Match with Primary Estimate' : '❌ Not in Primary Estimate';
      const statusColor = isMatch ? '#16A34A' : '#EF4444';
      const statusBg = isMatch ? '#F0FDF4' : '#FEF2F2';
      
      return `
        <tr style="${!isMatch ? 'background-color: #FEF2F2;' : ''}">
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #E5E7EB; font-family: monospace;">${it.sr}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; font-family: monospace; font-weight: bold; color: #1F2937;">${it.partNumber || 'N/A'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; font-weight: 500; color: #111827;">${it.partName}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #E5E7EB; font-weight: bold;">${it.qty}</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #E5E7EB; font-family: monospace;">₹${it.price.toLocaleString('en-IN')}</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #E5E7EB; font-weight: bold; font-family: monospace; color: #111827;">₹${(it.qty * it.price).toLocaleString('en-IN')}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #E5E7EB; font-weight: bold;">
            <span style="color: ${statusColor}; background: ${statusBg}; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
              ${statusText}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    const fullPrintDocHtml = `
      <html>
        <head>
          <title>Supplementary Estimation Comparison — HARMAN AUTO BOT</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
            @media print {
              body { background: white !important; color: black !important; padding: 0 !important; }
              .no-print { display: none !important; }
              .card { box-shadow: none !important; border: none !important; padding: 0 !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            body { background: #f1f5f9; font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1f2937; padding: 40px; margin: 0; }
            .card { background: white; border-radius: 16px; border: 1px solid #e5e7eb; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); max-w: 220mm; margin: 0 auto; padding: 40px; box-sizing: border-box; }
            .header-strip { border-bottom: 4px solid #16a34a; padding-bottom: 24px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
            .brand-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 32px; color: #16a34a; margin: 0; }
            .brand-subtitle { font-size: 11px; color: #4b5563; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin-top: 4px; }
            .quote-badge { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; font-weight: 700; text-transform: uppercase; padding: 6px 12px; border-radius: 6px; font-size: 11px; letter-spacing: 1px; display: inline-block; }
            .meta-grid { display: grid; grid-template-cols: repeat(2, 1fr); gap: 15px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 30px; font-size: 13px; }
            .meta-label { color: #6b7280; font-size: 10px; font-weight: 600; text-transform: uppercase; }
            .meta-value { font-weight: bold; color: #111827; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f3f4f6; padding: 12px 10px; font-size: 11px; text-transform: uppercase; color: #4b5563; border-bottom: 2px solid #e5e7eb; letter-spacing: 0.5px; }
            td { padding: 12px 10px; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header-strip">
              <div>
                <h1 class="brand-title">Harman Auto Bot</h1>
                <div class="brand-subtitle">Estimation Comparison Report</div>
              </div>
              <div class="quote-badge">Audit Log</div>
            </div>
            
            <div class="meta-grid">
              <div>
                <div class="meta-label">Customer Name / ग्राहक का नाम</div>
                <div class="meta-value">${compCustomer || 'N/A'}</div>
              </div>
              <div>
                <div class="meta-label">Vehicle No / गाड़ी नंबर</div>
                <div class="meta-value" style="font-family: monospace; font-size: 14px;">${compVehicle || 'N/A'}</div>
              </div>
              <div>
                <div class="meta-label">Insurance Company / बीमा कंपनी</div>
                <div class="meta-value">${compInsurance || 'N/A'}</div>
              </div>
              <div>
                <div class="meta-label">Surveyor Name / सर्वेयर का नाम</div>
                <div class="meta-value">${compSurveyor || 'N/A'}</div>
              </div>
            </div>

            <table style="width: 100%; text-align: left;">
              <thead>
                <tr>
                  <th style="text-align: center; width: 40px;">S.No</th>
                  <th>Part Number</th>
                  <th>Spare Part Particle</th>
                  <th style="text-align: center; width: 50px;">Qty</th>
                  <th style="text-align: right; width: 100px;">Rate</th>
                  <th style="text-align: right; width: 120px;">Amount</th>
                  <th style="text-align: center; width: 220px;">Audit Status</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: right; font-size: 12px; color: #4b5563;">
              Report compiled automatically by Harman PDF Multi-Toolbox. Page 1 of 1
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(fullPrintDocHtml);
      printWindow.document.close();
    } else {
      alert("Popup blocked! Please allow popups for printing or use the Download option.");
    }
  };

  const handleDownloadComparisonHTML = () => {
    const tableRows = comparedItems.map((it) => {
      const isMatch = it.matchStatus === 'match';
      const statusText = isMatch ? '✔️ Match with Primary Estimate' : '❌ Not in Primary Estimate';
      const statusColor = isMatch ? '#16A34A' : '#EF4444';
      const statusBg = isMatch ? '#F0FDF4' : '#FEF2F2';
      
      return `
        <tr style="${!isMatch ? 'background-color: #FEF2F2;' : ''}">
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #E5E7EB; font-family: monospace;">${it.sr}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; font-family: monospace; font-weight: bold; color: #1F2937;">${it.partNumber || 'N/A'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; font-weight: 500; color: #111827;">${it.partName}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #E5E7EB; font-weight: bold;">${it.qty}</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #E5E7EB; font-family: monospace;">₹${it.price.toLocaleString('en-IN')}</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #E5E7EB; font-weight: bold; font-family: monospace; color: #111827;">₹${(it.qty * it.price).toLocaleString('en-IN')}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #E5E7EB; font-weight: bold;">
            <span style="color: ${statusColor}; background: ${statusBg}; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
              ${statusText}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    const fullPrintDocHtml = `
      <html>
        <head>
          <title>Supplementary Estimation Comparison — HARMAN AUTO BOT</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
            body { background: #f1f5f9; font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1f2937; padding: 40px; margin: 0; }
            .card { background: white; border-radius: 16px; border: 1px solid #e5e7eb; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); max-w: 220mm; margin: 0 auto; padding: 40px; box-sizing: border-box; }
            .header-strip { border-bottom: 4px solid #16a34a; padding-bottom: 24px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
            .brand-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 32px; color: #16a34a; margin: 0; }
            .brand-subtitle { font-size: 11px; color: #4b5563; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin-top: 4px; }
            .quote-badge { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; font-weight: 700; text-transform: uppercase; padding: 6px 12px; border-radius: 6px; font-size: 11px; letter-spacing: 1px; display: inline-block; }
            .meta-grid { display: grid; grid-template-cols: repeat(2, 1fr); gap: 15px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 30px; font-size: 13px; }
            .meta-label { color: #6b7280; font-size: 10px; font-weight: 600; text-transform: uppercase; }
            .meta-value { font-weight: bold; color: #111827; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f3f4f6; padding: 12px 10px; font-size: 11px; text-transform: uppercase; color: #4b5563; border-bottom: 2px solid #e5e7eb; letter-spacing: 0.5px; }
            td { padding: 12px 10px; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header-strip">
              <div>
                <h1 class="brand-title">Harman Auto Bot</h1>
                <div class="brand-subtitle">Estimation Comparison Report</div>
              </div>
              <div class="quote-badge">Audit Log</div>
            </div>
            
            <div class="meta-grid">
              <div>
                <div class="meta-label">Customer Name / ग्राहक का नाम</div>
                <div class="meta-value">${compCustomer || 'N/A'}</div>
              </div>
              <div>
                <div class="meta-label">Vehicle No / गाड़ी नंबर</div>
                <div class="meta-value" style="font-family: monospace; font-size: 14px;">${compVehicle || 'N/A'}</div>
              </div>
              <div>
                <div class="meta-label">Insurance Company / बीमा कंपनी</div>
                <div class="meta-value">${compInsurance || 'N/A'}</div>
              </div>
              <div>
                <div class="meta-label">Surveyor Name / सर्वेयर का नाम</div>
                <div class="meta-value">${compSurveyor || 'N/A'}</div>
              </div>
            </div>

            <table style="width: 100%; text-align: left;">
              <thead>
                <tr>
                  <th style="text-align: center; width: 40px;">S.No</th>
                  <th>Part Number</th>
                  <th>Spare Part Particle</th>
                  <th style="text-align: center; width: 50px;">Qty</th>
                  <th style="text-align: right; width: 100px;">Rate</th>
                  <th style="text-align: right; width: 120px;">Amount</th>
                  <th style="text-align: center; width: 220px;">Audit Status</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: right; font-size: 12px; color: #4b5563;">
              Report compiled automatically by Harman PDF Multi-Toolbox. Page 1 of 1
            </div>
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([fullPrintDocHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Estimate_Comparison_${compVehicle || 'Report'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Watch Trigger props from Parent Header buttons
  useEffect(() => {
    if (addTrigger > 0) {
      handleOpenAddModal();
    }
  }, [addTrigger]);

  useEffect(() => {
    if (exportTrigger > 0) {
      exportSupplementarySpreadsheet();
    }
  }, [exportTrigger]);

  const canWrite = currentUser.canWrite;
  const canDelete = currentUser.canDelete;

  // Filter Parts that are supplementary
  const supplementaryParts = useMemo(() => {
    return parts.filter(p => !p.isDeleted && p.isSupplementary);
  }, [parts]);

  // Aggregate statistics
  const stats = useMemo(() => {
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCost = 0;
    let approvedCost = 0;

    supplementaryParts.forEach(p => {
      const rowCost = p.qty * (p.rate || 0);
      if (p.insuranceStatus === 'Approved') {
        approvedCount++;
        approvedCost += rowCost;
      } else if (p.insuranceStatus === 'Rejected') {
        rejectedCount++;
      } else {
        pendingCount++;
        pendingCost += rowCost;
      }
    });

    return {
      totalItems: supplementaryParts.length,
      pendingCount,
      approvedCount,
      rejectedCount,
      pendingCost,
      approvedCost,
      totalCost: approvedCost + pendingCost
    };
  }, [supplementaryParts]);

  // Unique list of vehicles in supplementary parts for filtering
  const uniqueVehiclesWithSupp = useMemo(() => {
    const set = new Set<string>();
    supplementaryParts.forEach(p => {
      if (p.regNo) set.add(p.regNo.toUpperCase());
    });
    return Array.from(set).sort();
  }, [supplementaryParts]);

  // Filtered List
  const filteredList = useMemo(() => {
    return supplementaryParts.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = q === '' || [
        p.regNo,
        p.partNo || '',
        p.partName,
        p.remarks || '',
        p.orderNo || ''
      ].some(field => field.toLowerCase().includes(q));

      const matchVehicle = filterVehicle === 'All' || p.regNo.toUpperCase() === filterVehicle.toUpperCase();
      const matchInsurance = filterInsurance === 'All' || (p.insuranceStatus || 'Pending') === filterInsurance;
      const matchProcurement = filterProcurement === 'All' || p.status === filterProcurement;

      return matchSearch && matchVehicle && matchInsurance && matchProcurement;
    }).sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [supplementaryParts, searchQuery, filterVehicle, filterInsurance, filterProcurement]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPage]);

  const handleOpenAddModal = () => {
    if (!canWrite) {
      alert("You don't have write permissions authorized.");
      return;
    }
    const activeVehs = vehicles.filter(v => !v.isDeleted && v.status !== 'Delivered');
    setSelectedVehicleReg(activeVehs.length > 0 ? activeVehs[0].regNo : '');
    setFormRows([
      { partNo: '', partName: '', qty: 1, rate: 0, insuranceStatus: 'Pending', status: 'In Order', remarks: '' }
    ]);
    setModalMode('create');
    setEditingPartId(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: PartOrder) => {
    if (!canWrite) {
      alert("You don't have write permissions authorized.");
      return;
    }
    setSelectedVehicleReg(p.regNo);
    setFormRows([
      {
        partNo: p.partNo || '',
        partName: p.partName,
        qty: p.qty,
        rate: p.rate || 0,
        insuranceStatus: (p.insuranceStatus as any) || 'Pending',
        status: p.status,
        remarks: p.remarks || ''
      }
    ]);
    setModalMode('edit');
    setEditingPartId(p.id);
    setIsModalOpen(true);
  };

  const handleAddRow = () => {
    setFormRows(prev => [
      ...prev,
      { partNo: '', partName: '', qty: 1, rate: 0, insuranceStatus: 'Pending', status: 'In Order', remarks: '' }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (formRows.length <= 1) {
      alert("At least one parts row must be defined in the entry form.");
      return;
    }
    setFormRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof SupplementaryFormRow, value: any) => {
    setFormRows(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value
      };
      return next;
    });
  };

  const selectCatalogItem = (index: number, m: PartsMasterItem) => {
    setFormRows(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        partNo: m.partNo,
        partName: m.partName,
        rate: m.price
      };
      return next;
    });
    setActiveSearchIndex(null);
    setCatalogSearchText('');
  };

  const filteredMasterCatalog = useMemo(() => {
    if (!catalogSearchText) return [];
    const q = catalogSearchText.toLowerCase();
    return partsMaster.filter(p => 
      p.partNo.toLowerCase().includes(q) || 
      p.partName.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [partsMaster, catalogSearchText]);

  const handleSave = () => {
    if (!selectedVehicleReg) {
      alert("Please choose a vehicle registration first.");
      return;
    }

    // Validation
    for (let i = 0; i < formRows.length; i++) {
      const r = formRows[i];
      if (!r.partName.trim()) {
        alert(`Part Description at index ${i + 1} cannot be empty!`);
        return;
      }
      if (r.qty <= 0) {
        alert(`Quantity at index ${i + 1} must be positive.`);
        return;
      }
    }

    if (modalMode === 'create') {
      // Save all multi-rows
      formRows.forEach(r => {
        const p: PartOrder = {
          id: 'supp_' + Date.now().toString() + '_' + Math.random().toString(36).slice(2, 6),
          regNo: selectedVehicleReg,
          partNo: r.partNo.trim().toUpperCase(),
          partName: r.partName.trim(),
          orderNo: 'SUPP-' + Date.now().toString().slice(-6),
          orderDate: new Date().toISOString().slice(0, 10),
          qty: r.qty,
          status: r.status,
          eta: '',
          isSupplementary: true,
          rate: r.rate,
          insuranceStatus: r.insuranceStatus,
          remarks: r.remarks,
          updatedAt: Date.now()
        };
        onSavePart(p);
      });
      addToast(`Successfully saved ${formRows.length} item(s) to the supplementary database!`, 'success');
    } else {
      // Edit mode (single item edit)
      const r = formRows[0];
      if (editingPartId) {
        const original = parts.find(x => x.id === editingPartId);
        const p: PartOrder = {
          ...original,
          id: editingPartId,
          regNo: selectedVehicleReg,
          partNo: r.partNo.trim().toUpperCase(),
          partName: r.partName.trim(),
          qty: r.qty,
          status: r.status,
          isSupplementary: true,
          rate: r.rate,
          insuranceStatus: r.insuranceStatus,
          remarks: r.remarks,
          updatedAt: Date.now()
        } as PartOrder;
        onSavePart(p);
        addToast(`Successfully updated part entry: "${p.partName}"`, 'success');
      }
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!canDelete) {
      alert("You don't have delete credentials authorized.");
      return;
    }
    if (confirm("Are you sure you want to delete this supplementary part item?")) {
      onDeletePart(id);
    }
  };

  const exportSupplementarySpreadsheet = () => {
    const cols = [
      'S.No',
      'Vehicle Reg No',
      'Part Number',
      'Spare Part Particle',
      'Quantity Requested',
      'Unit MRP Rate (₹)',
      'Total Net Value (₹)',
      'Date Initiated',
      'Insurance Approval Status',
      'Procurement State',
      'Reference ID',
      'Custom Remarks'
    ];

    const rows = filteredList.map((p, idx) => [
      idx + 1,
      p.regNo || '—',
      p.partNo || '—',
      p.partName || '',
      p.qty || 0,
      p.rate || 0,
      p.qty * (p.rate || 0),
      p.orderDate || '',
      p.insuranceStatus || 'Pending',
      p.status || '',
      p.id || '',
      p.remarks || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Supplementary Inventory Logs');
    XLSX.writeFile(wb, `Supplementary_Spare_Parts_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const activeNonDeliveredVehicles = useMemo(() => {
    return vehicles.filter(v => !v.isDeleted && v.status !== 'Delivered');
  }, [vehicles]);

  return (
    <div className="space-y-6">
      
      {/* Dynamic Sub-Tabs Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#12182d] border border-[#1d2c4e] rounded-xl p-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-fuchsia-400" />
          <div>
            <h1 className="text-sm font-black text-slate-100 uppercase tracking-wider font-sans">Supplementary Portal (पूरक पोर्टल)</h1>
            <p className="text-[10px] text-slate-400 font-sans">Automated supplementary, auditing, and AI extraction workspace</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center bg-[#070913] p-1.5 rounded-lg border border-[#1d2c4e] self-start sm:self-auto gap-1">
          <button
            onClick={() => setSubView('comparison')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              subView === 'comparison'
                ? 'bg-fuchsia-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚖️ Estimate Comparison
          </button>
          
          <button
            onClick={() => setSubView('ai-parser')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              subView === 'ai-parser'
                ? 'bg-fuchsia-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-300" /> AI Estimate Parser
          </button>

          <button
            onClick={() => setSubView('logs')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              subView === 'logs'
                ? 'bg-fuchsia-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📋 Supplementary Register
          </button>
        </div>
      </div>

      {subView === 'logs' && (
        <>
          {/* 1. STATISTICS DASH BOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Items count */}
        <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4 flex items-start gap-3.5 transition-all hover:border-fuchsia-500/20">
          <div className="bg-fuchsia-500/10 text-fuchsia-400 p-2.5 rounded-lg flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-widest">Total Supplementary Demands</div>
            <div className="text-2xl font-black text-slate-100 mt-1">{stats.totalItems}</div>
            <div className="text-[10px] text-slate-500 font-sans mt-1">Pending: {stats.pendingCount} | Approved: {stats.approvedCount}</div>
          </div>
        </div>

        {/* Approved Cost */}
        <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4 flex items-start gap-3.5 transition-all hover:border-emerald-500/20">
          <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-lg flex-shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-widest">Approved Spares Total Cost</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">₹{stats.approvedCost.toLocaleString('en-IN')}</div>
            <div className="text-[10px] text-slate-500 font-sans mt-1">Insurance certified spares budget</div>
          </div>
        </div>

        {/* Pending Approval Cost */}
        <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4 flex items-start gap-3.5 transition-all hover:border-amber-500/20">
          <div className="bg-[#ffaa00]/10 text-amber-500 p-2.5 rounded-lg flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-widest">Pending Approv Value</div>
            <div className="text-2xl font-black text-amber-500 mt-1">₹{stats.pendingCost.toLocaleString('en-IN')}</div>
            <div className="text-[10px] text-slate-500 font-sans mt-1">Awaiting surveyor clearance: {stats.pendingCount} items</div>
          </div>
        </div>

        {/* Cumulative Budget */}
        <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4 flex items-start gap-3.5 transition-all hover:border-indigo-500/20">
          <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-lg flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-widest">Cumulative Sum Value</div>
            <div className="text-2xl font-black text-indigo-400 mt-1">₹{stats.totalCost.toLocaleString('en-IN')}</div>
            <div className="text-[10px] text-slate-500 font-sans mt-1">Approved + Pending supplementary</div>
          </div>
        </div>

      </div>

      {/* 2. CONTROL FILTERS BAR */}
      <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row gap-3.5 items-center justify-between">
          
          {/* Left search */}
          <div className="relative w-full lg:max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search by Vehicle Reg, Part No, Description..."
              className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 outline-none focus:border-fuchsia-500 transition-all font-sans"
            />
          </div>

          {/* Right filters */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Filter Vehicle */}
            <div className="flex-1 min-w-[125px]">
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Filter by vehicle</label>
              <select
                value={filterVehicle}
                onChange={(e) => { setFilterVehicle(e.target.value); setCurrentPage(1); }}
                className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg text-slate-300 py-1.5 px-3 text-xs outline-none focus:border-fuchsia-500 cursor-pointer font-sans"
              >
                <option value="All">All Vehicles (सारे)</option>
                {uniqueVehiclesWithSupp.map(veh => (
                  <option key={veh} value={veh}>{veh}</option>
                ))}
              </select>
            </div>

            {/* Filter Insurance Status */}
            <div className="flex-1 min-w-[125px]">
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Insurance Approval</label>
              <select
                value={filterInsurance}
                onChange={(e) => { setFilterInsurance(e.target.value); setCurrentPage(1); }}
                className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg text-slate-300 py-1.5 px-3 text-xs outline-none focus:border-fuchsia-500 cursor-pointer font-sans"
              >
                <option value="All">All Approvals</option>
                <option value="Approved">Approved (पास)</option>
                <option value="Pending">Pending (अटकी)</option>
                <option value="Rejected">Rejected (रद्द है)</option>
              </select>
            </div>

            {/* Filter Procurement */}
            <div className="flex-1 min-w-[125px]">
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Procurement Supply</label>
              <select
                value={filterProcurement}
                onChange={(e) => { setFilterProcurement(e.target.value); setCurrentPage(1); }}
                className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg text-slate-300 py-1.5 px-3 text-xs outline-none focus:border-fuchsia-500 cursor-pointer font-sans"
              >
                <option value="All">All Orders</option>
                <option value="In Order">In Order (मांग की गई)</option>
                <option value="In Transit">In Transit (रास्ते में)</option>
                <option value="Received">Received (प्राप्त)</option>
              </select>
            </div>

            {/* Reset Filters */}
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterVehicle('All');
                setFilterInsurance('All');
                setFilterProcurement('All');
                setCurrentPage(1);
              }}
              className="mt-4 bg-[#19233f] text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs transition-all font-sans hover:bg-slate-700 font-bold border border-slate-700/60"
            >
              Reset
            </button>
          </div>

        </div>
      </div>

      {/* 3. PARTS LIST LEDGER */}
      <div className="bg-[#11162d] border border-[#1b2647] rounded-xl overflow-hidden">
        <div className="p-4 bg-[#151c35] border-b border-[#1d2c4e] flex items-center justify-between flex-wrap gap-2">
          <span className="text-slate-300 text-xs font-bold font-sans uppercase">
            Supplementary Catalog Logbooks ({filteredList.length} items matched)
          </span>
          <button
            onClick={exportSupplementarySpreadsheet}
            className="bg-transparent text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] font-sans font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export ledger (.xlsx)
          </button>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          {filteredList.length === 0 ? (
            <div className="text-center py-24">
              <Layers className="w-10 h-10 text-slate-600 mx-auto stroke-1" />
              <p className="text-slate-400 text-xs font-sans mt-3">No matching supplementary parts items found in inventory systems.</p>
              {canWrite && (
                <button
                  onClick={handleOpenAddModal}
                  className="mt-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-semibold shadow-lg text-xs px-4 py-2 rounded-lg font-sans transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Log supplementary demand
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-sans">
              <thead>
                <tr className="bg-[#0b1021] text-[10px] text-slate-400 uppercase tracking-wider font-extrabold border-b border-[#1c2a4f]">
                  <th className="py-3 px-4 text-center w-12">S.No</th>
                  <th className="py-3 px-4">Vehicle No</th>
                  <th className="py-3 px-4">Part Details</th>
                  <th className="py-3 px-4 text-center w-16">Qty</th>
                  <th className="py-3 px-4 text-right w-24">MRP Unit</th>
                  <th className="py-3 px-4 text-right w-28">Net Amount</th>
                  <th className="py-3 px-4 text-center w-32">Insurance Status</th>
                  <th className="py-3 px-4 text-center w-32">Procurement State</th>
                  <th className="py-3 px-4 w-40">Remarks / Order No</th>
                  {canWrite && <th className="py-3 px-4 text-center w-24">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4a]/45 text-slate-300 text-xs">
                {paginatedList.map((item, index) => {
                  const sNo = (currentPage - 1) * itemsPerPage + index + 1;
                  const itemAmount = item.qty * (item.rate || 0);
                  
                  return (
                    <tr key={item.id} className="hover:bg-fuchsia-500/[0.015] transition-all">
                      {/* S.No */}
                      <td className="py-3 px-4 text-center text-slate-500 font-mono text-[10px]">{sNo}</td>
                      
                      {/* Vehicle Reg */}
                      <td className="py-3 px-4 font-bold text-slate-100 uppercase tracking-wider">
                        <span className="bg-[#060811] border border-[#1b2b51] py-1 px-2 rounded-md font-mono text-[11px] inline-block tracking-wide">
                          🚗 {item.regNo}
                        </span>
                      </td>

                      {/* Part details */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-200">{item.partName}</div>
                        {item.partNo ? (
                          <div className="text-[10px] text-blue-400 font-mono mt-0.5 tracking-wider uppercase font-bold">PN: {item.partNo}</div>
                        ) : (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">— Code</div>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4 text-center font-bold font-mono">
                        {item.qty}
                      </td>

                      {/* Rate */}
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        ₹{(item.rate || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-4 text-right font-bold text-fuchsia-400 font-mono">
                        ₹{itemAmount.toLocaleString('en-IN')}
                      </td>

                      {/* Insurance approval */}
                      <td className="py-3 px-4 text-center">
                        {item.insuranceStatus === 'Approved' ? (
                          <span className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-0.5 px-2 rounded text-[10px] font-extrabold uppercase">
                            ✔️ Approved (पास)
                          </span>
                        ) : item.insuranceStatus === 'Rejected' ? (
                          <span className="inline-block bg-rose-500/10 text-rose-400 border border-rose-500/20 py-0.5 px-2 rounded text-[10px] font-extrabold uppercase">
                            ❌ Rejected (रद्द)
                          </span>
                        ) : (
                          <span className="inline-block bg-amber-500/10 text-amber-500 border border-amber-500/20 py-0.5 px-2 rounded text-[10px] font-extrabold uppercase tracking-wide">
                            ⏳ Pending (लंबित)
                          </span>
                        )}
                      </td>

                      {/* Procurement supply status */}
                      <td className="py-3 px-4 text-center">
                        {item.status === 'Received' ? (
                          <span className="inline-block bg-green-600/15 text-green-400 border border-green-650/40 py-0.5 px-2 rounded text-[10px] font-extrabold uppercase">
                            ✓ Received
                          </span>
                        ) : item.status === 'In Transit' ? (
                          <span className="inline-block bg-blue-500/10 text-blue-400 border border-blue-500/25 py-0.5 px-2 rounded text-[10px] font-semibold uppercase flex items-center justify-center gap-1 animate-pulse">
                            <Truck className="w-3 h-3" /> In Transit
                          </span>
                        ) : (
                          <span className="inline-block bg-[#1f2845] text-slate-300 border border-[#2d3a66] py-0.5 px-2 rounded text-[10px] font-medium uppercase">
                            🛒 In Order
                          </span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="py-3 px-4 text-slate-400 text-xs">
                        <div className="font-mono text-[10px] font-semibold text-slate-500">{item.orderNo || '—'}</div>
                        {item.remarks ? (
                          <p className="mt-0.5 italic text-[11px]" title={item.remarks}>{item.remarks}</p>
                        ) : (
                          <span className="text-slate-600 italic mt-0.5 text-[10px]">No additional comments</span>
                        )}
                      </td>

                      {/* Actions */}
                      {canWrite && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="bg-[#19233f] text-blue-400 hover:text-white hover:bg-blue-600 p-1 rounded transition-all cursor-pointer"
                              title="Edit Row"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="bg-[#19233f] text-rose-500 hover:text-white hover:bg-rose-600 p-1 rounded transition-all cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 4. PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div className="bg-[#131932] border-t border-[#203159] p-4 flex items-center justify-between font-sans">
            <span className="text-slate-400 text-xs">
              Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredList.length)} of {filteredList.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="bg-[#0a0d1a] border border-[#213054] text-slate-300 p-1 px-2 rounded disabled:opacity-40 select-none cursor-pointer text-xs"
              >
                Previous
              </button>
              <span className="text-slate-200 text-xs font-bold font-mono">{currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="bg-[#0a0d1a] border border-[#213054] text-slate-300 p-1 px-2 rounded disabled:opacity-40 select-none cursor-pointer text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {subView === 'comparison' && (
        <div className="space-y-6">
          {/* Comparison Tool Workspace */}
          <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#1d2c4e] pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center flex-wrap gap-2">
                  <Sparkles className="w-5 h-5 text-fuchsia-400" />
                  <span>Estimate Comparison & Audit Workspace (तुलना टूल)</span>
                  {(isParsingPrimary || isParsingSecondary) && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                      Parsing PDF...
                    </span>
                  )}
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Upload Primary and Secondary estimate PDFs. The system automatically highlights match discrepancies line-by-line of the parts lists.
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handlePrintComparison}
                  disabled={comparedItems.length === 0}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print Quotation Report
                </button>
                <button
                  onClick={handleDownloadComparisonHTML}
                  disabled={comparedItems.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Download HTML Report
                </button>
                <button
                  onClick={exportComparisonToExcel}
                  disabled={comparedItems.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Export Excel
                </button>
              </div>
            </div>

            {/* Editable Meta fields same as Quotation details */}
            <div className="bg-[#0b0e1e] border border-[#1d2c4e] rounded-xl p-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1">
                <span>📋 Customer & Vehicle Quotation Details (ग्राहक एवं गाड़ी जानकारी)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={compCustomer}
                    onChange={(e) => setCompCustomer(e.target.value)}
                    placeholder="Auto-extracted or Manual..."
                    className="w-full bg-[#12182d] border border-[#1d2f5a] rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-fuchsia-500 transition-all font-sans"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Vehicle No</label>
                  <input
                    type="text"
                    value={compVehicle}
                    onChange={(e) => setCompVehicle(e.target.value)}
                    placeholder="Auto-extracted or Manual..."
                    className="w-full bg-[#12182d] border border-[#1d2f5a] rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-fuchsia-500 transition-all font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Insurance Company</label>
                  <input
                    type="text"
                    value={compInsurance}
                    onChange={(e) => setCompInsurance(e.target.value)}
                    placeholder="Auto-extracted or Manual..."
                    className="w-full bg-[#12182d] border border-[#1d2f5a] rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-fuchsia-500 transition-all font-sans"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Surveyor Name</label>
                  <input
                    type="text"
                    value={compSurveyor}
                    onChange={(e) => setCompSurveyor(e.target.value)}
                    placeholder="Auto-extracted or Manual..."
                    className="w-full bg-[#12182d] border border-[#1d2f5a] rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-fuchsia-500 transition-all font-sans"
                  />
                </div>
              </div>
            </div>

            {/* Comparison Upload Areas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* PRIMARY ESTIMATE */}
              <div className="bg-[#141a35] border border-[#1d2c4e] rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-0.5 px-2 rounded text-[10px] font-extrabold uppercase tracking-widest">
                    Step 1: Primary Basis
                  </span>
                  <h3 className="text-sm font-bold text-slate-200 mt-2">Primary Estimate (मूल अनुमान)</h3>
                  <p className="text-slate-400 text-xs mt-1">Upload the core approved or initial insurance assessment estimate spreadsheet / PDF.</p>
                </div>

                <div className="mt-4">
                  {isParsingPrimary ? (
                    <div className="py-6 text-center animate-pulse">
                      <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-xs text-slate-400">Parsing complex lines & text metadata...</p>
                    </div>
                  ) : primaryFileName ? (
                    <div className="bg-[#0b0e1e] p-3 rounded-lg border border-emerald-500/20 flex items-center justify-between">
                      <div className="truncate pr-2">
                        <p className="text-xs font-bold text-emerald-400 truncate">{primaryFileName}</p>
                        <p className="text-[10px] text-slate-400">{primaryItems.length} parts lines identified.</p>
                      </div>
                      <button
                        onClick={() => {
                          setPrimaryFileName('');
                          setPrimaryItems([]);
                        }}
                        className="text-rose-450 hover:text-rose-500 text-xs px-2 py-1 font-bold rounded hover:bg-rose-500/5 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-[#1d2c4e] hover:border-emerald-500/40 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-[#0a0d1a]/55">
                      <FileText className="w-8 h-8 text-emerald-400/70 mb-2" />
                      <span className="text-xs font-bold text-slate-300">Choose Primary Estimate PDF</span>
                      <span className="text-[10px] text-slate-500 mt-0.5 font-sans">Supports raw files of any standard insurer copy</span>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handlePrimaryUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* SECONDARY ESTIMATE */}
              <div className="bg-[#141a35] border border-[#1d2c4e] rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <span className="bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 py-0.5 px-2 rounded text-[10px] font-extrabold uppercase tracking-widest">
                    Step 2: Supplementary Check
                  </span>
                  <h3 className="text-sm font-bold text-slate-200 mt-2">Secondary Estimate (पूरक अनुमान)</h3>
                  <p className="text-slate-400 text-xs mt-1">Upload the secondary, subsequent or additional parts demand estimate sheet to match.</p>
                </div>

                <div className="mt-4">
                  {isParsingSecondary ? (
                    <div className="py-6 text-center animate-pulse">
                      <div className="inline-block w-6 h-6 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-xs text-slate-400">Parsing parts rows & prices...</p>
                    </div>
                  ) : secondaryFileName ? (
                    <div className="bg-[#0b0e1e] p-3 rounded-lg border border-fuchsia-500/20 flex items-center justify-between">
                      <div className="truncate pr-2">
                        <p className="text-xs font-bold text-fuchsia-400 truncate">{secondaryFileName}</p>
                        <p className="text-[10px] text-slate-400">{secondaryItems.length} lines detected.</p>
                      </div>
                      <button
                        onClick={() => {
                          setSecondaryFileName('');
                          setSecondaryItems([]);
                        }}
                        className="text-rose-450 hover:text-rose-500 text-xs px-2 py-1 font-bold rounded hover:bg-rose-500/5 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-[#1d2c4e] hover:border-fuchsia-500/40 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-[#0a0d1a]/55">
                      <FileText className="w-8 h-8 text-fuchsia-400/70 mb-2" />
                      <span className="text-xs font-bold text-slate-300">Choose Secondary Estimate PDF</span>
                      <span className="text-[10px] text-slate-500 mt-0.5 font-sans">Lines will be matched with Primary PDF</span>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleSecondaryUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

            </div>

            {/* Results Output Section */}
            {comparedItems.length > 0 && (
              <div className="border-t border-[#1d2c4e]/50 pt-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    📋 Audited Comparison Discrepancies (पूरा विवरण)
                  </h3>
                  <div className="flex gap-4 text-xs font-semibold">
                    <span className="text-emerald-400">Matched with Primary: {comparedItems.filter(i=> i.matchStatus === 'match').length} parts</span>
                    <span className="text-rose-400">Not in Primary: {comparedItems.filter(i=> i.matchStatus === 'mismatch').length} parts</span>
                  </div>
                </div>

                <div className="bg-[#0b1021] border border-[#1d2c4e] rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-[#12182d] text-[10px] text-slate-400 uppercase font-extrabold border-b border-[#1d2c4e]">
                        <th className="py-3 px-4 text-center w-12">S.No</th>
                        <th className="py-3 px-4">Part Number</th>
                        <th className="py-3 px-4">Spare Part / Description</th>
                        <th className="py-3 px-4 text-center w-16">Qty</th>
                        <th className="py-3 px-4 text-right w-24">MRP Unit</th>
                        <th className="py-3 px-4 text-right w-28">Net Amount</th>
                        <th className="py-3 px-4 text-center w-48">Audit Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1d2c4e]/60 text-slate-300 text-xs">
                      {comparedItems.map((item, idx) => {
                        const isMatch = item.matchStatus === 'match';
                        return (
                          <tr key={idx} className={`hover:bg-[#1d2a4f]/15 transition-all ${!isMatch ? 'bg-rose-500/[0.02]' : ''}`}>
                            <td className="py-3 px-4 text-center text-slate-500 font-mono text-[10px]">{idx + 1}</td>
                            <td className="py-3 px-4 text-blue-400 font-mono font-bold uppercase tracking-wider">{item.partNumber || '—'}</td>
                            <td className="py-3 px-4">
                              <p className="font-bold text-slate-200">{item.partName}</p>
                            </td>
                            <td className="py-3 px-4 text-center font-bold font-mono">{item.qty}</td>
                            <td className="py-3 px-4 text-right font-mono font-medium">₹{item.price.toLocaleString('en-IN')}</td>
                            <td className="py-3 px-4 text-right font-bold text-slate-100 font-mono">₹{(item.qty * item.price).toLocaleString('en-IN')}</td>
                            <td className="py-3 px-4 text-center">
                              {isMatch ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-green-500/10 border border-green-500/20">
                                  <span className="text-[#22c55e] font-black">✔️</span> <span className="text-emerald-400 font-bold">Match with Primary Estimate</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 border border-rose-500/25 text-rose-400">
                                  ❌ Not in Primary Estimate
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Help guidelines if empty uploaded */}
            {comparedItems.length === 0 && !isParsingPrimary && !isParsingSecondary && (
              <div className="bg-[#0b0e1e]/40 border border-[#1d2c4e]/50 rounded-xl p-10 text-center text-slate-400 max-w-xl mx-auto mt-6">
                <HelpCircle className="w-10 h-10 text-fuchsia-500/60 mx-auto stroke-1 mb-3 animate-bounce" />
                <h4 className="text-slate-200 font-bold text-xs uppercase tracking-wider">How to Compare Estimates</h4>
                <p className="text-[11px] mt-2 leading-relaxed font-sans">
                  Upload the initial approved primary invoice or estimate PDF on the left column. Then, upload subsequent supplementary or secondary assessment PDFs on the right column. The workbench audit report will check line-by-line part codes and descriptions.
                </p>
              </div>
            )}
            
          </div>
        </div>
      )}

      {subView === 'ai-parser' && (
        <div className="space-y-6 animate-fade-in">
          {/* AI PDF/Quotation Parser Workspace */}
          <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#1d2c4e] pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center flex-wrap gap-2">
                  <Sparkles className="w-5 h-5 text-fuchsia-400" />
                  <span>AI PDF Estimate / Quotation Parser (AI पीडीएफ पार्सर)</span>
                  {isParsingAI && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                      Gemini Scanning Estimate PDF...
                    </span>
                  )}
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Upload any damage estimation or quotation PDF. Gemini AI will scan, extract all Spare Parts & Labor items, and directly import them to your database.
                </p>
              </div>
            </div>

            {/* Upload Area */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="md:col-span-2">
                <div 
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-350 ${
                    isParsingAI 
                      ? 'border-fuchsia-500/40 bg-fuchsia-500/5' 
                      : aiFileName 
                        ? 'border-emerald-500/40 bg-emerald-500/5' 
                        : 'border-[#1d2c4e] bg-[#070913] hover:border-fuchsia-500/30'
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleAiPdfUpload}
                    id="ai-pdf-uploader"
                    className="hidden"
                    disabled={isParsingAI}
                  />
                  <label htmlFor="ai-pdf-uploader" className="cursor-pointer block">
                    <div className="flex flex-col items-center justify-center gap-3">
                      {isParsingAI ? (
                        <RefreshCw className="w-10 h-10 text-amber-500 animate-spin" />
                      ) : aiFileName ? (
                        <FileText className="w-10 h-10 text-emerald-400" />
                      ) : (
                        <Sparkles className="w-10 h-10 text-fuchsia-400 animate-pulse" />
                      )}
                      
                      <div>
                        {isParsingAI ? (
                          <p className="text-sm font-bold text-slate-100 font-sans">Reading PDF & extracting items with Gemini model...</p>
                        ) : aiFileName ? (
                          <p className="text-sm font-bold text-slate-100 font-sans">File Scanned: {aiFileName}</p>
                        ) : (
                          <p className="text-sm font-bold text-slate-200 font-sans">Click or Drag to Upload Estimate PDF (पार्ट्स एवं लेबर स्कैन करें)</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1 font-sans">Supports any service estimate, quotation, or garage assessment PDF</p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Preferences Card */}
              <div className="bg-[#0b0e1e] border border-[#1d2c4e] rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">AI Scan Preferences</h3>
                  
                  <div className="space-y-4">
                    {/* Auto save toggle */}
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={aiAutoSave}
                        onChange={(e) => setAiAutoSave(e.target.checked)}
                        className="mt-1 accent-fuchsia-600 rounded bg-[#070913] border-[#1d2c4e] cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">Auto-Save Directly (सीधे डेटाबेस में सेव करें)</span>
                        <span className="text-[10px] text-slate-400">Save spare parts and labor automatically straight to Supplementary Register when parsing completes.</span>
                      </div>
                    </label>

                    {/* Vehicle Dropdown */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Target Vehicle (गाड़ी चुनें / लिखें)</label>
                      <div className="space-y-2">
                        <select
                          value={aiSelectedVehicleReg}
                          onChange={(e) => setAiSelectedVehicleReg(e.target.value)}
                          className="w-full bg-[#12182d] border border-[#1d2f5a] text-slate-200 text-xs px-3 py-2 rounded-lg outline-none cursor-pointer focus:border-fuchsia-500 font-mono"
                        >
                          <option value="">-- Associate Vehicle --</option>
                          {activeNonDeliveredVehicles.map(v => (
                            <option key={v.id} value={v.regNo}>{v.regNo} ({v.customer})</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={aiSelectedVehicleReg}
                          onChange={(e) => setAiSelectedVehicleReg(e.target.value.toUpperCase())}
                          placeholder="Or type custom vehicle plate No."
                          className="w-full bg-[#12182d] border border-[#1d2f5a] text-slate-200 text-[11px] px-3 py-2 rounded-lg outline-none focus:border-fuchsia-500 font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {aiExtractedItems.length > 0 && (
                  <button
                    onClick={handleSaveSelectedAI}
                    className="w-full mt-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-fuchsia-600/10"
                  >
                    <Layers className="w-3.5 h-3.5" /> Save Selected ({aiExtractedItems.filter((_, idx) => aiSelectedIndices[idx]).length} items)
                  </button>
                )}
              </div>

            </div>

            {/* Error state */}
            {aiParseError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-rose-400">AI Parsing Failed (स्कैनिंग असफल)</h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">{aiParseError}</p>
                </div>
              </div>
            )}

            {/* Results Display */}
            {aiExtractedItems.length > 0 && (
              <div className="space-y-6 pt-2">
                
                {/* Meta details header */}
                <div className="bg-[#0b0e1e] border border-[#1d2c4e] rounded-xl p-4.5">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1">
                    <span>📋 Extracted Customer & Insurance Details (दस्तावेज़ जानकारी)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Customer Name</label>
                      <p className="text-xs text-white font-bold bg-[#12182d] px-3 py-1.5 rounded-md border border-[#1d2f5a]">{aiParsedDetails?.customerName || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Vehicle Reg No.</label>
                      <p className="text-xs text-white font-mono font-bold bg-[#12182d] px-3 py-1.5 rounded-md border border-[#1d2f5a] uppercase">{aiParsedDetails?.vehicleNo || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Insurance Company</label>
                      <p className="text-xs text-white font-bold bg-[#12182d] px-3 py-1.5 rounded-md border border-[#1d2f5a]">{aiParsedDetails?.insuranceCompany || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Surveyor Name</label>
                      <p className="text-xs text-white font-bold bg-[#12182d] px-3 py-1.5 rounded-md border border-[#1d2f5a]">{aiParsedDetails?.surveyorName || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Spares Estimate Real-time Auditing Grid Table section */}
                <div className="bg-[#0b0e1e] border border-[#1d2c4e] rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-[#1d2c4e] pb-3">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                      <Layers className="w-4 h-4 text-fuchsia-400" />
                      <span>Spares Estimate Items Found ({aiExtractedItems.length})</span>
                    </h3>
                    <button
                      onClick={() => {
                        const hasSelected = aiExtractedItems.some((_, idx) => aiSelectedIndices[idx]);
                        const updated = { ...aiSelectedIndices };
                        aiExtractedItems.forEach((_, idx) => {
                          updated[idx] = !hasSelected;
                        });
                        setAiSelectedIndices(updated);
                      }}
                      className="text-[10px] text-fuchsia-400 hover:text-fuchsia-300 font-bold cursor-pointer font-sans"
                    >
                      Toggle All Items
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-slate-300 text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#1d2f5a] text-slate-400 uppercase text-[9px] tracking-wider">
                          <th className="py-3 px-2 text-center w-[40px]">Select</th>
                          <th className="py-3 px-2 text-center w-[50px]">SL (SNo.)</th>
                          <th className="py-3 px-2">Part Number</th>
                          <th className="py-3 px-2 min-w-[180px]">Item Name</th>
                          <th className="py-3 px-2 text-center w-[60px]">Qty</th>
                          <th className="py-3 px-2 text-right">Unit Price</th>
                          <th className="py-3 px-2 text-center">Taxes (GST)</th>
                          <th className="py-3 px-2 text-right">Amount</th>
                          <th className="py-3 px-3 min-w-[240px]">Database Comparison Audit Result (रिमार्क / डेटा मिलान)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#121c38]">
                        {aiExtractedItems.map((item, originalIndex) => {
                          const isSelected = !!aiSelectedIndices[originalIndex];
                          const amount = item.estimatedAmount || ((item.qty || 1) * (item.rate || 0));
                          
                          // Badge styling for match status
                          let badgeBg = 'bg-rose-500/10 text-rose-400 border-rose-500/25';
                          let badgeText = '❌ Data Not Match';
                          if (item.matchedStatus === 'match') {
                            badgeBg = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
                            badgeText = '✅ Data Match';
                          } else if (item.matchedStatus === 'mismatch') {
                            badgeBg = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                            badgeText = '✅ Data Match';
                          }

                          return (
                            <tr 
                              key={originalIndex}
                              className={`hover:bg-[#121c38]/40 transition-all cursor-pointer ${isSelected ? 'bg-fuchsia-500/[0.02]' : ''}`}
                              onClick={() => setAiSelectedIndices(prev => ({ ...prev, [originalIndex]: !isSelected }))}
                            >
                              <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => setAiSelectedIndices(prev => ({ ...prev, [originalIndex]: !isSelected }))}
                                  className="accent-fuchsia-600 rounded bg-[#070913] cursor-pointer"
                                />
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-[11px] text-slate-400">
                                {item.sNo || (originalIndex + 1)}
                              </td>
                              <td className="py-3 px-2 font-mono font-medium text-[11px] text-fuchsia-300">
                                {item.partNo || 'N/A'}
                              </td>
                              <td className="py-3 px-2 font-medium text-slate-100 max-w-[220px] truncate">
                                {item.name}
                              </td>
                              <td className="py-3 px-2 text-center font-bold">
                                {item.qty}
                              </td>
                              <td className="py-3 px-2 text-right font-mono text-slate-200">
                                ⭐₹{(item.rate || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-[11px] text-slate-400">
                                {item.taxes ? `${item.taxes}%` : '18%'}
                              </td>
                              <td className="py-3 px-2 text-right font-mono font-bold text-slate-100">
                                ₹{amount.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-start gap-2 max-w-[320px]">
                                  <span className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded border ${badgeBg} tracking-wide flex-shrink-0 mt-0.5`}>
                                    {badgeText}
                                  </span>
                                  <span className="text-[10px] text-slate-350 leading-tight">
                                    {item.comparisonRemarks || 'Verification pending'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* Stack of Floating Confirmation Toasts */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4.5 py-3 rounded-xl border shadow-2xl max-w-sm pointer-events-auto transition-all duration-300 transform translate-y-0 opacity-100 animate-slide-in ${
              t.type === 'success' 
                ? 'bg-[#0f1d19]/95 border-emerald-500/50 text-emerald-100'
                : t.type === 'warning'
                  ? 'bg-[#231d12]/95 border-amber-500/50 text-amber-100'
                  : 'bg-[#12162a]/95 border-indigo-500/50 text-indigo-100'
            }`}
          >
            <div className={`p-1.5 rounded-lg flex-shrink-0 ${
              t.type === 'success' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : t.type === 'warning' 
                  ? 'bg-amber-500/20 text-amber-400' 
                  : 'bg-indigo-500/20 text-indigo-400'
            }`}>
              <CheckCircle className="w-5 h-5 font-bold" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black leading-tight tracking-wide font-sans">{t.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 5. ADD & EDIT DIALOG MODAL (SUPPORTING ADD MORE MULTI-ROW ADDITION) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 overflow-y-auto backdrop-blur-md">
          <div className="bg-[#0f1424] border border-[#20325a] shadow-[0_25px_60px_rgba(0,0,0,0.9)] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1f2f54] py-4 px-6 bg-[#151c35]">
              <div>
                <h3 className="text-sm font-bold font-sans tracking-wide text-white uppercase flex items-center gap-2">
                  <span>🛠️ {modalMode === 'create' ? 'Add Supplementary Parts' : 'Edit Supplementary Part'}</span>
                </h3>
                <p className="text-[#a4b5d6] text-[10px] mt-0.5">
                  {modalMode === 'create' 
                    ? 'Log multiple post-estimation spare demands in a single layout workflow.' 
                    : 'Modify the configured supplementary item details.'}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setActiveSearchIndex(null);
                }} 
                className="text-slate-400 hover:text-white p-1 hover:bg-rose-600 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Target Vehicle Section */}
              <div className="bg-[#12182d] border border-[#1d2a4f] rounded-xl p-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Choose Target Registered Vehicle * (सप्लीमेंट्री वाहन चुनें)
                </label>
                {modalMode === 'edit' ? (
                  <div className="bg-[#070913] border border-[#1b2b51] py-2 px-3 text-sm text-fuchsia-400 font-bold font-mono rounded inline-block uppercase">
                    🚗 {selectedVehicleReg}
                  </div>
                ) : (
                  <select
                    value={selectedVehicleReg}
                    onChange={(e) => setSelectedVehicleReg(e.target.value)}
                    className="w-full sm:max-w-md bg-[#070913] border border-[#1b2b51] text-slate-200 py-2 px-3 rounded text-xs select-none focus:outline-none focus:border-fuchsia-500 font-sans cursor-pointer"
                  >
                    <option value="" disabled>-- Select Active Vehicle --</option>
                    {activeNonDeliveredVehicles.map((v) => (
                      <option key={v.id} value={v.regNo}>
                        {v.regNo} ({v.customer} - JC: {v.jc})
                      </option>
                    ))}
                  </select>
                )}
                {activeNonDeliveredVehicles.length === 0 && modalMode === 'create' && (
                  <p className="text-[10px] text-rose-450 font-bold mt-1.5 font-sans">
                    🚨 Warning: No active workshop vehicles listed! Please register the vehicle first in Active Vehicles.
                  </p>
                )}
              </div>

              {/* Multi-Item Lines Form List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#213054]">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                    🔧 Spare parts request lines
                  </h4>
                  {modalMode === 'create' && (
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="bg-fuchsia-600/10 border border-fuchsia-600/30 text-fuchsia-400 hover:bg-fuchsia-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-sans font-bold flex items-center gap-1 transition-all cursor-pointer select-none"
                    >
                      <Plus className="w-3.5 h-3.5" /> add another spare item (और जोड़ें)
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {formRows.map((row, idx) => (
                    <div 
                      key={idx} 
                      className="bg-[#0a0d1a] border border-[#182342] rounded-xl p-4 space-y-4 relative hover:border-fuchsia-500/25 transition-all"
                    >
                      {/* Close row option for multi-row */}
                      {modalMode === 'create' && formRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="absolute top-2.5 right-2.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 p-1 rounded-md transition-all cursor-pointer"
                          title="Delete Row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Row Badge */}
                      <div className="inline-block bg-[#161c32] text-[10px] font-bold text-slate-400 font-mono py-0.5 px-2 rounded-md">
                        Part Item #{idx + 1}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        
                        {/* Part Number (Search Catalog trigger) */}
                        <div className="md:col-span-3 relative">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Part Number (Optional)</label>
                          <input
                            type="text"
                            value={row.partNo}
                            onChange={(e) => {
                              handleRowChange(idx, 'partNo', e.target.value);
                              setActiveSearchIndex(idx);
                              setCatalogSearchText(e.target.value);
                            }}
                            placeholder="Type or Search Code..."
                            className="w-full bg-[#070913] border border-[#1b2b51] text-slate-100 py-2 px-3 rounded text-xs focus:outline-none focus:border-fuchsia-500 font-mono tracking-wider"
                          />
                          
                          {/* Auto-suggest dropdown from partsMaster catalog */}
                          {activeSearchIndex === idx && catalogSearchText && filteredMasterCatalog.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-[#0a1024] border border-[#223565] rounded-lg shadow-2xl z-20 overflow-hidden font-sans text-xs">
                              <div className="bg-[#141b34] px-3 py-1.5 border-b border-[#223565] text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                                Suggestions in master catalog
                              </div>
                              <ul className="divide-y divide-[#223565]/60">
                                {filteredMasterCatalog.map(m => (
                                  <li key={m.id}>
                                    <button
                                      type="button"
                                      onClick={() => selectCatalogItem(idx, m)}
                                      className="w-full text-left py-2 px-3 text-slate-200 hover:bg-rose-600 hover:text-white transition-all block font-bold"
                                    >
                                      <div className="font-mono text-xs">{m.partNo}</div>
                                      <div className="text-[10px] opacity-80 font-normal truncate">{m.partName} - ₹{m.price}</div>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Part Name Description */}
                        <div className="md:col-span-4">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Part Name / Particular *</label>
                          <input
                            type="text"
                            value={row.partName}
                            onChange={(e) => handleRowChange(idx, 'partName', e.target.value)}
                            placeholder="e.g. Front Bumper, Tail Light Assy..."
                            className="w-full bg-[#070913] border border-[#1b2b51] text-slate-100 py-2 px-3 rounded text-xs focus:outline-none focus:border-fuchsia-500 font-sans"
                            required
                          />
                        </div>

                        {/* Qty */}
                        <div className="md:col-span-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={row.qty}
                            onChange={(e) => handleRowChange(idx, 'qty', parseInt(e.target.value) || 1)}
                            className="w-full bg-[#070913] border border-[#1b2b51] text-slate-100 py-2 px-3 rounded text-xs text-center font-bold focus:outline-none focus:border-fuchsia-500 font-mono"
                          />
                        </div>

                        {/* Rate */}
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Rate (₹)</label>
                          <input
                            type="number"
                            min={0}
                            value={row.rate}
                            onChange={(e) => handleRowChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                            className="w-full bg-[#070913] border border-[#1b2b51] text-slate-100 py-2 px-3 rounded text-xs text-right font-bold focus:outline-none focus:border-fuchsia-500 font-mono"
                          />
                        </div>

                        {/* Net Amount Preview */}
                        <div className="md:col-span-1.5 text-right px-2 pb-2">
                          <div className="text-[9px] uppercase font-bold text-slate-400 font-sans">Row Net</div>
                          <strong className="text-fuchsia-400 text-xs font-mono">
                            ₹{(row.qty * row.rate).toLocaleString('en-IN')}
                          </strong>
                        </div>

                      </div>

                      {/* Line Item Status Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[#1d2a4f]/50 pt-3 mt-1 text-left">
                        
                        {/* Insurance Approval Status */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Insurance Approval Status</label>
                          <div className="flex gap-2">
                            {['Pending', 'Approved', 'Rejected'].map((statusOption) => (
                              <button
                                key={statusOption}
                                type="button"
                                onClick={() => handleRowChange(idx, 'insuranceStatus', statusOption)}
                                className={`flex-1 py-1 px-2 text-[10px] font-black rounded-md tracking-wider border select-none transition-all cursor-pointer text-center ${
                                  row.insuranceStatus === statusOption
                                    ? statusOption === 'Approved'
                                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow'
                                      : statusOption === 'Rejected'
                                        ? 'bg-rose-500/15 border-rose-500 text-rose-400 shadow'
                                        : 'bg-amber-500/15 border-amber-500 text-amber-500 shadow'
                                    : 'bg-[#121626] border-[#202e53]/55 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {statusOption}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Procurement Supply State */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Procurement Supply status</label>
                          <select
                            value={row.status}
                            onChange={(e) => handleRowChange(idx, 'status', e.target.value)}
                            className="bg-[#070913] border border-[#1b2b51] text-slate-350 py-1.5 px-3 rounded text-[11px] outline-none focus:border-fuchsia-500 cursor-pointer font-sans w-full"
                          >
                            <option value="In Order">In Order (मांग दर्ज है)</option>
                            <option value="In Transit">In Transit (रास्ते में है)</option>
                            <option value="Received">Received (स्टॉक प्राप्त)</option>
                          </select>
                        </div>

                        {/* Remarks */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Additional Remarks (टिप्पणी)</label>
                          <input
                            type="text"
                            value={row.remarks}
                            onChange={(e) => handleRowChange(idx, 'remarks', e.target.value)}
                            placeholder="e.g. Surveyor asked for photo..."
                            className="w-full bg-[#070913] border border-[#1b2b51] text-slate-100 py-1.5 px-3 rounded text-[11px] focus:outline-none focus:border-fuchsia-500 font-sans"
                          />
                        </div>

                      </div>

                    </div>
                  ))}
                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-[#131932] border-t border-[#1f2f54] py-3.5 px-6 flex justify-between items-center">
              <span className="text-[11px] text-slate-400 font-sans hidden sm:inline">
                Total Parts Requested: <strong className="text-white">{formRows.length} rows</strong> | Cumulative: <strong className="text-fuchsia-400">₹{formRows.reduce((s, r)=> s + (r.qty * r.rate), 0).toLocaleString('en-IN')}</strong>
              </span>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-5 rounded-lg text-xs font-semibold transition-all cursor-pointer font-sans"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white py-2 px-6 rounded-lg text-xs font-semibold transition-all cursor-pointer font-sans shadow-lg shadow-fuchsia-600/20"
                >
                  Save Entry
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
