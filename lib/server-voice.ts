// The interviewer's voice from our server (Gemini speech), for browsers that cannot speak by themselves.
// Questions are fetched once and kept, and the next question can be fetched ahead of time so reading aloud feels instant.

const audioUrls = new Map<string, Promise<string>>();

/** Fetches the spoken audio for a question and returns a playable URL. Repeated calls share one request. */
export function fetchQuestionAudio(text: string): Promise<string> {
  let pending = audioUrls.get(text);
  if (!pending) {
    pending = fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Voice request failed (${res.status})`);
      return URL.createObjectURL(await res.blob());
    });
    audioUrls.set(text, pending);
    pending.catch(() => audioUrls.delete(text)); // a failure isn't remembered, so a later press can try again
  }
  return pending;
}

/** Starts fetching a question's audio in the background. Never throws. */
export function prefetchQuestionAudio(text: string): void {
  fetchQuestionAudio(text).catch(() => {});
}

export interface ServerSpeakHandlers {
  /** The audio is being fetched: it can take a few seconds the first time. */
  onLoading?: (loading: boolean) => void;
  onStart?: () => void;
  onEnd?: () => void;
  /** `blocked` means the browser refused to play without a click; the Listen button will work. */
  onError?: (blocked: boolean) => void;
}

let current: HTMLAudioElement | null = null;
let generation = 0;

export function stopServerSpeech(): void {
  generation++; // anything still being fetched for an earlier request must not start playing
  if (current) {
    current.onended = current.onerror = current.onplaying = null;
    current.pause();
    current = null;
  }
}

/** Plays a question aloud from the server. Replaces anything already playing. */
export async function speakFromServer(text: string, rate: number, handlers: ServerSpeakHandlers = {}): Promise<void> {
  stopServerSpeech();
  const mine = generation;
  handlers.onLoading?.(true);
  let url: string;
  try {
    url = await fetchQuestionAudio(text);
  } catch {
    if (mine === generation) {
      handlers.onLoading?.(false);
      handlers.onError?.(false);
    }
    return;
  }
  if (mine !== generation) return; // stopped or replaced while the audio was being fetched
  handlers.onLoading?.(false);

  const audio = new Audio(url);
  audio.playbackRate = rate;
  audio.onplaying = () => handlers.onStart?.();
  audio.onended = () => {
    if (current === audio) current = null;
    handlers.onEnd?.();
  };
  audio.onerror = () => handlers.onError?.(false);
  current = audio;
  try {
    await audio.play();
  } catch (err) {
    if (mine !== generation) return;
    current = null;
    handlers.onError?.((err as { name?: string })?.name === "NotAllowedError");
  }
}
