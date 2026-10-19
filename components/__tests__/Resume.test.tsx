import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, replace: h.replace }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated", data: null }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: any) => <a href={href} {...p}>{children}</a> }));

import InterviewSession from "@/components/InterviewSession";
import { SessionProvider } from "@/context/SessionContext";
import { DRAFT_KEY, saveDraft, loadDraft, type DraftSession } from "@/lib/session-draft";
import { getQuestions } from "@/lib/questions";

const qs = getQuestions("Behavioral").slice(0, 5);
const fb = { score: 7, summary: "s", strengths: ["a"], areasForImprovement: ["b"], focusNext: "f", strongerVersion: "v", followUpQuestion: "q?", howTheyAnswered: "h", toneAnalysis: "t", questionConnection: "c", source: "ai" };
const draftSession = (over: Partial<DraftSession> = {}): DraftSession => ({
  id: "saved-1", startedAt: new Date().toISOString(), category: "Behavioral", mode: "typed", questions: qs,
  entries: [{ question: qs[0].text, answer: "my first answer", durationSec: 40, status: "done", feedback: fb as any }], ...over,
});

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  window.localStorage.clear();
  h.push.mockClear();
  h.replace.mockClear();
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ feedback: fb }) }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.useRealTimers());

const mount = (category = "Behavioral", mode: "typed" | "mic" = "typed") =>
  render(<SessionProvider><InterviewSession category={category} mode={mode} /></SessionProvider>);

describe("autosave", () => {
  it("saves what you type shortly after you type it", async () => {
    mount();
    await userEvent.type(await screen.findByLabelText("Your answer"), "I led a team");
    await waitFor(() => expect(loadDraft()?.current.answer).toBe("I led a team"));
  });

  it("saves submitted answers and their reviews", async () => {
    mount();
    await userEvent.type(await screen.findByLabelText("Your answer"), "first answer");
    await userEvent.click(screen.getByRole("button", { name: "Next question" }));
    await waitFor(() => expect(loadDraft()?.session.entries[0]).toMatchObject({ answer: "first answer", status: "done" }));
  });

  it("does not create a draft for a session where nothing has been done", async () => {
    mount();
    await screen.findByLabelText("Your answer");
    await new Promise((r) => setTimeout(r, 700));
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("is removed when the session is completed", async () => {
    mount();
    await userEvent.type(await screen.findByLabelText("Your answer"), "only answer");
    await waitFor(() => expect(loadDraft()).not.toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "End early" }));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/summary"));
    expect(loadDraft()).toBeNull();
  });
});

describe("resuming after a refresh", () => {
  it("goes straight to the first question when there is nothing to resume", async () => {
    mount();
    expect(await screen.findByLabelText("Your answer")).toBeInTheDocument();
    expect(screen.queryByText("Pick up where you left off?")).toBeNull();
  });

  it("offers to resume, naming the track, the progress and the age", async () => {
    saveDraft(draftSession(), { answer: "", elapsedSec: 0, spokenSeconds: 0 }, new Date(Date.now() - 3 * 3600_000));
    mount();
    expect(await screen.findByText("Pick up where you left off?")).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 questions answered/)).toBeInTheDocument();
    expect(screen.getByText(/3 hours ago/)).toBeInTheDocument();
  });

  it("resumes at the right question with the half-written answer and the clock restored", async () => {
    saveDraft(draftSession(), { answer: "half an answ", elapsedSec: 75, spokenSeconds: 0 });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Resume session" }));
    expect(await screen.findByText("Question 2 of 5")).toBeInTheDocument();
    expect(screen.getByText(qs[1].text)).toBeInTheDocument();
    expect(screen.getByLabelText("Your answer")).toHaveValue("half an answ");
    expect(screen.getByLabelText("Time on this question").textContent).toMatch(/^1:1\d$/);
    expect(fetchMock).not.toHaveBeenCalled(); // finished reviews are not paid for twice
  });

  it("asks again for reviews that were still running when the page closed", async () => {
    saveDraft(draftSession({ entries: [{ question: qs[0].text, answer: "my first answer", durationSec: 40, status: "loading" }] }), { answer: "x", elapsedSec: 5, spokenSeconds: 0 });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Resume session" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse((fetchMock.mock.calls[0] as any)[1].body)).toMatchObject({ answer: "my first answer", question: qs[0].text });
    await waitFor(() => expect(loadDraft()?.session.entries[0].status).toBe("done"));
  });

  it("continues the same session, so saving history later stays idempotent", async () => {
    saveDraft(draftSession(), { answer: "second", elapsedSec: 5, spokenSeconds: 0 });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Resume session" }));
    await userEvent.click(await screen.findByRole("button", { name: "Next question" }));
    await waitFor(() => expect(loadDraft()?.session.entries).toHaveLength(2));
    expect(loadDraft()?.session.id).toBe("saved-1");
  });

  it("start new discards the old draft, and the fresh empty session does not bring it back or overwrite anything", async () => {
    saveDraft(draftSession(), { answer: "", elapsedSec: 0, spokenSeconds: 0 });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Start a new session" }));
    expect(await screen.findByText("Question 1 of 12")).toBeInTheDocument();
    expect(screen.getByLabelText("Your answer")).toHaveValue("");
    await new Promise((r) => setTimeout(r, 700));
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("leaves the real draft untouched until you choose (refreshing again loses nothing)", async () => {
    saveDraft(draftSession(), { answer: "keep me", elapsedSec: 9, spokenSeconds: 0 });
    const first = mount();
    await screen.findByText("Pick up where you left off?");
    await new Promise((r) => setTimeout(r, 700));
    first.unmount();
    mount();
    await screen.findByText("Pick up where you left off?");
    expect(loadDraft()?.current.answer).toBe("keep me");
  });

  it("a draft for another track offers to start the requested one instead, and resuming switches to the saved track's page", async () => {
    saveDraft(draftSession(), { answer: "", elapsedSec: 0, spokenSeconds: 0 });
    mount("Situational");
    expect(await screen.findByRole("button", { name: "Start Situational instead" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resume session" }));
    expect(h.replace).toHaveBeenCalledWith("/interview?category=Behavioral&mode=typed");
  });

  it("ignores a draft older than 24 hours", async () => {
    saveDraft(draftSession(), { answer: "old", elapsedSec: 0, spokenSeconds: 0 }, new Date(Date.now() - 25 * 3600_000));
    mount();
    expect(await screen.findByLabelText("Your answer")).toHaveValue("");
    expect(screen.queryByText("Pick up where you left off?")).toBeNull();
  });

  it("resuming a voice session skips the setup screen", async () => {
    saveDraft(draftSession({ mode: "mic" }), { answer: "", elapsedSec: 0, spokenSeconds: 0 });
    mount("Behavioral", "mic");
    await userEvent.click(await screen.findByRole("button", { name: "Resume session" }));
    expect(await screen.findByText("Question 2 of 5")).toBeInTheDocument();
    expect(screen.queryByText(/Before you start: voice answers/)).toBeNull();
  });
});
