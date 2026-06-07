/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PdfTextBlock {
  id: string; // Format: page_{pageNumber}_index_{itemIndex}
  pageNumber: number;
  itemIndex: number;
  text: string;
  width: number;
  height: number;
  x: number; // Native PDF coordinates (bottom-left origin)
  y: number; // Native PDF coordinates (bottom-left origin)
  fontSize: number;
  fontName: string; // Raw font key (e.g., g_d0_f1)
  fontFamily: string; // Resolved family name if available
  transform: number[]; // Original 6-element transformation matrix
}

export interface PdfEdit {
  text: string;
  fontSize: number;
  fontFamily: string; // "Helvetica" | "Times" | "Courier"
  textColor: string; // Hex color code (e.g., "#000000")
  backgroundColor: string; // Hex color code (e.g., "#ffffff") or "transparent"
  isBold: boolean;
  isItalic: boolean;
}

export interface PageEdits {
  [blockId: string]: PdfEdit;
}

export interface AllEdits {
  [pageNumber: number]: PageEdits;
}

export interface EstimationItem {
  id: string;
  sr: number;
  partNumber: string;
  partName: string;
  status: '✔️APPROVED' | '❌ NOT APPROVAL' | 'SUSPECTED ⚠️';
  qty: number;
  unitCategory: string;
  price: number;
  taxes: number; // as percentage or absolute
  amount: number;
}

export interface EstimationDetails {
  customerName: string;
  mobile: string;
  vehicleNo: string;
  vehicleModel: string;
  invoiceDate: string;
  jobCardNo?: string;
  insuranceCompany?: string;
  surveyorName?: string;
}

