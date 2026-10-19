import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import PasswordInput from "@/components/ui/PasswordInput";
import SegmentedControl from "@/components/ui/SegmentedControl";
import CategorySidebar from "@/components/CategorySidebar";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import manifest from "@/app/manifest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));

describe("ErrorMessage", () => {
  it("announces errors immediately and warnings politely", () => {
    const { rerender } = render(<ErrorMessage>Bad thing</ErrorMessage>);
    expect(screen.getByRole("alert")).toHaveTextContent("Bad thing");
    rerender(<ErrorMessage variant="warning">Heads up</ErrorMessage>);
    expect(screen.getByRole("status")).toHaveTextContent("Heads up");
  });
});

describe("LoadingSpinner", () => {
  it("is announced with its label", () => {
    render(<LoadingSpinner label="Loading your history…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your history…");
  });
});

describe("PasswordInput", () => {
  it("hides the password until asked, and can hide it again", async () => {
    render(<><label htmlFor="pw">Password</label><PasswordInput id="pw" defaultValue="secret123" /></>);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
  });
});

describe("SegmentedControl", () => {
  function Demo() {
    const [v, setV] = useState<"a" | "b">("a");
    return <SegmentedControl label="Pick" value={v} onChange={setV} options={[{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }]} />;
  }
  it("shows which option is selected and switches", async () => {
    render(<Demo />);
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(screen.getByRole("button", { name: "Beta" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("track picker dialog (keyboard use)", () => {
  function Page() {
    const { setPickerOpen } = useSidebar();
    return <button onClick={() => setPickerOpen(true)}>Open picker</button>;
  }
  const setup = () => render(<SidebarProvider><Page /><CategorySidebar /></SidebarProvider>);

  it("is a labelled modal dialog and moves focus to the search box", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Open picker" }));
    expect(screen.getByRole("dialog", { name: "Choose a track" })).toHaveAttribute("aria-modal", "true");
    expect(within(screen.getByRole("dialog")).getByLabelText("Search tracks")).toHaveFocus();
  });

  it("keeps Tab inside the dialog, both directions", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Open picker" }));
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 12; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 12; i++) {
      await userEvent.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("closes on Escape and returns focus to the button that opened it", async () => {
    setup();
    const opener = screen.getByRole("button", { name: "Open picker" });
    await userEvent.click(opener);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});

describe("web app manifest (installability)", () => {
  const m = manifest();
  it("has what browsers require to offer installation", () => {
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBe("Intervue");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });
  it("includes a maskable icon, so phones don't squash the logo into a circle", () => {
    expect((m.icons ?? []).some((i) => i.purpose === "maskable")).toBe(true);
  });
  it("includes the Intervue logo SVG", () => {
    expect((m.icons ?? []).some((i) => i.src === "/intervue-logo.svg" && i.type === "image/svg+xml")).toBe(true);
  });
  it("points only at icons that exist", async () => {
    const fs = await import("node:fs");
    for (const icon of m.icons ?? []) expect(fs.existsSync(`public${icon.src}`), icon.src).toBe(true);
  });
});
