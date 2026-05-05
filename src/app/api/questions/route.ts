import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const questions = await prisma.question.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        questionText: true,
        optionsJson: true,
        explanation: true,
        createdAt: true,
        nextReviewDate: true,
      },
    });

    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error('Fetch Questions Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { questionText, optionsJson, originalImage } = await req.json();

    if (!questionText || !optionsJson) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check upload limits for FREE plan
    if (dbUser.plan === 'FREE') {
      const today = new Date().toDateString();
      const lastUpload = dbUser.lastUploadDate.toDateString();
      
      let currentCount = dbUser.dailyUploadCount;

      if (today !== lastUpload) {
        // Reset counter for new day
        await prisma.user.update({
          where: { id: user.id },
          data: { dailyUploadCount: 0, lastUploadDate: new Date() }
        });
        currentCount = 0;
      }

      if (currentCount >= 3) {
        return NextResponse.json({ 
          error: "1日のアップロード上限（3問）に達しました。プレミアムプランへのアップグレードをご検討ください。", 
          limitReached: true 
        }, { status: 403 });
      }

      // Increment count
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          dailyUploadCount: { increment: 1 },
          lastUploadDate: new Date()
        }
      });
    }

    const newQuestion = await prisma.question.create({
      data: {
        questionText,
        optionsJson,
        originalImage,
        userId: user.id,
        nextReviewDate: new Date()
      }
    });

    return NextResponse.json(newQuestion);
  } catch (error: any) {
    console.error("Create Question Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
