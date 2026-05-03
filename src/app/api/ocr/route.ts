import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
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
      Format the output strictly as a JSON object with this exact structure:
      {
        "questionText": "The main text of the question",
        "optionsJson": ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]
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
    let jsonData = {};
    try {
      const cleaned = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      jsonData = JSON.parse(cleaned);
    } catch (e) {
      console.error("Parse Error:", e);
      jsonData = { error: "Failed to parse JSON correctly.", raw: textResponse };
    }

    return NextResponse.json(jsonData);
  } catch (error: any) {
    console.error("OCR Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
