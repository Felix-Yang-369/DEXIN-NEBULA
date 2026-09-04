"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpenText,
  Boxes,
  Building2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  MessageSquarePlus,
  PackageSearch,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { DexiaoxinAvatar } from "@/components/brand/dexiaoxin-avatar";
import type {
  AiChatMessage,
  AiConversationSummary,
  AiSource,
} from "@/features/ai/types";

const suggestions = [
  {
    icon: BookOpenText,
    label: "请假审批",
    prompt: "请假申请需要经过哪些审批环节？",
  },
  {
    icon: PackageSearch,
    label: "产品查询",
    prompt: "帮我查询 DX-R001 的规格、价格和配送说明。",
  },
  {
    icon: Boxes,
    label: "库存查询",
    prompt: "目前有哪些产品库存不足或需要确认？",
  },
  {
    icon: Building2,
    label: "客户数据",
    prompt: "帮我查找客户资料、最新报价和当前可见应收信息。",
  },
];

const sourceMeta: Record<
  AiSource["type"],
  { label: string; className: string }
> = {
  knowledge: {
    label: "制度",
    className: "bg-[#edf5ff] text-[#386b96]",
  },
  product: {
    label: "产品",
    className: "bg-[#eef7e9] text-[#4c703c]",
  },
  inventory: {
    label: "库存",
    className: "bg-[#fff5df] text-[#8b671f]",
  },
  customer: { label: "客户", className: "bg-[#e9f5ff] text-[#2e6f9e]" },
  supplier: { label: "供应商", className: "bg-[#f0f3ff] text-[#5366a6]" },
  employee: { label: "员工", className: "bg-[#eef7f5] text-[#31756d]" },
  announcement: { label: "公告", className: "bg-[#fff3df] text-[#94651d]" },
  document: { label: "文件", className: "bg-[#f3efff] text-[#6d57a3]" },
  approval: { label: "审批", className: "bg-[#e9f7ee] text-[#34724a]" },
  quote: { label: "报价", className: "bg-[#eef2ff] text-[#5266a9]" },
  finance: { label: "财务", className: "bg-[#fff0ed] text-[#a05248]" },
  sales: { label: "销售", className: "bg-[#eef4ff] text-[#3d64a1]" },
};

function SourceCards({ sources }: { sources: AiSource[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-4 border-t border-[#d9e5ed] pt-4">
      <div className="mb-2 text-[9px] font-medium uppercase tracking-[0.14em] text-[#6b8279]">
        回答来源
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {sources.map((source, index) => (
          <Link
            className="group flex min-w-0 items-start gap-2.5 rounded-xl border border-[#dfe9e5] bg-white/80 p-3 transition hover:border-[#93b9aa]"
            href={source.href}
            key={`${source.type}-${source.id}`}
          >
            <span
              className={`mt-0.5 rounded-full px-2 py-1 text-[8px] font-medium ${sourceMeta[source.type].className}`}
            >
              {index + 1} · {sourceMeta[source.type].label}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-medium text-[#294b65]">
                {source.title}
              </span>
              <span className="mt-1 line-clamp-2 block text-[9px] leading-4 text-muted-foreground">
                {source.description}
              </span>
            </span>
            <ExternalLink className="mt-1 size-3 shrink-0 text-muted-foreground/50" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AiChatWorkspace({
  employeeName,
  configured,
  initialConversationId,
  initialMessages,
  conversations,
}: {
  employeeName: string;
  configured: boolean;
  initialConversationId: string | null;
  initialMessages: AiChatMessage[];
  conversations: AiConversationSummary[];
}) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = configured && input.trim().length > 0 && !loading;
  const greeting = useMemo(
    () =>
      Number(
        new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Shanghai",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date()),
      ) < 12
        ? "早上好"
        : "你好",
    [],
  );

  const ask = async (question: string) => {
    const value = question.trim();
    if (!configured || !value || loading) return;
    const optimistic: AiChatMessage = {
      id: `local-${conversationId ?? "new"}-${messages.length}`,
      role: "user",
      content: value,
      sources: [],
    };
    setMessages((current) => [...current, optimistic]);
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
      if (!response.ok || !payload.message || !payload.conversationId) {
        throw new Error(payload.error || "德小馨暂时无法回答，请稍后重试");
      }
      setConversationId(payload.conversationId);
      setMessages((current) => [...current, payload.message!]);
      if (!conversationId) {
        window.history.replaceState(
          null,
          "",
          `/ai?conversation=${payload.conversationId}`,
        );
      }
    } catch (requestError) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimistic.id),
      );
      setInput(value);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "德小馨暂时无法回答，请稍后重试",
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(input);
  };

  return (
    <main className="grid min-h-[calc(100vh-64px)] bg-[#f3f7f5] xl:grid-cols-[250px_1fr]">
      <aside className="hidden border-r border-[#dbe6ed] bg-white/75 p-4 xl:block">
        <Link
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0a385d] text-[11px] font-medium text-white"
          href="/ai"
        >
          <MessageSquarePlus className="size-4" />
          新建对话
        </Link>
        <div className="mt-6 px-2 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          最近对话
        </div>
        <div className="mt-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="rounded-xl px-2 py-4 text-[10px] leading-5 text-muted-foreground">
              暂无历史对话。向德小馨提出第一个问题后会自动保存。
            </p>
          ) : (
            conversations.map((conversation) => (
              <Link
                className={`block rounded-xl px-3 py-3 transition ${
                  conversation.id === conversationId
                    ? "bg-[#eaf3ef] text-[#1a5a69]"
                    : "text-muted-foreground hover:bg-[#f5f8fb]"
                }`}
                href={`/ai?conversation=${conversation.id}`}
                key={conversation.id}
              >
                <span className="block truncate text-[10px] font-medium">
                  {conversation.title}
                </span>
                <span className="mt-1 flex items-center gap-1 text-[8px] opacity-65">
                  <Clock3 className="size-2.5" />
                  {new Intl.DateTimeFormat("zh-CN", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Shanghai",
                  }).format(new Date(conversation.updatedAt))}
                </span>
              </Link>
            ))
          )}
        </div>
        <div className="mt-6 rounded-2xl border border-[#dbe8e2] bg-[#f6faf8] p-4">
          <div className="flex items-center gap-2 text-[10px] font-medium text-[#176d78]">
            <ShieldCheck className="size-4" />
            权限内回答
          </div>
          <p className="mt-2 text-[9px] leading-5 text-muted-foreground">
            德小馨继承你的账号权限，可检索制度、业务、供应链、组织与财务数据，不执行修改或审批。
          </p>
        </div>
      </aside>

      <section className="flex min-w-0 flex-col">
        <div className="border-b border-[#dfe9e5] bg-white/80 px-5 py-4 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div className="flex items-center gap-3">
              <DexiaoxinAvatar className="size-11" priority />
              <div>
                <h1 className="text-sm font-semibold text-[#294b65]">
                  德小馨 AI
                </h1>
                <p className="mt-0.5 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <span
                    className={`size-1.5 rounded-full ${
                      configured ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {configured ? "DeepSeek 服务已连接" : "等待配置 DeepSeek API"}
                </p>
              </div>
            </div>
            <span className="rounded-full border border-[#d9e5ed] bg-white px-3 py-1.5 text-[9px] text-muted-foreground">
                  V0.2 · 企业数据内测
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-5xl">
            {messages.length === 0 ? (
              <div className="flex min-h-[500px] flex-col items-center justify-center py-10 text-center">
                <div className="relative">
                  <div className="absolute -inset-5 rounded-full bg-[#d4ad4a]/10 blur-xl" />
                  <DexiaoxinAvatar
                    className="relative size-24 shadow-[0_24px_55px_-30px_rgba(23,63,53,.9)]"
                    priority
                  />
                </div>
                <h2 className="mt-6 text-2xl font-semibold tracking-[-0.035em] text-[#294b65]">
                  {greeting}，{employeeName}
                </h2>
                <p className="mt-3 max-w-lg text-[11px] leading-6 text-muted-foreground">
                  我可以在你的账号权限内检索公司制度、客户、产品、供应商、库存、文件、审批和财务数据，并标注来源。
                </p>
                <div className="mt-7 grid w-full max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {suggestions.map(({ icon: Icon, label, prompt }) => (
                    <button
                      className="group rounded-[18px] border border-[#dbe6ed] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#91b6a7] hover:shadow-[0_18px_38px_-30px_rgba(23,63,53,.5)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!configured}
                      key={label}
                      onClick={() => void ask(prompt)}
                      type="button"
                    >
                      <span className="grid size-8 place-items-center rounded-xl bg-[#edf4f7] text-[#176d78]">
                        <Icon className="size-4" />
                      </span>
                      <span className="mt-3 block text-[11px] font-medium text-[#294b65]">
                        {label}
                      </span>
                      <span className="mt-1.5 line-clamp-2 block text-[9px] leading-4 text-muted-foreground">
                        {prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pb-8">
                {messages.map((message) => (
                  <article
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                    key={message.id}
                  >
                    {message.role === "assistant" && (
                      <DexiaoxinAvatar className="size-9" decorative />
                    )}
                    <div
                      className={`max-w-[850px] rounded-[20px] px-5 py-4 ${
                        message.role === "user"
                          ? "bg-[#0a385d] text-white"
                          : "border border-[#dbe6ed] bg-white text-[#344e46] shadow-[0_14px_40px_-34px_rgba(23,63,53,.5)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-[11px] leading-6">
                        {message.content}
                      </p>
                      {message.role === "assistant" && (
                        <SourceCards sources={message.sources} />
                      )}
                    </div>
                    {message.role === "user" && (
                      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#dfe9e5] text-[#176d78]">
                        <UserRound className="size-4" />
                      </span>
                    )}
                  </article>
                ))}
                {loading && (
                  <div className="flex items-center gap-3">
                    <DexiaoxinAvatar className="size-9" decorative />
                    <div className="flex items-center gap-2 rounded-2xl border border-[#dbe6ed] bg-white px-4 py-3 text-[10px] text-muted-foreground">
                      <LoaderCircle className="size-3.5 animate-spin" />
                      正在检索授权资料并组织回答…
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[#dfe9e5] bg-white/90 px-4 py-4 backdrop-blur sm:px-8">
          <div className="mx-auto max-w-4xl">
            {!configured && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] leading-5 text-amber-800">
                管理员需要在服务端配置 DEEPSEEK_API_KEY 后才能开始对话。
              </div>
            )}
            {error && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] text-red-700">
                {error}
              </div>
            )}
            <form
              className="relative rounded-[20px] border border-[#cfddd7] bg-white p-2 shadow-[0_18px_45px_-30px_rgba(23,63,53,.48)] focus-within:border-[#77a18f]"
              onSubmit={submit}
            >
              <textarea
                className="min-h-16 w-full resize-none bg-transparent px-3 py-2 pr-14 text-[11px] leading-5 text-foreground outline-none placeholder:text-muted-foreground/65"
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
                placeholder={
                  configured
                    ? "询问公司制度或权限内业务数据，Enter 发送，Shift + Enter 换行"
                    : "DeepSeek API 尚未配置"
                }
                ref={inputRef}
                value={input}
              />
              <button
                aria-label="发送问题"
                className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-xl bg-[#0a385d] text-white transition hover:bg-[#245d4e] disabled:cursor-not-allowed disabled:bg-[#cbd8d3]"
                disabled={!canSubmit}
                type="submit"
              >
                {loading ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </button>
            </form>
            <p className="mt-2 text-center text-[8px] text-muted-foreground">
              德小馨可能出现理解偏差，重要制度、金额与经营数据请通过来源页面再次确认。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
