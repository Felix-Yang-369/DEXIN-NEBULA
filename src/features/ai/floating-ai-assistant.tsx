"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpenText,
  Boxes,
  ExternalLink,
  LoaderCircle,
  Maximize2,
  Minus,
  PackageSearch,
  Sparkles,
  X,
} from "lucide-react";
import { DexiaoxinAvatar } from "@/components/brand/dexiaoxin-avatar";
import type { AiChatMessage } from "@/features/ai/types";

const quickQuestions = [
  {
    icon: BookOpenText,
    label: "请假流程",
    prompt: "请假申请需要经过哪些审批环节？",
  },
  {
    icon: PackageSearch,
    label: "查产品",
    prompt: "帮我查询 DX-R001 的产品信息。",
  },
  {
    icon: Boxes,
    label: "查库存",
    prompt: "目前有哪些产品库存不足或需要确认？",
  },
] as const;

function MessageSources({ message }: { message: AiChatMessage }) {
  if (message.sources.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
      {message.sources.slice(0, 3).map((source, index) => (
        <Link
          className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground transition hover:bg-muted"
          href={source.href}
          key={`${source.type}-${source.id}`}
          title={source.title}
        >
          <span className="max-w-32 truncate">
            来源{index + 1} · {source.title}
          </span>
          <ExternalLink className="size-2.5 shrink-0" />
        </Link>
      ))}
    </div>
  );
}

export function FloatingAiAssistantPanel({
  configured,
  onMinimize,
}: {
  configured: boolean;
  onMinimize: () => void;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const optimisticIdRef = useRef(0);
  const canSubmit = configured && input.trim().length > 0 && !loading;

  useEffect(() => {
    inputRef.current?.focus();
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onMinimize();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onMinimize]);

  const ask = async (question: string) => {
    const value = question.trim();
    if (!configured || !value || loading) return;

    optimisticIdRef.current += 1;

    const optimisticMessage: AiChatMessage = {
      id: `local-${optimisticIdRef.current}`,
      role: "user",
      content: value,
      sources: [],
    };

    setMessages((current) => [...current, optimisticMessage]);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: value }),
      });
      const payload = (await response.json()) as {
        error?: string;
        conversationId?: string;
        message?: AiChatMessage;
      };

      if (!response.ok || !payload.conversationId || !payload.message) {
        throw new Error(payload.error || "德小馨暂时无法回答，请稍后重试");
      }

      setConversationId(payload.conversationId);
      setMessages((current) => [...current, payload.message!]);
    } catch (requestError) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticMessage.id),
      );
      setInput(value);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "德小馨暂时无法回答，请稍后重试",
      );
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(input);
  };

  return (
    <section
      aria-label="德小馨 AI 助手"
      className="fixed bottom-20 right-3 z-[90] flex h-[min(620px,calc(100dvh-96px))] w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden rounded-md border border-white/70 bg-muted backdrop-blur-xl sm:right-6 lg:bottom-6 lg:h-[min(620px,calc(100dvh-48px))]"
      role="dialog"
    >
      <header className="bg-sidebar px-4 pb-4 pt-4 text-white">
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <DexiaoxinAvatar className="size-11 rounded-md ring-white/20" />
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
                德小馨 AI
                <Sparkles className="size-3 text-muted-foreground" />
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/65">
                <span
                  className={`size-1.5 rounded-full ${
                    configured ? "bg-muted" : "bg-amber-300"
                  }`}
                />
                {configured ? "在线 · 已连接企业知识库" : "服务等待管理员配置"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              aria-label="最小化德小馨助手"
              className="grid size-8 place-items-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={onMinimize}
              type="button"
            >
              <Minus className="size-4" />
            </button>
            <Link
              aria-label="进入德小馨完整工作区"
              className="grid size-8 place-items-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
              href="/ai"
            >
              <Maximize2 className="size-3.5" />
            </Link>
            <button
              aria-label="收起德小馨助手"
              className="grid size-8 place-items-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={onMinimize}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col">
            <div className="rounded-md border border-border bg-white p-4 ">
              <p className="text-[12px] font-semibold text-foreground">
                你好，我是德小馨 👋
              </p>
              <p className="mt-2 text-xs leading-5 text-foreground">
                我可以在你的账号权限内查询公司制度、客户、产品、供应链、文件、审批和财务数据，并标注来源。
              </p>
            </div>
            <div className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-foreground">
              你可以这样问
            </div>
            <div className="mt-2 grid gap-2">
              {quickQuestions.map(({ icon: Icon, label, prompt }) => (
                <button
                  className="group flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-3 text-left transition hover:border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!configured}
                  key={label}
                  onClick={() => void ask(prompt)}
                  type="button"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-foreground transition group-hover:bg-muted group-hover:text-white">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-foreground">
                      {label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-foreground">
                      {prompt}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-auto rounded-lg bg-muted px-3 py-2.5 text-xs leading-4 text-foreground">
              德小馨不会直接执行审批、付款、删除或修改操作。
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <article
                className={`flex gap-2.5 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
                key={message.id}
              >
                {message.role === "assistant" ? (
                  <DexiaoxinAvatar className="mt-0.5 size-8 rounded-full" decorative />
                ) : null}
                <div
                  className={`max-w-[82%] rounded-md px-3.5 py-3 text-xs leading-5 ${
                    message.role === "user"
                      ? "rounded-br-md bg-primary text-white"
                      : "rounded-bl-md border border-border bg-white text-foreground "
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.role === "assistant" ? (
                    <MessageSources message={message} />
                  ) : null}
                </div>
              </article>
            ))}
            {loading ? (
              <div className="flex items-center gap-2.5">
                <DexiaoxinAvatar className="size-8 rounded-full" decorative />
                <div className="flex items-center gap-2 rounded-md rounded-bl-md border border-border bg-white px-3 py-2.5 text-xs text-foreground">
                  <LoaderCircle className="size-3.5 animate-spin text-foreground" />
                  正在检索授权资料…
                </div>
              </div>
            ) : null}
            <div ref={messageEndRef} />
          </div>
        )}
      </div>

      <footer className="border-t border-border bg-white/90 p-3 backdrop-blur">
        {!configured ? (
          <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-4 text-amber-800">
            DeepSeek API 尚未配置，请联系管理员。
          </p>
        ) : null}
        {error ? (
          <p aria-live="polite" className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs leading-4 text-red-700">
            {error}
          </p>
        ) : null}
        <form
          className="relative rounded-md border border-border bg-white p-1.5  focus-within:border-border focus-within:ring-2 focus-within:ring-ring/20"
          onSubmit={submit}
        >
          <textarea
            aria-label="向德小馨提问"
            className="max-h-24 min-h-11 w-full resize-none bg-transparent px-2.5 py-2 pr-12 text-xs leading-5 text-foreground outline-none placeholder:text-muted-foreground"
            disabled={!configured || loading}
            maxLength={1000}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (canSubmit) void ask(input);
              }
            }}
            placeholder={configured ? "询问权限内的公司制度或业务数据…" : "AI 服务暂不可用"}
            ref={inputRef}
            value={input}
          />
          <button
            aria-label="发送问题"
            className="absolute bottom-2 right-2 grid size-8 place-items-center rounded-md bg-primary text-white transition hover:bg-muted disabled:cursor-not-allowed disabled:bg-muted"
            disabled={!canSubmit}
            type="submit"
          >
            {loading ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <ArrowUp className="size-3.5" />
            )}
          </button>
        </form>
        <div className="mt-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>Enter 发送 · Shift + Enter 换行</span>
          <Link className="font-medium text-foreground hover:underline" href="/ai">
            完整工作区
          </Link>
        </div>
      </footer>
    </section>
  );
}
