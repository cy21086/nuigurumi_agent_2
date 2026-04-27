import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { message, sessionId, agent } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }

    // agent は profiles.name を期待（例: "ちゆり" または "みほ"）。指定がなければ 'ちゆり' を使う
    const agentName = agent || "ちゆり";

    // プロフィールをDBから取得
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("name", agentName)
      .limit(1)
      .single();

    if (profileError) {
      console.error("Supabase profile fetch error", profileError);
    }

    const profile = profiles || null;

    // DBにユーザーメッセージを保存（profile がある場合は user_id を入れる）
    try {
      await supabase.from("chats").insert([
        {
          session_id: sessionId ?? "default",
          user_id: profile?.user_id ?? null,
          role: "user",
          message,
        },
      ]);
    } catch (e) {
      console.error("Supabase insert user chat error", e);
    }

    // system プロンプトをプロフィールから作成
    let systemPrompt = "あなたは会話エージェントです。親切に応答してください。";
    if (profile && profile.personality_json) {
      try {
        const pj = profile.personality_json;
        const tone = pj.tone || "";
        const intro = pj.intro || "";
        systemPrompt = `あなたは${profile.name}という人格を持つエージェントです。性格: ${tone}。初期口調: ${intro}`;
      } catch (e) {
        // ignore
      }
    }

    const messagesForOpenAI = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: messagesForOpenAI,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? "";

    // assistant の応答を chats に保存
    try {
      await supabase.from("chats").insert([
        {
          session_id: sessionId ?? "default",
          user_id: profile?.user_id ?? null,
          role: "assistant",
          message: reply,
        },
      ]);
    } catch (e) {
      console.error("Supabase insert assistant chat error", e);
    }

    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
