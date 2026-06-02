"use client";

import { Button } from "@/components/ui/Button";

export function VoicePrivacyNotice({
  onContinue,
  onCancel,
}: {
  onContinue: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
      <p>
        Dictation uses your browser&apos;s speech API. In Chrome that means
        audio is streamed to Google for transcription. Other browsers may
        transcribe locally. Continue?
      </p>
      <div className="mt-2 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
