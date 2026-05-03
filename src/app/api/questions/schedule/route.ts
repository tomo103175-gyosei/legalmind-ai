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

    const questions = await prisma.question.findMany({
      where: { userId: user.id },
      select: { nextReviewDate: true }
    });

    const schedule: Record<string, number> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const q of questions) {
      if (!q.nextReviewDate) continue;
      
      const date = new Date(q.nextReviewDate);
      date.setHours(0, 0, 0, 0);
      
      // Treat overdue stuff as today
      const targetDate = date < today ? today : date;
      const dateStr = targetDate.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });

      schedule[dateStr] = (schedule[dateStr] || 0) + 1;
    }

    // Convert object to sorted array
    const sortedSchedule = Object.keys(schedule)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .slice(0, 14) // Limit to the next 14 active days
      .map(dateStr => ({
        date: dateStr,
        count: schedule[dateStr]
      }));

    return NextResponse.json({ schedule: sortedSchedule });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
