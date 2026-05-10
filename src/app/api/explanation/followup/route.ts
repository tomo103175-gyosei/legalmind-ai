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

    const { questionText, previousExplanation, userMessage, chatHistory } = await req.json();

    if (!questionText || !previousExplanation || !userMessage) {
      return NextResponse.json({ error: "Missing required context." }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    const userPlan = dbUser?.plan || "FREE";

    // Chat Limits check
    const userMessageCount = (chatHistory || []).filter((m: any) => m.role === 'user').length;
    
    if (userPlan === "FREE" && userMessageCount >= 1) {
      return NextResponse.json({ error: "無料プランのチャット制限（1回）に到達しました。プレミアムプランで無制限に質問できます。" }, { status: 403 });
    }
    // Premium is unlimited (removing the 3-turn limit)

    // 常に精度の高い gemini-2.5-flash を使用
    const selectedModel = "gemini-2.5-flash";
    console.log(`[Follow-up Model Selection] accuracy-priority -> Using ${selectedModel}`);

    // Build the conversation context
    let prompt = `
      あなたは行政書士試験に特化した、法務のプロフェッショナルAIアシスタントです。
      ユーザーの質問に対し、日本の法令（e-Gov）および最高裁判例に基づいた、極めて正確な回答を提供してください。

      【対象の問題】
      "${questionText}"

      【以前の解説】
      "${previousExplanation}"

      【絶対遵守のルール（ハルシネーション対策）】
      1. 条文番号（第〇条第〇項）の捏造は厳禁です。確証がない場合はその旨を伝え、不正確な情報を教えないでください。
      2. 行政書士試験に関連しない質問には「行政書士試験に関連する質問のみお答えできます。」と返答してください。
      3. 回答には必ず具体的な法律名（例：行政手続法、民法など）を含めてください。
      
      【これまでの会話履歴（ある場合）】:
    `;

    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach((msg: any) => {
        prompt += `\n${msg.role === 'user' ? 'User' : 'You'}: ${msg.text}`;
      });
    }

    prompt += `\n\n今回のユーザーの質問/指摘: "${userMessage}"
    
    上記を踏まえ、丁寧かつ正確に回答してください。
    もし以前の解説が間違っていた場合は素直に認め、日本の法律（e-GovのURLを含む）に基づいて訂正された正確な解説を提供してください。
    長文テキスト形式で出力し、クイズ形式は絶対に避けてください。
    `;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192 }
    });

    return NextResponse.json({ answer: response.text || "返答を生成できませんでした。" });
  } catch (error: any) {
    console.error("Follow-up Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
