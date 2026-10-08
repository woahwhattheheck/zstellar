"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

export const TABS = [
  {
    id: "deposit",
    label: "Shield",
    lead: "You're shielding",
    cta: "Shield",
    hint: "Public asset in, private notes out. Your in-pool balance stays hidden.",
  },
  {
    id: "transfer",
    label: "Private Transfer",
    lead: "You're transferring privately",
    cta: "Send privately",
    hint: "Amount and recipient stay hidden on-chain.",
  },
  {
    id: "withdraw",
    label: "Private Withdraw",
    lead: "You're withdrawing privately",
    cta: "Withdraw",
    hint: "Spend private notes to a public address. The link stays hidden.",
  },
] as const;

export type TabId = (typeof TABS)[number]["id"];

type ActionTabValue = {
  active: TabId;
  setActive: (id: TabId) => void;
};

const ActionTabContext = createContext<ActionTabValue | null>(null);

// Lifts the active-tab state so the left rail (aligned with the logo) and the
// panel content can stay in sync while living in separate parts of the tree.
export function ActionTabProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<TabId>("deposit");
  return (
    <ActionTabContext.Provider value={{ active, setActive }}>
      {children}
    </ActionTabContext.Provider>
  );
}

export function useActionTab(): ActionTabValue {
  const ctx = useContext(ActionTabContext);
  if (!ctx) {
    throw new Error("useActionTab must be used within an ActionTabProvider");
  }
  return ctx;
}

// A backgroundless list of tabs. The active item is marked by a small dot at
// its top-left corner (no bars/backgrounds). `vertical` is the left-rail look;
// horizontal is the stacked-on-top mobile look.
export function ActionTabs({
  vertical = true,
  className = "",
}: {
  vertical?: boolean;
  className?: string;
}) {
  const { active, setActive } = useActionTab();
  return (
    <nav
      className={`flex ${
        vertical ? "flex-col gap-2" : "flex-row flex-wrap gap-x-6 gap-y-2"
      } ${className}`}
    >
      {TABS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={isActive ? "true" : undefined}
            onClick={() => setActive(item.id)}
            className={`relative cursor-pointer py-1 pl-4 text-left text-[15px] font-medium transition-colors ${
              isActive ? "text-fg" : "text-faint hover:text-fg"
            }`}
          >
            <span
              className={`-translate-y-1/2 absolute top-1/2 left-0 h-1.5 w-1.5 rounded-full bg-fg transition-opacity duration-200 ${
                isActive ? "opacity-100" : "opacity-0"
              }`}
            />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
