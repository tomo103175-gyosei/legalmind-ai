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

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  if (!dbUser || dbUser.plan === "FREE") {
    return (
      <div style={{ textAlign: "center", marginTop: "4rem", maxWidth: "500px", margin: "4rem auto" }} className="glass-card animate-fade-in">
        <h2 style={{ color: "var(--accent-color)" }}>🔒 プレミアム機能</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "2rem", lineHeight: "1.6" }}>
          「忘却曲線ダッシュボード」はプレミアムプラン（月額980円）専用の機能です。<br/>
          最適な復習タイミングの自動管理や、過去の苦手ノートの活用で、試験合格を確実なものにしましょう。
        </p>
        <div style={{ padding: "1.5rem", background: "rgba(0,0,0,0.2)", borderRadius: "8px", marginBottom: "2rem" }}>
          <ul style={{ textAlign: "left", listStyleType: "none", padding: 0, margin: 0 }}>
            <li style={{ marginBottom: "0.5rem" }}>✅ 画像読み込み無制限</li>
            <li style={{ marginBottom: "0.5rem" }}>✅ e-Govと判例に基づく完全版詳細解説</li>
            <li style={{ marginBottom: "0.5rem" }}>✅ 忘却曲線ダッシュボードの完全解放</li>
          </ul>
        </div>
        <form action="/api/stripe/checkout" method="POST">
          <button type="submit" className="btn btn-primary" style={{ width: "100%", height: "3rem", fontSize: "1.1rem" }}>
            プレミアムプランに登録する
          </button>
        </form>
        <div style={{ marginTop: "1rem" }}>
          <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "underline" }}>トップページに戻る</Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
