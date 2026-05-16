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

    const { questionId, questionText, previousExplanation, userMessage, chatHistory } = await req.json();

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

    const selectedModel = "gemini-2.5-flash";
    const currentDate = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

    // Build the conversation context
    let prompt = `
      あなたは行政書士試験に特化した、法務のプロフェッショナルAIアシスタントです。
      本日は ${currentDate} です。ユーザーの質問に対し、現時点で施行されている最新の日本の法令（e-Gov）および最新の最高裁判例に基づいた、極めて正確な回答を提供してください。

      【対象の問題】
      "${questionText}"

      【以前の解説】
      "${previousExplanation}"

      【絶対遵守のルール（ハルシネーション・旧法参照対策）】
      1. 【最優先】最新の改正内容を反映：特に以下の施行日以降の最新条文を必ず参照してください。
         - 行政事件訴訟法：令和7年（2025年）4月1日 施行版
         - 行政不服審査法：令和7年（2025年）6月1日 施行版
         - 民法：令和8年（2026年）4月1日 施行版
         - 商法：令和5年（2023年）4月1日 施行版
         これらを含む改正に細心の注意を払い、必ず現行法に基づいて回答してください。
      2. 条文番号（第〇条第〇項）の捏造は厳禁です。確証がない場合はその旨を伝え、不正確な情報を教えないでください。
      3. 行政書士試験に関連しない質問には「行政書士試験に関連する質問のみお答えできます。」と返答してください。
      4. 回答には必ず具体的な法律名（例：行政手続法、民法など）を含めてください。
      5. もし「以前の解説」が最新の法令に照らして間違っている、あるいは古い条文に基づいている場合は、素直に非を認め、正しい最新の解説を提供してください。
      
      【これまでの会話履歴（ある場合）】:
    `;

    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach((msg: any) => {
        prompt += `\n${msg.role === 'user' ? 'User' : 'You'}: ${msg.text}`;
      });
    }

    prompt += `\n\n今回のユーザーの質問/指摘: "${userMessage}"
    
    上記を踏まえ、丁寧かつ正確に回答してください。
    もし以前の解説が間違っていた場合は、日本の法律（e-GovのURLを含む）に基づいて訂正された正確な解説を提供してください。
    
    出力は以下のJSONフォーマットに厳密に従ってください。
    {
      "answer": "ユーザーへの返答テキスト（誤りを認めた場合はそのお詫びと修正箇所の説明）",
      "shouldUpdateCorrectAnswer": true/false (以前の正解番号や解説に間違いがあり、修正すべき場合はtrue),
      "newCorrectAnswer": "新しい正解の番号（数値のみ、例: 3）。修正しない場合や不明な場合はnull",
      "newExplanation": "修正後の新しい全体解説テキスト（e-Gov最新条文URL等を含む完全版）。修正しない場合はnull"
    }
    `;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { 
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text || "{}";
    let jsonData: any = {};
    try {
      jsonData = JSON.parse(responseText);
    } catch (e) {
      console.error("JSON Parse Error in Followup API:", e, responseText);
      jsonData = { answer: responseText, shouldUpdateCorrectAnswer: false };
    }

    if (jsonData.shouldUpdateCorrectAnswer && questionId) {
      await prisma.question.update({
        where: { id: questionId },
        data: {
          ...(jsonData.newCorrectAnswer !== null ? { correctAnswer: String(jsonData.newCorrectAnswer) } : {}),
          ...(jsonData.newExplanation !== null ? { explanation: jsonData.newExplanation } : {})
        }
      });
    }

    return NextResponse.json({ 
      answer: jsonData.answer || "返答を生成できませんでした。",
      updatedCorrectAnswer: jsonData.shouldUpdateCorrectAnswer ? jsonData.newCorrectAnswer : undefined,
      updatedExplanation: jsonData.shouldUpdateCorrectAnswer ? jsonData.newExplanation : undefined
    });
  } catch (error: any) {
    console.error("Follow-up Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
