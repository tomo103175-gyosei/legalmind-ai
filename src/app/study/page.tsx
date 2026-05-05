"use client";
import { useState, useEffect } from "react";

function ScheduleView({ schedule }: { schedule: any[] }) {
  if (!schedule || schedule.length === 0) {
    return (
      <div style={{ marginTop: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.95rem" }}>
        今後の復習予定はまだありません。問題をアップロードしましょう！
      </div>
    );
  }
  
  return (
    <div className="animate-fade-in" style={{ marginTop: "3rem", padding: "1.5rem 1rem", background: "rgba(255,255,255,0.03)", borderRadius: "var(--border-radius)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem", textAlign: "center" }}>📅 今後の復習スケジュール</h3>
      
      <div style={{ display: "flex", overflowX: "auto", gap: "10px", paddingBottom: "10px", justifyContent: schedule.length < 4 ? "center" : "flex-start" }}>
        {schedule.map(s => {
          // "2026/04/26" -> "04/26"
          const parts = s.date.split('/');
          const shortDate = parts.length === 3 ? `${parts[1]}/${parts[2]}` : s.date;
          
          return (
            <div key={s.date} style={{ minWidth: "75px", background: "rgba(0,0,0,0.2)", padding: "12px 5px", borderRadius: "8px", textAlign: "center", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "4px" }}>{shortDate}</div>
              <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "var(--primary-color)" }}>{s.count}<span style={{fontSize:"0.8rem", color:"var(--text-muted)", marginLeft:"2px"}}>問</span></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatDateJa(dateLike: string | Date | null | undefined) {
  if (!dateLike) return "-";
  const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export default function StudyPage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [allLoading, setAllLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [generatingExp, setGeneratingExp] = useState(false);

  const fetchSchedule = () => {
    fetch("/api/questions/schedule?userId=test-user")
      .then(r => r.json())
      .then(data => {
        setSchedule(data.schedule || []);
      });
  };

  const fetchAllQuestions = () => {
    setAllLoading(true);
    fetch("/api/questions")
      .then(r => r.json())
      .then(data => {
        setAllQuestions(data.questions || []);
      })
      .finally(() => setAllLoading(false));
  };

  const handleDeleteQuestion = async (id: string) => {
    const ok = confirm("この問題を削除しますか？（復習履歴も消えます）");
    if (!ok) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/questions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "削除に失敗しました");
      setAllQuestions((prev) => prev.filter((q) => q.id !== id));
      // もし今日の出題中リストにも含まれていたら除外
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      fetchSchedule();
    } catch (e: any) {
      console.error(e);
      alert(`エラー: ${e.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetch("/api/questions/due?userId=test-user")
      .then(r => r.json())
      .then(data => {
        setQuestions(data.questions || []);
        setLoading(false);
      });
      
    // Fetch upcoming schedule
    fetchSchedule();
    // Fetch all uploaded questions list
    fetchAllQuestions();
  }, []);

  if (loading) return <div style={{ textAlign: "center" }}>今日のタスクを読み込み中...</div>;

  const q = questions[0];
  let options = [];
  try {
    options = JSON.parse(q.optionsJson);
  } catch (e) {}

  const handleSubmit = async () => {
    if (selectedOption === null) return;
    setGeneratingExp(true);
    try {
      const res = await fetch("/api/explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          questionText: q.questionText,
          optionsJson: q.optionsJson,
          userAnswer: options[selectedOption]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "解説の生成に失敗しました");
      setExplanation(data.explanation);
    } catch (e: any) {
      console.error(e);
      alert(`エラー: ${e.message}`);
    } finally {
      setGeneratingExp(false);
    }
  };

  const handleFollowUp = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput("");
    setFollowUps(prev => [...prev, { role: 'user', text: msg }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/explanation/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: q.questionText,
          previousExplanation: explanation,
          userMessage: msg,
          chatHistory: followUps
        })
      });
      const data = await res.json();
      setFollowUps(prev => [...prev, { role: 'ai', text: data.answer || data.error }]);
    } catch (e) {
      console.error(e);
      setFollowUps(prev => [...prev, { role: 'ai', text: "エラー: 回答を取得できませんでした。" }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleReview = async (quality: number) => {
    // 1. Submit review
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: q.id, userId: "test-user", quality })
    });
    
    // 2. Next question
    setQuestions(questions.slice(1));
    setSelectedOption(null);
    setExplanation(null);
    setFollowUps([]);
    setChatInput("");
    
    // 3. Refresh schedule so the user sees the newly calculated date shift magically!
    fetchSchedule();
    // 4. Refresh list so nextReviewDate is reflected
    fetchAllQuestions();
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      {questions.length === 0 ? (
        <div className="glass-card animate-fade-in" style={{ textAlign: "center" }}>
          <h2>🎉 今日のタスクは完了しました！</h2>
          <p style={{ color: "var(--success-color)", marginBottom: "2rem" }}>
            今日復習すべき問題はすべて終了しました。
          </p>
          <a
            href="/upload"
            className="btn btn-primary"
            style={{ width: "100%", maxWidth: "300px", margin: "0 auto" }}
          >
            新しい問題を登録する
          </a>
        </div>
      ) : (
        <div className="glass-card animate-fade-in">
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", lineHeight: "1.5" }}>{q.questionText}</h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
            {options.map((opt: string, i: number) => (
              <label 
                key={i} 
                style={{ 
                  padding: "1rem", 
                  border: `1px solid ${selectedOption === i ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  borderRadius: "var(--btn-border-radius)",
                  cursor: "pointer",
                  background: selectedOption === i ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  transition: "all 0.2s"
                }}
              >
                <input 
                  type="radio" 
                  name="option" 
                  style={{ marginRight: "0.5rem" }}
                  onChange={() => setSelectedOption(i)} 
                  checked={selectedOption === i} 
                />
                {opt}
              </label>
            ))}
          </div>

          {!explanation ? (
            <button 
              className="btn btn-primary" 
              style={{ width: "100%", height: "3.5rem" }} 
              disabled={selectedOption === null || generatingExp}
              onClick={handleSubmit}
            >
              {generatingExp ? "e-Gov出力・解説を生成中..." : "解答と解説を確認する"}
            </button>
          ) : (
            <div className="animate-fade-in">
              <h3 style={{ color: "var(--success-color)", marginBottom: "0.5rem", fontSize: "1.1rem" }}>e-Gov 根拠に基づく解説</h3>
              <div style={{ whiteSpace: "pre-wrap", marginBottom: "2rem", background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "8px", fontSize: "0.95rem", lineHeight: "1.6", borderLeft: "4px solid var(--accent-color)" }}>
                {explanation}
              </div>

              {/* Follow up chat UI */}
              <div style={{ marginBottom: "2rem", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1rem" }}>
                <h4 style={{ fontSize: "1rem", marginBottom: "1rem" }}>💬 AIに追加で質問・指摘する</h4>
                
                {followUps.map((msg, idx) => (
                  <div key={idx} style={{ padding: "0.8rem", marginBottom: "0.5rem", background: msg.role === 'user' ? "rgba(59, 130, 246, 0.15)" : "rgba(0,0,0,0.3)", borderLeft: msg.role === 'ai' ? "4px solid var(--primary-color)" : "none", borderRadius: "8px", fontSize: "0.95rem", lineHeight: "1.5" }}>
                    <strong style={{ display: "block", marginBottom: "4px", color: msg.role === 'user' ? "var(--accent-color)" : "white" }}>{msg.role === 'user' ? 'あなた' : 'AI'}:</strong>
                    <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
                  </div>
                ))}
                
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                  <textarea 
                    value={chatInput} 
                    onChange={e => setChatInput(e.target.value)} 
                    disabled={chatLoading || followUps.filter(f => f.role === 'user').length >= 3} 
                    placeholder={followUps.filter(f => f.role === 'user').length >= 3 ? "深掘りチャットの制限（3往復）に到達しました" : "「ここ間違ってませんか？」「判例を教えてください」"} 
                    style={{ flex: 1, padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)", color: "var(--text-main)", resize: "vertical", minHeight: "50px", fontFamily: "inherit" }} 
                  />
                  <button className="btn btn-primary" onClick={handleFollowUp} disabled={chatLoading || !chatInput.trim() || followUps.filter(f => f.role === 'user').length >= 3} style={{ whiteSpace: "nowrap", padding: "0 1rem" }}>
                    {chatLoading ? "考案中..." : "送信する"}
                  </button>
                </div>
              </div>
              
              <h4 style={{ textAlign: "center", marginBottom: "1rem", fontSize: "1rem" }}>この問題の理解度はどうでしたか？</h4>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
                {[
                  { score: 0, label: "忘れた (0)" },
                  { score: 2, label: "難しい (2)" },
                  { score: 4, label: "普通 (4)" },
                  { score: 5, label: "簡単 (5)" }
                ].map(btn => (
                  <button 
                    key={btn.score}
                    className="btn btn-outline" 
                    onClick={() => handleReview(btn.score)}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global upcoming schedule shown underneath active questions as well */}
      <ScheduleView schedule={schedule} />

      <div
        className="glass-card animate-fade-in"
        style={{ marginTop: "2rem" }}
      >
        <h3 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>📚 アップロード済みの問題一覧</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginBottom: "1rem" }}>
          追加日と次回復習日を表示します。クリックすると問題内容が展開されます。
        </p>

        {allLoading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)" }}>一覧を読み込み中...</div>
        ) : allQuestions.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)" }}>まだ問題がありません。まずはアップロードしましょう。</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {allQuestions.map((item) => {
              let itemOptions: string[] = [];
              try {
                itemOptions = JSON.parse(item.optionsJson || "[]");
              } catch (e) {}

              return (
                <details
                  key={item.id}
                  style={{
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                    padding: "1rem",
                    cursor: "pointer",
                  }}
                >
                  <summary
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.4rem",
                      listStyle: "none",
                    }}
                  >
                    <span style={{ fontWeight: 700, lineHeight: "1.5" }}>
                      {item.questionText}
                    </span>
                    <span style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      <span>追加日: {formatDateJa(item.createdAt)}</span>
                      <span>次回復習日: {formatDateJa(item.nextReviewDate)}</span>
                    </span>
                  </summary>

                  <div style={{ marginTop: "1rem", cursor: "auto" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
                      <button
                        className="btn btn-outline"
                        style={{ borderColor: "rgba(239, 68, 68, 0.6)", color: "rgba(239, 68, 68, 1)" }}
                        disabled={deletingId === item.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteQuestion(item.id);
                        }}
                      >
                        {deletingId === item.id ? "削除中..." : "この問題を削除"}
                      </button>
                    </div>

                    {itemOptions.length > 0 && (
                      <div style={{ marginBottom: "1rem" }}>
                        <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>選択肢</div>
                        <ul style={{ paddingLeft: "1.2rem", lineHeight: "1.5" }}>
                          {itemOptions.map((opt, idx) => (
                            <li key={idx}>{opt}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {item.explanation && (
                      <div>
                        <div style={{ fontSize: "0.9rem", color: "var(--success-color)", marginBottom: "0.5rem" }}>解説</div>
                        <div style={{ whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "8px", fontSize: "0.95rem", lineHeight: "1.6", borderLeft: "4px solid var(--accent-color)" }}>
                          {item.explanation}
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
    </div>
  );
}
