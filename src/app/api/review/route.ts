import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateSM2 } from '@/lib/sm2';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { questionId, quality } = await req.json();

    if (!questionId || quality === undefined) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const { repetition, easinessFactor, interval, nextReviewDate } = calculateSM2(
      quality,
      question.repetition,
      question.easinessFactor,
      question.interval
    );

    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        repetition,
        easinessFactor,
        interval,
        nextReviewDate,
      }
    });

    await prisma.reviewLog.create({
      data: {
        questionId: question.id,
        userId: user.id,
        quality: quality,
        interval: interval
      }
    });

    return NextResponse.json(updatedQuestion);
  } catch (error: any) {
    console.error("Review Update Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
