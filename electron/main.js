const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Node <20 の環境でも File を使えるようポリフィルをセット
try {
  if (typeof globalThis.File === 'undefined') {
    // node:buffer の File を使う
    try {
      const { File } = require('node:buffer');
      globalThis.File = File;
      console.log('Polyfill: globalThis.File set from node:buffer');
    } catch (e1) {
      try {
        // fallback to buffer module name without node: prefix
        const { File } = require('buffer');
        globalThis.File = File;
        console.log('Polyfill: globalThis.File set from buffer');
      } catch (e2) {
        console.warn('Could not polyfill globalThis.File - File uploads may fail on Node <20');
      }
    }
  }
} catch (e) {
  // ignore
}

// dotenv を使ってルートの .env.local を読み込む（存在すれば）
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
} catch (e) {
  // dotenv がインストールされていない場合はスキップ。環境変数はシステム側で渡してください。
}

// Supabase client
let createSupabaseClient;
try {
  createSupabaseClient = require('@supabase/supabase-js').createClient;
} catch (e) {
  console.warn('Failed to load @supabase/supabase-js. Install it if you need DB access in main process.');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Web Speech API 等、実験的機能を有効化
      experimentalFeatures: true,
      enableBlinkFeatures: 'SpeechRecognition',
    },
  });

  // 静的出力の index.html を読み込む。複数の出力先を考慮して最初に見つかったものを使う。
  const fs = require('fs');
  const { pathToFileURL } = require('url');
  const candidates = [
    path.join(__dirname, '..', 'out', 'index.html'),
    path.join(__dirname, '..', '.next', 'output', 'export', 'index.html'),
    path.join(__dirname, '..', '.next', 'output', 'index.html'),
  ];
  let indexPath = null;
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        indexPath = p;
        break;
      }
    } catch (e) {
      // ignore
    }
  }
  if (!indexPath) {
    // Fallback to out/index.html even if missing (will error)
    indexPath = path.join(__dirname, '..', 'out', 'index.html');
  }
  console.log('Loading index.html from', indexPath);
  // file:// URL を使って確実に読み込む
  try {
    win.loadURL(pathToFileURL(indexPath).href).catch((err) => console.error('Failed to load index.html via loadURL', err));
  } catch (err) {
    console.error('Failed to load index.html', err);
  }
  // 開発時は DevTools を開く
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools({ mode: 'bottom' });
  }
}

app.whenReady().then(() => {
  // 一部の Web Speech 機能はフラグで有効にする必要がある場合がある
  try {
    app.commandLine.appendSwitch('enable-experimental-web-platform-features');
  } catch (e) {
    // ignore
  }

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// マイク／カメラ等の権限要求を自動で許可する（開発用途）。
// 本番では適切なユーザー承認フローを検討してください。
app.on('web-contents-created', (event, contents) => {
  try {
    contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media' || permission === 'microphone' || permission === 'camera') {
        callback(true);
      } else {
        callback(false);
      }
    });
  } catch (e) {
    // APIがない場合は無視
  }
});

// IPC handler: chat:send
ipcMain.handle('chat:send', async (event, payload) => {
  try {
    const { message, sessionId, agent } = payload || {};

    if (!process.env.OPENAI_API_KEY) {
      return { error: 'OPENAI_API_KEY is not configured' };
    }

    const agentName = agent || 'ちゆり';

    // Supabase client を作成（必要なら）
    let supabase = null;
    if (createSupabaseClient) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      if (supabaseUrl) {
        supabase = createSupabaseClient(String(supabaseUrl).trim(), String(supabaseAnonKey).trim());
      }
    }

    let profile = null;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('name', agentName)
          .limit(1)
          .single();
        if (error) {
          console.error('Supabase profile fetch error', error);
        }
        profile = data || null;
      } catch (e) {
        console.error('Supabase profile fetch exception', e);
      }
    }

    // DB にユーザーメッセージを保存（可能なら）
    if (supabase) {
      try {
        await supabase.from('chats').insert([
          {
            session_id: sessionId ?? 'default',
            user_id: profile?.user_id ?? null,
            role: 'user',
            message,
          },
        ]);
      } catch (e) {
        console.error('Supabase insert user chat error', e);
      }
    }

    // system prompt を profile から作成
    let systemPrompt = 'あなたは会話エージェントです。親切に応答してください。';
    if (profile && profile.personality_json) {
      try {
        const pj = profile.personality_json;
        const tone = pj.tone || '';
        const intro = pj.intro || '';
        systemPrompt = `あなたは${profile.name}という人格を持つエージェントです。性格: ${tone}。初期口調: ${intro}`;
      } catch (e) {
        // ignore
      }
    }

    const messagesForOpenAI = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: messagesForOpenAI, max_tokens: 500 }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: text, status: res.status };
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? '';

    // assistant の応答を chats に保存
    if (supabase) {
      try {
        await supabase.from('chats').insert([
          {
            session_id: sessionId ?? 'default',
            user_id: profile?.user_id ?? null,
            role: 'assistant',
            message: reply,
          },
        ]);
      } catch (e) {
        console.error('Supabase insert assistant chat error', e);
      }
    }

    return { reply };
  } catch (err) {
    console.error('chat:send handler error', err);
    return { error: String(err) };
  }
});

// 音声ファイルを受け取り OpenAI Whisper に送り文字起こしを返すハンドラ
ipcMain.handle('speech:transcribe', async (event, buffer, mime = 'audio/webm') => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return { error: 'OPENAI_API_KEY is not configured' };
    }

    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const { OpenAI } = require('openai');

    const tmpDir = os.tmpdir();
    const ext = mime.includes('webm') ? 'webm' : mime.includes('wav') ? 'wav' : 'bin';
    const tmpPath = path.join(tmpDir, `nuigurumi_audio_${Date.now()}.${ext}`);

    // buffer may be ArrayBuffer or Uint8Array
    let uint8;
    if (buffer instanceof Uint8Array) {
      uint8 = buffer;
    } else if (buffer && buffer instanceof ArrayBuffer) {
      uint8 = new Uint8Array(buffer);
    } else if (Buffer.isBuffer(buffer)) {
      uint8 = buffer;
    } else {
      // try to coerce
      uint8 = Buffer.from(buffer);
    }

    fs.writeFileSync(tmpPath, uint8);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Use Whisper model for transcription
    const resp = await client.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'whisper-1',
    });

    // cleanup
    try { fs.unlinkSync(tmpPath); } catch (e) {}

    return { text: resp.text };
  } catch (err) {
    console.error('speech:transcribe error', err);
    return { error: String(err) };
  }
});
