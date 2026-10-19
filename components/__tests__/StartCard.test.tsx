import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StartCard from "@/components/StartCard";
import CategorySidebar from "@/components/CategorySidebar";
import { SidebarProvider } from "@/context/SidebarContext";
import { MODE_KEY } from "@/lib/mode-storage";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/" }));

function setup() {
  return render(
    <SidebarProvider>
      <StartCard />
      <CategorySidebar />
    </SidebarProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  push.mockClear();
});

describe("Home start card", () => {
  it("preselects the remembered mode", () => {
    window.localStorage.setItem(MODE_KEY, "typed");
    setup();
    expect(screen.getByLabelText(/Written/)).toBeChecked();
  });

  it("remembers a mode change", async () => {
    setup();
    await userEvent.click(screen.getByLabelText(/Written/));
    expect(window.localStorage.getItem(MODE_KEY)).toBe("typed");
  });

  it("starts the interview with track and mode in the URL", async () => {
    setup();
    await userEvent.click(screen.getByLabelText(/Written/));
    await userEvent.click(screen.getByRole("button", { name: "Start practicing" }));
    expect(push).toHaveBeenCalledWith("/interview?category=Behavioral&mode=typed");
  });

  it("opens the picker, searches, and selects a track", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Change track" }));
    const drawer = within(screen.getByRole("dialog"));
    await userEvent.type(drawer.getByLabelText("Search tracks"), "nursing");
    await userEvent.click(drawer.getByRole("button", { name: /Medical & Health Sciences Programs/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: /Medical & Health Sciences Programs/ })).toBeInTheDocument();
  });

  it("shows all 52 tracks in the picker", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Change track" }));
    expect(within(screen.getByRole("dialog")).getByText("52 tracks")).toBeInTheDocument();
  });
});
