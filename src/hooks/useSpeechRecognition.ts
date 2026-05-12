"use client";

import { useState, useEffect, useRef } from "react";

// Web Speech APIの型定義（簡易版）
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: { new (): SpeechRecognition };
    webkitSpeechRecognition: { new (): SpeechRecognition };
  }
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "ja-JP"; // 日本語に設定

        recognitionRef.current.onresult = (event) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptSegment = event.results[i][0].transcript;
            currentTranscript += transcriptSegment;
          }
          setTranscript(currentTranscript);
        };

        recognitionRef.current.onerror = (event) => {
          console.error("Speech recognition error", event.error);
          // network エラーが出た場合はフォールバックで録音→Whisper に送る
          if (String(event?.error).toLowerCase().includes('network')) {
            (async () => {
              try {
                // 3秒録音して送信
                if (typeof (window as any)?.electronAPI?.sendAudio === 'function') {
                  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                  const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                  const chunks: BlobPart[] = [];
                  recorder.ondataavailable = (ev) => chunks.push(ev.data);
                  recorder.start();
                  await new Promise((res) => setTimeout(res, 3000));
                  recorder.stop();
                  await new Promise((res) => (recorder.onstop = res));
                  stream.getTracks().forEach((t) => t.stop());
                  const blob = new Blob(chunks, { type: 'audio/webm' });
                  const arrayBuffer = await blob.arrayBuffer();
                  // @ts-ignore
                  const result = await (window as any).electronAPI.sendAudio(arrayBuffer, 'audio/webm');
                  if (result && result.text) {
                    setTranscript(String(result.text));
                  } else {
                    console.error('Transcription failed', result);
                  }
                }
              } catch (e2) {
                console.error('Fallback transcription error', e2);
              } finally {
                setIsListening(false);
              }
            })();
          } else {
            setIsListening(false);
          }
        };

        recognitionRef.current.onend = () => {
          // continuousがtrueでも、無音が続くと終了してしまう場合があるため状態を更新
          setIsListening(false);
        };
      } else {
        console.warn("Web Speech API is not supported in this browser.");
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = () => {
    setTranscript("");
    // マイク権限を事前に要求（Electron 環境では preload 経由のヘルパーを使う）
    (async () => {
      try {
        if (typeof (window as any)?.electronAPI?.requestMicrophone === 'function') {
          const r = await (window as any).electronAPI.requestMicrophone();
          if (!r?.granted) {
            console.warn('Microphone permission not granted', r?.error);
            return;
          }
        } else if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch (e) {
            console.warn('microphone permission denied', e);
            return;
          }
        }

        if (recognitionRef.current && !isListening) {
          try {
            recognitionRef.current.start();
            setIsListening(true);
          } catch (e) {
            console.error('Speech recognition start error', e);
          }
        }
      } catch (e) {
        console.error('Error while requesting microphone or starting recognition', e);
      }
    })();
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const resetTranscript = () => {
    setTranscript("");
  };

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    hasSupport: !!recognitionRef.current,
  };
}
