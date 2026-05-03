"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const router = useRouter();

  const handleUpload = async () => {
    if (!file) {
      alert("⚠️ 画像が選択されていません！もう一度撮影してください。");
      return;
    }
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("image", file, file.name || "upload.jpg");

      // OCR Parsing
      const ocrRes = await fetch("/api/ocr", { method: "POST", body: formData });
      
      if (!ocrRes.ok) {
        const errorText = await ocrRes.text();
        throw new Error(`送信エラー (${ocrRes.status}): ${errorText.substring(0, 50)}`);
      }

      const ocrData = await ocrRes.json();
      if (ocrData.error) throw new Error(ocrData.error || "情報の解析に失敗しました");

      const options = ocrData.optionsJson ? ocrData.optionsJson : [];

      // Save Question
      const saveRes = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: ocrData.questionText || "問題文が抽出できませんでした...",
          optionsJson: JSON.stringify(options),
          userId: "test-user"
        })
      });

      if (saveRes.ok) {
        alert("✅ 解析と保存に成功しました！学習画面へ移動します。");
        router.push("/study");
      } else {
        const saveErr = await saveRes.text();
        throw new Error(`保存エラー: ${saveErr.substring(0, 50)}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`⚠️ エラー詳細: ${e.message ? e.message : JSON.stringify(e)}`);
    } finally {
      setParsing(false);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    } else {
      console.warn("No file selected");
    }
  };

  return (
    <div className="glass-card animate-fade-in" style={{ textAlign: "center" }}>
      <h2>📋 問題を登録</h2>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        カメラで直接撮影するか、保存済みの写真を選択してください。
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
        <label className="btn btn-outline" style={{ cursor: "pointer", display: "inline-block" }}>
          📸 カメラで撮影する
          <input 
            type="file" 
            accept="image/jpeg, image/jpg, image/png" 
            capture="environment" 
            onChange={onFileSelect}
            style={{ display: "none" }} 
          />
        </label>

        <label className="btn btn-outline" style={{ cursor: "pointer", display: "inline-block" }}>
          📁 フォルダから選ぶ
          <input 
            type="file" 
            accept="image/jpeg, image/jpg, image/png" 
            onChange={onFileSelect}
            style={{ display: "none" }} 
          />
        </label>
      </div>

      {file && (
        <p style={{ fontSize: "0.9rem", color: "var(--accent-color)", marginBottom: "1rem" }}>
          ☑️ 選択済み: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </p>
      )}

      <button className="btn btn-primary" onClick={handleUpload} disabled={!file || parsing} style={{ width: "100%", height: "3.5rem", fontSize: "1.1rem" }}>
        {parsing ? "⏳ AIが画像を解析中 (約10〜30秒)..." : "アップロードして解析"}
      </button>
    </div>
  );
}
