import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Levenshtein距離を計算する（正規化済み類似度 0〜1 を返す）
 */
function similarity(a: string, b: string): number {
  const s1 = a.trim().slice(0, 200); // 先頭200文字で比較（高速化）
  const s2 = b.trim().slice(0, 200);
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matrix: number[][] = Array.from({ length: s2.length + 1 }, (_, i) =>
    Array.from({ length: s1.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2[i - 1] === s1[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
      }
    }
  }

  const distance = matrix[s2.length][s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - distance / maxLen;
}

export async function POST(req: Request) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { questionText } = await req.json();

    if (!questionText) {
      return NextResponse.json({ error: "questionText is required." }, { status: 400 });
    }

    // 既存の問題を全件取得
    const existingQuestions = await prisma.question.findMany({
      where: { userId: user.id },
      select: { id: true, questionText: true },
    });

    if (existingQuestions.length === 0) {
      return NextResponse.json({ isDuplicate: false, method: "no-existing-questions" });
    }

    // Step 1: ローカル類似度チェック
    let maxSim = 0;
    let mostSimilarQuestion: { id: string; questionText: string } | null = null;

    for (const q of existingQuestions) {
      const sim = similarity(questionText, q.questionText);
      if (sim > maxSim) {
        maxSim = sim;
        mostSimilarQuestion = q;
      }
    }

    // 明確に重複（90%以上）
    if (maxSim >= 0.9) {
      return NextResponse.json({
        isDuplicate: true,
        confidence: "high",
        method: "local-similarity",
        similarityScore: maxSim,
        existingQuestionId: mostSimilarQuestion?.id,
        message: "この問題はすでに登録されている可能性が非常に高いです。",
      });
    }

    // 明確に新規（50%未満）
    if (maxSim < 0.5) {
      return NextResponse.json({
        isDuplicate: false,
        confidence: "high",
        method: "local-similarity",
        similarityScore: maxSim,
      });
    }

    // Step 2: グレーゾーン（50〜90%）→ Gemini 2.5 Pro にエスカレーション
    const proPrompt = `
あなたは法律問題の専門家です。以下の2つの問題が「実質的に同じ問題」であるかどうかを判断してください。
言い回しが少し異なっても、問われている法的論点・内容が同一であれば「同じ問題」と判断してください。

【新しい問題】
${questionText}

【既存の問題】
${mostSimilarQuestion?.questionText}

判断結果を以下のJSON形式のみで返してください（他のテキストは一切不要）：
{"isDuplicate": true または false, "reason": "判断の理由を50文字以内で"}
    `.trim();

    const proResponse = await ai.models.generateContent({
      model: "gemma-4-31b-it",
      contents: proPrompt,
    });

    const rawText = (proResponse.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
    let proResult: { isDuplicate: boolean; reason?: string } = { isDuplicate: false };
    try {
      proResult = JSON.parse(rawText);
    } catch {
      console.error("Pro escalation parse error:", rawText);
    }

    return NextResponse.json({
      isDuplicate: proResult.isDuplicate,
      confidence: "pro-escalated",
      method: "gemini-pro-escalation",
      similarityScore: maxSim,
      existingQuestionId: proResult.isDuplicate ? mostSimilarQuestion?.id : undefined,
      message: proResult.isDuplicate
        ? `重複の可能性があります（AI判定）: ${proResult.reason || ""}`
        : undefined,
    });
  } catch (error: any) {
    console.error("Duplicate Check Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
