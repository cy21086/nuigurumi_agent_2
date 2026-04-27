// Environment variable type declarations
// Put secret values into .env.local and do NOT commit them.
// This file augments `process.env` types for TypeScript without editing next-env.d.ts.

declare namespace NodeJS {
  interface ProcessEnv {
    /** OpenAI等のサーバー側APIキー（公開しない） */
    OPENAI_API_KEY?: string;

    /** クライアントで使う公開キー（NEXT_PUBLIC_ で始める） */
    NEXT_PUBLIC_MAP_KEY?: string;
  }
}

export {};
