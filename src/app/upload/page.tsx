"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type DuplicateResult = {
  isDuplicate: boolean;
  confidence?: string;
  method?: string;
  similarityScore?: number;
  message?: string;
  existingQuestionId?: string;
};

type UsageData = {
  plan: string;
  dailyCount: number;
  totalCount: number;
  limits: {
    FREE_DAILY: number;
    FREE_TOTAL: number;
  };
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateResult | null>(null);
  const [pendingSaveData, setPendingSaveData] = useState<{ questionText: string; optionsJson: string } | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const res = await fetch("/api/user/usage");
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch (e) {
      console.error("Failed to fetch usage:", e);
    }
  };

  const isLimitReached = usage?.plan === "FREE" && usage.totalCount >= usage.limits.FREE_TOTAL;

  const saveQuestion = async (questionText: string, optionsJson: string) => {
    const saveRes = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionText,
        optionsJson,
      }),
    });

    if (saveRes.ok) {
      alert("✅ 解析と保存に成功しました！学習画面へ移動します。");
      await fetchUsage(); // Refresh usage data
      router.push("/study");
    } else {
      const data = await saveRes.json();
      if (data.capacityReached || data.limitReached) {
        setShowPaywall(true);
      } else {
        throw new Error(data.error || "保存エラーが発生しました");
      }
    }
  };

  const handleUpload = async () => {
    if (isLimitReached) {
      setShowPaywall(true);
      return;
    }

    if (!file) {
      alert("⚠️ 画像が選択されていません！もう一度撮影してください。");
      return;
    }
    setParsing(true);
    setDuplicateWarning(null);
    setPendingSaveData(null);

    try {
      const formData = new FormData();
      formData.append("image", file, file.name || "upload.jpg");

      // Step 1: OCR解析（Gemini 1.5 Flash）
      const ocrRes = await fetch("/api/ocr", { method: "POST", body: formData });

      if (!ocrRes.ok) {
        const errorText = await ocrRes.text();
        throw new Error(`送信エラー (${ocrRes.status}): ${errorText.substring(0, 50)}`);
      }

      const ocrData = await ocrRes.json();
      if (ocrData.error) throw new Error(ocrData.error || "情報の解析に失敗しました");

      const options = ocrData.optionsJson ? ocrData.optionsJson : [];
      const questionText = ocrData.questionText || "問題文が抽出できませんでした...";
      const optionsJson = JSON.stringify(options);

      // Step 2: 重複チェック
      const dupRes = await fetch("/api/questions/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText }),
      });
      const dupData: DuplicateResult = dupRes.ok ? await dupRes.json() : { isDuplicate: false };

      if (dupData.isDuplicate) {
        // 重複の可能性あり → ユーザーに確認
        setDuplicateWarning(dupData);
        setPendingSaveData({ questionText, optionsJson });
        setParsing(false);
        return;
      }

      // Step 3: 新規問題として保存
      await saveQuestion(questionText, optionsJson);
    } catch (e: any) {
      console.error(e);
      alert(`⚠️ エラー詳細: ${e.message ? e.message : JSON.stringify(e)}`);
    } finally {
      setParsing(false);
    }
  };

  const handleForceRegister = async () => {
    if (!pendingSaveData) return;
    setParsing(true);
    try {
      await saveQuestion(pendingSaveData.questionText, pendingSaveData.optionsJson);
    } catch (e: any) {
      alert(`⚠️ エラー詳細: ${e.message}`);
    } finally {
      setParsing(false);
    }
  };

  const handleCancelDuplicate = () => {
    setDuplicateWarning(null);
    setPendingSaveData(null);
    setFile(null);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLimitReached) {
      setShowPaywall(true);
      return;
    }
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setDuplicateWarning(null);
      setPendingSaveData(null);
    } else {
      console.warn("No file selected");
    }
  };

  const confidenceLabel = (result: DuplicateResult) => {
    if (result.method === "gemini-pro-escalation") return "AI（Pro）判定";
    if (result.confidence === "high") return "高精度ローカル判定";
    return "自動判定";
  };

  return (
    <div className="glass-card animate-fade-in" style={{ textAlign: "center", position: "relative" }}>
      <h2>📋 問題を登録</h2>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        カメラで直接撮影するか、保存済みの写真を選択してください。
      </p>

      {/* ペイウォールモーダル風UI */}
      {showPaywall && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.9)", zIndex: 10, borderRadius: "var(--card-border-radius)",
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "2rem"
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1.5rem" }}>🔒</div>
          <h3 style={{ marginBottom: "1rem" }}>アカウントの保存上限に達しました</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: "2rem", lineHeight: "1.6" }}>
            無料プランの保存上限（15問）に達しました。<br/>
            過去の学習履歴を削除して枠を空けるか、プレミアムプランで無制限に学習しましょう。
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%", maxWidth: "300px" }}>
            <form action="/api/stripe/checkout" method="POST">
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                プレミアムプランへアップグレード
              </button>
            </form>
            <button className="btn btn-outline" onClick={() => setShowPaywall(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 重複警告UI */}
      {duplicateWarning && (
        <div
          style={{
            background: "rgba(234, 179, 8, 0.12)",
            border: "1px solid rgba(234, 179, 8, 0.5)",
            borderRadius: "12px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
            textAlign: "left",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "#facc15", marginBottom: "0.5rem" }}>
            ⚠️ 重複問題の可能性があります
          </div>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
            {duplicateWarning.message || "この問題はすでに登録されている可能性があります。"}
            <br />
            <span style={{ fontSize: "0.8rem" }}>
              判定方法: {confidenceLabel(duplicateWarning)}
              {duplicateWarning.similarityScore !== undefined &&
                ` / 類似度: ${(duplicateWarning.similarityScore * 100).toFixed(1)}%`}
            </span>
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              className="btn btn-outline"
              style={{ borderColor: "rgba(234,179,8,0.6)", color: "#facc15", flex: 1 }}
              onClick={handleForceRegister}
              disabled={parsing}
            >
              それでも登録する
            </button>
            <button
              className="btn btn-outline"
              style={{ borderColor: "rgba(239,68,68,0.5)", color: "rgba(239,68,68,1)", flex: 1 }}
              onClick={handleCancelDuplicate}
              disabled={parsing}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
        <label 
          className={`btn btn-outline ${isLimitReached ? 'disabled' : ''}`} 
          style={{ cursor: isLimitReached ? "not-allowed" : "pointer", display: "inline-block", opacity: isLimitReached ? 0.6 : 1 }}
          onClick={() => isLimitReached && setShowPaywall(true)}
        >
          📸 カメラで撮影する
          {!isLimitReached && (
            <input
              type="file"
              accept="image/jpeg, image/jpg, image/png"
              capture="environment"
              onChange={onFileSelect}
              style={{ display: "none" }}
            />
          )}
        </label>

        <label 
          className={`btn btn-outline ${isLimitReached ? 'disabled' : ''}`} 
          style={{ cursor: isLimitReached ? "not-allowed" : "pointer", display: "inline-block", opacity: isLimitReached ? 0.6 : 1 }}
          onClick={() => isLimitReached && setShowPaywall(true)}
        >
          📁 フォルダから選ぶ
          {!isLimitReached && (
            <input
              type="file"
              accept="image/jpeg, image/jpg, image/png"
              onChange={onFileSelect}
              style={{ display: "none" }}
            />
          )}
        </label>
      </div>

      {file && (
        <p style={{ fontSize: "0.9rem", color: "var(--accent-color)", marginBottom: "1rem" }}>
          ☑️ 選択済み: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </p>
      )}

      <button
        className="btn btn-primary"
        onClick={handleUpload}
        disabled={(!file && !isLimitReached) || parsing || !!duplicateWarning}
        style={{ width: "100%", height: "3.5rem", fontSize: "1.1rem", opacity: isLimitReached ? 0.7 : 1 }}
      >
        {isLimitReached ? "🔒 保存上限に達しました" : (parsing ? "⏳ AIが画像を解析中 (約10〜30秒)..." : "アップロードして解析")}
      </button>

      {usage && usage.plan === "FREE" && (
        <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          無料プラン利用状況: {usage.totalCount} / {usage.limits.FREE_TOTAL} 問保存済み
        </p>
      )}
    </div>
  );
}
