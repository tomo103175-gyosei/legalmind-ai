import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import LoginButton from "@/components/LoginButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div style={{ textAlign: "center", marginTop: "4rem" }} className="animate-fade-in">
        <h2>🔒 ログインが必要です</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
          ダッシュボードを利用するにはログインしてください。
        </p>
        <LoginButton />
      </div>
    );
  }

  return <>{children}</>;
}
