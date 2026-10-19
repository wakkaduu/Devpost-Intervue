import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HistoryView from "@/components/HistoryView";
import { saveGuestSession } from "@/lib/guest-storage";
import type { SavedSession } from "@/types";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: any) => <a href={href} {...p}>{children}</a> }));

const saved = (id: string, score: number, day: number, category = "Behavioral"): SavedSession => ({
  id, category, mode: "typed", averageScore: score, questionCount: 5, entries: [], createdAt: `2026-03-0${day}T10:00:00Z`,
});

beforeEach(() => window.localStorage.clear());

describe("History", () => {
  it("shows a friendly empty state with no sessions", async () => {
    render(<HistoryView />);
    expect(await screen.findByText("No sessions yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start your first session/ })).toHaveAttribute("href", "/");
  });

  it("with one session, shows the point but asks for another to compare", async () => {
    saveGuestSession(saved("a", 6, 1));
    render(<HistoryView />);
    expect(await screen.findByText(/Complete one more session/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /6 out of 10/ })).toBeInTheDocument();
  });

  it("with two sessions, plots both points and states the change", async () => {
    saveGuestSession(saved("a", 5, 1));
    saveGuestSession(saved("b", 7.5, 2));
    render(<HistoryView />);
    expect(await screen.findByText("Up 2.5 points since your first session")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /out of 10/ })).toHaveLength(2);
  });

  it("filters by track", async () => {
    saveGuestSession(saved("a", 5, 1));
    saveGuestSession(saved("b", 7, 2));
    saveGuestSession(saved("c", 3, 3, "Cultural Fit"));
    render(<HistoryView />);
    await userEvent.selectOptions(await screen.findByLabelText("Track"), "Cultural Fit");
    expect(screen.getAllByRole("img", { name: /out of 10/ })).toHaveLength(1);
    expect(screen.getByText(/Complete one more session/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Track"), "Behavioral");
    expect(screen.getByText("Up 2 points since your first session")).toBeInTheDocument();
  });

  it("offers a table view with every session", async () => {
    saveGuestSession(saved("a", 5, 1));
    saveGuestSession(saved("b", 7, 2));
    render(<HistoryView />);
    await userEvent.click(await screen.findByRole("button", { name: "table" }));
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(3); // header + 2 sessions
    expect(within(rows[1]).getByText("7")).toBeInTheDocument(); // newest first
  });
});
