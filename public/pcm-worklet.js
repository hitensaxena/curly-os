// Mic capture worklet. Runs at the AudioContext sample rate (we force 16kHz on
// the context), converts each Float32 quantum to Int16 PCM, and posts it to the
// main thread. The main thread batches frames and ships them over the WebSocket.
class PCMCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && ch.length) {
      const pcm = new Int16Array(ch.length);
      for (let i = 0; i < ch.length; i++) {
        let s = ch[i];
        s = s < -1 ? -1 : s > 1 ? 1 : s;
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-capture', PCMCapture);
