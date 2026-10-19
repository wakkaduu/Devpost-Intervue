import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InterviewSession from "@/components/InterviewSession";
import SessionSummary from "@/components/SessionSummary";
import { SessionProvider } from "@/context/SessionContext";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: any) => <a href={href} {...p}>{children}</a> }));

const review = (score: number) => ({
  feedback: {
    score, summary: "sum", strengths: ["good"], areasForImprovement: ["fix"], focusNext: "focus",
    strongerVersion: "better", followUpQuestion: "why?", howTheyAnswered: "h", toneAnalysis: "t", questionConnection: "c", source: "ai",
  },
});

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  push.mockClear();
  let n = 0;
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => review([8, 6][n++ % 2]) }));
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("img", { name: "Score 7 out of 10" })).toBeInTheDocument();
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
