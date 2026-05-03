ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Question" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Chat" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own User record" ON "User";
CREATE POLICY "Users can manage their own User record" ON "User" FOR ALL USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Users can manage their own Questions" ON "Question";
CREATE POLICY "Users can manage their own Questions" ON "Question" FOR ALL USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can manage their own ReviewLogs" ON "ReviewLog";
CREATE POLICY "Users can manage their own ReviewLogs" ON "ReviewLog" FOR ALL USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can manage their own Chats" ON "Chat";
CREATE POLICY "Users can manage their own Chats" ON "Chat" FOR ALL USING (auth.uid()::text = "userId");
