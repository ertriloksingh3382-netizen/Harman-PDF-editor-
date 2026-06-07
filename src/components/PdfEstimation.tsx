/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { EstimationItem, EstimationDetails } from '../types';
import { 
  FileUp, 
  Printer, 
  Plus, 
  Trash2, 
  Sparkles, 
  RefreshCw, 
  AlertCircle,
  Clock,
  Briefcase,
  User,
  Smartphone,
  Tag,
  Calendar,
  CheckCircle,
  FileText,
  Cpu,
  Layers,
  Download,
  Shield,
  UserCheck
} from 'lucide-react';

const INSURANCE_COMPANIES = [
  'Cash Work',
  'Acko General',
  'Bajaj General',
  'HDFC Ergo',
  'ICICI Lombard',
  'Indusind General',
  'New India Assu.',
  'Tata AIG',
  'Oriental Insurance',
  'United India',
  'Kotak General',
  'Go Digit',
  'Liberty General'
];

export default function PdfEstimation() {
  const [items, setItems] = useState<EstimationItem[]>([]);
  const [details, setDetails] = useState<EstimationDetails>({
    customerName: 'Trilok Singh',
    mobile: '9876543210',
    vehicleNo: 'DL1CAB4596',
    vehicleModel: 'BYD E6 EV',
    invoiceDate: new Date().toISOString().substring(0, 10),
    jobCardNo: 'JC-2026-089',
    insuranceCompany: 'Cash Work',
    surveyorName: '',
  });

  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Default mock entries for instant playground exploration
  const handleLoadSampleData = () => {
    const sampleItems: EstimationItem[] = [
      {
        id: '1',
        sr: 1,
        partNumber: '2004251-A0',
        partName: 'Front Brake Pad Kit (OES)',
        status: '✔️APPROVED',
        qty: 1,
        unitCategory: 'SET',
        price: 4850,
        taxes: 18,
        amount: 5723,
      },
      {
        id: '2',
        sr: 2,
        partNumber: 'BYD-330452',
        partName: 'Cabin AC Hepa Filter v2',
        status: '✔️APPROVED',
        qty: 2,
        unitCategory: 'PCS',
        price: 1200,
        taxes: 12,
        amount: 2688,
      },
      {
        id: '3',
        sr: 3,
        partNumber: 'BYD-903421',
        partName: 'LED Right Headlamp Assembly',
        status: 'SUSPECTED ⚠️',
        qty: 1,
        unitCategory: 'PCS',
        price: 24500,
        taxes: 18,
        amount: 28910,
      },
      {
        id: '4',
        sr: 4,
        partNumber: 'WPR-Blade-24',
        partName: 'Premium Silicon Wiper Blade (BOSCH)',
        status: '❌ NOT APPROVAL',
        qty: 2,
        unitCategory: 'SET',
        price: 850,
        taxes: 18,
        amount: 2006,
      },
    ];
    setItems(sampleItems);
    setErrorMessage(null);
  };

  const handleAddManualRow = () => {
    setItems((prev) => {
      const nextSr = prev.length > 0 ? Math.max(...prev.map(i => i.sr)) + 1 : 1;
      const newItem: EstimationItem = {
        id: Math.random().toString(36).substring(2, 9),
        sr: nextSr,
        partNumber: '',
        partName: '',
        status: '✔️APPROVED',
        qty: 1,
        unitCategory: 'PCS',
        price: 0,
        taxes: 0,
        amount: 0,
      };
      return [...prev, newItem];
    });
  };

  const handleUpdateItem = (id: string, field: keyof EstimationItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // For Qty, Price, or Taxes change, compute amount: Amount = Price * Qty * (1 + Taxes / 100)
        if (field === 'qty' || field === 'price' || field === 'taxes') {
          const qty = Number(updated.qty) || 0;
          const price = Number(updated.price) || 0;
          const taxes = Number(updated.taxes) || 0;
          updated.amount = Math.round(qty * price * (1 + taxes / 100));
        }

        return updated;
      })
    );
  };

  const handleDeleteRow = (id: string) => {
    setItems((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      // Re-index Sr sequence
      return filtered.map((item, index) => ({
        ...item,
        sr: index + 1,
      }));
    });
  };

  const handleClearAll = () => {
    if (confirm('Clear all line items in the current estimation?')) {
      setItems([]);
      setErrorMessage(null);
    }
  };

  // Sophisticated client-side layout grouping-based PDF parser
  const handlePdfUploadAndExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setErrorMessage(null);
    try {
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        try {
          if (!event.target?.result) throw new Error('File read empty.');
          const bytes = new Uint8Array(event.target.result as ArrayBuffer);

          // Configure PDFJS library options
          const loadingTask = pdfjsLib.getDocument({ data: bytes });
          const pdf = await loadingTask.promise;

          let extractedItems: EstimationItem[] = [];
          let foundDetails: Partial<EstimationDetails> = {};
          let fullCombinedText = '';
          let tempSrCounter = 1;
          let currentItem: any = null;

          const saveCurrentItem = () => {
            if (currentItem) {
              if (!currentItem.partNumber || currentItem.partNumber === '') {
                currentItem.partNumber = 'N/A';
              }
              if (!currentItem.partName || currentItem.partName === '') {
                currentItem.partName = 'Automotive Component';
              }

              // Guard against duplicates
              const isDuplicated = extractedItems.some(
                (item) => item.sr === currentItem.sr && item.partNumber === currentItem.partNumber
              );
              if (!isDuplicated) {
                extractedItems.push({
                  id: Math.random().toString(36).substring(2, 9),
                  sr: currentItem.sr,
                  partNumber: currentItem.partNumber.trim(),
                  partName: currentItem.partName.trim(),
                  status: '✔️APPROVED',
                  qty: currentItem.qty || 1,
                  unitCategory: currentItem.unitCategory || 'PCS',
                  price: currentItem.price || 0,
                  taxes: currentItem.taxes || 18,
                  amount: currentItem.amount || ((currentItem.qty || 1) * (currentItem.price || 0))
                });
              }
            }
            currentItem = null;
          };

          const tryParseNumericCell = (cellStr: string) => {
            const regex = /([\d,.]+)\s*(Unit|LTR|PCS|KG|BOX|SET|[A-Za-z]+)?\s*(Customer)?\s*([\d,.]+)\s*(GST)?/i;
            const match = cellStr.match(regex);
            if (match) {
              const qRaw = match[1].replace(/,/g, '');
              const pRaw = match[4].replace(/,/g, '');
              const qtyVal = parseFloat(qRaw);
              const priceVal = parseFloat(pRaw);
              if (!isNaN(qtyVal) && !isNaN(priceVal)) {
                return {
                  qty: qtyVal,
                  unitCategory: match[2] || 'PCS',
                  price: priceVal
                };
              }
            }
            return null;
          };

          // Loop pages and analyze text
          for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
            const page = await pdf.getPage(pNum);
            const textContent = await page.getTextContent();
            
            // Check for customer detail key strings inside whole text block
            const pageTextRaw = textContent.items.map((it: any) => it.str).join(' ');
            fullCombinedText += pageTextRaw + '\n';
            
            // Heuristic details parsing
            if (!foundDetails.customerName) {
              const custMatch = pageTextRaw.match(/(?:Customer|Name|Client|Owner):\s*([A-Za-z\s]{3,30})/i);
              if (custMatch) foundDetails.customerName = custMatch[1].trim();
            }
            if (!foundDetails.mobile) {
              const mobMatch = pageTextRaw.match(/(?:Mobile|Phone|Tel|Contact):\s*([0-9\-\s\+]{10,15})/i);
              if (mobMatch) foundDetails.mobile = mobMatch[1].trim();
            }
            if (!foundDetails.vehicleNo) {
              const vehMatch = pageTextRaw.match(/(?:Vehicle|Reg|Plate|Car\s*No):\s*([A-Z0-9\s\-]{6,15})/i);
              if (vehMatch) foundDetails.vehicleNo = vehMatch[1].replace(/\s+/g, ' ').trim().toUpperCase();
            }
            if (!foundDetails.vehicleModel) {
              const modelMatch = pageTextRaw.match(/(?:Model|Variant|Make):\s*([A-Za-z0-9\s\-]{3,20})/i);
              if (modelMatch) foundDetails.vehicleModel = modelMatch[1].trim();
            }

            // Gather non-empty page items
            const pageItems: any[] = [];
            textContent.items.forEach((item: any) => {
              if (item.str && item.str.trim() !== '') {
                pageItems.push(item);
              }
            });

            // Sort page items descending vertically from top to bottom
            pageItems.sort((a, b) => b.transform[5] - a.transform[5]);

            // Group text items by dynamic proximity of Y-coordinates (within 8.5 pixels)
            const dynamicYRows: any[][] = [];
            pageItems.forEach((item) => {
              const y = item.transform[5];
              let matchedRow = dynamicYRows.find((r) => Math.abs(r[0].transform[5] - y) < 8.5);
              if (matchedRow) {
                matchedRow.push(item);
              } else {
                dynamicYRows.push([item]);
              }
            });

            // Process each grouped row
            dynamicYRows.forEach((rawRow) => {
              // Sort horizontally from left to right (X coordinate)
              rawRow.sort((cellA, cellB) => cellA.transform[4] - cellB.transform[4]);

              // Merge text pieces that are very close horizontally (within 15 pixels)
              const mergedCells: string[] = [];
              let currentCellText = '';
              let lastX = -999;

              rawRow.forEach((cell) => {
                const x = cell.transform[4];
                if (lastX !== -999 && x - lastX > 15) {
                  if (currentCellText.trim()) {
                    mergedCells.push(currentCellText.trim());
                  }
                  currentCellText = cell.str;
                } else {
                  currentCellText += (currentCellText ? ' ' : '') + cell.str;
                }
                lastX = x + cell.width;
              });
              if (currentCellText.trim()) {
                mergedCells.push(currentCellText.trim());
              }

              const joinedStr = mergedCells.join(' ').trim();
              const isHsnRow = joinedStr.toLowerCase().includes('hsn/sac');
              const isPriceRow = joinedStr.toLowerCase().includes('unit') || joinedStr.toLowerCase().includes('customer') || joinedStr.toLowerCase().includes('ltr') || joinedStr.toLowerCase().includes('pcs');
              const isTaxRow = joinedStr.match(/^\d+%\s*$/) || joinedStr.match(/^gst\s*\d+%\s*$/i);
              
              // Validate possible serial number prefix in a cell
              const srMatch = mergedCells[0]?.trim().match(/^(\d+)$/);

              // 1. Process candidate start
              if (srMatch) {
                // Archive preceding candidate
                saveCurrentItem();

                const srNum = parseInt(srMatch[1], 10);
                currentItem = {
                  sr: srNum,
                  partNumber: 'N/A',
                  partName: '',
                  qty: 1,
                  unitCategory: 'PCS',
                  price: 0,
                  taxes: 18,
                  amount: 0
                };

                // Extract Part number and Part name
                if (mergedCells.length >= 2) {
                  const rawCell = mergedCells[1] || '';
                  const partNo8_2Match = rawCell.match(/^(\d{8}-\d{2})(.*)$/);
                  if (partNo8_2Match) {
                    currentItem.partNumber = partNo8_2Match[1];
                    currentItem.partName = partNo8_2Match[2].trim();
                  } else {
                    const firstSpaceIdx = rawCell.search(/\s/);
                    if (firstSpaceIdx !== -1) {
                      const firstPart = rawCell.substring(0, firstSpaceIdx).trim();
                      const secondPart = rawCell.substring(firstSpaceIdx + 1).trim();
                      if (/[0-9]/.test(firstPart) && firstPart.length >= 5 && !/^[0-9.,]+$/.test(firstPart)) {
                        currentItem.partNumber = firstPart;
                        currentItem.partName = secondPart;
                      } else {
                        currentItem.partNumber = 'N/A';
                        currentItem.partName = rawCell;
                      }
                    } else {
                      currentItem.partNumber = 'N/A';
                      currentItem.partName = rawCell;
                    }
                  }
                }

                // If pricing parameters exist on the same line, extract them immediately
                const checkPricing = tryParseNumericCell(joinedStr);
                if (checkPricing) {
                  currentItem.qty = checkPricing.qty;
                  currentItem.unitCategory = checkPricing.unitCategory;
                  currentItem.price = checkPricing.price;

                  const amountMatch = joinedStr.match(/([\d,.]+)\s*(?:₹|INR)?\s*$/i);
                  if (amountMatch) {
                    currentItem.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                  }
                }
              } else if (currentItem) {
                // Secondary / supplemental row mapping state machine
                if (isHsnRow) {
                  // Capture tax rate if declared on HSN line
                  const taxMatch = joinedStr.match(/(\d+)%/);
                  if (taxMatch) {
                    currentItem.taxes = parseInt(taxMatch[1], 10);
                  }
                } else if (isPriceRow) {
                  const pricing = tryParseNumericCell(joinedStr);
                  if (pricing) {
                    currentItem.qty = pricing.qty;
                    currentItem.unitCategory = pricing.unitCategory;
                    currentItem.price = pricing.price;
                  }

                  const amountMatch = joinedStr.match(/([\d,.]+)\s*(?:₹|INR)?\s*$/i);
                  if (amountMatch) {
                    currentItem.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                  }
                } else if (isTaxRow) {
                  const taxMatch = joinedStr.match(/(\d+)/);
                  if (taxMatch) {
                    currentItem.taxes = parseInt(taxMatch[1], 10);
                  }
                } else {
                  // Wrapped description continuation row
                  const isNoise = joinedStr.match(/(?:spares\s*estimate|customer\s*&\s*vehicle|demanded\s*repair|accidenatal\s*repair|registered\s*name|office\s*add|gstin|email|page:\s*\d+|kristan|service\s*cost)/i);
                  if (!isNoise && joinedStr.replace(/[^A-Za-z]/g, '').length > 2) {
                    currentItem.partName += (currentItem.partName ? ' ' : '') + joinedStr;
                  }
                }
              }
            });
          }

          // Save final active candidate if any remains
          saveCurrentItem();

          // Post-processing sweep on fullCombinedText for high-accuracy fields extraction
          const cleanTextForParsing = fullCombinedText.replace(/\s+/g, ' ');

          // 1. Customer Name
          const custMatch = cleanTextForParsing.match(/(?:Customer\s*(?:Name)?|Client\s*(?:Name)?|Name\s*of\s*Customer|Owner\s*(?:Name)?)\s*[:.-]?\s*([A-Za-z\s.]{3,35})/i);
          if (custMatch) {
            const val = custMatch[1].trim();
            if (val && !/^(mobile|phone|vehicle|job|card|plate|date|invoice|address|model|make|chassis|engine)/i.test(val)) {
              foundDetails.customerName = val;
            }
          }

          // 2. Mobile
          if (!foundDetails.mobile) {
            const mobMatch = cleanTextForParsing.match(/(?:Mobile|Phone|Tel|Contact|Phone\s*No)\s*[:.-]?\s*([0-9\-\s\+]{10,15})/i);
            if (mobMatch) foundDetails.mobile = mobMatch[1].trim();
          }

          // 3. Indian Vehicle Registration Number or general vehicle reg number
          const indVehMatch = cleanTextForParsing.match(/\b([A-Z]{2}\s*[-–/]?\s*[0-9]{1,2}\s*[-–/]?\s*[A-Z]{1,3}\s*[-–/]?\s*[0-9]{4})\b/i);
          if (indVehMatch) {
            foundDetails.vehicleNo = indVehMatch[1].replace(/[\s\-–/]+/g, '').trim().toUpperCase();
          } else {
            const vehMatch = cleanTextForParsing.match(/(?:Vehicle|Reg|Plate|Car\s*No|Vehicle\s*No|Regn\s*No|Registration\s*No)\s*[:.-]?\s*([A-Z0-9\s\-]{6,15})/i);
            if (vehMatch) {
              foundDetails.vehicleNo = vehMatch[1].replace(/[\s\-]+/g, '').trim().toUpperCase();
            }
          }

          // 4. Vehicle Model
          if (!foundDetails.vehicleModel) {
            const modelMatch = cleanTextForParsing.match(/(?:Vehicle\s*Model|Car\s*Model|Vehicle\s*Make|Model|Variant|Make)\s*[:.-]?\s*([A-Za-z0-9\s\-]{3,30})/i);
            if (modelMatch) {
              const val = modelMatch[1].trim();
              if (val && !/^(number|no|date|invoice|customer|job|card|address)/i.test(val)) {
                foundDetails.vehicleModel = val;
              }
            }
          }

          // 5. Job Card Number
          const jcMatch = cleanTextForParsing.match(/(?:Job\s*Card\s*No|Job\s*Card\s*Number|Jobcard\s*No|Jobcard\s*Number|JC\s*No|JC\s*Number|Repair\s*Order|R\.?O\.?\s*No|RO\s*No|Job\s*Card)\s*[:.-]?\s*([A-Za-z0-9\-/\\]{3,25})/i);
          if (jcMatch) {
            foundDetails.jobCardNo = jcMatch[1].trim();
          } else {
            const jcRawMatch = cleanTextForParsing.match(/\b(JC\s*[-–/]\s*[0-9A-Z\-]+)\b/i);
            if (jcRawMatch) {
              foundDetails.jobCardNo = jcRawMatch[1].replace(/\s+/g, '').toUpperCase();
            }
          }

          // 6. Insurance Company (Check for substring match first from drop down options)
          const insFound = INSURANCE_COMPANIES.find(ins => 
            ins.toLowerCase() !== 'cash work' && cleanTextForParsing.toLowerCase().includes(ins.toLowerCase())
          );
          if (insFound) {
            foundDetails.insuranceCompany = insFound;
          } else {
            const insMatch = cleanTextForParsing.match(/(?:Insurance\s*Company|Insurance\s*Co|Ins\s*Co|Insurer|Insurance)\s*[:.-]?\s*([A-Za-z0-9\s.-]{3,30})/i);
            if (insMatch) {
              const term = insMatch[1].trim();
              const mappedIns = INSURANCE_COMPANIES.find(ins => 
                ins.toLowerCase().includes(term.toLowerCase()) || 
                term.toLowerCase().includes(ins.toLowerCase())
              );
              foundDetails.insuranceCompany = mappedIns || term;
            }
          }

          // 7. Surveyor Name
          const surveyorMatch = cleanTextForParsing.match(/(?:Surveyor\s*Name|Surveyor\s*of\s*Insurance|Surveyor|Ins\s*Surveyor)\s*[:.-]?\s*([A-Za-z\s.]{3,30})/i);
          if (surveyorMatch) {
            foundDetails.surveyorName = surveyorMatch[1].trim();
          }

          // Apply found details if any
          if (Object.keys(foundDetails).length > 0) {
            setDetails((prev) => ({
              ...prev,
              ...foundDetails,
            }));
          }

          if (extractedItems.length === 0) {
            // Let's implement regex fallback to parse line by line
            const allTextLines = fullCombinedText.split('\n');
            allTextLines.forEach((line) => {
              // look for sr, code, description, qty, category, price, taxes, amount
              const matches = line.match(/^(\d+)\s+([A-Za-z0-9\-]+)\s+([A-Za-z0-9\s\-\(\)\/]{3,30})\s+(\d+)\s+([A-Za-z]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)$/);
              if (matches) {
                extractedItems.push({
                  id: Math.random().toString(36).substring(2, 9),
                  sr: parseInt(matches[1]),
                  partNumber: matches[2],
                  partName: matches[3],
                  status: '✔️APPROVED',
                  qty: parseInt(matches[4]),
                  unitCategory: matches[5],
                  price: parseFloat(matches[6].replace(/,/g, '')),
                  taxes: parseFloat(matches[7].replace(/,/g, '')),
                  amount: parseFloat(matches[8].replace(/,/g, '')),
                });
              }
            });
          }

          if (extractedItems.length > 0) {
            // Sort by Sr
            extractedItems.sort((a, b) => a.sr - b.sr);
            setItems(extractedItems);
            setErrorMessage(null);
          } else {
            // If nothing parsed, show prompt but load beautiful mock database to let user play!
            handleLoadSampleData();
            setErrorMessage('Unable to extract structured columns from the uploaded PDF layout. We have loaded pre-configured sample parts databases from our automotive cluster instead. You can edit or add items below!');
          }
        } catch (innerErr: any) {
          console.error(innerErr);
          setErrorMessage(`PDF parsing failed: ${innerErr.message || innerErr}`);
        } finally {
          setIsParsing(false);
        }
      };

      fileReader.readAsArrayBuffer(file);
    } catch (e: any) {
      setErrorMessage(`Error reading file: ${e.message || e}`);
      setIsParsing(false);
    }
  };

  // Math summary lists
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalTaxAmount = 0;
    
    // Sum only APPROVED and SUSPECTED items
    items.forEach((it) => {
      if (it.status === '✔️APPROVED' || it.status === 'SUSPECTED ⚠️') {
        const itemSub = it.qty * it.price;
        subtotal += itemSub;
        totalTaxAmount += itemSub * (it.taxes / 100);
      }
    });

    const grandTotal = Math.round(subtotal + totalTaxAmount);

    return {
      subtotal,
      totalTaxAmount: Math.round(totalTaxAmount),
      grandTotal,
    };
  }, [items]);

  // Real-time PDF layout complexity and compiled file size estimations
  const pdfOptimizerStats = useMemo(() => {
    // 1. Complexity Score (0 - 100 scale)
    let rawComplexity = 15; // baseline structure weight
    
    // Line counts impact
    const approvedCount = items.filter((it) => it.status === '✔️APPROVED').length;
    const suspectedCount = items.filter((it) => it.status === 'SUSPECTED ⚠️').length;
    const rejectedCount = items.filter((it) => it.status === '❌ NOT APPROVAL').length;
    
    rawComplexity += approvedCount * 6;
    rawComplexity += suspectedCount * 12; // suspected items require deeper diagnostic annotations and yellow warning box renders
    rawComplexity += rejectedCount * 3; // rejected items require grey-out strike-through rules
    
    // Customer details character weight
    const detailsLength = 
      (details.customerName?.length || 0) + 
      (details.mobile?.length || 0) + 
      (details.vehicleNo?.length || 0) + 
      (details.vehicleModel?.length || 0);
    rawComplexity += Math.min(20, Math.floor(detailsLength / 3));

    // Tax complexity (different tax rates imply multi-rate sub-calculations in compiled tables)
    const uniqueTaxRates = new Set(items.map(it => it.taxes));
    if (uniqueTaxRates.size > 1) {
      rawComplexity += 15; // compound tax matrix
    }

    const complexityScore = Math.min(100, Math.max(10, rawComplexity));

    // Determine complexity categorization tier
    let complexityTier: 'Optimized / Minimal' | 'Standard Document' | 'Highly Detailed / Complex' = 'Standard Document';
    let complexityColor = 'text-green-600 bg-green-55 border-green-200';
    if (complexityScore < 30) {
      complexityTier = 'Optimized / Minimal';
      complexityColor = 'text-green-600 bg-green-50 border-green-200';
    } else if (complexityScore <= 60) {
      complexityTier = 'Standard Document';
      complexityColor = 'text-blue-600 bg-blue-50 border-blue-200';
    } else {
      complexityTier = 'Highly Detailed / Complex';
      complexityColor = 'text-amber-600 bg-amber-50 border-amber-200';
    }

    // 2. Estimated Compiled PDF File Size in Bytes
    // Standard basic structural headers, file catalog, cross-reference tables and embedded font headers:
    const baseEnvelopeSize = 124 * 1024; // 124 KB baseline (Space Grotesk + JetBrains Mono subheadings)
    
    // Render trees: active rows consume drawing instructions
    let dynamicOverheadBytes = 0;
    items.forEach((it) => {
      // String bytes + vector border commands & table drawing commands
      const charsCount = (it.partNumber?.length || 0) + (it.partName?.length || 0);
      let drawCommandWeight = 850; // default bytes for standard bounding box, standard typography
      if (it.status === 'SUSPECTED ⚠️') {
        drawCommandWeight = 1150; // requires drawing dashed boundaries, warning triangles
      } else if (it.status === '❌ NOT APPROVAL') {
        drawCommandWeight = 420; // simplified structural rendering (lighter gray, raw strike path)
      }
      dynamicOverheadBytes += charsCount * 4 + drawCommandWeight;
    });

    // Tax tables and summary cards add to PDF structural components:
    const summaryOverhead = 4.2 * 1024; // 4.2 KB
    
    const totalEstimatedBytes = baseEnvelopeSize + dynamicOverheadBytes + summaryOverhead;
    const totalEstimatedKB = parseFloat((totalEstimatedBytes / 1024).toFixed(2));

    return {
      complexityScore,
      complexityTier,
      complexityColor,
      totalEstimatedKB,
      totalEstimatedBytes,
      counts: {
        approved: approvedCount,
        suspected: suspectedCount,
        rejected: rejectedCount
      }
    };
  }, [items, details]);

  // Compile high fidelity diagnostic bundle and trigger direct file download
  const handleDownloadQuotationFile = () => {
    // Generate beautiful self-contained HTML that prints natively as a PDF invoice
    const tableRows = items.map((it) => {
      let statusStyle = 'color: #10B981; font-weight: bold; font-family: sans-serif;';
      if (it.status === '❌ NOT APPROVAL') {
        statusStyle = 'color: #EF4444; font-weight: bold; font-family: sans-serif; text-decoration: line-through;';
      } else if (it.status === 'SUSPECTED ⚠️') {
        statusStyle = 'color: #F59E0B; font-weight: bold; font-family: sans-serif;';
      }

      return `
        <tr style="${it.status === '❌ NOT APPROVAL' ? 'background-color: #FEF2F2; opacity: 0.65;' : ''}">
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #E5E7EB; font-family: monospace;">${it.sr}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; font-family: monospace; font-weight: bold; color: #374151;">${it.partNumber || '—'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; font-weight: bold; color: #111827;">${it.partName}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #E5E7EB; font-weight: 600; font-size: 13px;">
            <span style="${statusStyle}">${it.status}</span>
          </td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #E5E7EB; font-weight: bold;">${it.qty}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #E5E7EB; color: #6B7280; font-size: 11px;">${it.unitCategory}</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #E5E7EB; font-family: monospace;">₹${it.price.toLocaleString('en-IN')}</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-family: monospace;">${it.taxes}%</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #E5E7EB; font-weight: bold; font-family: monospace; color: #111827;">
            ${it.status === '❌ NOT APPROVAL' ? '<span style="color: #9CA3AF; font-size:11px;">Excluded</span>' : `₹${it.amount.toLocaleString('en-IN')}`}
          </td>
        </tr>
      `;
    }).join('');

    const formattedDate = new Date(details.invoiceDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const fullDocHtml = `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Quotation — ${details.vehicleNo || 'HARMAN_AUTO_BOT'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght=500;700&family=Inter:wght=400;500;600;700&display=swap');
            body {
              background: #F3F4F6;
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #1F2937;
              padding: 40px;
              margin: 0;
            }
            .quotation-card {
              background: white;
              border-radius: 16px;
              border: 1px solid #E5E7EB;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
              max-w: 230mm;
              margin: 0 auto;
              padding: 40px;
              box-sizing: border-box;
            }
            .header-strip {
              border-bottom: 4px solid #DC2626;
              padding-bottom: 24px;
              margin-bottom: 30px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .brand-title {
              font-family: 'Space Grotesk', sans-serif;
              font-weight: 700;
              font-size: 32px;
              color: #DC2626;
              margin: 0;
              letter-spacing: -0.5px;
            }
            .brand-subtitle {
              font-size: 11px;
              color: #4B5563;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              font-weight: 600;
              margin-top: 4px;
            }
            .quote-badge {
              background: #FEF2F2;
              border: 1px solid #FCA5A5;
              color: #DC2626;
              font-weight: 700;
              text-transform: uppercase;
              padding: 6px 12px;
              border-radius: 6px;
              font-size: 11px;
              letter-spacing: 1px;
              display: inline-block;
            }
            .meta-grid {
              display: grid;
              grid-template-cols: repeat(3, 1fr);
              gap: 20px;
              background-color: #F9FAFB;
              border: 1px solid #E5E7EB;
              border-radius: 10px;
              padding: 20px;
              margin-bottom: 30px;
              font-size: 13px;
            }
            .meta-field {
              margin-bottom: 4px;
            }
            .meta-label {
              color: #6B7280;
              font-size: 10px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .meta-value {
              font-weight: bold;
              color: #111827;
              font-size: 14px;
              font-family: 'Space Grotesk', sans-serif;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
              font-size: 12px;
            }
            th {
              background-color: #111827;
              color: white;
              padding: 12px 10px;
              font-weight: 600;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.5px;
            }
            .totals-container {
              display: flex;
              justify-content: flex-end;
              margin-top: 20px;
            }
            .totals-table {
              width: 320px;
              border-collapse: collapse;
              font-size: 13px;
            }
            .totals-table td {
              padding: 8px 12px;
              border-bottom: 1px solid #F3F4F6;
            }
            .totals-row-prime {
              font-size: 16px;
              font-weight: bold;
              background-color: #FEF2F2;
              color: #DC2626;
            }
            .totals-row-prime td {
              border-top: 2px solid #FCA5A5;
              border-bottom: 2px solid #FCA5A5;
              padding: 12px;
            }
            .signatures {
              margin-top: 60px;
              display: grid;
              grid-template-cols: repeat(3, 1fr);
              gap: 30px;
              text-align: center;
              font-size: 10px;
              color: #6B7280;
              font-weight: 600;
              text-transform: uppercase;
            }
            .signature-line {
              border-top: 1px solid #D1D5DB;
              padding-top: 8px;
            }
          </style>
        </head>
        <body onload="window.print()">
          <div class="quotation-card">
            
            <div class="header-strip">
              <div>
                <h1 class="brand-title">HARMAN AUTO BOT v3.0</h1>
                <div class="brand-subtitle">Enterprise Digital Workshop Network & Smart Quotation Systems</div>
              </div>
              <div style="text-align: right;">
                <div class="quote-badge">AUTOMATED ESTIMATION</div>
                <div style="font-size: 10px; color: #4B5563; font-weight: bold; margin-top: 6px; font-family: monospace;">SYSTEM ID: E-3000-RE</div>
              </div>
            </div>
 
             <div class="meta-grid">
               <div>
                 <div class="meta-field">
                   <span class="meta-label">Customer / Client</span>
                   <div class="meta-value">${details.customerName}</div>
                 </div>
                 <div class="meta-field" style="margin-top: 10px;">
                   <span class="meta-label">Contact Number</span>
                   <div class="meta-value" style="font-family: monospace; font-size:13px;">+91 ${details.mobile}</div>
                 </div>
               </div>
               <div>
                 <div class="meta-field">
                   <span class="meta-label">Vehicle Registration No.</span>
                   <div class="meta-value" style="color:#DC2626; letter-spacing:0.5px;">${details.vehicleNo}</div>
                 </div>
                 <div class="meta-field" style="margin-top: 10px;">
                   <span class="meta-label">Vehicle Model & Make</span>
                   <div class="meta-value" style="color: #4B5563;">${details.vehicleModel}</div>
                 </div>
               </div>
               <div>
                 <div class="meta-field">
                   <span class="meta-label">Job Card Number</span>
                   <div class="meta-value" style="font-family: monospace; color: #1E3A8A;">${details.jobCardNo || '—'}</div>
                 </div>
                 <div class="meta-field" style="margin-top: 10px;">
                   <span class="meta-label">Insurance / Surveyor</span>
                   <div class="meta-value" style="font-size: 13px; color: #374151;">
                     ${details.insuranceCompany || 'Cash Work'} ${details.surveyorName ? ` / ${details.surveyorName}` : ''}
                   </div>
                 </div>
               </div>
               <div style="grid-column: span 3; border-top: 1px solid #E5E7EB; padding-top: 12px; margin-top: 4px; display: flex; justify-content: space-between; align-items: center;">
                 <div>
                   <span class="meta-label" style="display-inline: block; margin-right: 8px;">Quotation Date:</span>
                   <span style="font-weight: bold; color: #374151;">${formattedDate}</span>
                 </div>
                 <div>
                   <span class="meta-label" style="display-inline: block; margin-right: 8px;">Validity:</span>
                   <span style="font-weight: bold; color: #374151;">15 Days from Date of Issue</span>
                 </div>
               </div>
             </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 5%; text-align: center;">Sr</th>
                  <th style="width: 15%; text-align: left;">Part Number</th>
                  <th style="width: 32%; text-align: left;">Part Name / Particulars</th>
                  <th style="width: 18%; text-align: center;">Approval Status</th>
                  <th style="width: 6%; text-align: center;">Qty</th>
                  <th style="width: 8%; text-align: center;">Unit</th>
                  <th style="width: 12%; text-align: right;">Unit Price</th>
                  <th style="width: 6%; text-align: right;">GST</th>
                  <th style="width: 12%; text-align: right;">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows || '<tr><td colspan="9" style="text-align:center; padding: 20px; color:#4B5563; font-style:italic;">No spare parts compiled. Please manually add columns.</td></tr>'}
              </tbody>
            </table>

            <div class="totals-container">
              <table class="totals-table">
                <tr>
                  <td style="color: #6B7280; font-weight: 500;">Approved Parts Subtotal</td>
                  <td style="text-align: right; font-weight: bold; font-family: monospace;">₹${calculations.subtotal.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td style="color: #6B7280; font-weight: 500;">Aggregated GST (Taxes)</td>
                  <td style="text-align: right; font-weight: bold; font-family: monospace; color: #4B5563;">₹${calculations.totalTaxAmount.toLocaleString('en-IN')}</td>
                </tr>
                <tr class="totals-row-prime">
                  <td>GRAND TOTAL (INR)</td>
                  <td style="text-align: right; font-family: monospace;">₹${calculations.grandTotal.toLocaleString('en-IN')}</td>
                </tr>
              </table>
            </div>

            <div style="margin-top: 40px; padding: 15px; background: #FFFEEF; border: 1px solid #FCD34D; border-radius: 8px; font-size: 11px; color: #78350F; line-height: 1.5;">
              <strong>Terms & Conditions (नियम व शर्तें):</strong><br/>
              1. This is an auto-generated workshop estimation sheet based on system diagnostics analysis.<br/>
              2. Items marked with 'NOT APPROVAL' are excluded from calculations and total quotation figures.<br/>
              3. Final dismantling & job completion remains subject to unseen damages found during active repairs.
            </div>

            <div class="signatures">
              <div class="signature-line">Workshop Advisor Sign</div>
              <div class="signature-line" style="color: #DC2626;">HARMAN AUTOBOT AUTH. PRINT</div>
              <div class="signature-line">Authorized Customer Sign</div>
            </div>

          </div>
        </body>
      </html>`;

    const fileBlob = new Blob([fullDocHtml], { type: 'text/html' });
    const fileUrl = URL.createObjectURL(fileBlob);
    
    // Create download trigger element
    const dlLink = document.createElement('a');
    const cleanVeh = (details.vehicleNo || 'ESTIMATE').replace(/[^a-zA-Z0-9]/g, '_');
    dlLink.href = fileUrl;
    dlLink.download = `Quotation_${cleanVeh}_Compiled.html`;
    document.body.appendChild(dlLink);
    dlLink.click();
    
    // Clean up cache reference
    document.body.removeChild(dlLink);
    URL.revokeObjectURL(fileUrl);
  };

  // High fidelity raw HTML window quotation generator for beautiful printing
  const handlePrintQuotation = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    // Format individual table entries
    const tableRows = items.map((it) => {
      // Inline status indicator pill formatting for print mode
      let statusStyle = 'color: #10B981; font-weight: bold; font-family: sans-serif;'; // Approved
      if (it.status === '❌ NOT APPROVAL') {
        statusStyle = 'color: #EF4444; font-weight: bold; font-family: sans-serif; text-decoration: line-through;';
      } else if (it.status === 'SUSPECTED ⚠️') {
        statusStyle = 'color: #F59E0B; font-weight: bold; font-family: sans-serif;';
      }

      return `
        <tr style="${it.status === '❌ NOT APPROVAL' ? 'background-color: #FEF2F2; opacity: 0.65;' : ''}">
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #E5E7EB; font-family: monospace;">${it.sr}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; font-family: monospace; font-weight: bold; color: #374151;">${it.partNumber || '—'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; font-weight: bold; color: #111827;">${it.partName}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #E5E7EB; font-weight: 600; font-size: 13px;">
            <span style="${statusStyle}">${it.status}</span>
          </td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #E5E7EB; font-weight: bold;">${it.qty}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #E5E7EB; color: #6B7280; font-size: 11px;">${it.unitCategory}</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #E5E7EB; font-family: monospace;">₹${it.price.toLocaleString('en-IN')}</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-family: monospace;">${it.taxes}%</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #E5E7EB; font-weight: bold; font-family: monospace; color: #111827;">
            ${it.status === '❌ NOT APPROVAL' ? '<span style="color: #9CA3AF; font-size:11px;">Excluded</span>' : `₹${it.amount.toLocaleString('en-IN')}`}
          </td>
        </tr>
      `;
    }).join('');

    const formattedDate = new Date(details.invoiceDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    printWin.document.write(`
      <html>
        <head>
          <title>Quotation — HARMAN AUTO BOT v3.0</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
            @media print {
              body {
                background: white !important;
                color: black !important;
                padding: 0 !important;
              }
              .no-print {
                display: none !important;
              }
              .quotation-card {
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            body {
              background: #F3F4F6;
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #1F2937;
              padding: 40px;
              margin: 0;
            }
            .quotation-card {
              background: white;
              border-radius: 16px;
              border: 1px solid #E5E7EB;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
              max-w: 230mm;
              margin: 0 auto;
              padding: 40px;
              box-sizing: border-box;
            }
            .header-strip {
              border-bottom: 4px solid #DC2626;
              padding-bottom: 24px;
              margin-bottom: 30px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .brand-title {
              font-family: 'Space Grotesk', sans-serif;
              font-weight: 700;
              font-size: 32px;
              color: #DC2626;
              margin: 0;
              letter-spacing: -0.5px;
            }
            .brand-subtitle {
              font-size: 11px;
              color: #4B5563;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              font-weight: 600;
              margin-top: 4px;
            }
            .quote-badge {
              background: #FEF2F2;
              border: 1px solid #FCA5A5;
              color: #DC2626;
              font-weight: 700;
              text-transform: uppercase;
              padding: 6px 12px;
              border-radius: 6px;
              font-size: 11px;
              letter-spacing: 1px;
              display: inline-block;
            }
            .meta-grid {
              display: grid;
              grid-template-cols: repeat(3, 1fr);
              gap: 20px;
              background-color: #F9FAFB;
              border: 1px solid #E5E7EB;
              border-radius: 10px;
              padding: 20px;
              margin-bottom: 30px;
              font-size: 13px;
            }
            .meta-field {
              margin-bottom: 4px;
            }
            .meta-label {
              color: #6B7280;
              font-size: 10px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .meta-value {
              font-weight: bold;
              color: #111827;
              font-size: 14px;
              font-family: 'Space Grotesk', sans-serif;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
              font-size: 12px;
            }
            th {
              background-color: #111827;
              color: white;
              padding: 12px 10px;
              font-weight: 600;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.5px;
            }
            .totals-container {
              display: flex;
              justify-content: flex-end;
              margin-top: 20px;
            }
            .totals-table {
              width: 320px;
              border-collapse: collapse;
              font-size: 13px;
            }
            .totals-table td {
              padding: 8px 12px;
              border-bottom: 1px solid #F3F4F6;
            }
            .totals-row-prime {
              font-size: 16px;
              font-weight: bold;
              background-color: #FEF2F2;
              color: #DC2626;
            }
            .totals-row-prime td {
              border-top: 2px solid #FCA5A5;
              border-bottom: 2px solid #FCA5A5;
              padding: 12px;
            }
            .signatures {
              margin-top: 60px;
              display: grid;
              grid-template-cols: repeat(3, 1fr);
              gap: 30px;
              text-align: center;
              font-size: 10px;
              color: #6B7280;
              font-weight: 600;
              text-transform: uppercase;
            }
            .signature-line {
              border-top: 1px solid #D1D5DB;
              padding-top: 8px;
            }
          </style>
        </head>
        <body onload="window.print()">
          <div class="quotation-card">
            
            <!-- Company banner info -->
            <div class="header-strip">
              <div>
                <h1 class="brand-title">HARMAN AUTO BOT v3.0</h1>
                <div class="brand-subtitle">Enterprise Digital Workshop Network & Smart Quotation Systems</div>
              </div>
              <div style="text-align: right;">
                <div class="quote-badge">AUTOMATED ESTIMATION</div>
                <div style="font-size: 10px; color: #4B5563; font-weight: bold; margin-top: 6px; font-family: monospace;">SYSTEM ID: E-3000-RE</div>
              </div>
            </div>

            <!-- Customer & Vehicle detail grid -->
            <div class="meta-grid">
              <div>
                <div class="meta-field">
                  <span class="meta-label">Customer / Client</span>
                  <div class="meta-value">${details.customerName}</div>
                </div>
                <div class="meta-field" style="margin-top: 10px;">
                  <span class="meta-label">Contact Number</span>
                  <div class="meta-value" style="font-family: monospace; font-size:13px;">+91 ${details.mobile}</div>
                </div>
              </div>
              <div>
                <div class="meta-field">
                  <span class="meta-label">Vehicle Registration No.</span>
                  <div class="meta-value" style="color:#DC2626; letter-spacing:0.5px;">${details.vehicleNo}</div>
                </div>
                <div class="meta-field" style="margin-top: 10px;">
                  <span class="meta-label">Vehicle Model & Make</span>
                  <div class="meta-value" style="color: #4B5563;">${details.vehicleModel}</div>
                </div>
              </div>
              <div>
                <div class="meta-field">
                  <span class="meta-label">Job Card Number</span>
                  <div class="meta-value" style="font-family: monospace; color: #1E3A8A;">${details.jobCardNo || '—'}</div>
                </div>
                <div class="meta-field" style="margin-top: 10px;">
                  <span class="meta-label">Insurance / Surveyor</span>
                  <div class="meta-value" style="font-size: 13px; color: #374151;">
                    ${details.insuranceCompany || 'Cash Work'} ${details.surveyorName ? ` / ${details.surveyorName}` : ''}
                  </div>
                </div>
              </div>
              <div style="grid-column: span 3; border-top: 1px solid #E5E7EB; padding-top: 12px; margin-top: 4px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span class="meta-label" style="display-inline: block; margin-right: 8px;">Quotation Date:</span>
                  <span style="font-weight: bold; color: #374151;">${formattedDate}</span>
                </div>
                <div>
                  <span class="meta-label" style="display-inline: block; margin-right: 8px;">Validity:</span>
                  <span style="font-weight: bold; color: #374151;">15 Days from Date of Issue</span>
                </div>
              </div>
            </div>

            <!-- Structured breakdown table -->
            <table>
              <thead>
                <tr>
                  <th style="width: 5%; text-align: center;">Sr</th>
                  <th style="width: 15%; text-align: left;">Part Number</th>
                  <th style="width: 32%; text-align: left;">Part Name / Particulars</th>
                  <th style="width: 18%; text-align: center;">Approval Status</th>
                  <th style="width: 6%; text-align: center;">Qty</th>
                  <th style="width: 8%; text-align: center;">Unit</th>
                  <th style="width: 12%; text-align: right;">Unit Price</th>
                  <th style="width: 6%; text-align: right;">GST</th>
                  <th style="width: 12%; text-align: right;">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows || '<tr><td colspan="9" style="text-align:center; padding: 20px; color:#4B5563; font-style:italic;">No spare parts compiled. Please manually add columns.</td></tr>'}
              </tbody>
            </table>

            <!-- Calculation summary values -->
            <div class="totals-container">
              <table class="totals-table">
                <tr>
                  <td style="color: #6B7280; font-weight: 500;">Approved Parts Subtotal</td>
                  <td style="text-align: right; font-weight: bold; font-family: monospace;">₹${calculations.subtotal.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td style="color: #6B7280; font-weight: 500;">Aggregated GST (Taxes)</td>
                  <td style="text-align: right; font-weight: bold; font-family: monospace; color: #4B5563;">₹${calculations.totalTaxAmount.toLocaleString('en-IN')}</td>
                </tr>
                <tr class="totals-row-prime">
                  <td>GRAND TOTAL (INR)</td>
                  <td style="text-align: right; font-family: monospace;">₹${calculations.grandTotal.toLocaleString('en-IN')}</td>
                </tr>
              </table>
            </div>

            <!-- Legal terms notice block -->
            <div style="margin-top: 40px; padding: 15px; background: #FFFEEF; border: 1px solid #FCD34D; border-radius: 8px; font-size: 11px; color: #78350F; line-height: 1.5;">
              <strong>Terms & Conditions (नियम व शर्तें):</strong><br/>
              1. This is an auto-generated workshop estimation sheet based on system diagnostics analysis.<br/>
              2. Items marked with 'NOT APPROVAL' are excluded from calculations and total quotation figures.<br/>
              3. Final dismantling & job completion remains subject to unseen damages found during active repairs.
            </div>

            <!-- Signatures column footer -->
            <div class="signatures">
              <div class="signature-line">Workshop Advisor Sign</div>
              <div class="signature-line" style="color: #DC2626;">HARMAN AUTOBOT AUTH. PRINT</div>
              <div class="signature-line">Authorized Customer Sign</div>
            </div>

          </div>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-y-auto max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6" id="pdf_estimation_tab_container">
      
      {/* Dynamic Header Badge */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-red-50 text-red-600 font-bold text-[10px] uppercase font-mono tracking-wider border border-red-200 px-2.5 py-0.5 rounded-full">
              Automated Operations HUD
            </span>
            <span className="bg-blue-50 text-blue-600 font-bold text-[10px] uppercase font-mono tracking-wider border border-blue-200 px-2.5 py-0.5 rounded-full">
              v3.0 Engine
            </span>
          </div>
          <h2 className="text-xl font-sans font-black tracking-tight text-gray-800 flex items-center gap-2">
            👨‍🔧 PDF Estimation & Quotation Creator
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-normal max-w-2xl">
            Upload workshop PDF estimation reports to automatically extract items, override customer metrics, assign specific approval consensus, and compile beautiful print-ready invoice quotations.
          </p>
        </div>

        {/* Global Toolbar Options */}
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <button
            onClick={handleLoadSampleData}
            id="estimations_load_sample_btn"
            className="flex-1 sm:flex-none py-2 px-3 text-xs font-bold bg-[#1E293B] hover:bg-[#0F172A] active:bg-black text-white hover:text-amber-300 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            Populate Sample Spares
          </button>
          
          <button
            onClick={handleAddManualRow}
            id="estimations_add_manual_btn"
            className="flex-1 sm:flex-none py-2 px-3 text-xs font-bold bg-white border border-gray-300 hover:bg-gray-100 active:bg-gray-200/60 text-gray-700 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
            Add Custom Parts Line
          </button>

          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              id="estimations_clear_all_btn"
              className="flex-1 sm:flex-none py-2 px-3 text-xs font-bold bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Dataset
            </button>
          )}

          <button
            onClick={handlePrintQuotation}
            id="estimations_print_quote_btn"
            disabled={items.length === 0}
            className="w-full sm:w-auto py-2.5 px-4 text-xs font-black bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-40 disabled:pointer-events-none text-white rounded-lg shadow-md transition flex items-center justify-center gap-2 cursor-pointer border border-red-500/10"
          >
            <Printer className="w-4 h-4" />
            Print Proper Quotation
          </button>

          <button
            onClick={handleDownloadQuotationFile}
            id="estimations_download_pdf_btn"
            disabled={items.length === 0}
            className="w-full sm:w-auto py-2.5 px-4 text-xs font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:pointer-events-none text-white rounded-lg shadow-md transition flex items-center justify-center gap-2 cursor-pointer border border-blue-500/10"
            title="Download fully optimized HTML quotation with auto-printing support"
          >
            <Download className="w-4 h-4" />
            Download Compiled PDF
          </button>
        </div>
      </div>

      {/* ERROR CONSOLE */}
      {errorMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-widest">Parsing Notice Log</h4>
            <p className="text-xs text-amber-700 mt-1 leading-normal">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* DOUBLE GRIDS AREA */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* INPUT FORM AND GRID BUILDER */}
        <div className="xl:col-span-8 bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
          
          <div className="border-b border-gray-150 p-5 bg-gray-50/55 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="font-bold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" /> Inbound Database Configuration
            </h3>

            {/* Smart PDF Uploader */}
            <label className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer self-start md:self-auto shadow-sm">
              {isParsing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Mining PDF Structure...
                </>
              ) : (
                <>
                  <FileUp className="w-3.5 h-3.5" /> Direct PDF Upload & Scan
                </>
              )}
              <input
                type="file"
                accept=".pdf"
                disabled={isParsing}
                onChange={handlePdfUploadAndExtract}
                className="hidden"
              />
            </label>
          </div>

          <div className="p-5 space-y-6">
            
            {/* Meta input boxes for details */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/70 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" /> Customer Name
                </label>
                <input
                  type="text"
                  value={details.customerName}
                  onChange={(e) => setDetails({ ...details, customerName: e.target.value })}
                  placeholder="e.g. Mukesh Kumar"
                  className="w-full bg-white border border-gray-300 text-gray-800 py-1.5 px-3 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none font-bold"
                  id="estimator_cust_name"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-slate-400" /> Mobile Number
                </label>
                <input
                  type="text"
                  value={details.mobile}
                  onChange={(e) => setDetails({ ...details, mobile: e.target.value })}
                  placeholder="10-digit number"
                  className="w-full bg-white border border-gray-300 text-gray-800 py-1.5 px-3 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                  id="estimator_mobile"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-slate-400" /> Registration Number (Vehicle No)
                </label>
                <input
                  type="text"
                  value={details.vehicleNo}
                  onChange={(e) => setDetails({ ...details, vehicleNo: e.target.value.toUpperCase() })}
                  placeholder="e.g. MH02EK4014"
                  className="w-full bg-white border border-gray-300 text-gray-800 py-1.5 px-3 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none uppercase font-bold text-blue-700"
                  id="estimator_vehicle_no"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-slate-400" /> Vehicle Model
                </label>
                <input
                  type="text"
                  value={details.vehicleModel}
                  onChange={(e) => setDetails({ ...details, vehicleModel: e.target.value })}
                  placeholder="e.g. Fortuner Sigma 4"
                  className="w-full bg-white border border-gray-300 text-gray-800 py-1.5 px-3 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none font-semibold"
                  id="estimator_vehicle_model"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Quotation Date
                </label>
                <input
                  type="date"
                  value={details.invoiceDate}
                  onChange={(e) => setDetails({ ...details, invoiceDate: e.target.value })}
                  className="w-full bg-white border border-gray-300 text-gray-800 py-1.5 px-3 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                  id="estimator_invoice_date"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-slate-400" /> Job Card No.
                </label>
                <input
                  type="text"
                  value={details.jobCardNo || ''}
                  onChange={(e) => setDetails({ ...details, jobCardNo: e.target.value })}
                  placeholder="e.g. JC-2026-089"
                  className="w-full bg-white border border-gray-300 text-gray-800 py-1.5 px-3 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none font-semibold"
                  id="estimator_job_card_no"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-slate-400" /> Insurance Company
                </label>
                <select
                  value={details.insuranceCompany || 'Cash Work'}
                  onChange={(e) => setDetails({ ...details, insuranceCompany: e.target.value })}
                  className="w-full bg-white border border-gray-300 text-gray-800 py-1.5 px-3 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none font-semibold"
                  id="estimator_insurance_company"
                >
                  {INSURANCE_COMPANIES.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                  {details.insuranceCompany && !INSURANCE_COMPANIES.includes(details.insuranceCompany) && (
                    <option value={details.insuranceCompany}>{details.insuranceCompany}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-slate-400" /> Surveyor Name
                </label>
                <input
                  type="text"
                  value={details.surveyorName || ''}
                  onChange={(e) => setDetails({ ...details, surveyorName: e.target.value })}
                  placeholder="Enter Surveyor name"
                  className="w-full bg-white border border-gray-300 text-gray-800 py-1.5 px-3 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none font-semibold"
                  id="estimator_surveyor_name"
                />
              </div>

            </div>

            {/* Editable Spreadsheet Table Columns */}
            <div className="overflow-x-auto border border-gray-150 rounded-lg shadow-inner">
              <table className="w-full text-left text-xs text-gray-700 border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 text-[9px] font-bold tracking-wider text-gray-500 uppercase select-none">
                    <th className="py-3 px-3 text-center w-10">Sr</th>
                    <th className="py-3 px-3 w-32">Part Number</th>
                    <th className="py-3 px-3">Part Name Particulars</th>
                    <th className="py-3 px-3 w-40 text-center">Approval Status</th>
                    <th className="py-3 px-3 w-16 text-center">Qty</th>
                    <th className="py-3 px-3 w-16 text-center">Unit</th>
                    <th className="py-3 px-3 w-24 text-right">Price (₹)</th>
                    <th className="py-3 px-3 w-16 text-right">Taxes (GST %)</th>
                    <th className="py-3 px-3 w-28 text-right">Amount (₹)</th>
                    <th className="py-3 px-3 text-center w-10">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 bg-white">
                  {items.length > 0 ? (
                    items.map((it) => (
                      <tr 
                        key={it.id} 
                        className={`hover:bg-slate-50/50 transition-colors ${
                          it.status === '❌ NOT APPROVAL' ? 'bg-red-50/40 opacity-70' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center text-gray-400 font-mono text-[11px]">
                          {it.sr}
                        </td>
                        
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={it.partNumber}
                            onChange={(e) => handleUpdateItem(it.id, 'partNumber', e.target.value.toUpperCase())}
                            placeholder="e.g. 52119-0K920"
                            className="bg-white border border-gray-300 text-gray-800 text-[11px] font-mono py-1 px-1.5 rounded-md w-full focus:outline-none focus:border-blue-500"
                          />
                        </td>

                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={it.partName}
                            onChange={(e) => handleUpdateItem(it.id, 'partName', e.target.value)}
                            placeholder="e.g. Front Bumper Cover v3"
                            className="bg-white border border-gray-300 text-gray-800 text-[11px] font-semibold py-1 px-1.5 rounded-md w-full focus:outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Status dropdown requested after Part Name */}
                        <td className="py-2.5 px-3 text-center">
                          <select
                            value={it.status}
                            onChange={(e) => handleUpdateItem(it.id, 'status', e.target.value)}
                            className={`text-[10px] font-bold py-1 px-2 rounded-md border focus:outline-none ${
                              it.status === '✔️APPROVED' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                                : it.status === '❌ NOT APPROVAL'
                                ? 'bg-rose-50 text-rose-700 border-rose-300 line-through'
                                : 'bg-amber-50 text-amber-700 border-amber-300'
                            }`}
                          >
                            <option value="✔️APPROVED">✔️ APPROVED</option>
                            <option value="❌ NOT APPROVAL">❌ NOT APPROVAL</option>
                            <option value="SUSPECTED ⚠️">SUSPECTED ⚠️</option>
                          </select>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min={1}
                            value={String(it.qty)}
                            onChange={(e) => handleUpdateItem(it.id, 'qty', parseInt(e.target.value) || 1)}
                            className="bg-white border border-gray-300 text-gray-800 text-[11px] font-bold py-1 px-1.5 rounded-md w-12 text-center focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="text"
                            value={it.unitCategory}
                            onChange={(e) => handleUpdateItem(it.id, 'unitCategory', e.target.value)}
                            placeholder="PCS"
                            className="bg-white border border-gray-300 text-gray-500 py-1 px-1 rounded-md w-12 text-center text-[10px] focus:outline-none"
                          />
                        </td>

                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min={0}
                            value={String(it.price)}
                            onChange={(e) => handleUpdateItem(it.id, 'price', parseFloat(e.target.value) || 0)}
                            className="bg-white border border-gray-300 text-slate-900 text-[11px] font-bold py-1 px-1.5 rounded-md w-20 text-right focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </td>

                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={String(it.taxes)}
                            onChange={(e) => handleUpdateItem(it.id, 'taxes', parseFloat(e.target.value) || 0)}
                            className="bg-white border border-gray-300 text-slate-500 text-[11px] py-1 px-1.5 rounded-md w-14 text-right focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-850">
                          {it.status === '❌ NOT APPROVAL' ? (
                            <span className="text-gray-400 font-sans font-medium text-[10px]">Excluded</span>
                          ) : (
                            `₹${it.amount.toLocaleString('en-IN')}`
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(it.id)}
                            className="text-gray-400 hover:text-red-650 p-1 rounded hover:bg-red-50 cursor-pointer transition-colors"
                            title="Delete Line Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>

                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-gray-400 italic">
                        No estimation rows registered yet. Please upload a PDF report or click 'Populate Sample Spares'!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>

        {/* COMPREHENSIVE SIDEBAR SUMMARY PREVIEW */}
        <div className="xl:col-span-4 bg-white border border-gray-200 rounded-xl shadow-xs p-5 space-y-5">
          <h3 className="font-bold text-xs text-gray-800 uppercase tracking-widest flex items-center gap-1.5 pb-3 border-b border-gray-150">
            📊 Cost Quotation Summary
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center text-slate-500 font-medium">
              <span>Included Items (Qty):</span>
              <span className="font-bold text-slate-800">
                {items.filter(it => it.status !== '❌ NOT APPROVAL').length} of {items.length} Lines
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-500">
              <span>Parts Base Cost:</span>
              <span className="font-mono text-slate-800 font-bold">
                ₹{calculations.subtotal.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-500 pb-3 border-b border-gray-200/60">
              <span>Taxes & GST:</span>
              <span className="font-mono text-slate-800 font-semibold">
                ₹{calculations.totalTaxAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="pt-2 flex justify-between items-center text-sm font-bold">
              <span className="text-gray-800">Grand Total:</span>
              <span className="text-red-600 font-sans text-lg font-black">
                ₹{calculations.grandTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* PDF OPTIMIZER & COMPILER HUDS CARD */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 shadow-2xs">
            <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-150">
              <Cpu className="w-4 h-4 text-slate-500 animate-pulse" /> Compiled PDF Diagnostics
            </h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-150">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">
                  Est. File Size
                </span>
                <span className="text-sm font-black text-slate-800 font-mono">
                  {pdfOptimizerStats.totalEstimatedKB} <span className="text-[10px] font-semibold text-slate-500">KB</span>
                </span>
                <span className="text-[9px] text-gray-400 block mt-0.5">
                  ({pdfOptimizerStats.totalEstimatedBytes.toLocaleString()} B)
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-150 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">
                    Complexity Index
                  </span>
                  <span className="text-sm font-black text-slate-800 font-mono">
                    {pdfOptimizerStats.complexityScore} <span className="text-[10px] font-semibold text-slate-500 font-medium">/ 100</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Complexity Indicator Status Strip */}
            <div className={`text-[11px] font-bold py-1.5 px-3 rounded-lg border flex items-center justify-between ${pdfOptimizerStats.complexityColor}`}>
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                Tier: {pdfOptimizerStats.complexityTier}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider">
                ({items.length} items logged)
              </span>
            </div>

            {/* Progress/Gauge indicator bar */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                <span>Vector Overhead Gauge</span>
                <span>{pdfOptimizerStats.complexityScore}% Used</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    pdfOptimizerStats.complexityScore < 30 
                      ? 'bg-green-500' 
                      : pdfOptimizerStats.complexityScore <= 60 
                      ? 'bg-blue-500' 
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${pdfOptimizerStats.complexityScore}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-normal pt-1">
                Size dynamically calculates based on embedded fonts, 44KB branding vector, table row complexity ({pdfOptimizerStats.counts.approved} Approved, {pdfOptimizerStats.counts.suspected} Suspected, {pdfOptimizerStats.counts.rejected} Excluded) & layout parameters.
              </p>
            </div>
          </div>

          {/* Quick Guidance Card */}
          <div className="bg-red-50/40 border border-red-200/60 rounded-xl p-4 text-xs text-red-800 leading-relaxed font-sans">
            <div className="flex items-center gap-1.5 font-bold mb-1 uppercase tracking-wide text-red-950">
              <CheckCircle className="w-4 h-4 text-red-600" /> Redirection Notice
            </div>
            When you complete configuring the spreadsheet database above, tap <strong className="text-red-950">"Print Proper Quotation"</strong>. It will instantly render the completely rebuilt print page featuring your customized <strong className="text-red-600">HARMAN AUTO BOT v3.0</strong> corporate red banner.
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex gap-2">
            <FileText className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-normal">
              <strong>Table Column Format Match:</strong><br/>
              Our advanced scanning engine parses PDF layouts matching: <em>"Sr, Part Number, Part Name, Qty, unit Category, price, taxes, amount"</em>. Non-conforming columns degrade to automatic smart mapping.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
