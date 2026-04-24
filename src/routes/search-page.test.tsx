import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchPage } from "./search-page";

const mocks = vi.hoisted(() => ({
  getSuggestions: vi.fn(),
  getMovieSuggestions: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/lib/books-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/books-api")>("@/lib/books-api");
  return {
    ...actual,
    getSuggestions: mocks.getSuggestions,
  };
});

vi.mock("@/lib/movies-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/movies-api")>("@/lib/movies-api");
  return {
    ...actual,
    getMovieSuggestions: mocks.getMovieSuggestions,
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
}

function renderSearchPage() {
  const container = document.createElement("div");
  document.body.append(container);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const root = createRoot(container);

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SearchPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  });

  return { container, root, queryClient };
}

describe("SearchPage", () => {
  let mountedRoot: Root | null = null;
  let mountedContainer: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    mocks.getSuggestions.mockResolvedValue([]);
    mocks.getMovieSuggestions.mockResolvedValue([]);
    mocks.navigate.mockReset();
  });

  afterEach(() => {
    if (mountedRoot) {
      act(() => mountedRoot?.unmount());
    }
    mountedContainer?.remove();
    mountedRoot = null;
    mountedContainer = null;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("keeps a typed query alive when Enter is pressed before suggestions resolve", async () => {
    const { container, root } = renderSearchPage();
    mountedRoot = root;
    mountedContainer = container;

    const input = container.querySelector<HTMLInputElement>('input[name="search"]');
    expect(input).not.toBeNull();

    await act(async () => {
      setNativeInputValue(input!, "三体");
      input!.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: "三体",
        })
      );
    });

    await act(async () => {
      input!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        })
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(input!.value).toBe("三体");
    expect(mocks.getSuggestions).toHaveBeenCalledWith("三体");
    expect(mocks.getMovieSuggestions).toHaveBeenCalledWith("三体");
  });
});
