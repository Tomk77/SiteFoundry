import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GraphQLPlayground } from "@/features/site-settings/graphql-playground";

vi.mock("@apollo/sandbox/react", () => ({
  ApolloSandbox: ({
    handleRequest,
    initialEndpoint,
  }: {
    handleRequest: (url: string, options: RequestInit) => Promise<Response>;
    initialEndpoint: string;
  }) => (
    <button
      onClick={() =>
        void handleRequest(initialEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      }
      type="button"
    >
      Run in Apollo
    </button>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

afterEach(cleanup);

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("GraphQL playground", () => {
  it("loads Apollo Sandbox and attaches the publishable token to its requests", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <GraphQLPlayground initialToken="scaffold_pub_test-token" siteKey="northstar-journal" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run in Apollo" }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/sites\/northstar-journal\/graphql$/),
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer scaffold_pub_test-token",
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("waits for a token and reconnects Apollo after the token changes", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    render(<GraphQLPlayground siteKey="northstar-journal" />);
    expect(screen.queryByTestId("apollo-sandbox")).toBeNull();

    fireEvent.change(screen.getByLabelText("Publishable token"), {
      target: { value: "scaffold_pub_second-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    fireEvent.click(screen.getByRole("button", { name: "Run in Apollo" }));

    expect(screen.getByTestId("apollo-sandbox")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer scaffold_pub_second-token" }),
      }),
    );
  });

  it("opens the hosted Apollo Sandbox without putting the token in its URL", () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <GraphQLPlayground initialToken="scaffold_pub_private-value" siteKey="northstar-journal" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open in Apollo" }));

    const openedUrl = new URL(String(openMock.mock.calls[0]?.[0]));
    expect(openedUrl.origin).toBe("https://studio.apollographql.com");
    expect(openedUrl.pathname).toBe("/sandbox/explorer");
    expect(openedUrl.searchParams.get("endpoint")).toMatch(
      /\/api\/v1\/sites\/northstar-journal\/graphql$/,
    );
    expect(openedUrl.searchParams.get("document")).toContain("query PlaygroundPages");
    expect(openedUrl.toString()).not.toContain("scaffold_pub_private-value");
  });
});
