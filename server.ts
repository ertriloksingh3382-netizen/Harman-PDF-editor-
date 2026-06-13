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
Analyzing the following raw text extracted from an estimate or quotation document, find and extract ONLY the items under "Spares Estimate" or the spare parts listing.
You MUST look for a layout/table of spare parts containing columns similar to:
- SNo / SL (Serial Number)
- Part Number / Part No / Item Code
- Item Name / Part Name / Description / Particulars
- Qty (Quantity)
- Unit Price / Rate / Price
- Taxes (integrated GST, SGST, CGST, tax percentage, or absolute tax amount)
- Amount (Subtotal, Line Amount, Net Amount)

IGNORE any labor logs, payment details, narration paragraphs, or terms and conditions unless they are part of the spare parts estimation table. Only extract genuine physical spare parts.

Document raw text content:
---------------------------------------------
${text}
---------------------------------------------

For each extracted row from the Spares Estimate table:
- "sNo" should be the serial number (e.g., 1, 2, 3...) as shown in the document.
- "partNo" must be the precise part number key from the document. Left as "N/A" if blank or not shown.
- "name" must be the clean human name of the spare part.
- "qty" is the parsed numerical quantity (minimum 1, default 1).
- "rate" is the unit price or unit rate before tax.
- "taxes" is the tax amount or tax percentage (GST) associated with this item as recorded in the document (if empty or unspecified, estimate or default to 18% or 0 based on document).
- "estimatedAmount" is the total price/amount for the line item (equal to qty * rate + taxes, or as written in the amount column).
- "type" MUST be "part".
- "remarks" should be any inline specific notes if any (e.g., "To Replace", "RHS", "LHS", etc.).

Return the extracted values as a structured JSON object matching the requested schema. Ensure numbers are parsed correctly without commas or currency symbols.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You only output JSON matching the exact schema. Do not include markdown wraps.",
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
      res.json(parsedResult);
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
