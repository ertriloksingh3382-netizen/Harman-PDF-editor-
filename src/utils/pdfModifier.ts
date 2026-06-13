/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { AllEdits, PdfTextBlock, PdfEdit } from '../types';

/**
 * Helper to convert HEX color string to PDF-Lib RGB object
 */
function hexToPdfRgb(hex: string) {
  if (!hex || hex === 'transparent') {
    return rgb(1, 1, 1);
  }
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
}

/**
 * Modifies the original PDF bytes by overlaying masks and inserting vector edits.
 */
export async function exportModifiedPdf(
  originalPdfBytes: Uint8Array,
  edits: AllEdits,
  blockMetadata: { [blockId: string]: PdfTextBlock }
): Promise<Uint8Array> {
  // 1. Load original document structures
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const pages = pdfDoc.getPages();

  // 2. Embed standard sans-serif, serif, and monospaced vector fonts
  const helveticaRef = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldRef = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaItalicRef = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const helveticaBoldItalicRef = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  const timesRef = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBoldRef = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalicRef = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const timesBoldItalicRef = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);

  const courierRef = await pdfDoc.embedFont(StandardFonts.Courier);
  const courierBoldRef = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const courierItalicRef = await pdfDoc.embedFont(StandardFonts.CourierOblique);
  const courierBoldItalicRef = await pdfDoc.embedFont(StandardFonts.CourierBoldOblique);

  // 3. Apply edits page-by-page
  for (let p = 0; p < pages.length; p++) {
    const pageIndex = p + 1;
    const pageEdits = edits[pageIndex];
    if (!pageEdits) continue; // No modifications on this page
    
    // Get the pdf-lib scale page
    const page = pages[p];

    for (const blockId of Object.keys(pageEdits)) {
      const block = blockMetadata[blockId];
      const edit = pageEdits[blockId];
      if (!block || !edit) continue;

      // Map fonts
      let fontRef = helveticaRef;
      if (edit.fontFamily === 'Courier') {
        if (edit.isBold && edit.isItalic) fontRef = courierBoldItalicRef;
        else if (edit.isBold) fontRef = courierBoldRef;
        else if (edit.isItalic) fontRef = courierItalicRef;
        else fontRef = courierRef;
      } else if (edit.fontFamily === 'Times') {
        if (edit.isBold && edit.isItalic) fontRef = timesBoldItalicRef;
        else if (edit.isBold) fontRef = timesBoldRef;
        else if (edit.isItalic) fontRef = timesItalicRef;
        else fontRef = timesRef;
      } else {
        if (edit.isBold && edit.isItalic) fontRef = helveticaBoldItalicRef;
        else if (edit.isBold) fontRef = helveticaBoldRef;
        else if (edit.isItalic) fontRef = helveticaItalicRef;
        else fontRef = helveticaRef;
      }

      // Base original text metrics
      const xPdf = block.x;
      const yPdf = block.y;
      const originalWidth = block.width;
      const originalHeight = block.height || block.fontSize;
      const fontSizePdf = edit.fontSize || block.fontSize;

      // Estimate the width of the new text at the chosen font size
      let textWidth = originalWidth;
      try {
        textWidth = fontRef.widthOfTextAtSize(edit.text, fontSizePdf);
      } catch (e) {
        // Fallback calculation in case of encoding or lookup issues
        textWidth = edit.text.length * (fontSizePdf * 0.55);
      }

      // Always draw a masking rectangle to cover and erase the original text underneath.
      // Default to white (#FFFFFF) if specified as transparent or undefined.
      const bgToUse = !edit.backgroundColor || edit.backgroundColor === 'transparent' ? '#FFFFFF' : edit.backgroundColor;
      const maskColor = hexToPdfRgb(bgToUse);
      
      // Define bounding box to cover the text nicely (bottom-left coordinate space)
      // Shifting bottom bounds (y) down by 22% of font size to mask character descenders fully
      const maskX = xPdf - 2;
      const maskY = yPdf - (fontSizePdf * 0.22);
      const maskWidth = Math.max(originalWidth, textWidth) + 4;
      const maskHeight = Math.max(originalHeight, fontSizePdf) * 1.25;

      page.drawRectangle({
        x: maskX,
        y: maskY,
        width: maskWidth,
        height: maskHeight,
        color: maskColor,
      });

      // Draw the new edited text on top
      const textColor = hexToPdfRgb(edit.textColor);
      page.drawText(edit.text, {
        x: xPdf,
        y: yPdf,
        size: fontSizePdf,
        font: fontRef,
        color: textColor,
      });
    }
  }

  // 4. Save and return modified document bytes
  return await pdfDoc.save();
}
