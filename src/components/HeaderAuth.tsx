import { createClient } from "@/utils/supabase/server";
import LoginButton from "./LoginButton";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default async function HeaderAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
      {user ? (
        <>
          <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
            {user.email}
          </span>
          <LogoutButton />
        </>
      ) : (
        <LoginButton />
      )}
    </div>
  );
}
