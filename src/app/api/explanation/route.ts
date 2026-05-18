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
    
    // 最新の Gemma 4 高精度モデル（31B IT）を使用
    const selectedModel = "gemma-4-31b-it";

    console.log(`[Model Selection] Plan: ${userPlan}, accuracy-priority -> Using ${selectedModel}`);

    const currentDate = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

    let prompt = `
      あなたは行政書士試験に特化した、法務のプロフェッショナルAIアシスタントです。
      本日は ${currentDate} です。回答は必ず、現時点で施行されている最新の日本の法令（e-Gov）および最新の最高裁判例に基づいた、極めて正確な解説を提供してください。
      
      【問題テキスト】
      "${questionText}"
      
      【選択肢】
      ${optionsParsed.map((o: string, i: number) => (i+1) + ". " + o).join('\n')}

      【ユーザーの現在の解答】: ${userAnswer}

      【絶対遵守のルール（ハルシネーション・旧法参照対策）】
      1. 【最優先】最新の改正内容を反映：特に以下の施行日以降の最新条文を必ず参照してください。
         - 行政事件訴訟法：令和7年（2025年）4月1日 施行版
         - 行政不服審査法：令和7年（2025年）6月1日 施行版
         - 民法：令和8年（2026年）4月1日 施行版
         - 商法：令和5年（2023年）4月1日 施行版
         これらを含む主要な改正に細心の注意を払い、必ず現行法に基づいて解説してください。古い条文（旧法）に基づいた解説は絶対に避けてください。
      2. 条文番号の捏造は絶対にしないでください。不明な場合は「関連する条文」として記述し、具体的な番号を偽らないこと。
      3. 根拠となる法律名（例：行政手続法、民法、行政事件訴訟法など）を必ず明記してください。
      4. 可能な限り「第〇条第〇項」まで特定して解説してください。
      5. e-Gov（https://laws.e-gov.go.jp/）のURLを提示する場合は、実在するものか慎重に判断してください。
      6. 【重要】選択肢（1〜5）が単なる数字だけで具体的な内容（例：「ア・イ」など）が不明な場合、勝手に組み合わせを推測・捏造しないでください。「具体的な選択肢の組み合わせが不明なため、各記述の正誤のみ判定します」と記載し、その場合の「correctAnswer」は null としてください。
      7. 【最重要】法令の条文や判例の文章を「そのまま長く引用（コピー＆ペースト）」することは絶対に避けてください。引用制限エラーで回答が途切れてしまいます。必ず「要約して自分の言葉で」解説してください。
    `.trim();

    if (userPlan === "FREE") {
      prompt += `
      8. 各選択肢（1〜5）について、正誤のポイントを条文の趣旨に沿って2〜3行で簡潔に説明してください。必ず「最新の施行法」に基づいていることを確認してください。
      9. 解説の最後に必ず「※詳細はプレミアムプランで確認できます」という一文を単独の行で追記してください。
      10. 出力は必ず以下のJSON形式で行ってください。
      
      【出力形式】
      {
        "correctAnswer": "正解の番号（数値のみ、例: 3）",
        "explanation": "各肢の正確かつ簡潔な解説テキスト（最新の条文根拠を含む）\\n\\n※詳細はプレミアムプランで確認できます"
      }
      `;
    } else {
      prompt += `
      8. 選択肢がなぜ正解・不正解なのかを、e-Govの最新条文や関連判例に基づいて「徹底的かつ詳細に」解説してください。
      9. 【最重要事項】どれほど詳細に解説する場合でも、条文・判例の「長文の直接引用（コピペ）」は絶対に禁止です。必ずあなた自身の言葉で要約・再構成してください。
      10. 行政書士試験の過去問解説として相応しい、格調高く正確な文章で記述してください。最新の法状況を正確に反映させてください。
      11. 出力は必ず以下のJSON形式で行ってください。
      
      【出力形式】
      絶対にJSON形式のデータのみを出力してください。挨拶や前置きの文章は一切出力しないでください。
      {
        "correctAnswer": "正解の番号（数値のみ、例: 3）",
        "explanation": "e-Gov最新条文URL、法律名、条文番号を網羅した詳細かつ最新の解説テキスト"
      }
      `;
    }

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { 
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text || "{}";
    let jsonData: { correctAnswer?: string | number, explanation?: string } = {};
    
    try {
      // 挨拶文などが混ざっていてもJSON部分だけを抽出する
      const start = responseText.indexOf('{');
      const end = responseText.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const jsonStr = responseText.slice(start, end + 1);
        jsonData = JSON.parse(jsonStr);
      } else {
        throw new Error("JSON object not found");
      }
    } catch (e) {
      console.error("JSON Parse Error in Explanation API:", e, responseText);
      // フォールバック: JSON解析に失敗した場合、responseTextから "explanation": "..." の中身を抽出する
      let extractedExplanation = responseText;
      const expMatch = responseText.match(/"explanation"\s*:\s*"([^]*)/);
      if (expMatch) {
        let partialText = expMatch[1];
        // replace escaped characters
        partialText = partialText.replace(/\\n/g, '\n').replace(/\\"/g, '"');
        // cleanup trailing quotes or braces
        partialText = partialText.replace(/"\s*\}\s*$/, '');
        extractedExplanation = partialText;
      }
      
      jsonData = { explanation: extractedExplanation + "\n\n(※AIによる解説生成が途中で途切れてしまいました。そのまま表示しています。)" };
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
