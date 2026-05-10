import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { questionId, questionText, optionsJson, userAnswer } = await req.json();

    if (!questionId) {
      return NextResponse.json({ error: "questionId is required to save the explanation." }, { status: 400 });
    }

    if (!questionText || !optionsJson) {
      return NextResponse.json({ error: "Missing question content." }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    const userPlan = dbUser?.plan || "FREE";

    const optionsParsed = JSON.parse(optionsJson);

    // 判例問題や複雑な形式（組み合わせ、個数）を判定
    const precedentKeywords = ["判例", "最高裁", "大審院", "決定", "判決", "趣旨", "事件"];
    const complexKeywords = ["組合せ", "組み合わせ", "個数", "いくつあるか", "正誤の組み合わせ"];
    
    const isPrecedent = precedentKeywords.some(k => questionText.includes(k));
    const isComplex = complexKeywords.some(k => questionText.includes(k));
    
    // 判例または難易度が高い場合は gemini-2.5-flash、それ以外は lite を使用
    const selectedModel = (isPrecedent || isComplex) 
      ? "gemini-2.5-flash" 
      : "gemini-2.5-flash-lite";

    console.log(`[Model Selection] Plan: ${userPlan}, Precedent: ${isPrecedent}, Complex: ${isComplex} -> Using ${selectedModel}`);

    let prompt = `
      あなたは行政書士試験に特化した最高峰のAIアシスタントです。
      以下の問題テキストと選択肢に基づいて、正確な解説を生成し、正解の番号（1〜5）を特定してください。
      
      【問題テキスト】
      "${questionText}"
      
      【選択肢】
      ${optionsParsed.map((o: string, i: number) => (i+1) + ". " + o).join('\n')}

      【ユーザーの現在の解答】: ${userAnswer}

      【厳格な制約（必ず守ること）】
    `.trim();

    if (userPlan === "FREE") {
      prompt += `
      1. 各選択肢（1〜5）について、それぞれ2〜3行程度で簡潔に正誤の理由を説明してください。
      2. 法律の専門用語は使いつつも、初学者にもわかりやすい平易な表現を心がけてください。
      3. 解説の最後に必ず「※詳細はプレミアムプランで確認できます」という一文を単独の行で追記してください。
      4. 出力は必ず以下のJSON形式で行ってください。
      
      【出力形式】
      {
        "correctAnswer": "正解の番号（数値のみ、例: 3）",
        "explanation": "各肢の簡潔な解説テキスト\\n\\n※詳細はプレミアムプランで確認できます"
      }
      `;
    } else {
      prompt += `
      1. 解説の根拠となる条文は必ず「 https://laws.e-gov.go.jp/ 」を参照し、正確なURLを提供すること。
      2. 行政書士試験の問題データ処理において、クイズ形式の出題・回答は絶対に避け、必ず本試験同様の長文テキスト形式で解説すること。
      3. 選択肢がなぜ正解・不正解なのかを、e-Govの条文や関連判例に基づいて徹底的かつ詳細に解説してください。
      4. 出力は必ず以下のJSON形式で行ってください。
      
      【出力形式】
      {
        "correctAnswer": "正解の番号（数値のみ, 例: 3）",
        "explanation": "詳細な解説テキスト"
      }
      `;
    }

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const responseText = response.text || "{}";
    let jsonData: { correctAnswer?: string | number, explanation?: string } = {};
    
    try {
      // JSON部分を抽出（バックティックス等の除去）
      const cleanedJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      jsonData = JSON.parse(cleanedJson);
    } catch (e) {
      console.error("JSON Parse Error in Explanation API:", e, responseText);
      // フォールバック: JSON解析に失敗した場合はテキスト全体を解説とし、正解は不明とする
      jsonData = { explanation: responseText };
    }

    const explanation = jsonData.explanation || "No explanation generated.";
    const correctAnswer = jsonData.correctAnswer ? String(jsonData.correctAnswer) : null;

    // 解説と正解をDBに保存する
    await prisma.question.update({
      where: { id: questionId },
      data: { 
        explanation,
        correctAnswer
      }
    });

    return NextResponse.json({ explanation, correctAnswer });
  } catch (error: any) {
    console.error("Explanation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
