import type { ReactNode } from "react";

type ContentBlock =
  | { type: "heading"; level: 1 | 2; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

function parseContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = content.split(/\r?\n/);
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      blocks.push({ type: "heading", level: 2, text: line.slice(3) });
      continue;
    }

    if (line.startsWith("# ")) {
      flushList();
      blocks.push({ type: "heading", level: 1, text: line.slice(2) });
      continue;
    }

    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      continue;
    }

    flushList();
    blocks.push({ type: "paragraph", text: line });
  }

  flushList();
  return blocks;
}

export function KnowledgeContent({ content }: { content: string }) {
  const blocks = parseContent(content);

  return (
    <div className="knowledge-article">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        if (block.type === "heading" && block.level === 1) {
          return (
            <h2 className="sr-only" key={key}>
              {block.text}
            </h2>
          );
        }

        if (block.type === "heading") {
          return (
            <h2
              className="mt-10 scroll-mt-24 border-t border-border/75 pt-8 text-lg font-semibold tracking-[-0.02em] text-[#183c35] first:mt-0 first:border-0 first:pt-0 sm:text-xl"
              id={`section-${index}`}
              key={key}
            >
              {block.text}
            </h2>
          );
        }

        if (block.type === "list") {
          return (
            <ul
              className="mt-4 space-y-2.5 text-[13px] leading-7 text-[#52655f] sm:text-sm"
              key={key}
            >
              {block.items.map((item) => (
                <li className="flex gap-3" key={item}>
                  <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-[#76bca3]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p
            className="mt-4 text-[13px] leading-7 text-[#52655f] sm:text-sm sm:leading-8"
            key={key}
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

export function KnowledgeMetaItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-[#eef4f8] text-primary">
        {icon}
      </span>
      <div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="mt-1 text-xs font-medium text-[#294b65]">{value}</div>
      </div>
    </div>
  );
}
