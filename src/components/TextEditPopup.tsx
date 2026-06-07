/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Check, Type, EyeOff, Baseline, Paintbrush, Bold, Italic } from 'lucide-react';
import { PdfTextBlock, PdfEdit } from '../types';

interface TextEditPopupProps {
  block: PdfTextBlock;
  currentEdit: PdfEdit | null;
  onSave: (edit: PdfEdit) => void;
  onCancel: () => void;
}

const COMMON_COLORS = [
  '#000000', // Black
  '#1E293B', // Slate
  '#172554', // Navy
  '#0961BC', // Primary Blue
  '#DC2626', // Red
  '#16A34A', // Green
  '#CA8A04', // Yellow/Gold
  '#FFFFFF', // White
];

const COMMON_BG_COLORS = [
  '#FFFFFF', // White (Default Background)
  'transparent', // Transparent
  '#F8FAFC', // Slate 50
  '#FFFBEB', // Amber 50
  '#F0FDF4', // Emerald 50
  '#EFF6FF', // Blue 50
  '#000000', // Black Cover
];

export default function TextEditPopup({
  block,
  currentEdit,
  onSave,
  onCancel
}: TextEditPopupProps) {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(12);
  const [fontFamily, setFontFamily] = useState('Helvetica');
  const [textColor, setTextColor] = useState('#000000');
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  // Initialize with current edit values or block values on open
  useEffect(() => {
    if (currentEdit) {
      setText(currentEdit.text);
      setFontSize(currentEdit.fontSize);
      setFontFamily(currentEdit.fontFamily);
      setTextColor(currentEdit.textColor);
      setBackgroundColor(currentEdit.backgroundColor);
      setIsBold(currentEdit.isBold);
      setIsItalic(currentEdit.isItalic);
    } else {
      setText(block.text);
      setFontSize(Math.round(block.fontSize * 10) / 10);
      
      // Auto-identify font family based on block's original font
      let detectedFont = 'Helvetica';
      const orig = (block.fontFamily || block.fontName).toLowerCase();
      if (orig.includes('times') || orig.includes('serif') || orig.includes('roman')) {
        detectedFont = 'Times';
      } else if (orig.includes('courier') || orig.includes('mono') || orig.includes('code')) {
        detectedFont = 'Courier';
      }
      setFontFamily(detectedFont);
      
      // Auto-detect bold/italic weights of original extracted font
      setIsBold(orig.includes('bold') || orig.includes('bd') || block.transform[0] > block.fontSize * 1.05);
      setIsItalic(orig.includes('italic') || orig.includes('oblique') || orig.includes('it'));
      
      setTextColor('#000000');
      setBackgroundColor('#FFFFFF'); // standard default
    }
  }, [block, currentEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      text,
      fontSize,
      fontFamily,
      textColor,
      backgroundColor,
      isBold,
      isItalic
    });
  };

  return (
    <div className="fixed inset-0 bg-[#0F172A]/45 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in" id="edit_modal_backdrop">
      <div 
        className="bg-white rounded-xl w-full max-w-lg shadow-2xl border border-gray-200/80 overflow-hidden flex flex-col max-h-[90vh]"
        id="text_editor_card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gray-50/80 border-b border-gray-150/70 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-sans font-bold text-gray-800 flex items-center gap-2">
              <Baseline className="w-4 h-4 text-blue-600" />
              Edit Text Block
            </h2>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
              Original font: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-500 font-normal normal-case">{block.fontFamily || block.fontName}</span>
            </p>
          </div>
          <button 
            id="close_modal" 
            onClick={onCancel}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Main edited text */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Text Content
            </label>
            <textarea
              id="editor_textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full min-h-[90px] p-3 text-sm font-sans border border-gray-300/80 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100/50 transition outline-none resize-y text-gray-800"
              placeholder="Edit the original text here..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Font Family Selection */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Vector Font (Standard)
              </label>
              <select
                id="font_family_select"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold bg-white border border-gray-300 hover:border-gray-400 rounded-xl focus:border-blue-500 focus:ring-3 focus:ring-blue-100 outline-none transition cursor-pointer"
              >
                <option value="Helvetica">Helvetica (Sans-Serif)</option>
                <option value="Times">Times Roman (Serif)</option>
                <option value="Courier">Courier Standard (Monospace)</option>
              </select>
            </div>

            {/* Font Size Selector */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <Type className="w-3.5 h-3.5" />
                Font Size (pt)
              </label>
              <input
                id="font_size_input"
                type="number"
                step="0.1"
                min="3"
                max="120"
                value={fontSize}
                onChange={(e) => setFontSize(parseFloat(e.target.value) || 12)}
                className="w-full p-2.5 text-xs font-mono font-semibold bg-white border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-3 focus:ring-blue-100 outline-none transition"
              />
            </div>
          </div>

          {/* Bold/Italic Options */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Font Styling (Emphases)
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                id="toggle_bold"
                onClick={() => setIsBold(!isBold)}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  isBold
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Bold className="w-4 h-4" />
                Bold Weight
              </button>
              <button
                type="button"
                id="toggle_italic"
                onClick={() => setIsItalic(!isItalic)}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  isItalic
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Italic className="w-4 h-4" />
                Italic Slant
              </button>
            </div>
          </div>

          {/* Color Palettes Grid (Text & Background) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Text Color Selection */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Paintbrush className="w-3.5 h-3.5 text-gray-400" />
                Text Color
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setTextColor(c)}
                    className={`w-6 h-6 rounded-full border transition-transform cursor-pointer relative shrink-0 ${
                      textColor === c ? 'scale-110 ring-2 ring-blue-500/50 border-white' : 'border-gray-250 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {textColor === c && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold pt-0.5 animate-scale-in" style={{ color: c === '#FFFFFF' ? '#000000' : '#FFFFFF' }}>
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-full px-2.5 py-1.5 text-[10px] font-mono border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                placeholder="Hex value"
              />
            </div>

            {/* Background Cover Mask Color Selection */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5" title="Opacity rectangle to clear old text beneath">
                <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                Cover Mask Color
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_BG_COLORS.map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setBackgroundColor(bg)}
                    className={`w-6 h-6 rounded-full border transition-transform cursor-pointer relative shrink-0 ${
                      backgroundColor === bg ? 'scale-110 ring-2 ring-blue-500/50 border-white' : 'border-gray-250 hover:scale-105'
                    }`}
                    style={{ 
                      backgroundColor: bg === 'transparent' ? '#ffffff' : bg,
                      backgroundImage: bg === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : undefined,
                      backgroundSize: bg === 'transparent' ? '6px 6px' : undefined,
                      backgroundPosition: bg === 'transparent' ? '0 0, 0 3px, 3px -3px, -3px 0px' : undefined
                    }}
                    title={bg === 'transparent' ? 'No cover (Keep original text visible)' : bg}
                  >
                    {backgroundColor === bg && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold pt-0.5 animate-scale-in" style={{ color: bg === '#FFFFFF' || bg === 'transparent' ? '#000000' : '#FFFFFF' }}>
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="w-full px-2.5 py-1.5 text-[10px] font-mono border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                placeholder="Hex bg value"
              />
            </div>
          </div>
        </form>

        {/* Footer actions */}
        <div className="bg-gray-50 border-t border-gray-200/60 p-4 shrink-0 flex items-center justify-end gap-3">
          <button
            type="button"
            id="cancel_block_edit"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            id="save_block_edit"
            onClick={handleSubmit}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
