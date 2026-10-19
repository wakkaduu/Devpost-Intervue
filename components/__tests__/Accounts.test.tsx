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
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ google: false, github: false }) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForm />);
    await userEvent.click(screen.getByRole("button", { name: "Create account", pressed: false }));
    await userEvent.type(screen.getByLabelText("Email"), "bad");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/auth/register", expect.anything());
  });

  it("registers, shows the code step, then signs in once the code is confirmed", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/auth/register") return { ok: true, json: async () => ({ user: {}, needsConfirmation: true, emailSent: true }) };
      if (url === "/api/auth/confirm-email") return { ok: true, json: async () => ({ verified: true }) };
      return { ok: true, json: async () => ({ google: false, github: false }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    h.signIn.mockResolvedValue({ ok: true });
    render(<AuthForm />);
    await userEvent.click(screen.getByRole("button", { name: "Create account", pressed: false }));
    await userEvent.type(screen.getByLabelText("Name"), "Sam");
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret1");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText(/We sent a 6-digit code to sam@example.com/)).toBeInTheDocument();
    expect(h.signIn).not.toHaveBeenCalled(); // not signed in until the email is confirmed
    await userEvent.type(screen.getByLabelText("6-digit code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Confirm email" }));
    await waitFor(() => expect(h.signIn).toHaveBeenCalledWith("credentials", { email: "sam@example.com", password: "supersecret1", redirect: false }));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/confirm-email", expect.objectContaining({ body: JSON.stringify({ email: "sam@example.com", code: "123456" }) }));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/"));
  });

  it("shows tries left on a wrong code, and blocks malformed codes without a request", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/auth/register") return { ok: true, json: async () => ({ needsConfirmation: true, emailSent: true }) };
      if (url === "/api/auth/confirm-email") return { ok: false, json: async () => ({ code: "INVALID_CODE", attemptsLeft: 3 }) };
      return { ok: true, json: async () => ({ google: false, github: false }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForm />);
    await userEvent.click(screen.getByRole("button", { name: "Create account", pressed: false }));
    await userEvent.type(screen.getByLabelText("Name"), "Sam");
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret1");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(await screen.findByLabelText("6-digit code"), "12");
    await userEvent.click(screen.getByRole("button", { name: "Confirm email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter the 6-digit code");
    expect(fetchMock.mock.calls.some((c) => c[0] === "/api/auth/confirm-email")).toBe(false);
    await userEvent.type(screen.getByLabelText("6-digit code"), "3456");
    await userEvent.click(screen.getByRole("button", { name: "Confirm email" }));
    expect(await screen.findByText("That code isn't right. 3 tries left.")).toBeInTheDocument();
  });

  it("disables resend during the cooldown", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url === "/api/auth/register"
        ? { ok: true, json: async () => ({ needsConfirmation: true, emailSent: true }) }
        : { ok: true, json: async () => ({ google: false, github: false }) }));
    render(<AuthForm />);
    await userEvent.click(screen.getByRole("button", { name: "Create account", pressed: false }));
    await userEvent.type(screen.getByLabelText("Name"), "Sam");
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret1");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("button", { name: /Send a new code \(\d+s\)/ })).toBeDisabled();
  });

  it("sends someone with a correct password but unconfirmed email to the code step", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url === "/api/auth/resend-confirmation"
        ? { ok: true, json: async () => ({ ok: true, sent: true }) }
        : { ok: true, json: async () => ({ google: false, github: false }) });
    vi.stubGlobal("fetch", fetchMock);
    h.signIn.mockResolvedValue({ error: "CredentialsSignin", code: "email_not_verified" });
    render(<AuthForm />);
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret1");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByLabelText("6-digit code")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/resend-confirmation", expect.anything());
    expect(h.push).not.toHaveBeenCalled();
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

describe("Social sign-in buttons", () => {
  const providers = (p: object) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => p })));

  it("shows GitHub, Google and Facebook with their icons, and only the configured ones are usable", async () => {
    providers({ google: false, github: true, facebook: false });
    render(<AuthForm callbackUrl="/history" />);
    const gh = await screen.findByRole("button", { name: "Continue with GitHub" });
    expect(gh).toBeEnabled();
    expect(gh.querySelector("svg")).not.toBeNull();
    const google = screen.getByRole("button", { name: "Continue with Google (coming soon)" });
    const facebook = screen.getByRole("button", { name: "Continue with Facebook (coming soon)" });
    expect(google).toBeDisabled();
    expect(facebook).toBeDisabled();
    expect(google.querySelector("svg")).not.toBeNull();
    expect(facebook.querySelector("svg")).not.toBeNull();
    expect(screen.getAllByText("Soon")).toHaveLength(2);
    await userEvent.click(gh);
    expect(h.signIn).toHaveBeenCalledWith("github", { callbackUrl: "/history" });
    await userEvent.click(facebook);
    expect(h.signIn).toHaveBeenCalledTimes(1); // a disabled button does nothing
  });

  it("when Google is configured it becomes usable", async () => {
    providers({ google: true, github: true, facebook: false });
    render(<AuthForm />);
    const g = await screen.findByRole("button", { name: "Continue with Google" });
    expect(g).toBeEnabled();
    await userEvent.click(g);
    expect(h.signIn).toHaveBeenCalledWith("google", { callbackUrl: "/" });
  });

  it("still shows all three, marked coming soon, when none are configured or the check fails", async () => {
    providers({ google: false, github: false, facebook: false });
    const { unmount } = render(<AuthForm />);
    expect(await screen.findByRole("button", { name: "Continue with GitHub (coming soon)" })).toBeDisabled();
    unmount();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    render(<AuthForm />);
    expect(await screen.findByRole("button", { name: "Continue with Facebook (coming soon)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue with GitHub (coming soon)" })).toBeDisabled();
  });

  it("explains a refused social sign-in", () => {
    providers({ google: false, github: false, facebook: false });
    render(<AuthForm authError="AccessDenied" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/verified with the provider/);
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
