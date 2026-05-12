const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendChat: (payload) => ipcRenderer.invoke('chat:send', payload),
  // Renderer からマイク使用を明示的にリクエストするユーティリティ
  requestMicrophone: async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        return { granted: true };
      }
      return { granted: false, error: 'mediaDevices not available' };
    } catch (err) {
      return { granted: false, error: String(err) };
    }
  },
  // バイナリオーディオを main に送って文字起こししてもらう
  sendAudio: async (buffer, mime = 'audio/webm') => {
    // ArrayBuffer または Uint8Array を受け取り ipc に送る
    return ipcRenderer.invoke('speech:transcribe', buffer, mime);
  },
});
