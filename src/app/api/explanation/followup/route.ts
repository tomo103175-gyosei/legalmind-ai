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

    // 判例問題や複雑な形式を判定
    const precedentKeywords = ["判例", "最高裁", "大審院", "決定", "判決", "趣旨", "事件"];
    const complexKeywords = ["組合せ", "組み合わせ", "個数", "いくつあるか", "正誤の組み合わせ"];
    
    const isPrecedent = precedentKeywords.some(k => questionText.includes(k));
    const isComplex = complexKeywords.some(k => questionText.includes(k));
    
    // モデル選択
    const selectedModel = (isPrecedent || isComplex) 
      ? "gemini-2.5-flash" 
      : "gemini-2.5-flash-lite";

    console.log(`[Follow-up Model Selection] Precedent: ${isPrecedent}, Complex: ${isComplex} -> Using ${selectedModel}`);

    // Build the conversation context
    let prompt = `
      あなたは行政書士試験に特化した最高峰のAIアシスタントです。
      ユーザーは以下の問題について学習しています:
      "${questionText}"

      以前の解説:
      "${previousExplanation}"

      【厳格なガードレール】
      行政書士試験の解説に関係のない質問（例：一般的なプログラミングの質問、世間話、他資格の質問など）には一切応答しないでください。もし関係のない質問だと判断した場合は、「行政書士試験に関連する質問のみお答えできます。」とだけ返答してください。
      
      これまでの会話履歴（ある場合）:
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
      contents: prompt
    });

    return NextResponse.json({ answer: response.text || "返答を生成できませんでした。" });
  } catch (error: any) {
    console.error("Follow-up Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
