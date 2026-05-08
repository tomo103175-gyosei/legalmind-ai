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

function kanaOptionsToQuestionText(stemRaw: string, kanaOptions: string[]) {
  const stem = (stemRaw || "").trim();
  const labels = ["ア", "イ", "ウ", "エ", "オ"];
  const lines: string[] = [];
  if (stem) lines.push(stem);
  for (let i = 0; i < kanaOptions.length && i < labels.length; i++) {
    const body = (kanaOptions[i] || "").trim();
    if (!body) continue;
    lines.push(`${labels[i]} ${body}`);
  }
  return lines.join("\n");
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
        - The statements ア〜エ/オ are part of the questionText (include them up to エ or オ).
        - "optionsJson" MUST remain ["1","2","3","4","5"].
        - Do NOT treat ア〜エ/オ as selectable options.
      Format the output strictly as a JSON object with this exact structure:
      {
        "questionText": "The main text of the question",
        "optionsJson": ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]
      }
      Do not include any markdown backticks or other text. Just the JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
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

    // Post-process:
    // - If questionText contains ア〜エ/オ statements, keep them in questionText and force optionsJson to ["1".."5"].
    // - If the model mistakenly put ア〜エ/オ into optionsJson, move them back into questionText.
    if (!jsonData?.error) {
      const qt = typeof jsonData.questionText === "string" ? jsonData.questionText : "";
      const normalizedOptions = normalizeOptionsArray(jsonData.optionsJson);

      if (qt) {
        const extracted = extractKanaOptionsFromText(qt);
        if (extracted) {
          // qt already contains ア〜 statements; keep as-is but normalize options to 1..5.
          jsonData.questionText = qt.trim();
          jsonData.optionsJson = ["1", "2", "3", "4", "5"];
        } else {
          // If optionsJson looks like it contains ア〜 statements, fold them into questionText.
          if (normalizedOptions && normalizedOptions.length >= 4) {
            const looksKana = normalizedOptions.some((s) => /^\s*[ア-オ]\s*/u.test(s));
            if (looksKana) {
              const cleanedKana = normalizedOptions.map((s) =>
                s.replace(/^\s*[ア-オ]\s*[\.．、:：\)]?\s*/u, "").trim()
              );
              jsonData.questionText = kanaOptionsToQuestionText(qt, cleanedKana);
              jsonData.optionsJson = ["1", "2", "3", "4", "5"];
            } else {
              jsonData.optionsJson = normalizedOptions;
            }
          }
        }
      } else if (normalizedOptions) {
        // No questionText; best-effort normalize options
        jsonData.optionsJson = normalizedOptions;
      }
    }

    return NextResponse.json(jsonData);
  } catch (error: any) {
    console.error("OCR Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
