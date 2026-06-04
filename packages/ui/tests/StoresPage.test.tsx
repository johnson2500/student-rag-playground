import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StoresPage from "../src/pages/StoresPage";

// ---------------------------------------------------------------------------
// Mock the API client module
// ---------------------------------------------------------------------------
vi.mock("../src/api/client", () => ({
  getStores: vi.fn().mockResolvedValue([]),
  createStore: vi.fn().mockResolvedValue({
    id: "00000000-0000-0000-0000-000000000001",
    name: "Test Store",
    created_at: "2024-01-01T00:00:00Z",
    document_count: 0,
  }),
  deleteStore: vi.fn().mockResolvedValue(undefined),
  getDocuments: vi.fn().mockResolvedValue([]),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  ingestFiles: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StoresPage", () => {
  it('renders "New Store" button', async () => {
    render(<StoresPage />);
    // The button should be visible
    expect(screen.getByText("New Store")).toBeDefined();
  });

  it("shows the new store form when New Store is clicked", async () => {
    render(<StoresPage />);

    const newStoreBtn = screen.getByText("New Store");
    fireEvent.click(newStoreBtn);

    // The form input should appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Store name (e.g. CS101 Lecture Notes)")).toBeDefined();
    });
  });

  it("submits create store form correctly", async () => {
    const { createStore } = await import("../src/api/client");

    render(<StoresPage />);

    // Open the form
    fireEvent.click(screen.getByText("New Store"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Store name (e.g. CS101 Lecture Notes)")).toBeDefined();
    });

    // Type a store name
    const input = screen.getByPlaceholderText("Store name (e.g. CS101 Lecture Notes)");
    fireEvent.change(input, { target: { value: "Test Store" } });

    // Click Create
    const createBtn = screen.getByText("Create");
    fireEvent.click(createBtn);

    // createStore should have been called with the store name
    await waitFor(() => {
      expect(createStore).toHaveBeenCalledWith("Test Store");
    });
  });
});
