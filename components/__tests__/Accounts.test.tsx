import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({ status: "authenticated" as string, signIn: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: h.status, data: { user: { name: "Sam" } } }),
  signIn: h.signIn,
  signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: any) => <a href={href} {...p}>{children}</a> }));

import AuthForm from "@/components/AuthForm";
import HistoryView from "@/components/HistoryView";
import { loadGuestSessions, saveGuestSession } from "@/lib/guest-storage";
import type { SavedSession } from "@/types";

const saved = (id: string, score: number, day: number): SavedSession => ({
  id, category: "Behavioral", mode: "typed", averageScore: score, questionCount: 5, entries: [], createdAt: `2026-03-0${day}T10:00:00Z`,
});

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  h.status = "authenticated";
});

describe("AuthForm", () => {
  it("signs in and goes to the safe callback path", async () => {
    h.signIn.mockResolvedValue({ ok: true });
    render(<AuthForm callbackUrl="/history" />);
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret1");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/history"));
    expect(h.signIn).toHaveBeenCalledWith("credentials", { email: "sam@example.com", password: "supersecret1", redirect: false });
  });

  it("ignores an off-site callback URL", async () => {
    h.signIn.mockResolvedValue({ ok: true });
    render(<AuthForm callbackUrl="https://evil.com" />);
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret1");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/"));
  });

  it("shows a plain message for wrong credentials", async () => {
    h.signIn.mockResolvedValue({ error: "CredentialsSignin" });
    render(<AuthForm />);
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("don't match");
    expect(h.push).not.toHaveBeenCalled();
  });

  it("validates sign-up fields before sending anything", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForm />);
    await userEvent.click(screen.getByRole("button", { name: "Create account", pressed: false }));
    await userEvent.type(screen.getByLabelText("Email"), "bad");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registers, then signs in", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ user: {} }) })));
    h.signIn.mockResolvedValue({ ok: true });
    render(<AuthForm />);
    await userEvent.click(screen.getByRole("button", { name: "Create account", pressed: false }));
    await userEvent.type(screen.getByLabelText("Name"), "Sam");
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret1");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(h.signIn).toHaveBeenCalled());
    expect(h.push).toHaveBeenCalledWith("/");
  });

  it("shows the server's message when the email is taken", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: "An account with this email already exists. Try signing in.", fields: { email: "This email is already registered." } }) })));
    render(<AuthForm />);
    await userEvent.click(screen.getByRole("button", { name: "Create account", pressed: false }));
    await userEvent.type(screen.getByLabelText("Name"), "Sam");
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret1");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText("This email is already registered.")).toBeInTheDocument();
    expect(h.signIn).not.toHaveBeenCalled();
  });
});

describe("History when signed in", () => {
  it("loads sessions from the account, not the browser", async () => {
    saveGuestSession(saved("local", 2, 5));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ sessions: [saved("a", 5, 1), saved("b", 8, 2)] }) })));
    render(<HistoryView />);
    expect(await screen.findByText("Up 3 points since your first session")).toBeInTheDocument();
    expect(screen.getByText(/Saved to your account/)).toBeInTheDocument();
  });

  it("offers to add browser-only sessions to the account, then clears them from the browser", async () => {
    saveGuestSession(saved("local", 2, 5));
    let server = [saved("a", 5, 1)];
    const fetchMock = vi.fn(async (_url: string, init?: any) => {
      if (init?.method === "POST") {
        server = [...server, ...JSON.parse(init.body).sessions];
        return { ok: true, json: async () => ({ saved: 1 }) };
      }
      return { ok: true, json: async () => ({ sessions: server }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<HistoryView />);
    await userEvent.click(await screen.findByRole("button", { name: "Add to my account" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Add to my account" })).toBeNull());
    expect(loadGuestSessions()).toEqual([]);
    expect(server).toHaveLength(2);
  });

  it("shows an error with retry when the account history can't load", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: "We couldn't load your history right now." }) })));
    render(<HistoryView />);
    expect(await screen.findByText("We couldn’t load your history")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
