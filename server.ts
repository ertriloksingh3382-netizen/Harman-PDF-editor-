import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// Lazy initialization of Gemini client to prevent crash if key is temporarily missing
let aiInstance: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please check Settings > Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

function cleanAndFilterParsedData(data: any): any {
  if (!data || !Array.isArray(data.items)) {
    return data;
  }

  const junkKeywords = [
    "advisor", "delivery date", "job card", "claim no", "chassis", "engine no", 
    "policy no", "surveyor", "contact no", "mobile no", "phone no", "email", 
    "address", "customer name", "vehicle no", "reg no", "odometer", "kilometers",
    "km reading", "date in", "time in", "pan no", "tin no", "gstin", "authorized signatory",
    "signature", "watermark", "billing to", "insured", "hsn code", "sac code",
    "estimate no", "quotation no", "milage", "model year", "auto kristan", "kristan auto",
    "kristan", "service advisor", "surveyor name", "customer registration", "tax invoice",
    "date of loss", "loss date", "time of loss", "place of loss", "work order",
    "workshop name", "authorised signatory", "general terms", "salvage details"
  ];

  const totalKeywords = [
    "grand total", "total amount", "net amount", "round off", "subtotal", "sub total",
    "cgst", "sgst", "igst", "utgst", "vat", "cess", "tax total", "total gst",
    "amount in words", "total labour", "total parts", "final amount",
    "payment terms", "terms and conditions", "conditions", "general terms"
  ];

  const cleanItems = data.items.map((item: any) => {
    if (!item || typeof item !== "object") return null;

    let name = String(item.name || "").trim();
    let partNo = String(item.partNo || "").trim();
    
    // Clean leading/trailing layout junk from name
    name = name.replace(/^[-–—\s\d_*#@+|:()]+/, "").trim();
    // Strip trailing columns that sometimes append mistakenly
    name = name.replace(/\s*(?:Customer Price|Price|GST|₹|Tax|Rate|Amount|Qty|Quantity|Unit Price|PCS|UNIT)+s*$/i, "").trim();

    // 1. Detect and repair suffix wraps:
    // If name starts with "-00" or "-01" or similar suffix (e.g. "-00Front bumper")
    const suffixRegex = /^(-[0-9]{2,4})(.*)$/;
    const suffixMatch = name.match(suffixRegex);
    if (suffixMatch) {
      const suffix = suffixMatch[1];
      const remainingName = suffixMatch[2].trim();
      
      // Move suffix to partNo if partNo doesn't already have it
      if (partNo !== "N/A" && partNo && !partNo.endsWith(suffix)) {
        partNo = partNo + suffix;
      }
      name = remainingName;
    }

    // Clean up name prefix one more time after shifting suffix
    name = name.replace(/^[-–—\s\d_*#@+|:()]+/, "").trim();

    // If the partNo has been joined with description like "28 13442643-00LOWER LEFT SUPPORT"
    const nameLower = name.toLowerCase();
    const isNameJunk = nameLower === "gst" || nameLower === "gst ₹" || nameLower === "tax" || nameLower === "taxes" || !name || nameLower === "automotive component" || nameLower === "particulars";
    
    if (partNo && partNo !== "N/A" && isNameJunk) {
      const cleanedPartNo = partNo.trim();
      
      // Test 1: PartNo contains suffix directly followed by alphabetical characters like "13442643-00LOWER"
      const suffixLetterMatch = cleanedPartNo.match(/^(?:\d+\s+)?([A-Z0-9]+-[0-9]{2,4})([A-Za-z_].*)$/i);
      if (suffixLetterMatch) {
        partNo = suffixLetterMatch[1].trim();
        name = suffixLetterMatch[2].trim();
      } else {
        // Test 2: PartNo is followed by space and descriptive letters e.g. "28 13442643-00 LOWER LEFT SUPPORT"
        const spaceAfterPartMatch = cleanedPartNo.match(/^(?:\d+\s+)?([A-Za-z0-9_-]+)\s+([A-Za-z_].*)$/i);
        if (spaceAfterPartMatch) {
          partNo = spaceAfterPartMatch[1].trim();
          name = spaceAfterPartMatch[2].trim();
        } else {
          // Test 3: SNo + space + sub-code / partNo, then multiple tokens e.g. "28 KRS-2627 Automotive Component"
          const partsList = cleanedPartNo.split(/\s+/);
          if (partsList.length >= 3) {
            const firstToken = partsList[0];
            const secondToken = partsList[1];
            if (/^\d+$/.test(firstToken) && secondToken.length >= 4) {
              partNo = secondToken;
              name = partsList.slice(2).join(" ");
            }
          }
        }
      }
    }

    // Strip leading sequence numbers from partNo (e.g. "28 13442643-00" -> "13442643-00") if it is still there
    if (partNo && partNo !== "N/A") {
      const seqRegex = /^(\d+)\s+([A-Z0-9a-zA-Z_-]+)$/;
      const seqMatch = partNo.match(seqRegex);
      if (seqMatch) {
        if (!item.sNo || item.sNo === "N/A") {
          item.sNo = seqMatch[1];
        }
        partNo = seqMatch[2];
      }
    }

    item.name = name;
    item.partNo = partNo;
    return item;
  }).filter((item: any) => {
    if (!item) return false;
    
    let name = String(item.name || "").trim();
    let partNo = String(item.partNo || "").trim();
    const cleanNameLower = name.toLowerCase();

    // 1. Is it entirely empty?
    if (!name) return false;

    // 2. Is it a header line or column label or tax word?
    if (
      cleanNameLower === "gst" || 
      cleanNameLower === "taxes" || 
      cleanNameLower === "tax" || 
      cleanNameLower === "gst ₹" || 
      cleanNameLower === "cgst" || 
      cleanNameLower === "sgst" || 
      cleanNameLower === "igst" || 
      cleanNameLower === "part name" || 
      cleanNameLower === "description" ||
      cleanNameLower === "sl" ||
      cleanNameLower === "sNo" ||
      cleanNameLower === "sno" ||
      cleanNameLower === "particulars" ||
      cleanNameLower === "net value" ||
      cleanNameLower === "price rate"
    ) {
      return false;
    }

    // 2b. Block exactly "Automotive" or similar generic single brand/meta words when rate is low or 0
    if (
      (cleanNameLower === "automotive" || 
       cleanNameLower === "auto" || 
       cleanNameLower === "motors" || 
       cleanNameLower === "service") && 
      (item.rate === 0 || !item.rate || item.rate <= 10)
    ) {
      return false;
    }

    // 3. Does it contain total/tax summarizing keywords?
    if (totalKeywords.some(kw => cleanNameLower === kw || cleanNameLower.includes("total " + kw) || (cleanNameLower.startsWith(kw) && cleanNameLower.length < kw.length + 5))) {
      return false;
    }

    // 4. Does it contain advisor/surveyor/meta metadata?
    if (junkKeywords.some(kw => cleanNameLower.includes(kw))) {
      return false;
    }

    // 5. Watermark lines check
    const words = cleanNameLower.split(/\s+/);
    if (words.length >= 4) {
      const uniqueWords = new Set(words);
      if (uniqueWords.size <= 2 && words.length > 5) {
        return false; // Watermark line
      }
      if (cleanNameLower.includes("auto & service") || cleanNameLower.includes("auto service") || cleanNameLower.includes("auto kristan") || cleanNameLower.includes("kristan auto")) {
        const validKeywords = ["bumper", "grille", "panel", "support", "reinforcement", "bracket", "clip", "lamp", "mirror", "fender", "fastener", "logo"];
        const hasValidKeyword = validKeywords.some(vKw => cleanNameLower.includes(vKw));
        if (!hasValidKeyword) {
          return false;
        }
      }
    }

    // 6. Rate validation & name check (Skip if low rate and name looks like junk)
    if ((item.rate === 0 || !item.rate || item.rate <= 10) && (cleanNameLower.includes("auto") || cleanNameLower.includes("service") || cleanNameLower.includes("date") || cleanNameLower.includes("mobile") || cleanNameLower.includes("advisor") || cleanNameLower.includes("delivery") || cleanNameLower.includes("address") || cleanNameLower.includes("customer"))) {
      return false;
    }

    // 7. Check if partNo looks like a phone number (e.g., 10 digits starting with 7, 8, 9)
    if (/^[789]\d{9}$/.test(partNo)) {
      return false;
    }

    // Clean part number label
    if (partNo.toUpperCase() === "N/A" || partNo.toUpperCase() === "NA" || partNo === "" || partNo.toLowerCase() === "part") {
      item.partNo = "N/A";
    } else {
      item.partNo = partNo.replace(/\s+/g, "").toUpperCase();
    }

    return true;
  });

  data.items = cleanItems;
  return data;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON
  app.use(express.json({ limit: '15mb' }));

  // API Route: AI PDF Estimate/Quotation Parser
  app.post("/api/parse-estimate", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Missing 'text' key in request body." });
      }

      const ai = getGemini();
      const prompt = `
You are an expert automobile damage estimator and insurance surveyor.
Analyzing the following raw text extracted from an estimate or quotation document, find and extract ONLY the items under the parts table.

### SPECIAL CASE: "ESTIMATION COMPARISON REPORTS" DETECTED
- The document might be an "Estimation Comparison Report" or "Audit Log" which has columns like "S.No", "Part Number", "Spare Part Particle", "Qty", "Rate", "Amount", "Audit Status".
- IN SUCH REPORTS, due to PDF layout rendering, the actual description of the spare part (e.g. "LOWER LEFT SUPPORT", "HEXAGON FLANGE BOLT", "FRONT COMPARTMENT", "Bonnet Paint Charges") is often shifted or concatenated directly inside the PART NUMBER column (e.g., "28 13442643-00LOWER LEFT SUPPORT..."), while the "Particular / Spare Part Particle" column just says "GST", "GST ₹", or "Automotive Component".
- CRITICAL: You MUST separate the alphanumeric part code (e.g. "13442643-00") and the descriptive part name (e.g. "LOWER LEFT SUPPORT BRACKET ASSY"). NEVER set "GST" or "GST ₹" or "Automotive Component" as the part name! Use the description that was merged into the Part Number column instead!

### CRITICAL INSTRUCTIONS (MUST FOLLOW):
1. EXTRACT ONLY GENUINE PHYSICAL SPARE PARTS & SERVICES:
   - A valid line item is a real physical spare part (e.g., bumper, panel, grille, headlamp, clip, guard, sheet, fender, member, bracket, glass, door, mirror) or a specific labor service.
   - Each item MUST have a legitimate name of a physical part or labor service, quantity, and rate/amount.
   - NEVER extract rows representing document metadata, advisor names, mobile numbers, delivery dates, or terms.
   - EXAMPLE of bad rows to EXCLUDE: EXCLUDE lines representing "Address :H...", "Advisor S A : Mobile No...", "Job Card No...", "Delivery Date :...", "Billing to...". These are metadata!

2. ABSOLUTELY NO TAXES, LABELS, OR COLUMN HEADERS AS PARTS:
   - In raw text, columns may shift. NEVER extract a row where the "name" is just "GST", "Taxes", "SGST", "CGST", "IGST", "GST ₹", "Total", "Grand Total", or "Amount in Words". Those are column names or calculations, not separate physical parts!
   - Under no circumstances should "GST" or "GST ₹" or "Taxes" be assigned as the "name" of a part!

3. RESOLVE THE LINE-BREAK/WRAPPING SUFFIX DISPLACEMENT:
   - When a part number like "16361103" is immediately followed by a name like "-00Front bumper body", it means "-00" belongs to the part number! You MUST combine them as "16361103-00", and clean the name to "Front bumper body".
   - Never leave "-00" or "-01" prefixes at the start of the part name! Move it to the end of the part number.

4. STRICTLY FILTER OUT CHURNED/GARBAGE ROWS:
   - Check quantity and rate. Any row with unit rate 1, 0, or extremely low unit prices (like 1 for a bumper or grille) is a column alignment leak. Skip those completely!
   - If a row has name like "GST" and rate like "1177.79", check if there's a part number like "28 13442643-00 LOWER LEFT SUPPORT" nearby. The real item is Name: "LOWER LEFT SUPPORT", Part No: "13442643-00", Rate: 1177.79.

5. SERIAL NUMBER SPLITTING:
   - Part numbers in the raw text might sometimes be prefixed by their sequence number, like "28 13442643-00". You MUST strip the leading sequence number (e.g. "28") from the Part Number, use it as sNo, and set the partNo strictly to the clean alphanumeric code (e.g. "13442643-00").

Document raw text content:
---------------------------------------------
${text}
---------------------------------------------

For each extracted genuine physical part or labor service:
- "sNo": The serial number of the part as printed in the table (e.g., 1, 2, 3...) or generated sequentially starting from 1.
- "partNo": The precise alphanumeric part code / reference number. Leave as "N/A" if it represents general labor or is absent.
- "name": Clean, human-readable name of the physical part or labor description. (e.g., "LOWER LEFT SUPPORT", "Front Bumper Body"). Cleaned of layout noise, duplicate watermarks, prefix codes like "-00", and column labels.
- "qty": Numerical quantity (minimum 1, default 1).
- "rate": Unit price before tax. If price is shifted, re-align it correctly.
- "taxes": Tax percentage (e.g. 18 or 12) or tax amount associated. Default to 18 (percent) if unspecified.
- "estimatedAmount": The line total (qty * rate + tax).
- "type": MUST be "part".
- "remarks": Inline notes if any (e.g., "To Replace", "Dent & Paint").

Return the result strictly as a structured JSON object. Ensure numbers are parsed as pure float/int types without text characters or comma separators.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an expert automobile data-entry auditor. You only output JSON matching the exact schema. Do not include markdown wraps. IMPORTANT: NEVER include document layout noise, phone numbers, repeated watermark words, terms, advisors, dates, or individual tax/total rows in the items array. Ensure all names are cleaned of prefixes (like '-00', '28 ') and trailing column headers. Ensure 'GST' is never used as a part name — always resolve the real physical description instead.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              estimationDetails: {
                type: Type.OBJECT,
                properties: {
                  customerName: { type: Type.STRING },
                  vehicleNo: { type: Type.STRING },
                  insuranceCompany: { type: Type.STRING },
                  surveyorName: { type: Type.STRING }
                },
                required: ["customerName", "vehicleNo"]
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, description: "Must be 'part'" },
                    sNo: { type: Type.STRING },
                    partNo: { type: Type.STRING },
                    name: { type: Type.STRING },
                    qty: { type: Type.NUMBER },
                    rate: { type: Type.NUMBER },
                    taxes: { type: Type.NUMBER, description: "Taxes / GST amount or percentage" },
                    estimatedAmount: { type: Type.NUMBER },
                    insuranceStatus: { type: Type.STRING, description: "'Pending', 'Approved', or 'Rejected'" },
                    remarks: { type: Type.STRING }
                  },
                  required: ["type", "name", "qty", "rate"]
                }
              }
            },
            required: ["estimationDetails", "items"]
          }
        }
      });

      const parsedResult = JSON.parse(response.text || "{}");
      const cleanedParsedResult = cleanAndFilterParsedData(parsedResult);
      res.json(cleanedParsedResult);
    } catch (err: any) {
      console.error("AI Estimate Parse Failure:", err);
      res.status(500).json({ error: err.message || "Unknown server-side error occurred parsing PDF quotation." });
    }
  });

  // Serve static assets or mount Vite dev server
  if (process.env.NODE_ENV !== "production") {
    // Development Mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[HARMAN AUTO] Full-stack Server listening at http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
  process.exit(1);
});
