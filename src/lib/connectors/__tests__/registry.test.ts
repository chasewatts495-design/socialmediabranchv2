import { describe, expect, it } from "vitest";
import { resolveConnector } from "../registry";
import { DemoConnector } from "../demo/demo-connector";
import { ManualConnector } from "../manual/manual-connector";
import { NotImplementedError } from "../errors";

describe("resolveConnector", () => {
  it("returns DemoConnector for demo accounts", () => {
    const c = resolveConnector({ platformId: "instagram", mode: "demo" });
    expect(c).toBeInstanceOf(DemoConnector);
  });

  it("returns ManualConnector for manual accounts", () => {
    const c = resolveConnector({ platformId: "instagram", mode: "manual" });
    expect(c).toBeInstanceOf(ManualConnector);
    expect(c.capabilities.canPublish).toBe(false);
  });

  it("Snapchat live still resolves to manual (no public API)", () => {
    const c = resolveConnector({ platformId: "snapchat", mode: "live" });
    expect(c).toBeInstanceOf(ManualConnector);
  });

  it("Snapchat demo behaves as a demo account", () => {
    const c = resolveConnector({ platformId: "snapchat", mode: "demo" });
    expect(c).toBeInstanceOf(DemoConnector);
  });

  it("live platforms without a real connector explain themselves", () => {
    expect(() => resolveConnector({ platformId: "reddit", mode: "live" })).toThrow(
      NotImplementedError,
    );
  });
});
