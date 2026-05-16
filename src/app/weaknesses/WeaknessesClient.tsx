"use client";

import { useMemo, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type WeakQuestion = {
  id: string;
  questionText: string;
  optionsJson: string;
  explanation?: string | null;
  correctAnswer?: string | null;
};

export default function WeaknessesClient({ initialQuestions }: { initialQuestions: WeakQuestion[] }) {
  const [questions, setQuestions] = useState<WeakQuestion[]>(initialQuestions || []);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(questions[0]?.id ?? null);
  const [selectedOptionById, setSelectedOptionById] = useState<Record<string, number | null>>({});
  const [explanationById, setExplanationById] = useState<Record<string, string | null>>({});
  const [loadingExpById, setLoadingExpById] = useState<Record<string, boolean>>({});
  const [submittingReviewById, setSubmittingReviewById] = useState<Record<string, boolean>>({});
  const [userResultById, setUserResultById] = useState<Record<string, { isCorrect: boolean; correctAnswer: string } | null>>({});
  const [progressById, setProgressById] = useState<Record<string, number>>({});
  const questionRef = useRef<HTMLDivElement>(null);

  const q = useMemo(() => {
    if (!selectedQuestionId) return null;
    return questions.find((x) => x.id === selectedQuestionId) ?? null;
  }, [questions, selectedQuestionId]);

  const options = useMemo(() => {
    if (!q) return [];
    try {
      const parsed = JSON.parse(q.optionsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [q]);

  const handleSubmit = async () => {
    if (!q) return;
    const selectedOption = selectedOptionById[q.id] ?? null;
    if (selectedOption === null) return;

    // もしすでに保存された正解・解説がある場合はそれを使う
    if (q.explanation && q.correctAnswer) {
      setExplanationById(prev => ({ ...prev, [q.id]: q.explanation || "" }));
      setUserResultById(prev => ({ 
        ...prev, 
        [q.id]: {
          isCorrect: q.correctAnswer === (selectedOption + 1).toString(),
          correctAnswer: q.correctAnswer || "?"
        } 
      }));
      return;
    }

    setLoadingExpById((prev) => ({ ...prev, [q.id]: true }));
    setProgressById(prev => ({ ...prev, [q.id]: 0 }));
    
    // プログレスバーの擬似アニメーション (合計40秒)
    const interval = setInterval(() => {
      setProgressById(prev => {
        const p = prev[q.id] || 0;
        let nextP = p;
        if (p < 60) nextP = p + 0.4;      // 15秒で60%
        else if (p < 85) nextP = p + 0.16; // 15秒で25%
        else if (p < 95) nextP = p + 0.1;  // 10秒で10%
        else nextP = 95;
        return { ...prev, [q.id]: nextP };
      });
    }, 100);

    try {
      const res = await fetch("/api/explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          questionText: q.questionText,
          optionsJson: q.optionsJson,
          userAnswer: options[selectedOption],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "解説の生成に失敗しました");
      setExplanationById((prev) => ({
        ...prev,
        [q.id]: data.explanation || "解説を生成できませんでした。",
      }));
      setUserResultById((prev) => ({
        ...prev,
        [q.id]: {
          isCorrect: data.correctAnswer === (selectedOption + 1).toString(),
          correctAnswer: data.correctAnswer || "?"
        }
      }));
    } catch (e: any) {
      console.error(e);
      alert(`エラー: ${e.message}`);
    } finally {
      clearInterval(interval);
      setLoadingExpById((prev) => ({ ...prev, [q.id]: false }));
      setProgressById(prev => ({ ...prev, [q.id]: 100 }));
    }
  };

  const handleReview = async (quality: number) => {
    if (!q) return;
    setSubmittingReviewById((prev) => ({ ...prev, [q.id]: true }));
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q.id, quality }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "復習結果の保存に失敗しました");

      setQuestions((prev) => {
        const next = prev.filter((x) => x.id !== q.id);
        // 削除した問題が選択中だったら、次の問題を自動選択
        if (selectedQuestionId === q.id) {
          setSelectedQuestionId(next[0]?.id ?? null);
        }
        return next;
      });
      setSelectedOptionById((prev) => ({ ...prev, [q.id]: null }));
      setExplanationById((prev) => ({ ...prev, [q.id]: null }));
    } catch (e: any) {
      console.error(e);
      alert(`エラー: ${e.message}`);
    } finally {
      setSubmittingReviewById((prev) => ({ ...prev, [q.id]: false }));
    }
  };

  const selectedOption = q ? selectedOptionById[q.id] ?? null : null;
  const explanation = q ? explanationById[q.id] ?? null : null;
  const loadingExp = q ? !!loadingExpById[q.id] : false;
  const submittingReview = q ? !!submittingReviewById[q.id] : false;
  const userResult = q ? userResultById[q.id] : null;
  const progress = q ? progressById[q.id] || 0 : 0;

  if (!questions || questions.length === 0) {
    return (
      <div className="glass-card animate-fade-in" style={{ textAlign: "center", padding: "3rem 1rem" }}>
        <p style={{ color: "var(--success-color)", fontSize: "1.1rem", marginBottom: "1rem" }}>🎉 苦手ノートの復習は完了しました！</p>
        <p style={{ color: "var(--text-muted)" }}>このページで間違えた問題を、もう一度解き直せます。</p>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="glass-card animate-fade-in" style={{ textAlign: "center", padding: "3rem 1rem" }}>
        <p style={{ color: "var(--text-muted)" }}>問題を選択してください。</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div ref={questionRef} className="glass-card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1.1rem", lineHeight: "1.6", margin: 0 }}>{q.questionText}</h3>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", whiteSpace: "nowrap", marginTop: "4px" }}>
            残り {questions.length} 問
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
          {options.map((opt: string, i: number) => {
            const displayOpt = /^[1-5１-５][\.．\s]/.test(opt) ? opt : `${i + 1}. ${opt}`;
            return (
            <label
              key={i}
              style={{
                padding: "1rem",
                border: `1px solid ${selectedOption === i ? "var(--primary-color)" : "var(--border-color)"}`,
                borderRadius: "var(--btn-border-radius)",
                cursor: "pointer",
                background: selectedOption === i ? "rgba(59, 130, 246, 0.1)" : "transparent",
                transition: "all 0.2s",
              }}
            >
              <input
                type="radio"
                name="weakness-option"
                style={{ marginRight: "0.5rem" }}
                onChange={() => setSelectedOptionById((prev) => ({ ...prev, [q.id]: i }))}
                checked={selectedOption === i}
                disabled={loadingExp || submittingReview}
              />
              {displayOpt}
            </label>
          )})}
        </div>

        {!explanation ? (
        <button
          className="btn btn-primary"
          style={{ width: "100%", height: "3.5rem", position: "relative", overflow: "hidden" }}
          disabled={selectedOption === null || loadingExp || submittingReview}
          onClick={handleSubmit}
        >
          {loadingExp && (
            <div style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${progress}%`,
              background: "rgba(255, 255, 255, 0.2)",
              transition: "width 0.2s linear"
            }} />
          )}
          <span style={{ position: "relative", zIndex: 1 }}>
            {loadingExp ? `解説を生成中... ${Math.floor(progress)}%` : q.explanation ? "解答と解説を確認する（保存済み）" : "解答と解説を確認する"}
          </span>
        </button>
      ) : (
        <div className="animate-fade-in">
          {userResult && (
            <div style={{ 
              textAlign: "center", 
              padding: "1rem", 
              marginBottom: "1.5rem", 
              borderRadius: "12px", 
              fontSize: "1.2rem", 
              fontWeight: "bold",
              background: userResult.isCorrect ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
              border: `2px solid ${userResult.isCorrect ? "var(--success-color)" : "rgba(239, 68, 68, 1)"}`,
              color: userResult.isCorrect ? "var(--success-color)" : "rgba(239, 68, 68, 1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem"
            }}>
              {userResult.isCorrect ? (
                <><span>⭕</span> 正解です！</>
              ) : (
                <><span>❌</span> 不正解（正解は選択肢 {userResult.correctAnswer}）</>
              )}
            </div>
          )}
            <h4 style={{ color: "var(--success-color)", margin: "1rem 0 0.5rem 0", fontSize: "1.05rem" }}>
              e-Gov 根拠に基づく解説
            </h4>
            <div
              style={{
                marginBottom: "1.5rem",
                background: "rgba(0,0,0,0.3)",
                padding: "1rem",
                borderRadius: "8px",
                fontSize: "0.95rem",
                lineHeight: "1.6",
                borderLeft: "4px solid var(--accent-color)",
              }}
              className="markdown-body"
            >
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }} />
                }}
              >
                {explanation}
              </ReactMarkdown>
            </div>

            <h4 style={{ textAlign: "center", marginBottom: "1rem", fontSize: "1rem" }}>この問題の理解度はどうでしたか？</h4>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
              {[
                { score: 0, label: "忘れた (0)" },
                { score: 2, label: "難しい (2)" },
                { score: 4, label: "普通 (4)" },
                { score: 5, label: "簡単 (5)" },
              ].map((btn) => (
                <button
                  key={btn.score}
                  className="btn btn-outline"
                  onClick={() => handleReview(btn.score)}
                  disabled={submittingReview}
                >
                  {submittingReview ? "保存中..." : btn.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: "1rem" }}>
        <h4 style={{ fontSize: "1rem", margin: "0 0 0.75rem 0" }}>一覧（クリックして選択）</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {questions.map((item, idx) => {
            const active = item.id === selectedQuestionId;
            return (
              <button
                key={item.id}
                className={active ? "btn btn-primary" : "btn btn-outline"}
                style={{
                  width: "100%",
                  textAlign: "left",
                  justifyContent: "flex-start",
                  padding: "0.75rem 1rem",
                  whiteSpace: "normal",
                  lineHeight: "1.4",
                }}
                onClick={() => {
                  setSelectedQuestionId(item.id);
                  setTimeout(() => {
                    questionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 50);
                }}
                disabled={submittingReview}
              >
                {idx + 1}. {item.questionText}
              </button>
            );
          })}
        </div>
      </div>


    </div>
  );
}

