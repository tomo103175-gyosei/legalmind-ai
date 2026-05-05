import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

function extractKanaOptionsFromText(fullTextRaw: string) {
  const fullText = (fullTextRaw || "").replace(/\r\n/g, "\n");
  const labelRe = /(?:^|\n)\s*([ア-オ])\s*[\.．、:：\)]?\s*/g;

  const matches: { idx: number; kana: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = labelRe.exec(fullText)) !== null) {
    matches.push({
      idx: matches.length,
      kana: m[1],
      start: m.index,
      end: labelRe.lastIndex,
    });
  }

  if (matches.length < 4) return null;

  const stem = fullText.slice(0, matches[0].start).trim();
  const kanaToIndex: Record<string, number> = { ア: 0, イ: 1, ウ: 2, エ: 3, オ: 4 };
  const options: (string | null)[] = [null, null, null, null, null];

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const body = fullText.slice(cur.end, next ? next.start : fullText.length).trim();
    const idx = kanaToIndex[cur.kana];
    if (idx !== undefined && body) options[idx] = body;
  }

  const compact = options.filter((x) => typeof x === "string" && x.trim().length > 0) as string[];
  if (stem && (compact.length === 4 || compact.length === 5)) {
    return { questionText: stem, options: compact };
  }

  return null;
}

function normalizeOptionsArray(raw: any) {
  if (!Array.isArray(raw)) return null;
  const cleaned = raw
    .map((x) => (typeof x === "string" ? x : String(x ?? "")))
    .map((s) => s.replace(/^\s*[ア-オ]\s*[\.．、:：\)]?\s*/u, "").trim())
    .filter((s) => s.length > 0);
  if (cleaned.length === 4 || cleaned.length === 5) return cleaned;
  return cleaned.length > 0 ? cleaned : null;
}

export async function POST(req: Request) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const formData = await req.formData();
    const imageFile = formData.get('image') as Blob;
    
    if (!imageFile) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    const prompt = `
      You are an expert OCR and Legal Question Parser. 
      Read the administrative scrivener exam question from this image.
      Extract the main question text and the options (肢).
      
      IMPORTANT:
      - If the problem statement contains options labeled ア〜エ or ア〜オ, then:
        - "questionText" MUST end right before the first option label (ア...).
        - "optionsJson" MUST be an array of 4 or 5 option strings in order (1〜4 or 1〜5).
        - Remove the leading labels (ア/イ/ウ/エ/オ) from each option string.
      Format the output strictly as a JSON object with this exact structure:
      {
        "questionText": "The main text of the question",
        "optionsJson": ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]
      }
      Do not include any markdown backticks or other text. Just the JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { 
              inlineData: {
                data: base64Image,
                mimeType: imageFile.type
              }
            }
          ]
        }
      ]
    });

    const textResponse = response.text || "{}";
    let jsonData: any = {};
    try {
      const cleaned = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      jsonData = JSON.parse(cleaned);
    } catch (e) {
      console.error("Parse Error:", e);
      jsonData = { error: "Failed to parse JSON correctly.", raw: textResponse };
    }

    // Post-process: if options are embedded in questionText with ア〜エ/オ, split them.
    if (!jsonData?.error) {
      const qt = typeof jsonData.questionText === "string" ? jsonData.questionText : "";
      const normalizedOptions = normalizeOptionsArray(jsonData.optionsJson);

      if (qt) {
        const extracted = extractKanaOptionsFromText(qt);
        if (extracted) {
          jsonData.questionText = extracted.questionText;
          jsonData.optionsJson = extracted.options;
        } else if (normalizedOptions) {
          jsonData.optionsJson = normalizedOptions;
        }
      } else if (normalizedOptions) {
        jsonData.optionsJson = normalizedOptions;
      }
    }

    return NextResponse.json(jsonData);
  } catch (error: any) {
    console.error("OCR Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
