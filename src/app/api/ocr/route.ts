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
        - ENSURE each statement (ア, イ, ウ, エ, オ) starts on a NEW LINE and there is an EMPTY LINE between them for readability.
        - "optionsJson" should contain the selectable labels (usually 1 to 5).
        - If labels 1 to 5 have associated combination text like "ア・エ" or "アとイ", INCLUDE THAT TEXT in the optionsJson.
      
      Format the output strictly as a JSON object with this exact structure:
      {
        "questionText": "The main text of the question (ensure an empty line between ア, イ, ウ...)",
        "optionsJson": ["Option 1 text", "Option 2 text", "Option 3 text", "Option 4 text", "Option 5 text"]
      }
      Do not include any markdown backticks or other text. Just the JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
    if (!jsonData?.error) {
      let qt = typeof jsonData.questionText === "string" ? jsonData.questionText : "";
      const optJson = Array.isArray(jsonData.optionsJson) ? jsonData.optionsJson : [];

      // 設問（ア〜オ）ごとに改行（空行込み）を入れるリフォーマット処理
      if (qt) {
        const reformatQt = (text: string) => {
          const labels = ["ア", "イ", "ウ", "エ", "オ"];
          let formatted = text;
          labels.forEach(label => {
            // 文中（改行以外）に現れる「ア」「イ」などのラベルを検出し、その前に空行（\n\n）を入れる
            const regex = new RegExp(`([^\\n])(\\s*${label}[\\s　\\.．、:：\\)])`, 'g');
            formatted = formatted.replace(regex, '$1\n\n$2');
            
            // 記号がない場合（例: 「...。ア 行政手続法...」）のケースも補完
            const regexNoSym = new RegExp(`([。．])(${label})`, 'g');
            formatted = formatted.replace(regexNoSym, '$1\n\n$2');
          });
          return formatted.trim();
        };
        qt = reformatQt(qt);
        jsonData.questionText = qt;
      }

      // 組み合わせ問題（「・」や「と」を含む）かどうかをチェック
      const isCombination = optJson.some((s: string) => 
        typeof s === "string" && (s.includes("・") || s.includes("と") || /[ア-オ]\s*[・と]\s*[ア-オ]/.test(s))
      );

      if (qt) {
        const extracted = extractKanaOptionsFromText(qt);
        if (extracted) {
          // qt already contains ア〜 statements
          // 組み合わせ問題でない場合のみ、1〜5 に強制置換する（既存の単一選択肢の誤混入防止）
          if (!isCombination) {
             const looksLikeNumbers = optJson.every((s: any) => /^\s*\d+\s*$/.test(String(s)));
             if (!looksLikeNumbers) {
                jsonData.optionsJson = ["1", "2", "3", "4", "5"];
             }
          }
        } else {
          // If optionsJson looks like it contains ア〜 statements, fold them into questionText.
          const normalizedOptions = normalizeOptionsArray(jsonData.optionsJson);
          if (normalizedOptions && normalizedOptions.length >= 4) {
            const looksKana = normalizedOptions.some((s) => /^\s*[ア-オ]\s*$/.test(s));
            if (looksKana && !isCombination) {
              const cleanedKana = normalizedOptions.map((s) =>
                s.replace(/^\s*[ア-オ]\s*[\.．、:：\)]?\s*/u, "").trim()
              );
              jsonData.questionText = kanaOptionsToQuestionText(qt, cleanedKana);
              jsonData.optionsJson = ["1", "2", "3", "4", "5"];
            }
          }
        }
      }
    }

    return NextResponse.json(jsonData);
  } catch (error: any) {
    console.error("OCR Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
