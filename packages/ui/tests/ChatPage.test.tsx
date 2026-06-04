import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChatPage from "../src/pages/ChatPage";

// ---------------------------------------------------------------------------
// Mock the API client module
// ---------------------------------------------------------------------------
vi.mock("../src/api/client", () => ({
  getStores: vi.fn().mockResolvedValue([]),
  chatStream: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatPage", () => {
  it("renders the store selector", async () => {
    render(<ChatPage />);

    // Should render the Vector Store label
    await waitFor(() => {
      expect(screen.getByText("Vector Store:")).toBeDefined();
    });
  });

  it("shows empty state when no store is selected", async () => {
    render(<ChatPage />);

    // With no store selected, should show the "no store selected" message
    await waitFor(() => {
      expect(screen.getByText("No store selected")).toBeDefined();
    });
  });

  it("renders the send button", async () => {
    render(<ChatPage />);

    await waitFor(() => {
      expect(screen.getByText("Send")).toBeDefined();
    });
  });

  it("renders store selector with placeholder option", async () => {
    render(<ChatPage />);

    await waitFor(() => {
      expect(screen.getByText("— Select a store —")).toBeDefined();
    });
  });
});
