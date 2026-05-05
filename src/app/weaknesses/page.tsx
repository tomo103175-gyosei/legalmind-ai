import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function WeaknessesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", paddingBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem" }}>📓 苦手ノート</h2>
          <Link href="/" className="btn btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}>← トップへ</Link>
        </div>

        <div className="glass-card animate-fade-in" style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <p style={{ color: "var(--text-muted)" }}>苦手ノートを見るにはログインしてください。</p>
        </div>
      </div>
    );
  }

  // 「間違えた問題」= レビュー品質が低い(0-2)ものを抽出
  // distinctにより同一問題は最新の失敗ログだけ拾う
  const wrongLogs = await prisma.reviewLog.findMany({
    where: {
      userId: user.id,
      quality: { lte: 2 },
    },
    orderBy: { createdAt: "desc" },
    distinct: ["questionId"],
    include: {
      question: true,
    },
  });

  const wrongQuestions = wrongLogs
    .map((l) => l.question)
    .filter(Boolean);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", paddingBottom: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
         <h2 style={{ fontSize: "1.5rem" }}>📓 苦手ノート</h2>
         <Link href="/" className="btn btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}>← トップへ</Link>
      </div>
      
      {wrongQuestions.length === 0 ? (
        <div className="glass-card animate-fade-in" style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <p style={{ color: "var(--success-color)", fontSize: "1.1rem", marginBottom: "1rem" }}>🎉 まだ「間違えた問題」はありません！</p>
          <p style={{ color: "var(--text-muted)" }}>学習で「忘れた(0) / 難しい(2)」を選ぶと、ここに表示されます。</p>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ color: "var(--text-muted)", marginBottom: "0.5rem", fontSize: "0.95rem" }}>
            「忘れた(0) / 難しい(2)」など、理解度が低かった問題（全 {wrongQuestions.length} 問）を表示しています。クリックして内容を確認できます。
          </p>
          {wrongQuestions.map((q) => {
            let options = [];
            try {
               options = JSON.parse(q.optionsJson);
            } catch (e) {}

            return (
              <details key={q.id} className="glass-card" style={{ cursor: "pointer", padding: "1.5rem" }}>
                <summary style={{ fontSize: "1.05rem", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                   <span style={{ lineHeight: "1.6" }}>{q.questionText}</span>
                   <span style={{ 
                     background: "var(--danger-color, #ef4444)", 
                     color: "white", 
                     padding: "4px 10px", 
                     borderRadius: "12px", 
                     fontSize: "0.8rem", 
                     whiteSpace: "nowrap",
                     marginTop: "4px"
                   }}>
                     苦手度: 高
                   </span>
                </summary>
                
                <div style={{ marginTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1.5rem", cursor: "auto" }}>
                   <div style={{ marginBottom: "1.5rem" }}>
                     <h4 style={{ fontSize: "0.95rem", color: "var(--text-muted)", marginBottom: "0.8rem" }}>選択肢:</h4>
                     <ul style={{ listStyleType: "circle", paddingLeft: "1.5rem", color: "var(--text-main)", lineHeight: "1.4" }}>
                       {options.map((opt: string, i: number) => (
                         <li key={i} style={{ marginBottom: "0.5rem" }}>{opt}</li>
                       ))}
                     </ul>
                   </div>

                   {q.explanation && (
                     <div>
                       <h4 style={{ fontSize: "0.95rem", color: "var(--success-color)", marginBottom: "0.8rem" }}>e-Gov 根拠に基づく解説:</h4>
                       <div style={{ whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "8px", fontSize: "0.95rem", lineHeight: "1.6", borderLeft: "4px solid var(--accent-color)" }}>
                         {q.explanation}
                       </div>
                     </div>
                   )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
