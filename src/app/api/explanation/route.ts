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
    
    // 解説には常に精度の高い gemini-2.5-flash を使用（liteはハルシネーション回避のため使用しない）
    const selectedModel = "gemini-2.5-flash";

    console.log(`[Model Selection] Plan: ${userPlan}, accuracy-priority -> Using ${selectedModel}`);

    let prompt = `
      あなたは行政書士試験に特化した、法務のプロフェッショナルAIアシスタントです。
      以下の問題に対し、日本の法令（e-Gov）および最高裁判例に基づいた、極めて正確な解説を提供してください。
      
      【問題テキスト】
      "${questionText}"
      
      【選択肢】
      ${optionsParsed.map((o: string, i: number) => (i+1) + ". " + o).join('\n')}

      【ユーザーの現在の解答】: ${userAnswer}

      【絶対遵守のルール（ハルシネーション対策および強制終了対策）】
      1. 条文番号の捏造は絶対にしないでください。不明な場合は「関連する条文」として記述し、具体的な番号を偽らないこと。
      2. 根拠となる法律名（例：行政手続法、民法、行政事件訴訟法など）を必ず明記してください。
      3. 可能な限り「第〇条第〇項」まで特定して解説してください。
      4. e-Gov（https://laws.e-gov.go.jp/）のURLを提示する場合は、実在するものか慎重に判断してください。
      5. 【重要】選択肢（1〜5）が単なる数字だけで具体的な内容（例：「ア・イ」など）が不明な場合、勝手に組み合わせを推測・捏造しないでください。「具体的な選択肢の組み合わせが不明なため、各記述の正誤のみ判定します」と記載し、その場合の「correctAnswer」は null としてください。
      6. 【最重要】法令の条文や判例の文章を「そのまま長く引用（コピー＆ペースト）」することは絶対に避けてください。引用制限エラーで回答が途切れてしまいます。必ず「要約して自分の言葉で」解説してください。
    `.trim();

    if (userPlan === "FREE") {
      prompt += `
      5. 各選択肢（1〜5）について、正誤のポイントを条文の趣旨に沿って2〜3行で簡潔に説明してください。
      6. 解説の最後に必ず「※詳細はプレミアムプランで確認できます」という一文を単独の行で追記してください。
      7. 出力は必ず以下のJSON形式で行ってください。
      
      【出力形式】
      {
        "correctAnswer": "正解の番号（数値のみ、例: 3）",
        "explanation": "各肢の正確かつ簡潔な解説テキスト（条文根拠を含む）\\n\\n※詳細はプレミアムプランで確認できます"
      }
      `;
    } else {
      prompt += `
      5. 選択肢がなぜ正解・不正解なのかを、e-Govの条文や関連判例に基づいて「徹底的かつ詳細に」解説してください。
      6. 行政書士試験の過去問解説として相応しい、格調高く正確な文章で記述してください。
      7. 出力は必ず以下のJSON形式で行ってください。
      
      【出力形式】
      絶対にJSON形式のデータのみを出力してください。挨拶や前置きの文章は一切出力しないでください。
      {
        "correctAnswer": "正解の番号（数値のみ、例: 3）",
        "explanation": "e-Gov条文URL、法律名、条文番号を網羅した詳細な解説テキスト"
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
