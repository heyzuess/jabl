"use client";

import { useMemo } from "react";
import Markdown from "react-markdown";
import { PaneChrome } from "./PaneChrome";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLayoutStore } from "@/lib/workspace/layout-store";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { cn } from "@/lib/utils";

function isMarkdownPath(path: string | null): boolean {
  return !!path && path.toLowerCase().endsWith(".md");
}

export function MarkdownPreviewPane() {
  const minimized = useLayoutStore((s) => s.minimized.preview);
  const activePath = useWorkspaceStore((s) => s.activePath);
  const buffers = useWorkspaceStore((s) => s.buffers);
  const root = useWorkspaceStore((s) => s.root);

  const source = useMemo(() => {
    if (!activePath || !isMarkdownPath(activePath)) return null;
    if (buffers[activePath] != null) return buffers[activePath];
    // Fall back to in-memory sample / tree content
    const find = (
      node: typeof root,
      path: string
    ): string | null => {
      if (!node) return null;
      if (node.path === path && node.kind === "file") {
        return node.content ?? null;
      }
      for (const c of node.children || []) {
        const hit = find(c, path);
        if (hit != null) return hit;
      }
      return null;
    };
    return find(root, activePath);
  }, [activePath, buffers, root]);

  const titleName = activePath?.split("/").pop() || "Markdown";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--ide-sidebar)]">
      <PaneChrome pane="preview" title="Preview" />
      {minimized ? (
        <div className="flex flex-1 items-center px-3 text-xs text-muted-foreground">
          Preview (minimized)
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-4 py-3">
            {!isMarkdownPath(activePath) || source == null ? (
              <p className="text-xs text-muted-foreground">
                Open a Markdown (<span className="font-mono">.md</span>) file to
                preview it here.
              </p>
            ) : (
              <>
                <p className="mb-3 truncate font-mono text-[10px] text-muted-foreground">
                  {titleName}
                </p>
                <article
                  className={cn(
                    "markdown-preview max-w-none text-sm leading-relaxed text-foreground",
                    "[&_h1]:mb-3 [&_h1]:mt-0 [&_h1]:text-xl [&_h1]:font-semibold",
                    "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold",
                    "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold",
                    "[&_p]:mb-3 [&_p]:text-[13px]",
                    "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5",
                    "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5",
                    "[&_li]:mb-1",
                    "[&_a]:text-[var(--ide-accent)] [&_a]:underline",
                    "[&_code]:rounded [&_code]:bg-accent/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]",
                    "[&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-[var(--ide-editor-bg)] [&_pre]:p-3",
                    "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
                    "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--ide-accent)] [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
                    "[&_table]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
                    "[&_th]:border [&_th]:border-border [&_th]:bg-accent/40 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
                    "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
                    "[&_hr]:my-4 [&_hr]:border-border"
                  )}
                >
                  <Markdown>{source}</Markdown>
                </article>
              </>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
