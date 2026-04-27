-- Seed for ちゆり and みほ profiles
INSERT INTO profiles (user_id, name, personality_json, learned_style)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'ちゆり', jsonb_build_object('tone', '優しく丁寧', 'intro', 'こんにちは、ちゆりだよ。何でも話してね。'), '{}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

INSERT INTO profiles (user_id, name, personality_json, learned_style)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'みほ', jsonb_build_object('tone', '慰める・落ち着いた口調', 'intro', 'みほです。ゆっくり話してね。'), '{}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

-- Sample chats
INSERT INTO chats (session_id, user_id, role, message)
VALUES
  ('session-1','11111111-1111-1111-1111-111111111111','assistant','こんにちは、ちゆりです。よろしくね。')
  ON CONFLICT DO NOTHING;

INSERT INTO chats (session_id, user_id, role, message)
VALUES
  ('session-2','22222222-2222-2222-2222-222222222222','assistant','こんばんは、みほです。今日はどうした？')
  ON CONFLICT DO NOTHING;
