import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({ pathname: "/", push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }), usePathname: () => h.pathname }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated", data: null }), signOut: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: any) => <a href={href} {...p}>{children}</a> }));

import AppHeader from "@/components/AppHeader";
import CategorySidebar from "@/components/CategorySidebar";
import Logo from "@/components/Logo";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";

function Selected() {
  return <p data-testid="selected">{useSidebar().selectedTrack}</p>;
}
const setup = () => render(<SidebarProvider><AppHeader /><CategorySidebar /><Selected /></SidebarProvider>);

beforeEach(() => {
  h.pathname = "/";
  h.push.mockClear();
});

describe("header", () => {
  it("shows the Intervue logo next to the name, as a link home", () => {
    setup();
    const home = screen.getByRole("link", { name: "Intervue" });
    expect(home).toHaveAttribute("href", "/");
    const img = home.querySelector("img")!;
    expect(img).toHaveAttribute("src", "/intervue-logo.svg");
    expect(img).toHaveAttribute("alt", ""); // decorative: the name is right beside it
  });

  it("the Logo component can carry its own name when it stands alone", () => {
    render(<Logo alt="Intervue" size={64} />);
    expect(screen.getByRole("img", { name: "Intervue" })).toHaveAttribute("width", "64");
  });
});

describe("track drawer toggle", () => {
  it("opens and closes the drawer, and says whether it is open", async () => {
    setup();
    const toggle = screen.getByRole("button", { name: "Browse tracks" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "track-picker");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Choose a track" })).toHaveAttribute("id", "track-picker");
    await userEvent.click(screen.getByRole("button", { name: "Close track picker" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus(); // focus comes back to where it started
  });

  it("slides in from the left", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Browse tracks" }));
    const root = screen.getByRole("dialog").parentElement!;
    expect(root.className).toContain("justify-start");
    expect(root.className).not.toContain("justify-end");
    expect(screen.getByRole("dialog").className).toContain("animate-slide-in-left");
  });

  it("closes from the backdrop and from Escape, and locks page scrolling only while open", async () => {
    setup();
    const toggle = screen.getByRole("button", { name: "Browse tracks" });
    await userEvent.click(toggle);
    expect(document.body.style.overflow).toBe("hidden");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    await userEvent.click(toggle);
    const backdrop = screen.getByRole("dialog").previousElementSibling as HTMLElement;
    await userEvent.click(backdrop);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is not offered during an interview, where picking another track would abandon it", () => {
    h.pathname = "/interview";
    setup();
    expect(screen.queryByRole("button", { name: "Browse tracks" })).toBeNull();
  });

  it("picking a track on Home just selects it", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Browse tracks" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Cultural Fit/ }));
    expect(screen.getByTestId("selected")).toHaveTextContent("Cultural Fit");
    expect(h.push).not.toHaveBeenCalled();
  });

  it("picking a track from another page takes you to Home to start it", async () => {
    h.pathname = "/history";
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Browse tracks" }));
    await userEvent.click(screen.getByRole("button", { name: /Cultural Fit/ }));
    expect(screen.getByTestId("selected")).toHaveTextContent("Cultural Fit");
    expect(h.push).toHaveBeenCalledWith("/");
  });
});
