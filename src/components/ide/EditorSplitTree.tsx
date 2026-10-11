"use client";

import { Fragment } from "react";
import type * as Monaco from "monaco-editor";
import {
  Group,
  Panel,
  Separator as ResizeSeparator,
  type Layout,
} from "react-resizable-panels";
import {
  useEditorLayoutStore,
  type SplitNode,
} from "@/lib/workspace/editor-layout-store";
import { PaneChrome } from "./PaneChrome";
import { EditorPane } from "./EditorPane";

type EditorSplitTreeProps = {
  applyTheme: (monaco: typeof Monaco) => void;
  themeKey: string;
};

export function EditorSplitTree({
  applyTheme,
  themeKey,
}: EditorSplitTreeProps) {
  const root = useEditorLayoutStore((s) => s.root);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--ide-editor-bg)]">
      <PaneChrome pane="editor" title="Editor" editorMode />
      <div className="min-h-0 flex-1 overflow-hidden">
        <SplitNodeView
          node={root}
          path={[]}
          applyTheme={applyTheme}
          themeKey={themeKey}
        />
      </div>
    </div>
  );
}

function layoutToPercents(
  layout: Layout,
  path: number[],
  count: number
): number[] {
  return Array.from({ length: count }, (_, index) => {
    const id = `split-${path.concat(index).join("-")}`;
    const value = layout[id];
    return typeof value === "number" ? value : 100 / count;
  });
}

function SplitNodeView({
  node,
  path,
  applyTheme,
  themeKey,
}: {
  node: SplitNode;
  path: number[];
  applyTheme: (monaco: typeof Monaco) => void;
  themeKey: string;
}) {
  const setBranchSizes = useEditorLayoutStore((s) => s.setBranchSizes);

  if (node.type === "leaf") {
    return (
      <EditorPane
        groupId={node.groupId}
        applyTheme={applyTheme}
        themeKey={themeKey}
      />
    );
  }

  const sepClass =
    node.orientation === "horizontal"
      ? "w-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]"
      : "h-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]";

  return (
    <Group
      orientation={node.orientation}
      className="h-full w-full"
      onLayoutChanged={(layout) => {
        setBranchSizes(
          path,
          layoutToPercents(layout, path, node.children.length)
        );
      }}
    >
      {node.children.map((child, index) => (
        <Fragment key={leafKey(child, index)}>
          {index > 0 && <ResizeSeparator className={sepClass} />}
          <Panel
            id={`split-${path.concat(index).join("-")}`}
            defaultSize={`${node.sizes[index] ?? 100 / node.children.length}%`}
            minSize="15%"
            className="min-h-0 overflow-hidden"
          >
            <SplitNodeView
              node={child}
              path={[...path, index]}
              applyTheme={applyTheme}
              themeKey={themeKey}
            />
          </Panel>
        </Fragment>
      ))}
    </Group>
  );
}

function leafKey(node: SplitNode, index: number): string {
  if (node.type === "leaf") return node.groupId;
  return `branch-${index}-${node.orientation}`;
}
