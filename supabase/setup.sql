-- プロファイルテーブル（ユーザー情報や人格、口癖を保存）
CREATE TABLE profiles (
    user_id UUID PRIMARY KEY, -- ユーザー識別子
    name TEXT NOT NULL,       -- ユーザー名
    personality_json JSONB DEFAULT '{}'::jsonb, -- 性格、趣味、関係性、初期口調など
    learned_style JSONB DEFAULT '{}'::jsonb,    -- 学習済みの口癖
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 近況（Life Events）テーブル（要約された近況を保存）
CREATE TABLE life_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE, -- 近況の主（話した人）
    content TEXT NOT NULL,    -- 要約された近況
    category TEXT,            -- カテゴリ（食事、仕事、趣味など）
    is_told BOOLEAN DEFAULT false, -- 相手に伝達済みかどうか
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- チャット履歴テーブル
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL, -- 会話セッションID
    user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE, -- 話しているユーザー
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) を一時的に無効化、あるいはテスト用に全許可（プロトタイプ用）
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write on profiles" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow public read/write on life_events" ON life_events FOR ALL USING (true);
CREATE POLICY "Allow public read/write on chats" ON chats FOR ALL USING (true);
