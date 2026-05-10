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

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        plan: true,
        dailyUploadCount: true,
        lastUploadDate: true,
      }
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate total questions count
    const totalQuestions = await prisma.question.count({
      where: { userId: user.id }
    });

    // Handle daily count reset logic
    const today = new Date().toDateString();
    const lastUpload = dbUser.lastUploadDate.toDateString();
    let currentDailyCount = dbUser.dailyUploadCount;

    if (today !== lastUpload) {
      currentDailyCount = 0;
    }

    return NextResponse.json({
      plan: dbUser.plan,
      dailyCount: currentDailyCount,
      totalCount: totalQuestions,
      limits: {
        FREE_DAILY: 3,
        FREE_TOTAL: 15
      }
    });
  } catch (error: any) {
    console.error('Usage Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
