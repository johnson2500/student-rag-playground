import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "../src/App";

describe("App", () => {
  it("renders the nav bar", () => {
    render(<App />);
    expect(screen.getByText("RAG Playground")).toBeDefined();
    expect(screen.getByText("Chat")).toBeDefined();
    expect(screen.getByText("Vector Stores")).toBeDefined();
  });
});
