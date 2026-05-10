export async function transcribeAudioText(base64Audio: string, mimeType: string, language: string): Promise<string> {
  void base64Audio;
  void mimeType;
  void language;
  throw new Error("Audio transcription is not wired to OpenRouter yet.");
}

export async function generateSpeechTTS(text: string, language: string): Promise<string | null> {
  void text;
  void language;
  throw new Error("OpenRouter does not provide the TTS bridge used by this app yet.");
}

export async function playPCM16Audio(base64Audio: string, sampleRate = 24000): Promise<AudioBufferSourceNode> {
  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const buffer = bytes.buffer;

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
  const dataView = new DataView(buffer);
  const length = buffer.byteLength / 2;
  const audioBuffer = audioContext.createBuffer(1, length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
  }
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start(0);
  return source;
}
