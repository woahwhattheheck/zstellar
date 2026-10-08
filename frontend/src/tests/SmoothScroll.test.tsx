// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Track every constructed Lenis instance.
const instances: Array<{
  raf: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  scrollTo: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("lenis", () => ({
  default: class {
    raf = vi.fn();
    destroy = vi.fn();
    scrollTo = vi.fn();
    constructor() {
      instances.push(this);
    }
  },
}));

import { SmoothScroll, useSmoothScroll } from "../components/landing/SmoothScroll";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let rafCallbacks: FrameRequestCallback[];
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  instances.length = 0;
  rafCallbacks = [];
  let nextId = 0;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return ++nextId;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

describe("SmoothScroll", () => {
  it("constructs Lenis and starts the RAF loop on mount", async () => {
    await act(async () => {
      root.render(
        <SmoothScroll>
          <div />
        </SmoothScroll>,
      );
    });
    expect(instances).toHaveLength(1);
    expect(requestAnimationFrame).toHaveBeenCalled();

    // One frame tick drives lenis.raf and re-queues.
    const cb = rafCallbacks.shift()!;
    const before = rafCallbacks.length;
    act(() => {
      cb(16.7);
    });
    expect(instances[0].raf).toHaveBeenCalledWith(16.7);
    expect(rafCallbacks.length).toBe(before + 1);
  });

  it("cancels the frame and destroys the Lenis instance on unmount", async () => {
    await act(async () => {
      root.render(
        <SmoothScroll>
          <div />
        </SmoothScroll>,
      );
    });
    const lenis = instances[0];
    await act(async () => {
      root.unmount();
    });
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(lenis.destroy).toHaveBeenCalledTimes(1);
    // Re-render flag for afterEach's unmount: it already ran.
    root = createRoot(container);
  });

  it("exposes a callable scrollTo through context", async () => {
    let captured: ((t: string | number | HTMLElement) => void) | undefined;
    function Probe() {
      captured = useSmoothScroll().scrollTo;
      return null;
    }
    await act(async () => {
      root.render(
        <SmoothScroll>
          <Probe />
        </SmoothScroll>,
      );
    });
    expect(typeof captured).toBe("function");
    captured!("#section");
    expect(instances[0].scrollTo).toHaveBeenCalledWith("#section", {
      offset: -80,
    });
  });

  it("returns a no-op scrollTo outside the provider", async () => {
    let captured: ((t: string | number | HTMLElement) => void) | undefined;
    function Probe() {
      captured = useSmoothScroll().scrollTo;
      return null;
    }
    await act(async () => {
      root.render(<Probe />);
    });
    expect(typeof captured).toBe("function");
    expect(() => captured!("#nowhere")).not.toThrow();
  });
});
