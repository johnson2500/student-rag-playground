import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "../src/App";

vi.mock("../src/api/client", () => ({
  getStores: vi.fn().mockResolvedValue([]),
  chatStream: vi.fn(),
}));

describe("App", () => {
  it("renders the nav bar", () => {
    render(<App />);
    expect(screen.getByText("RAG Playground")).toBeDefined();
    // Use role query to target the nav button specifically
    expect(screen.getByRole("button", { name: "Chat" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Vector Stores" })).toBeDefined();
  });
});
