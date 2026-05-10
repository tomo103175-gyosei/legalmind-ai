import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="animate-fade-in" style={{ padding: "2rem 1rem", maxWidth: "800px", margin: "0 auto" }}>
      <Link href="/" style={{ color: "var(--text-muted)", marginBottom: "2rem", display: "inline-block" }}>
        ← ホームへ戻る
      </Link>
      
      <section className="glass-card" style={{ padding: "3rem 2rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "2rem", textAlign: "center" }}>利用規約</h1>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", color: "var(--text-main)", lineHeight: "1.8" }}>
          <section>
            <h2 style={{ fontSize: "1.25rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>1. はじめに</h2>
            <p>
              本規約は、LegalMind AI（以下「本サービス」）の利用条件を定めるものです。ユーザーは本サービスを利用することで、本規約に同意したものとみなされます。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "1.25rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>2. AI生成コンテンツについて</h2>
            <p>
              本サービスが提供する解説や回答は、人工知能（AI）によって生成されています。
            </p>
            <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
              <li>AIの性質上、不正確な情報や誤りが含まれる可能性があります。</li>
              <li>提供される情報は教育および学習の補助を目的としており、法的助言を構成するものではありません。</li>
              <li>重要な判断を行う際は、必ず公式の条文（e-Gov等）や専門家にご確認ください。</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: "1.25rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>3. 利用制限（無料プラン）</h2>
            <p>
              無料プランのユーザーには以下の制限が適用されます。
            </p>
            <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
              <li>1日の画像解析上限：3問まで</li>
              <li>アカウント総保存容量：15問まで</li>
            </ul>
            <p style={{ marginTop: "0.5rem" }}>
              上限に達した場合は、既存データの削除またはプレミアムプランへのアップグレードが必要です。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: "1.25rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>4. 禁止事項</h2>
            <p>
              ユーザーは、以下に該当する行為を行わないものとします。
            </p>
            <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
              <li>著作権を侵害する不適切なコンテンツのアップロード</li>
              <li>本サービスの運営を妨げる行為</li>
              <li>その他、法律に違反する行為</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: "1.25rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>5. 免責事項</h2>
            <p>
              本サービスの利用によりユーザーに生じた損害について、当方は一切の責任を負わないものとします。
            </p>
          </section>
        </div>

        <div style={{ marginTop: "4rem", textAlign: "center" }}>
          <Link href="/" className="btn btn-primary" style={{ minWidth: "200px" }}>
            同意して戻る
          </Link>
        </div>
      </section>
    </div>
  );
}
