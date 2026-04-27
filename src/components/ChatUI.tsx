"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "こんにちは。何かあった？",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [agentName, setAgentName] = useState("ちゆり");
  
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [ended, setEnded] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 音声認識の結果をリアルタイムで入力欄に反映
  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript]);

  // ユーザーが無発話で5秒続いたら自動送信する（音声入力時）
  useEffect(() => {
    // 既に会話終了している場合は無視
    if (ended) return;

    // 音声認識中のみタイマーを使う
    if (transcript && transcript.trim()) {
      // 既存タイマーをクリアしてから再設定
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        // 5秒の無発話で自動送信 + 会話を終了する
        handleSendMessage(undefined, true);
      }, 5000);
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, [transcript, ended]);

  // 新しいメッセージが追加されたら一番下までスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // sessionId を localStorage に保存して、ブラウザごとに会話を識別する
  useEffect(() => {
    try {
      const key = "nuigurumi_session_id";
      let id = localStorage.getItem(key);
      if (!id) {
        id = (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : Date.now().toString();
        localStorage.setItem(key, id);
      }
      setSessionId(id);
    } catch (e) {
      // ignore
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSendMessage = (e?: React.FormEvent, endAfterResponse: boolean = false) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    // ユーザーのメッセージを追加
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputText,
    };
    
    setMessages((prev) => [...prev, newUserMsg]);
    const textToSend = newUserMsg.content;
    setInputText("");
    resetTranscript();
    if (isListening) stopListening();

    // 会話終了トリガー（ばいばい／バイバイ）
    const lower = textToSend.trim();
    if (/^(?:ばいばい|バイバイ)$/.test(lower)) {
      const byeMsg: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: "さようなら！またね。",
      };
      setMessages((prev) => [...prev, byeMsg]);
      setEnded(true);
      // 発話を再生してから戻る
      try {
        if (typeof window !== "undefined" && 'speechSynthesis' in window) {
          const synth = window.speechSynthesis;
          synth.cancel();
          const utt = new SpeechSynthesisUtterance(byeMsg.content);
          utt.lang = "ja-JP";
          synth.speak(utt);
        }
      } catch (e) {
        console.error("TTS error", e);
      }
      return;
    }

    // API 呼び出し
    (async () => {
      try {
        setLoading(true);
        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: textToSend, sessionId, agent: agentName }),
        });

        if (!resp.ok) {
          // サーバーがエラーを返した場合は可能ならテキストで内容を取得して表示
          const text = await resp.text().catch(() => "");
          const errMsg = text || `HTTP ${resp.status}`;
          const botMsg: Message = {
            id: (Date.now() + 3).toString(),
            role: "assistant",
            content: `エラー: ${errMsg}`,
          };
          setMessages((prev) => [...prev, botMsg]);
          return;
        }

        // 正常ステータスでも JSON パースが失敗する場合があるので安全に処理する
        let json: any = null;
        try {
          json = await resp.json();
        } catch (parseErr) {
          const text = await resp.text().catch(() => "");
          const botMsg: Message = {
            id: (Date.now() + 3).toString(),
            role: "assistant",
            content: text || "エラー: レスポンスの解析に失敗しました",
          };
          setMessages((prev) => [...prev, botMsg]);
          return;
        }

        const botContent = json?.reply || (json?.error ? `エラー: ${json.error}` : "応答がありません");
        const botMsg: Message = {
          id: (Date.now() + 3).toString(),
          role: "assistant",
          content: botContent,
        };
        setMessages((prev) => [...prev, botMsg]);
        // エージェント応答を音声で再生
        try {
          if (typeof window !== "undefined" && 'speechSynthesis' in window) {
            const synth = window.speechSynthesis;
            // 発話を停止してから新しい発話を実行
            synth.cancel();
            const utt = new SpeechSynthesisUtterance(botContent);
            utt.lang = "ja-JP";
            // 少し雑音対策で速度とピッチはデフォルトにしておく
            utt.rate = 1;
            utt.pitch = 1;
            synth.speak(utt);
          }
        } catch (e) {
          // TTSが失敗しても処理を継続
          console.error("TTS error", e);
        }
        } catch (e) {
        const botMsg: Message = {
          id: (Date.now() + 4).toString(),
          role: "assistant",
          content: "通信エラーが発生しました。",
        };
        setMessages((prev) => [...prev, botMsg]);
      } finally {
        setLoading(false);
        if (endAfterResponse) {
          setEnded(true);
        }
      }
    })();
  };

  return (
    <div className="flex flex-col h-full w-full max-w-2xl mx-auto bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <span className="text-xl">🧸</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-medium text-zinc-900 dark:text-zinc-100">{agentName}（エージェント）</h2>
              <select
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="text-sm p-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                aria-label="エージェント選択"
              >
                <option value="ちゆり">ちゆり</option>
                <option value="みほ">みほ</option>
              </select>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Online</p>
          </div>
        </div>
      </div>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white dark:bg-zinc-950">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex w-full",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "flex gap-3 max-w-[80%]",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  msg.role === "user" 
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" 
                    : "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300"
                )}
              >
                {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div
                className={cn(
                  "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-sm"
                )}
              >
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        {/* スクロール用のアンカー */}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <form
          onSubmit={handleSendMessage}
          className="flex items-end gap-2 bg-white dark:bg-zinc-950 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all"
        >
          <button
            type="button"
            onClick={toggleListening}
            className={cn(
              "p-3 rounded-lg flex items-center justify-center shrink-0 transition-colors",
              isListening
                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
            title={isListening ? "音声入力を停止" : "音声入力を開始"}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={isListening ? "音声を認識中..." : "メッセージを入力..."}
            className="flex-1 max-h-32 min-h-[44px] py-3 px-2 bg-transparent border-none focus:ring-0 resize-none outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            rows={1}
          />
          
          <button
            type="submit"
            disabled={!inputText.trim() || loading || ended}
            className="p-3 bg-blue-600 text-white rounded-lg flex items-center justify-center shrink-0 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            <Send size={20} />
          </button>
        </form>
        {isListening && (
          <div className="mt-2 text-xs text-red-500 flex items-center justify-center gap-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            録音中...
          </div>
        )}
        {loading && (
          <div className="mt-2 text-xs text-zinc-500">応答を取得中...</div>
        )}
        {ended && (
          <div className="mt-2 text-xs text-zinc-500">会話は終了しました。</div>
        )}
      </div>
    </div>
  );
}
