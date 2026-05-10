import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let dueCount = 0;
  let totalCount = 0;
  let userPlan = "FREE";
  let dbError = null;
  if (user) {
    try {
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      userPlan = dbUser?.plan || "FREE";

      dueCount = await prisma.question.count({
        where: {
          userId: user.id,
          nextReviewDate: {
            lte: new Date()
          }
        }
      });

      totalCount = await prisma.question.count({
        where: { userId: user.id }
      });
    } catch (e: any) {
      dbError = e.message;
      console.error("Prisma error in Home:", e);
    }
  }

  const isLimitReached = userPlan === "FREE" && totalCount >= 15;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
      {dbError && (
        <div style={{ background: "red", color: "white", padding: "1rem", borderRadius: "8px", overflowX: "auto" }}>
          <strong>Database Connection Error:</strong>
          <pre style={{ fontSize: "0.8rem", marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>{dbError}</pre>
        </div>
      )}
      {/* Hero Section */}
      <section className="glass-card" style={{ textAlign: "center", padding: "4rem 2rem", background: "linear-gradient(to bottom, rgba(59, 130, 246, 0.1), transparent)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "900", marginBottom: "1.5rem", lineHeight: "1.3" }}>
          スマホで撮るだけ。<br/>
          AIが作る「あなた専用」の弱点克服システム。
        </h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "3rem", fontSize: "1.1rem", maxWidth: "800px", margin: "0 auto 3rem auto", lineHeight: "1.8" }}>
          間違えた問題を撮影するだけで、法的根拠（e-Gov）に基づいた正確な解説をAIが即座に生成。<br/>
          さらに忘却曲線アルゴリズムが、最適なタイミングでの復習を自動管理します。
        </p>
        
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
          {isLimitReached ? (
            <div style={{ width: "100%", maxWidth: "300px", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Link href="/upload" className="btn btn-outline" style={{ width: "100%", borderColor: "var(--error-color)", color: "var(--error-color)" }}>
                🔒 保存上限に達しました
              </Link>
              <p style={{ fontSize: "0.75rem", color: "var(--error-color)" }}>過去の問題を削除するか、プランをアップグレードしてください。</p>
            </div>
          ) : (
            <Link href="/upload" className="btn btn-primary" style={{ width: "100%", maxWidth: "300px", padding: "1rem" }}>
              ☑️ 問題をアップロードする
            </Link>
          )}
          <Link href="/study" className="btn btn-outline" style={{ width: "100%", maxWidth: "300px", position: "relative", padding: "1rem" }}>
            📖 今日の復習タスク
            {user && dueCount > 0 ? (
              <span style={{ background: "var(--danger-color, #ef4444)", color: "white", padding: "2px 8px", borderRadius: "12px", fontSize: "0.85rem", marginLeft: "8px", fontWeight: "bold" }}>
                残り {dueCount} 問
              </span>
            ) : user ? (
              <span style={{ background: "var(--success-color, #22c55e)", color: "white", padding: "2px 8px", borderRadius: "12px", fontSize: "0.85rem", marginLeft: "8px", fontWeight: "bold" }}>
                完了!
              </span>
            ) : null}
          </Link>
          <Link href="/weaknesses" className="btn btn-outline" style={{ width: "100%", maxWidth: "300px", padding: "1rem" }}>
            📓 苦手ノート (間違えた問題)
          </Link>
        </div>
        <p style={{ marginTop: "1.5rem", fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center" }}>
          ※AI生成のため誤りが含まれる場合があります。疑問点はチャット（1問3往復まで）で質問可能です。<br/>
          詳細は<Link href="/terms" style={{ textDecoration: "underline", color: "inherit" }}>利用規約</Link>をご確認ください。
        </p>
      </section>

      {/* 3-Step Guide Section */}
      <section style={{ padding: "2rem 1rem" }}>
        <h2 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "3rem" }}>使い方は簡単 3ステップ</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "2rem" }}>
          
          {/* Step 1 */}
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "2rem" }}>
            <h3 style={{ fontSize: "1.5rem", color: "var(--primary-color)", marginBottom: "1rem" }}>ステップ1：撮影する</h3>
            <p style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>
              間違えた問題や、わからない選択肢をスマホで撮影してください。画像の文字はAIが自動で読み取ります。
            </p>
          </div>

          {/* Step 2 */}
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "2rem" }}>
            <h3 style={{ fontSize: "1.5rem", color: "var(--accent-color)", marginBottom: "1rem" }}>ステップ2：解説を読む</h3>
            <p style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>
              数秒お待ちいただくだけで、e-Govの条文や判例に基づいた、正確でわかりやすい解説をAIが作成します。
            </p>
          </div>

          {/* Step 3 */}
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "2rem" }}>
            <h3 style={{ fontSize: "1.5rem", color: "var(--success-color)", marginBottom: "1rem" }}>ステップ3：復習する</h3>
            <p style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>
              「今日の復習タスク」をご確認いただくだけです。忘却曲線に合わせて、一番忘れやすい最適なタイミングでシステムが自動で再出題します。
            </p>
          </div>

        </div>
      </section>
    </div>
  );
}
