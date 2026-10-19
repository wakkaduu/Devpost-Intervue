// POST /api/transcribe (multipart, field "file"): audio in, text out. For browsers without built-in speech recognition.
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/http";
import { MAX_AUDIO_BYTES, MIN_AUDIO_BYTES, isAcceptedAudioType, transcribeAudio } from "@/lib/transcribe";

export const maxDuration = 30;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimit(request, "transcribe");
  if (limited) return limited;

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_AUDIO_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "That recording is too large (10 MB at most)." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Send the audio as multipart/form-data in a “file” field." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No audio file was sent." }, { status: 400 });
  if (file.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "That recording is too large (10 MB at most)." }, { status: 413 });
  if (file.size < MIN_AUDIO_BYTES) return NextResponse.json({ error: "That recording is too short to transcribe." }, { status: 400 });
  if (!isAcceptedAudioType(file.type)) return NextResponse.json({ error: "That file type isn't supported." }, { status: 415 });

  try {
    const result = await transcribeAudio(file);
    if (result.ok) {
      console.log(`[transcribe] done by ${result.provider}`);
      return NextResponse.json({ text: result.text, provider: result.provider });
    }
    if (result.reason === "no-speech") {
      return NextResponse.json({ error: "We couldn't hear any speech in that recording. Try again, a little closer to the microphone." }, { status: 422 });
    }
    return NextResponse.json({ error: "Transcription is unavailable right now. Please type your answer instead." }, { status: 502 });
  } catch (err) {
    console.error("[transcribe] unexpected failure:", err);
    return NextResponse.json({ error: "Transcription failed. Please type your answer instead." }, { status: 500 });
  }
}
