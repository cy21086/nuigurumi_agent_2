import { createClient } from '@supabase/supabase-js';

// 環境変数は開発環境では .env.local から読み込まれるはず。
// デバッグしやすいように値をトリムして、存在確認ログ（マスク付き）を出す。
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const rawAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
const supabaseUrl = String(rawUrl).trim();
const supabaseAnonKey = String(rawAnon).trim();

// デバッグ用ログ（キー全体は表示しない）
if (process.env.NODE_ENV === 'development') {
	const mask = (s?: string) => {
		if (!s) return '(empty)';
		const st = String(s);
		if (st.length <= 8) return st;
		return `${st.slice(0, 6)}...${st.slice(-4)}`;
	};
	// eslint-disable-next-line no-console
	console.info('[supabase] NEXT_PUBLIC_SUPABASE_URL present:', Boolean(rawUrl), 'value:', mask(rawUrl));
	// eslint-disable-next-line no-console
	console.info('[supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY present:', Boolean(rawAnon), 'value:', mask(rawAnon));
}

if (!supabaseUrl) {
	// 明示的にわかりやすいエラーを投げる（既存の挙動と同じだがログが増える）
	throw new Error('supabaseUrl is required. Please set NEXT_PUBLIC_SUPABASE_URL in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
