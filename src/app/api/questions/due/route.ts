import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();

    const dueQuestions = await prisma.question.findMany({
      where: {
        userId: user.id,
        nextReviewDate: {
          lte: today
        }
      },
      orderBy: {
        nextReviewDate: 'asc'
      }
    });

    return NextResponse.json({ questions: dueQuestions });
  } catch (error: any) {
    console.error("Fetch Due Questions Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
