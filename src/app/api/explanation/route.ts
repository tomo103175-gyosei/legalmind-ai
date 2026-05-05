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

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    const isFree = !dbUser || dbUser.plan === "FREE";

    const { questionId, questionText, optionsJson, userAnswer } = await req.json();

    if (!questionText || !optionsJson) {
      return NextResponse.json({ error: "Missing question content." }, { status: 400 });
    }

    const optionsParsed = JSON.parse(optionsJson);
    
    let prompt = `
      あなたは行政書士試験に特化した最高峰のAIアシスタントです。
      以下の問題テキストと選択肢、そしてユーザーの解答に基づいて、正確な解説を生成してください。
      
      【問題テキスト】
      "${questionText}"
      
      【選択肢】
      ${optionsParsed.map((o: string, i: number) => (i+1) + ". " + o).join('\n')}

      【ユーザーの解答】: ${userAnswer}

      【厳格な制約（必ず守ること）】
      1. 解説の根拠となる条文は必ず「 https://laws.e-gov.go.jp/ 」を参照し、正確なURLを提供すること。
      2. 行政書士試験の問題データ処理において、クイズ形式の出題・回答は絶対に避け、必ず本試験同様の長文テキスト形式で解説すること。
      3. 選択肢がなぜ正解・不正解なのかを、e-Govの条文や関連判例に基づいて徹底的かつ詳細に解説してください。
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    const explanation = response.text || "No explanation generated.";

    if (questionId) {
       await prisma.question.update({
         where: { id: questionId },
         data: { explanation }
       });
    }

    return NextResponse.json({ explanation });
  } catch (error: any) {
    console.error("Explanation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
