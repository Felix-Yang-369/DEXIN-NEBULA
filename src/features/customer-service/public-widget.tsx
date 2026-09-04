"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowUp, Headphones, LoaderCircle, Maximize2, Mic, Minimize2, RotateCcw, Send, UserRound, X } from "lucide-react";

type Source = { id: string; title: string; href: string | null };
type Message = { id: string; sequenceNo: number; role: "visitor" | "assistant" | "employee" | "system"; content: string; sources: Source[]; pending?: boolean };
type Workspace = { code: string; assistant_name: string; assistant_avatar_url: string | null; welcome_message: string; quick_questions: string[]; theme: { primary?: string; accent?: string; surface?: string } };
type SpeechRecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

function normalizeMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    sequenceNo: Number(row.sequence_no ?? 0),
    role: row.sender_type as Message["role"],
    content: String(row.content ?? ""),
    sources: (row.source_refs as Source[]) ?? [],
  };
}

function mergeMessage(current: Message[], incoming: Message) {
  if (current.some((item) => item.id === incoming.id)) return current;
  return [...current, incoming].sort((left, right) => left.sequenceNo - right.sequenceNo);
}

export function PublicCustomerServiceWidget({ workspaceCode }: { workspaceCode: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [token, setToken] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("ai_active");
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sequenceRef = useRef(0);
  const localMessageIdRef = useRef(0);
  const activeAssistantIdRef = useRef("");
  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    const supplied = new URLSearchParams(window.location.search).get("parentOrigin");
    return supplied || window.location.origin;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let started = false;
    const initialize = async (existingToken = "") => {
      if (started) return;
      started = true;
      setLoading(true);
      try {
        const response = await fetch("/api/customer-service/public/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceCode, origin, pageUrl: document.referrer || undefined, existingToken: existingToken || undefined }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "客服服务暂时不可用");
        if (cancelled) return;
        setToken(payload.token);
        setWorkspace(payload.workspace);
        setStatus(payload.conversation.status);
        const history = (payload.messages ?? []).map(normalizeMessage);
        setMessages(history);
        sequenceRef.current = Math.max(0, ...history.map((message: Message) => message.sequenceNo));
        setLeadSaved(Boolean(payload.hasLead));
        window.parent.postMessage({ type: "dexiaoxin:session", token: payload.token }, origin);
        setError("");
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "客服服务暂时不可用");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.data?.type !== "dexiaoxin:init") return;
      void initialize(typeof event.data.token === "string" ? event.data.token : "");
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "dexiaoxin:ready" }, origin);
    const fallback = window.setTimeout(() => void initialize(""), 700);
    return () => { cancelled = true; window.clearTimeout(fallback); window.removeEventListener("message", onMessage); };
  }, [origin, workspaceCode]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let controller: AbortController | null = null;
    const connect = async () => {
      while (!cancelled) {
        controller = new AbortController();
        try {
          const response = await fetch(`/api/customer-service/public/events?after=${sequenceRef.current}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
          if (!response.ok || !response.body) throw new Error("reconnect");
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";
            for (const block of events) {
              const eventName = block.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
              const data = block.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
              if (!data) continue;
              const payload = JSON.parse(data);
              if (eventName === "message") {
                const incoming = normalizeMessage(payload);
                sequenceRef.current = Math.max(sequenceRef.current, incoming.sequenceNo);
                if (incoming.role === "employee" || incoming.role === "system") setMessages((current) => mergeMessage(current, incoming));
              } else if (eventName === "status") setStatus(payload.status);
            }
          }
        } catch { /* reconnect below */ }
        if (!cancelled) await new Promise((resolve) => setTimeout(resolve, 1600));
      }
    };
    void connect();
    return () => { cancelled = true; controller?.abort(); };
  }, [token]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  const ask = async (question: string) => {
    const value = question.trim();
    if (!token || !value || sending) return;
    localMessageIdRef.current += 1;
    const localId = `local-${localMessageIdRef.current}`;
    setMessages((current) => [...current, { id: localId, sequenceNo: sequenceRef.current + 0.1, role: "visitor", content: value, sources: [] }]);
    setInput(""); setSending(true); setError("");
    try {
      const response = await fetch("/api/customer-service/public/chat", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: value }) });
      if (!response.ok || !response.body) { const payload = await response.json(); throw new Error(payload.error || "发送失败"); }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const placeholderId = `assistant-local-${localMessageIdRef.current}`;
      activeAssistantIdRef.current = placeholderId;
      setMessages((current) => [...current, { id: placeholderId, sequenceNo: sequenceRef.current + 0.2, role: "assistant", content: "", sources: [], pending: true }]);
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === "meta") { const previousId = activeAssistantIdRef.current; activeAssistantIdRef.current = event.messageId; setMessages((current) => current.map((message) => message.id === previousId ? { ...message, id: event.messageId } : message)); }
          if (event.type === "delta") { const activeId = activeAssistantIdRef.current; setMessages((current) => current.map((message) => message.id === activeId ? { ...message, content: `${message.content}${event.delta}` } : message)); }
          if (event.type === "done") { const activeId = activeAssistantIdRef.current; const doneSources = (event.sources ?? []) as Source[]; sequenceRef.current = Math.max(sequenceRef.current, Number(event.sequenceNo ?? 0)); setMessages((current) => current.map((message) => message.id === activeId ? { ...message, sequenceNo: Number(event.sequenceNo), sources: doneSources, pending: false } : message)); if (event.needsHuman) setStatus("waiting_human"); }
        }
      }
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "消息发送失败"); setInput(value); setMessages((current) => current.filter((message) => message.id !== localId && !message.pending)); }
    finally { setSending(false); inputRef.current?.focus(); }
  };

  const requestHuman = async () => {
    if (!token) return;
    const response = await fetch("/api/customer-service/public/handoff", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) { setStatus("waiting_human"); setLeadOpen(!leadSaved); }
  };

  const startVoice = () => {
    const Recognition = (window as typeof window & { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Recognition) { setError("当前浏览器暂不支持语音输入，请使用键盘输入"); return; }
    const recognition = new Recognition(); recognition.lang = "zh-CN"; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event) => setInput(event.results[0]?.[0]?.transcript ?? "");
    recognition.onend = () => setListening(false); recognition.onerror = () => { setListening(false); setError("没有识别到语音，请重试或使用键盘输入"); };
    setListening(true); recognition.start();
  };

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/customer-service/public/leads", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, consent: form.get("consent") === "on" }) });
    if (response.ok) { setLeadSaved(true); setLeadOpen(false); } else { const body = await response.json(); setError(body.error || "留资保存失败"); }
  };

  const primary = workspace?.theme?.primary || "#07503d";
  return <main className="flex h-dvh min-h-[420px] w-full flex-col overflow-hidden bg-[#f7faf8] text-[#193c32]" style={{ "--customer-primary": primary } as CSSProperties}>
    <header className="relative flex items-center justify-between overflow-hidden px-4 py-4 text-white" style={{ background: `linear-gradient(135deg,#05271e 0%,${primary} 72%,#08715c 100%)` }}>
      <div className="flex items-center gap-3"><span className="relative size-11 overflow-hidden rounded-[14px] border border-[#ead8ad]/35"><Image alt="德小馨" fill priority sizes="44px" src={workspace?.assistant_avatar_url || "/dexinai-icon.png"} /></span><div><h1 className="text-[14px] font-semibold">{workspace?.assistant_name || "德小馨"} <small className="rounded border border-[#ead8ad]/30 px-1 py-0.5 text-[8px] text-[#ead8ad]">AI</small></h1><p className="mt-1 flex items-center gap-1.5 text-[9px] text-white/65"><i className="size-1.5 rounded-full bg-[#6bd7b2]" />{status === "human_active" ? "人工客服接待中" : status === "waiting_human" ? "等待人工客服" : "在线 · AI 智能接待"}</p></div></div>
      <div className="flex gap-1"><button aria-label="重新开始" className="grid size-8 place-items-center rounded-xl hover:bg-white/10" onClick={() => { window.parent.postMessage({ type: "dexiaoxin:clear-session" }, origin); location.reload(); }}><RotateCcw className="size-3.5" /></button><button aria-label={maximized ? "恢复窗口" : "最大化窗口"} className="grid size-8 place-items-center rounded-xl hover:bg-white/10" onClick={() => { const next = !maximized; setMaximized(next); window.parent.postMessage({ type: "dexiaoxin:resize", maximized: next }, origin); }}>{maximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button><button aria-label="收起客服" className="grid size-8 place-items-center rounded-xl hover:bg-white/10" onClick={() => window.parent.postMessage({ type: "dexiaoxin:close" }, origin)}><X className="size-4" /></button></div>
    </header>
    <section aria-live="polite" className="flex-1 overflow-y-auto p-4">
      {loading ? <div className="grid h-full place-items-center text-xs text-[#71827c]"><LoaderCircle className="size-6 animate-spin text-[var(--customer-primary)]" /></div> : messages.length === 0 ? <div className="flex h-full flex-col"><article className="rounded-[20px] border border-[#dce7e2] bg-white p-4 shadow-sm"><strong className="text-xs">你好，我是{workspace?.assistant_name || "德小馨"} 👋</strong><p className="mt-2 text-[10px] leading-5 text-[#6f827b]">{workspace?.welcome_message}</p></article><p className="mb-2 mt-5 text-[9px] tracking-[.12em] text-[#81918b]">你可以这样问</p><div className="grid gap-2">{workspace?.quick_questions?.map((question) => <button className="flex min-h-12 items-center justify-between rounded-2xl border border-[#dce7e2] bg-white px-4 text-left text-[10px] text-[#38594f] hover:border-[#98c9ba]" key={question} onClick={() => void ask(question)}>{question}<ArrowUp className="size-3 rotate-45 text-[#b0965c]" /></button>)}</div><p className="mt-auto rounded-xl bg-[#edf4f1] p-3 text-[8px] leading-4 text-[#74857f]">库存、交期、账期、合同条款和最终成交价由人工确认，德小馨不会在缺少依据时作出承诺。</p></div> : <div className="space-y-4">{messages.filter((message) => message.role !== "system").map((message) => <article className={`flex gap-2 ${message.role === "visitor" ? "justify-end" : "items-start"}`} key={message.id}>{message.role !== "visitor" && <span className="relative mt-0.5 size-8 shrink-0 overflow-hidden rounded-[10px]"><Image alt="" fill sizes="32px" src={message.role === "employee" ? "/dexin-nebula-icon.png" : "/dexinai-icon.png"} /></span>}<div className={`max-w-[82%] rounded-[17px] px-3 py-2.5 text-[10px] leading-5 ${message.role === "visitor" ? "rounded-br-[5px] bg-[var(--customer-primary)] text-white" : "rounded-bl-[5px] border border-[#dce7e2] bg-white text-[#3d5b52]"}`}><p className="whitespace-pre-wrap">{message.content}{message.pending && <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-[#2eb497]" />}</p>{message.sources.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{message.sources.map((source) => source.href ? <a className="rounded-full bg-[#eef5f2] px-2 py-1 text-[8px] text-[#17654f]" href={source.href} key={source.id} rel="noreferrer" target="_blank">来源 · {source.title}</a> : null)}</div>}</div></article>)}{sending && !messages.some((message) => message.pending) && <LoaderCircle className="ml-10 size-4 animate-spin text-[var(--customer-primary)]" />}<div ref={endRef} /></div>}
    </section>
    {leadOpen && !leadSaved && <form className="mx-3 mb-2 grid max-h-[55dvh] gap-2 overflow-y-auto rounded-2xl border border-[#d7e3dd] bg-white p-3 shadow-xl" onSubmit={submitLead}><div className="flex items-center justify-between"><strong className="text-xs">留下采购需求</strong><button aria-label="关闭留资表单" onClick={() => setLeadOpen(false)} type="button"><X className="size-4" /></button></div><div className="grid grid-cols-2 gap-2"><input className="h-9 rounded-lg border px-3 text-[10px]" name="name" placeholder="姓名 *" required /><input className="h-9 rounded-lg border px-3 text-[10px]" name="phone" placeholder="联系电话 *" required /><input className="h-9 rounded-lg border px-3 text-[10px]" name="company" placeholder="公司名称" /><input className="h-9 rounded-lg border px-3 text-[10px]" name="city" placeholder="所在城市" /></div><select className="h-9 rounded-lg border px-3 text-[10px]" defaultValue="enterprise" name="businessType"><option value="enterprise">企业采购</option><option value="catering">餐饮供应</option><option value="gift">福利礼赠</option><option value="distributor">渠道合作</option><option value="other">其他</option></select><input className="h-9 rounded-lg border px-3 text-[10px]" name="requestedProducts" placeholder="意向产品或服务" /><div className="grid grid-cols-2 gap-2"><input className="h-9 rounded-lg border px-3 text-[10px]" name="expectedVolume" placeholder="预计用量" /><input className="h-9 rounded-lg border px-3 text-[10px]" name="procurementTimeline" placeholder="采购时间" /></div><textarea className="min-h-16 rounded-lg border p-3 text-[10px]" name="notes" placeholder="补充需求" /><label className="flex gap-2 text-[8px] leading-4 text-[#71827c]"><input name="consent" required type="checkbox" />我同意德馨淼盛使用以上信息与我联系并处理本次采购咨询。</label><button className="h-9 rounded-xl bg-[var(--customer-primary)] text-[10px] font-medium text-white" type="submit">提交并等待联系</button></form>}
    {error && <p className="mx-3 mb-2 rounded-lg bg-[#fff1ef] px-3 py-2 text-[9px] text-[#a65548]">{error}</p>}
    <footer className="border-t border-[#dce7e2] bg-white/95 p-3"><div className="mb-2 flex items-center justify-between"><button className="flex items-center gap-1.5 text-[9px] text-[#17654f]" onClick={() => void requestHuman()}><Headphones className="size-3.5" />{status === "waiting_human" ? "已申请人工客服" : "转人工客服"}</button><button className="flex items-center gap-1.5 text-[9px] text-[#806d43]" onClick={() => setLeadOpen(true)}><UserRound className="size-3.5" />{leadSaved ? "联系信息已提交" : "留下联系方式"}</button></div><form className="flex items-end gap-2 rounded-2xl border border-[#d3e0da] bg-[#f8faf9] p-2" onSubmit={(event) => { event.preventDefault(); void ask(input); }}><button aria-label="语音输入" className={`grid size-8 shrink-0 place-items-center rounded-xl ${listening ? "bg-[#e7f5ef] text-[#14755d]" : "text-[#71827c]"}`} onClick={startVoice} type="button"><Mic className="size-4" /></button><textarea aria-label="输入客服问题" className="max-h-24 min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-[11px] outline-none" maxLength={1000} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(input); } }} placeholder="请输入产品、采购或配送问题…" ref={inputRef} rows={1} value={input} /><button aria-label="发送" className="grid size-8 shrink-0 place-items-center rounded-xl bg-[var(--customer-primary)] text-white disabled:opacity-40" disabled={!input.trim() || sending} type="submit"><Send className="size-3.5" /></button></form><p className="mt-1.5 text-center text-[7px] text-[#8b9994]">AI 回答仅依据已发布的官网公开资料</p></footer>
  </main>;
}
