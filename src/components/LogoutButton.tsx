"use client";

import { createClient } from "@/utils/supabase/client";

export default function LogoutButton() {
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <button onClick={handleLogout} className="btn btn-outline" style={{ padding: "4px 8px", fontSize: "0.8rem" }}>
      ログアウト
    </button>
  );
}
