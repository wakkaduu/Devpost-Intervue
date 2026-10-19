import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InterviewSession from "@/components/InterviewSession";
import SessionSummary from "@/components/SessionSummary";
import { loadGuestSessions } from "@/lib/guest-storage";
import { SessionProvider } from "@/context/SessionContext";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const authState = vi.hoisted(() => ({ status: "unauthenticated" as "loading" | "authenticated" | "unauthenticated" }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: authState.status, data: null }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: any) => <a href={href} {...p}>{children}</a> }));

const review = (score: number) => ({
  feedback: {
    score, summary: "sum", strengths: ["good"], areasForImprovement: ["fix"], focusNext: "focus",
    strongerVersion: "better", followUpQuestion: "why?", howTheyAnswered: "h", toneAnalysis: "t", questionConnection: "c", source: "ai",
  },
});

const DEBRIEF = {
  overview: "Solid but you skip results.", patterns: ["You never state the outcome"],
  bestAnswer: { number: 1, why: "Clear ownership" }, weakestAnswer: { number: 2, why: "No result" }, fixFirst: "End every answer with the result.",
};

let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: any) => Promise<any>>>;
beforeEach(() => {
  window.localStorage.clear();
  push.mockClear();
  let n = 0;
  fetchMock = vi.fn(async (url: string, _init?: any) =>
    url === "/api/review/summary"
      ? { ok: true, json: async () => ({ debrief: DEBRIEF }) }
      : { ok: true, json: async () => review([8, 6][n++ % 2]) }
  );
  vi.stubGlobal("fetch", fetchMock);
});

function setup() {
  return render(
    <SessionProvider>
      <InterviewSession category="Behavioral" mode="typed" />
      <SessionSummary />
    </SessionProvider>
  );
}

describe("interview session", () => {
  it("blocks an empty answer and makes no AI request", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Next question" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Write an answer");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reviews each answer, advances, and ends early with an average", async () => {
    setup();
    const box = await screen.findByLabelText("Your answer");
    await userEvent.type(box, "first answer");
    await userEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(await screen.findByText(/Question 2 of 5/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Your answer"), "second answer");
    await userEvent.click(screen.getByRole("button", { name: "End early" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/summary"));
    await waitFor(() => expect(screen.getByText("Almost there")).toBeInTheDocument()); // (8+6)/2 = 7
    expect(fetchMock.mock.calls.filter((c) => c[0] === "/api/review")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Score 7 out of 10" })).toBeInTheDocument();
  });

  it("writes a debrief once the reviews finish, with a request built from reviewed answers", async () => {
    setup();
    await userEvent.type(await screen.findByLabelText("Your answer"), "first answer");
    await userEvent.click(screen.getByRole("button", { name: "Next question" }));
    await userEvent.type(await screen.findByLabelText("Your answer"), "second answer");
    await userEvent.click(screen.getByRole("button", { name: "End early" }));
    expect(await screen.findByText("You never state the outcome")).toBeInTheDocument();
    expect(screen.getByText("End every answer with the result.")).toBeInTheDocument();
    const call = fetchMock.mock.calls.find((c) => c[0] === "/api/review/summary")!;
    const body = JSON.parse(call[1].body);
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0]).toMatchObject({ answer: "first answer", score: 8, focusNext: "focus" });
    expect(fetchMock.mock.calls.filter((c) => c[0] === "/api/review/summary")).toHaveLength(1);
  });

  it("explains that one answer is too few for a debrief", async () => {
    setup();
    await userEvent.type(await screen.findByLabelText("Your answer"), "only answer");
    await userEvent.click(screen.getByRole("button", { name: "End early" }));
    expect(await screen.findByText(/at least two answers reviewed/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => c[0] === "/api/review/summary")).toBe(false);
  });

  it("offers a retry when the debrief fails", async () => {
    const base = fetchMock.getMockImplementation()! as (url: string, init?: unknown) => Promise<any>;
    let failed = false;
    fetchMock.mockImplementation(async (url: string, init?: unknown) => {
      if (url === "/api/review/summary" && !failed) {
        failed = true;
        return { ok: false, json: async () => ({ error: "The debrief is unavailable right now. Please try again." }) };
      }
      return base(url, init);
    });
    setup();
    await userEvent.type(await screen.findByLabelText("Your answer"), "first answer");
    await userEvent.click(screen.getByRole("button", { name: "Next question" }));
    await userEvent.type(await screen.findByLabelText("Your answer"), "second answer");
    await userEvent.click(screen.getByRole("button", { name: "End early" }));
    await userEvent.click(await screen.findByRole("button", { name: "Retry debrief" }));
    expect(await screen.findByText("You never state the outcome")).toBeInTheDocument();
  });

  it("saves the finished session once, and updates (not duplicates) it when a review is retried", async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false, json: async () => ({ error: "boom" }) }));
    setup();
    await userEvent.type(await screen.findByLabelText("Your answer"), "first answer");
    await userEvent.click(screen.getByRole("button", { name: "Next question" }));
    await userEvent.type(await screen.findByLabelText("Your answer"), "second answer");
    await userEvent.click(screen.getByRole("button", { name: "End early" }));
    await screen.findByText("Saved to your history.", { exact: false });
    let stored = loadGuestSessions();
    expect(stored).toHaveLength(1);
    expect(stored[0].questionCount).toBe(2);
    await userEvent.click(screen.getByRole("button", { name: "Retry review" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Retry review" })).toBeNull());
    await waitFor(() => expect(loadGuestSessions()[0].averageScore).not.toBe(stored[0].averageScore));
    stored = loadGuestSessions();
    expect(stored).toHaveLength(1);
  });

  it("does not save a session with no answers", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "End early" }));
    await screen.findByText("No answers submitted");
    expect(loadGuestSessions()).toEqual([]);
  });

  it("ending early with nothing typed shows no answers submitted", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "End early" }));
    expect(await screen.findByText("No answers submitted")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("spoken answers get delivery feedback and are reviewed as spoken", async () => {
    class Rec {
      static last: Rec;
      onresult: any; onerror: any; onend: any;
      start = vi.fn(); stop = vi.fn(); abort = vi.fn();
      constructor() { Rec.last = this; }
    }
    (window as any).SpeechRecognition = Rec;
    render(
      <SessionProvider>
        <InterviewSession category="Behavioral" mode="mic" />
        <SessionSummary />
      </SessionProvider>
    );
    await userEvent.click(await screen.findByRole("button", { name: /Start recording/ }));
    act(() => Rec.last.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "um I led the project and like shipped it" }], { isFinal: true })] }));
    await new Promise((r) => setTimeout(r, 1100)); // let one second of speaking time pass
    await userEvent.click(screen.getByRole("button", { name: /Stop recording/ }));
    await userEvent.click(screen.getByRole("button", { name: "End early" }));
    expect(await screen.findByRole("region", { name: "Delivery feedback" })).toHaveTextContent("Filler words");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).mode).toBe("mic");
    delete (window as any).SpeechRecognition;
  });

  it("offers a retry when a review fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Review service unavailable. Please try again." }) });
    setup();
    await userEvent.type(await screen.findByLabelText("Your answer"), "an answer");
    await userEvent.click(screen.getByRole("button", { name: "End early" }));
    const retry = await screen.findByRole("button", { name: "Retry review" });
    await userEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Retry review" })).toBeNull());
    expect(await screen.findByText("Interview-ready")).toBeInTheDocument();
  });
});
