"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpenText,
  Boxes,
  ExternalLink,
  LoaderCircle,
  Maximize2,
  MessageCircleMore,
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
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#dce7ee] pt-2.5">
      {message.sources.slice(0, 3).map((source, index) => (
        <Link
          className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#eef5f8] px-2 py-1 text-[9px] font-medium text-[#0d6475] transition hover:bg-[#dff5f4]"
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

export function FloatingAiAssistant({ configured }: { configured: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
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
    if (!open || minimized) return;
    inputRef.current?.focus();
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, minimized, messages, loading]);

  if (pathname === "/login" || pathname.startsWith("/ai") || pathname.startsWith("/customer-service/widget")) return null;

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

  if (!open) {
    return (
      <div className="fixed bottom-4 right-3 z-[90] flex items-end gap-2 sm:bottom-6 sm:right-6">
        <button
          aria-label="打开德小馨 AI 助手"
          className="group flex items-center gap-3 rounded-[24px] border border-white/80 bg-white/92 py-2 pl-4 pr-2 text-left shadow-[0_18px_50px_-18px_rgba(6,24,44,.38)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_58px_-18px_rgba(6,24,44,.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18afb3] focus-visible:ring-offset-2"
          onClick={() => {
            setOpen(true);
            setMinimized(false);
          }}
          type="button"
        >
          <span className="hidden sm:block">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0a2340]">
              随时问德小馨
              <Sparkles className="size-3 text-[#e1a72d]" />
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[9px] text-[#6d8192]">
              <span
                className={`size-1.5 rounded-full ${
                  configured ? "bg-[#18afb3]" : "bg-amber-400"
                }`}
              />
              {configured ? "企业知识与业务助手" : "AI 服务等待配置"}
            </span>
          </span>
          <span className="relative">
            <span className="absolute -inset-1 rounded-[25px] bg-[#18afb3]/20 opacity-0 blur-md transition group-hover:opacity-100" />
            <DexiaoxinAvatar className="relative size-16 rounded-[22px] shadow-[0_12px_28px_-15px_rgba(6,24,44,.8)] sm:size-[72px]" priority />
            <span className="absolute -bottom-1 -left-1 grid size-7 place-items-center rounded-full border-2 border-white bg-[#0a2340] text-white shadow-lg">
              <MessageCircleMore className="size-3.5" />
            </span>
          </span>
        </button>
      </div>
    );
  }

  if (minimized) {
    return (
      <button
        aria-label="已最小化的德小馨 AI 助手"
        className="group fixed bottom-4 right-3 z-[90] rounded-[22px] border border-white/80 bg-white/90 p-1.5 shadow-[0_18px_50px_-18px_rgba(6,24,44,.5)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_58px_-18px_rgba(6,24,44,.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18afb3] focus-visible:ring-offset-2 sm:bottom-6 sm:right-6"
        onClick={() => setMinimized(false)}
        title="恢复德小馨助手窗口"
        type="button"
      >
        <DexiaoxinAvatar className="size-14 rounded-[18px] shadow-[0_12px_28px_-15px_rgba(6,24,44,.8)] transition-transform duration-300 group-hover:scale-[1.03]" priority />
      </button>
    );
  }

  return (
    <section
      aria-label="德小馨 AI 助手"
      className="fixed bottom-3 right-3 z-[90] flex h-[min(620px,calc(100dvh-24px))] w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden rounded-[28px] border border-white/70 bg-[#f7fafc]/95 shadow-[0_30px_80px_-24px_rgba(6,24,44,.55)] backdrop-blur-xl sm:bottom-6 sm:right-6"
      role="dialog"
    >
      <header className="relative overflow-hidden bg-[linear-gradient(135deg,#06182c_0%,#0a385d_62%,#0d7580_100%)] px-4 pb-4 pt-4 text-white">
        <div className="absolute -right-10 -top-16 size-40 rounded-full border border-[#6bd7d4]/20" />
        <div className="absolute -right-3 top-8 size-20 rounded-full bg-[#18afb3]/10 blur-xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <DexiaoxinAvatar className="size-11 rounded-[15px] ring-white/20" priority />
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
                德小馨 AI
                <Sparkles className="size-3 text-[#f0bf54]" />
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-[9px] text-white/65">
                <span
                  className={`size-1.5 rounded-full ${
                    configured ? "bg-[#6bd7d4]" : "bg-amber-300"
                  }`}
                />
                {configured ? "在线 · 已连接企业知识库" : "服务等待管理员配置"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              aria-label="最小化德小馨助手"
              className="grid size-8 place-items-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={() => setMinimized(true)}
              type="button"
            >
              <Minus className="size-4" />
            </button>
            <Link
              aria-label="进入德小馨完整工作区"
              className="grid size-8 place-items-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              href="/ai"
            >
              <Maximize2 className="size-3.5" />
            </Link>
            <button
              aria-label="收起德小馨助手"
              className="grid size-8 place-items-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={() => {
                setOpen(false);
                setMinimized(false);
              }}
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
            <div className="rounded-[20px] border border-[#dce7ee] bg-white p-4 shadow-[0_14px_38px_-30px_rgba(6,24,44,.35)]">
              <p className="text-[12px] font-semibold text-[#0a2340]">
                你好，我是德小馨 👋
              </p>
              <p className="mt-2 text-[10px] leading-5 text-[#6d8192]">
                我可以在你的账号权限内查询公司制度、客户、产品、供应链、文件、审批和财务数据，并标注来源。
              </p>
            </div>
            <div className="mt-4 text-[9px] font-medium uppercase tracking-[0.14em] text-[#8093a3]">
              你可以这样问
            </div>
            <div className="mt-2 grid gap-2">
              {quickQuestions.map(({ icon: Icon, label, prompt }) => (
                <button
                  className="group flex items-center gap-3 rounded-2xl border border-[#dce7ee] bg-white px-3 py-3 text-left transition hover:border-[#91d3d1] hover:bg-[#f5fbfb] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!configured}
                  key={label}
                  onClick={() => void ask(prompt)}
                  type="button"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#dff5f4] text-[#0d7580] transition group-hover:bg-[#18afb3] group-hover:text-white">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold text-[#172b3f]">
                      {label}
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] text-[#7d8f9d]">
                      {prompt}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-auto rounded-2xl bg-[#eef5f8] px-3 py-2.5 text-[9px] leading-4 text-[#6d8192]">
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
                  <DexiaoxinAvatar className="mt-0.5 size-8 rounded-[11px]" decorative />
                ) : null}
                <div
                  className={`max-w-[82%] rounded-[18px] px-3.5 py-3 text-[10px] leading-5 ${
                    message.role === "user"
                      ? "rounded-br-md bg-[#0a385d] text-white"
                      : "rounded-bl-md border border-[#dce7ee] bg-white text-[#2e465b] shadow-[0_12px_30px_-28px_rgba(6,24,44,.45)]"
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
                <DexiaoxinAvatar className="size-8 rounded-[11px]" decorative />
                <div className="flex items-center gap-2 rounded-[16px] rounded-bl-md border border-[#dce7ee] bg-white px-3 py-2.5 text-[9px] text-[#708595]">
                  <LoaderCircle className="size-3.5 animate-spin text-[#0d7580]" />
                  正在检索授权资料…
                </div>
              </div>
            ) : null}
            <div ref={messageEndRef} />
          </div>
        )}
      </div>

      <footer className="border-t border-[#dce7ee] bg-white/90 p-3 backdrop-blur">
        {!configured ? (
          <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-[9px] leading-4 text-amber-800">
            DeepSeek API 尚未配置，请联系管理员。
          </p>
        ) : null}
        {error ? (
          <p aria-live="polite" className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-[9px] leading-4 text-red-700">
            {error}
          </p>
        ) : null}
        <form
          className="relative rounded-[18px] border border-[#cddce6] bg-white p-1.5 shadow-[0_12px_28px_-24px_rgba(6,24,44,.5)] focus-within:border-[#18afb3] focus-within:ring-2 focus-within:ring-[#18afb3]/10"
          onSubmit={submit}
        >
          <textarea
            aria-label="向德小馨提问"
            className="max-h-24 min-h-11 w-full resize-none bg-transparent px-2.5 py-2 pr-12 text-[10px] leading-5 text-[#172b3f] outline-none placeholder:text-[#8b9ba8]"
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
            className="absolute bottom-2 right-2 grid size-8 place-items-center rounded-xl bg-[#0d6475] text-white transition hover:bg-[#0a385d] disabled:cursor-not-allowed disabled:bg-[#cbd8e0]"
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
        <div className="mt-2 flex items-center justify-between px-1 text-[8px] text-[#8a9aa7]">
          <span>Enter 发送 · Shift + Enter 换行</span>
          <Link className="font-medium text-[#0d7580] hover:underline" href="/ai">
            完整工作区
          </Link>
        </div>
      </footer>
    </section>
  );
}
