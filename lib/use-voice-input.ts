"use client";

import { useEffect, useRef, useState } from "react";

const VOICE_PRIVACY_LS_KEY = "crazymage:voicePrivacyAck";

// Minimal Web Speech API typing — the official lib types aren't enabled
// by default. We only need start/stop and the result event shape.
type SpeechResultAlt = { transcript: string };
type SpeechResult = { isFinal: boolean; 0: SpeechResultAlt; length: number };
type SpeechResultEvent = {
  resultIndex: number;
  results: { [i: number]: SpeechResult; length: number };
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceInputState = {
  supported: boolean;
  recording: boolean;
  voiceError: string | null;
  showPrivacyNotice: boolean;
  toggleRecording: () => void;
  acknowledgePrivacyAndRecord: () => void;
  dismissPrivacyNotice: () => void;
};

export function useVoiceInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}): VoiceInputState {
  // SSR has no SpeechRecognition; client may have it. We accept a one-time
  // hydration tick where the dictation button appears post-mount instead of
  // calling the ctor in a lazy initializer (which would render different
  // HTML server vs. client and trigger a hydration warning).
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  useEffect(() => {
    // Browser-only capability detection; deferring to a mount effect is the
    // standard pattern when a lazy initializer would diverge from SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const startRecording = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    setVoiceError(null);
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    baseTextRef.current = valueRef.current;
    rec.onresult = (e: SpeechResultEvent) => {
      let built = "";
      for (let i = 0; i < e.results.length; i++) {
        built += e.results[i][0].transcript;
      }
      const sep =
        baseTextRef.current && !baseTextRef.current.endsWith(" ") ? " " : "";
      onChange(baseTextRef.current + sep + built);
    };
    rec.onerror = () => {
      setVoiceError("Microphone access denied or unavailable.");
      setRecording(false);
    };
    rec.onend = () => setRecording(false);
    try {
      rec.start();
      recognitionRef.current = rec;
      setRecording(true);
    } catch {
      setVoiceError("Could not start microphone.");
    }
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  };

  const toggleRecording = () => {
    if (recording) {
      stopRecording();
      return;
    }
    const ack =
      typeof window !== "undefined" &&
      window.localStorage.getItem(VOICE_PRIVACY_LS_KEY) === "1";
    if (!ack) {
      setShowPrivacyNotice(true);
      return;
    }
    startRecording();
  };

  const acknowledgePrivacyAndRecord = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VOICE_PRIVACY_LS_KEY, "1");
    }
    setShowPrivacyNotice(false);
    startRecording();
  };

  const dismissPrivacyNotice = () => setShowPrivacyNotice(false);

  return {
    supported,
    recording,
    voiceError,
    showPrivacyNotice,
    toggleRecording,
    acknowledgePrivacyAndRecord,
    dismissPrivacyNotice,
  };
}
