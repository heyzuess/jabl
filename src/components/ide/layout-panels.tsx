"use client";

import {
  createContext,
  useContext,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Group,
  Separator,
  useGroupRef,
  type Orientation,
} from "react-resizable-panels";

const EqualizeGroupContext = createContext<(() => void) | null>(null);

type LayoutGroupProps = {
  orientation?: Orientation;
  className?: string;
  id?: string;
  children?: ReactNode;
  onLayoutChanged?: ComponentProps<typeof Group>["onLayoutChanged"];
};

/**
 * Group whose Separators equalize all sibling panels on double-click
 * (VS Code sash reset / even-split behavior).
 */
export function LayoutGroup({
  orientation = "horizontal",
  className,
  id,
  children,
  onLayoutChanged,
}: LayoutGroupProps) {
  const groupRef = useGroupRef();

  const equalize = () => {
    const api = groupRef.current;
    if (!api) return;
    const layout = api.getLayout();
    const ids = Object.keys(layout);
    if (ids.length < 2) return;
    const each = 100 / ids.length;
    const next: Record<string, number> = {};
    for (const panelId of ids) next[panelId] = each;
    api.setLayout(next);
  };

  return (
    <EqualizeGroupContext.Provider value={equalize}>
      <Group
        groupRef={groupRef}
        id={id}
        orientation={orientation}
        className={className}
        onLayoutChanged={onLayoutChanged}
      >
        {children}
      </Group>
    </EqualizeGroupContext.Provider>
  );
}

type LayoutSeparatorProps = {
  className?: string;
  id?: string;
  title?: string;
};

/** Separator that equalizes its parent LayoutGroup on double-click. */
export function LayoutSeparator({
  className,
  id,
  title,
}: LayoutSeparatorProps) {
  const equalize = useContext(EqualizeGroupContext);

  return (
    <Separator
      id={id}
      className={className}
      title={title}
      disableDoubleClick
      onDoubleClick={(e) => {
        e.preventDefault();
        equalize?.();
      }}
    />
  );
}
