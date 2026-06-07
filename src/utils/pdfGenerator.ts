/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Generates a beautiful vector PDF invoice dynamically using pdf-lib.
 * This serves as a quick demonstration document for testing the editor features.
 */
export async function generateSamplePdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 Size in points
  const { width, height } = page.getSize();
  
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  
  // Main title
  page.drawText('HARMAN PDF EDITOR', {
    x: 50,
    y: height - 70,
    size: 24,
    font: helveticaBold,
    color: rgb(0.09, 0.38, 0.74), // Primary Blue
  });

  // Badge
  page.drawRectangle({
    x: width - 170,
    y: height - 73,
    width: 120,
    height: 24,
    color: rgb(0.9, 0.95, 1.0),
  });
  page.drawText('OFFLINE-FIRST', {
    x: width - 150,
    y: height - 64,
    size: 9,
    font: helveticaBold,
    color: rgb(0.09, 0.38, 0.74),
  });
  
  // Decorative divider
  page.drawLine({
    start: { x: 50, y: height - 90 },
    end: { x: width - 50, y: height - 90 },
    thickness: 1.5,
    color: rgb(0.09, 0.38, 0.74),
  });
  
  // Paragraph introduction
  page.drawText('Thank you for trying out Harman PDF Editor! This is a real vector PDF document.', {
    x: 50,
    y: height - 118,
    size: 11,
    font: helveticaBold,
    color: rgb(0.15, 0.2, 0.25),
  });
  
  page.drawText('You can switch to EDIT MODE, hover over any text blocks below, and double-click to modify.', {
    x: 50,
    y: height - 136,
    size: 10,
    font: helveticaFont,
    color: rgb(0.3, 0.35, 0.4),
  });

  page.drawText('The exported PDF will cover the edited text blocks and draw exact vector text in place.', {
    x: 50,
    y: height - 152,
    size: 10,
    font: helveticaFont,
    color: rgb(0.3, 0.35, 0.4),
  });
  
  // Invoice Metadata
  page.drawText('Document Type:', { x: 50, y: height - 195, size: 10, font: helveticaBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('Sample Interactive Invoice', { x: 150, y: height - 195, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });

  page.drawText('Invoice Code:', { x: 50, y: height - 212, size: 10, font: helveticaBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('#INV-2026-6184', { x: 150, y: height - 212, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });

  page.drawText('Created On:', { x: 50, y: height - 229, size: 10, font: helveticaBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('June 4, 2026', { x: 150, y: height - 229, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });

  page.drawText('Prepared For:', { x: 330, y: height - 195, size: 10, font: helveticaBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('Valued Client Inc.', { x: 420, y: height - 195, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });

  page.drawText('Contact Email:', { x: 330, y: height - 212, size: 10, font: helveticaBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('billing@workspace.io', { x: 420, y: height - 212, size: 10, font: helveticaFont, color: rgb(0.09, 0.38, 0.74) });
  
  // Table Header Box
  page.drawRectangle({
    x: 50,
    y: height - 280,
    width: width - 100,
    height: 25,
    color: rgb(0.09, 0.38, 0.74),
  });
  
  // Table Header Labels
  page.drawText('SERVICES DESCRIPTION (EDIT ME)', {
    x: 60,
    y: height - 273,
    size: 10,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });
  
  page.drawText('HOURS', {
    x: 340,
    y: height - 273,
    size: 10,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });
  
  page.drawText('RATE', {
    x: 420,
    y: height - 273,
    size: 10,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });
  
  page.drawText('TOTAL PRICE', {
    x: 500,
    y: height - 273,
    size: 10,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });
  
  // Line Item 1
  page.drawText('Advanced React Web UI Design Implementation', {
    x: 60,
    y: height - 320,
    size: 10,
    font: helveticaFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText('40 hrs', { x: 340, y: height - 320, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('$120.00', { x: 420, y: height - 320, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('$4,800.00', { x: 500, y: height - 320, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });
  
  // Line Item 2
  page.drawText('Vite Core Hot Bundling and Development Support', {
    x: 60,
    y: height - 350,
    size: 10,
    font: helveticaFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText('15 hrs', { x: 340, y: height - 350, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('$150.00', { x: 420, y: height - 350, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('$2,250.00', { x: 500, y: height - 350, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });
  
  // Line Item 3
  page.drawText('Custom Vector Font Mapping & PDF Rendering System', {
    x: 60,
    y: height - 380,
    size: 10,
    font: helveticaFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText('10 hrs', { x: 340, y: height - 380, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('$140.00', { x: 420, y: height - 380, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('$1,400.00', { x: 500, y: height - 380, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });

  // Light separator
  page.drawLine({
    start: { x: 50, y: height - 420 },
    end: { x: width - 50, y: height - 420 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  
  // Totals Section
  page.drawText('Subtotal:', { x: 340, y: height - 450, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('$8,450.00', { x: 500, y: height - 450, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });
  
  page.drawText('Dynamic Discount (10% Off):', { x: 340, y: height - 470, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('-$845.00', { x: 500, y: height - 470, size: 10, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });
  
  page.drawRectangle({
    x: 330,
    y: height - 510,
    width: width - 380,
    height: 30,
    color: rgb(0.95, 0.97, 1.0),
  });
  page.drawText('GRAND TOTAL DUE:', { x: 340, y: height - 500, size: 11, font: helveticaBold, color: rgb(0.09, 0.38, 0.74) });
  page.drawText('$7,605.00', { x: 500, y: height - 500, size: 11, font: helveticaBold, color: rgb(0.09, 0.38, 0.74) });

  // Bottom Notice Box (Decorative)
  page.drawRectangle({
    x: 50,
    y: 120,
    width: width - 100,
    height: 70,
    color: rgb(0.98, 0.98, 0.98),
  });
  
  page.drawText('Important Guidelines:', {
    x: 65,
    y: 172,
    size: 10,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  
  page.drawText('1. Changes made to this document are done entirely in-browser and remain 100% confidential.', {
    x: 65,
    y: 155,
    size: 9,
    font: timesFont,
    color: rgb(0.4, 0.4, 0.4),
  });
  
  page.drawText('2. When you edit and download, the original vector content, images, and layout remain unaffected.', {
    x: 65,
    y: 138,
    size: 9,
    font: timesFont,
    color: rgb(0.4, 0.4, 0.4),
  });
  
  // Footer credit
  page.drawText('This file is open-source and generated at runtime via PDF-Lib. Developed for ertriloksingh3382@gmail.com.', {
    x: 50,
    y: 80,
    size: 8,
    font: helveticaFont,
    color: rgb(0.6, 0.6, 0.6),
  });
  
  return pdfDoc.save();
}
