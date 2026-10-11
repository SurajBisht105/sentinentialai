// src/__tests__/components/Badge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/Badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>CRITICAL</Badge>);
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();
  });

  it("applies critical variant styles", () => {
    const { container } = render(<Badge variant="critical">CRITICAL</Badge>);
    expect(container.firstChild).toHaveClass("text-red-400");
  });

  it("applies success variant styles", () => {
    const { container } = render(<Badge variant="success">Clean</Badge>);
    expect(container.firstChild).toHaveClass("text-emerald-400");
  });

  it("renders an animated dot when dot=true and variant=running", () => {
    const { container } = render(<Badge variant="running" dot>RUNNING</Badge>);
    const dot = container.querySelector("span > span");
    expect(dot).toHaveClass("animate-pulse");
  });

  it("does not render a dot when dot is not passed", () => {
    const { container } = render(<Badge variant="running">RUNNING</Badge>);
    // Only one child span — the text
    const spans = container.querySelectorAll("span > span");
    expect(spans.length).toBe(0);
  });

  it("renders with default variant when no variant prop passed", () => {
    const { container } = render(<Badge>Default</Badge>);
    expect(container.firstChild).toHaveClass("text-muted-foreground");
  });

  it("accepts and applies additional className", () => {
    const { container } = render(<Badge className="custom-class">Tag</Badge>);
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
