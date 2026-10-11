import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProjectsPage from "@/app/(dashboard)/dashboard/projects/page";
import axios from "axios";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  }),
}));

vi.mock("@/store", () => ({
  useAppStore: () => ({}),
}));

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("ProjectsPage action menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.get).mockResolvedValue({
      data: [
        {
          id: "p1",
          name: "Alpha",
          repo_url: "https://github.com/acme/alpha",
          branch: "main",
          risk_score: 12,
          language: "TypeScript",
          finding_count: 0,
          scan_count: 0,
          last_scan_at: null,
        },
      ],
    });
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
  });

  it("keeps the project action menu visible and allows actions to run", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<ProjectsPage />);

    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());

    const projectCard = screen.getByText("Alpha").closest(".group");
    expect(projectCard).not.toBeNull();
    expect(projectCard).not.toHaveClass("overflow-hidden");

    const menuButton = projectCard!.querySelector("button");
    expect(menuButton).not.toBeNull();

    fireEvent.click(menuButton!);

    expect(await screen.findByText("Trigger Scan")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Trigger Scan"));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "/api/scans",
        expect.objectContaining({
          project_id: "p1",
          target_repo: "https://github.com/acme/alpha",
          branch: "main",
        }),
      );
    });

    fireEvent.click(screen.getByText("Open Repo"));
    expect(openSpy).toHaveBeenCalledWith(
      "https://github.com/acme/alpha",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
