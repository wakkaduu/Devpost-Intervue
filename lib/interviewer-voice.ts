// One entry point for "read this question aloud": the browser's own voice when it works, otherwise the server's.
import {
  browserVoiceUsable, markBrowserVoiceBroken, speak, stopSpeaking, type SpeakHandlers,
} from "@/lib/speech-synthesis";
import { speakFromServer, stopServerSpeech, type ServerSpeakHandlers } from "@/lib/server-voice";

export interface VoiceHandlers extends SpeakHandlers, Pick<ServerSpeakHandlers, "onLoading"> {
  /** Which voice is being used, so the screen can fetch the next question ahead of time when it is the server's. */
  onSource?: (source: "browser" | "server") => void;
}

let token = 0;

export function stopAllSpeech(): void {
  token++;
  stopSpeaking();
  stopServerSpeech();
}

/** Reads `text` aloud. If the browser has no working voice it falls back to the server's, remembering that for the session. */
export async function speakQuestion(text: string, rate: number, handlers: VoiceHandlers = {}): Promise<void> {
  stopAllSpeech();
  const mine = token;
  const fromServer = () => {
    handlers.onSource?.("server");
    return speakFromServer(text, rate, handlers);
  };

  if (!(await browserVoiceUsable()) || mine !== token) {
    if (mine === token) await fromServer();
    return;
  }

  handlers.onSource?.("browser");
  const started = speak(text, rate, {
    onStart: handlers.onStart,
    onEnd: handlers.onEnd,
    onError: (blocked) => {
      // "Blocked" just needs a click. Any other failure means this browser's voice doesn't work: use the server's from now on.
      if (blocked || mine !== token) return handlers.onError?.(blocked);
      markBrowserVoiceBroken();
      void fromServer();
    },
  });
  if (!started) await fromServer();
}
