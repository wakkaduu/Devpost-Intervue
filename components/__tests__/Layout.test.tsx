import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({ pathname: "/", push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }), usePathname: () => h.pathname }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated", data: null }), signOut: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: any) => <a href={href} {...p}>{children}</a> }));

import Accordion from "@/components/ui/Accordion";
import Skeleton from "@/components/ui/Skeleton";
import AppHeader from "@/components/AppHeader";
import CategorySidebar from "@/components/CategorySidebar";
import ScoreBars from "@/components/ScoreBars";
import ScoreRing from "@/components/ScoreRing";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { SidebarProvider } from "@/context/SidebarContext";
import { useCountUp } from "@/hooks/useCountUp";
import { stagger } from "@/lib/motion";
import { DOCK } from "./dock-helpers";
import type { SessionEntry } from "@/types";

describe("Accordion", () => {
  it("is a button that reports and controls its panel, and starts as asked", async () => {
    render(<Accordion title="Answer one" defaultOpen={false}><p>Hidden detail</p></Accordion>);
    const button = screen.getByRole("button", { name: /Answer one/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(panel).toHaveAttribute("inert");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(panel).not.toHaveAttribute("inert");
    expect(panel).toHaveAttribute("aria-hidden", "false");
    expect(within(panel).getByText("Hidden detail")).toBeInTheDocument();
  });

  it("works from the keyboard", async () => {
    render(<Accordion title="Answer one"><p>x</p></Accordion>);
    const button = screen.getByRole("button", { name: /Answer one/ });
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("can be controlled, and tells the parent about changes", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<Accordion title="T" open={false} onOpenChange={onOpenChange}><p>x</p></Accordion>);
    await userEvent.click(screen.getByRole("button", { name: /T/ }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: /T/ })).toHaveAttribute("aria-expanded", "false"); // parent decides
    rerender(<Accordion title="T" open onOpenChange={onOpenChange}><p>x</p></Accordion>);
    expect(screen.getByRole("button", { name: /T/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("uses the heading level it is given and shows a badge", () => {
    render(<Accordion title="Q" headingLevel={2} badge={<span>7/10</span>}><p>x</p></Accordion>);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(screen.getByText("7/10")).toBeInTheDocument();
  });
});

describe("SegmentedControl", () => {
  it("slides its highlight to the chosen option", async () => {
    const { rerender } = render(<SegmentedControl label="View" value="a" onChange={() => {}} options={[{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }]} />);
    const thumb = () => screen.getByRole("group", { name: "View" }).querySelector("span[aria-hidden]") as HTMLElement;
    expect(thumb().style.transform).toBe("translateX(0%)");
    rerender(<SegmentedControl label="View" value="c" onChange={() => {}} options={[{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }]} />);
    expect(thumb().style.transform).toBe("translateX(200%)");
  });
});

describe("motion helpers", () => {
  it("stagger delays each item and caps the wait", () => {
    expect(stagger(0).animationDelay).toBe("0ms");
    expect(stagger(3).animationDelay).toBe("180ms");
    expect(stagger(100).animationDelay).toBe("600ms");
  });

  it("the score counts up, and jumps straight to the value when reduced motion is requested", async () => {
    function Probe({ n }: { n: number }) {
      return <p data-testid="v">{useCountUp(n, 50)}</p>;
    }
    render(<Probe n={8} />);
    expect(screen.getByTestId("v")).toHaveTextContent("0");
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    expect(screen.getByTestId("v")).toHaveTextContent("8");

    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    render(<Probe n={6} />);
    expect(screen.getAllByTestId("v")[1]).toHaveTextContent("6");
    window.matchMedia = original;
  });

  it("the score ring keeps its accessible name while animating", () => {
    render(<ScoreRing score={6.5} />);
    expect(screen.getByRole("img", { name: "Score 6.5 out of 10" })).toBeInTheDocument();
  });

  it("skeletons are decorative", () => {
    const { container } = render(<Skeleton className="h-4 w-4" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("ScoreBars", () => {
  const entry = (status: SessionEntry["status"], score?: number): SessionEntry => ({
    question: "q", answer: "a", durationSec: 1, status, feedback: score ? ({ score } as SessionEntry["feedback"]) : undefined,
  });
  it("shows a bar and a number for each answer, and marks failed or pending ones", () => {
    render(<ScoreBars entries={[entry("done", 8), entry("done", 3), entry("error"), entry("loading")]} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Q1");
    expect(items[0]).toHaveTextContent("8/10");
    expect(items[1]).toHaveTextContent("3/10");
    expect(items[2]).toHaveTextContent("Failed");
    expect(items[3]).toHaveTextContent("…");
  });
});

describe("track panel on a wide Home page", () => {
  const original = window.matchMedia;
  beforeEach(() => {
    h.pathname = "/";
    window.localStorage.clear();
    window.matchMedia = DOCK.wide as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
    document.body.style.overflow = "";
  });
  const setup = () => render(<SidebarProvider><AppHeader /><CategorySidebar /></SidebarProvider>);

  it("is docked (not a dialog) and the header button collapses and reopens it", async () => {
    setup();
    const dock = await screen.findByRole("complementary", { name: "Interview tracks" });
    expect(screen.queryByRole("dialog")).toBeNull();
    const toggle = screen.getByRole("button", { name: "Browse tracks" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-controls", "track-dock");
    expect(dock).not.toHaveAttribute("inert");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(dock).toHaveAttribute("inert");
    expect(dock.style.width).toBe("0rem");
    await userEvent.click(toggle);
    expect(dock).not.toHaveAttribute("inert");
  });

  it("remembers that it was collapsed", async () => {
    const first = setup();
    await userEvent.click(screen.getByRole("button", { name: "Browse tracks" }));
    expect(window.localStorage.getItem("intervue_tracks_dock_open")).toBe("false");
    first.unmount();
    setup();
    expect(await screen.findByRole("button", { name: "Browse tracks" })).toHaveAttribute("aria-expanded", "false");
  });

  it("lists all 52 tracks at once in one flat list, with no sections to open", async () => {
    setup();
    const dock = within(await screen.findByRole("complementary", { name: "Interview tracks" }));
    const list = dock.getByRole("list", { name: "Interview tracks" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(52);
    expect(dock.getByText("52 tracks")).toBeInTheDocument();
    // no collapsible group headers, and no group names
    expect(dock.queryAllByRole("heading")).toHaveLength(0);
    expect(dock.queryByText(/Tech & Software/)).toBeNull();
    expect(dock.queryByText(/General & Foundational/)).toBeNull();
    // every track is reachable right away, including ones from the last group
    expect(dock.getByRole("button", { name: /Media, Journalism/ })).toBeInTheDocument();
    expect(dock.getByRole("button", { name: /Behavioral/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("searching narrows the same flat list and says how many match", async () => {
    setup();
    const dock = within(await screen.findByRole("complementary", { name: "Interview tracks" }));
    await userEvent.type(dock.getByLabelText("Search tracks"), "nursing");
    expect(dock.getByText("1 track")).toBeInTheDocument();
    expect(within(dock.getByRole("list")).getAllByRole("listitem")).toHaveLength(1);
    await userEvent.clear(dock.getByLabelText("Search tracks"));
    expect(within(dock.getByRole("list")).getAllByRole("listitem")).toHaveLength(52);
    await userEvent.type(dock.getByLabelText("Search tracks"), "zzzz");
    expect(dock.getByText(/No tracks match/)).toBeInTheDocument();
  });

  it("does not take over other pages: there it is a drawer opened from the header", async () => {
    h.pathname = "/history";
    setup();
    expect(screen.queryByRole("complementary", { name: "Interview tracks" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Browse tracks" }));
    expect(screen.getByRole("dialog", { name: "Choose a track" })).toBeInTheDocument();
  });

  it("is absent during an interview", () => {
    h.pathname = "/interview";
    setup();
    expect(screen.queryByRole("complementary", { name: "Interview tracks" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Browse tracks" })).toBeNull();
  });
});
