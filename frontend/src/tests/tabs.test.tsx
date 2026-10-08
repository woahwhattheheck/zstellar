import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ActionTabProvider,
  ActionTabs,
  TABS,
  useActionTab,
} from "../components/pages/(main)/tabs";

// renderToStaticMarkup exercises hooks without a DOM: a component that calls
// the hook during render throws immediately outside the provider, and a
// same-component setActive during render is applied synchronously by React.
function ActiveProbe() {
  const { active } = useActionTab();
  return createElement("span", { "data-active": active }, active);
}

function SwitchProbe() {
  const { active, setActive } = useActionTab();
  if (active === "deposit") setActive("withdraw");
  return createElement("span", null, active);
}

describe("TABS", () => {
  it("declares exactly the three ids ActionPanel compares against", () => {
    expect(TABS.map((tab) => tab.id)).toEqual([
      "deposit",
      "transfer",
      "withdraw",
    ]);
  });
});

describe("useActionTab", () => {
  it("throws by message when used outside the provider", () => {
    expect(() => renderToStaticMarkup(createElement(ActiveProbe))).toThrow(
      "useActionTab must be used within an ActionTabProvider",
    );
  });

  it("defaults to the deposit tab", () => {
    const html = renderToStaticMarkup(
      createElement(ActionTabProvider, null, createElement(ActiveProbe)),
    );
    expect(html).toContain("deposit");
  });

  it("setActive switches the tab", () => {
    const html = renderToStaticMarkup(
      createElement(ActionTabProvider, null, createElement(SwitchProbe)),
    );
    expect(html).toContain("withdraw");
  });
});

describe("ActionTabs", () => {
  it("renders exactly the three tab labels", () => {
    const html = renderToStaticMarkup(
      createElement(ActionTabProvider, null, createElement(ActionTabs)),
    );
    for (const label of ["Shield", "Private Transfer", "Private Withdraw"]) {
      expect(html).toContain(label);
    }
    expect((html.match(/<button/g) ?? []).length).toBe(3);
  });
});
