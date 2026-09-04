import type { Metadata } from "next";
import { Activity, Database, Gauge, TriangleAlert } from "lucide-react";
import { BusinessDataTable } from "@/components/business/business-data-table";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "性能监控与慢查询治理", description: "查看应用延迟、错误率、慢接口和数据库慢查询指纹" };
export const dynamic = "force-dynamic";
type RouteSummary={route:string;operation:string;sample_count:number;average_ms:number;p95_ms:number;error_count:number;last_seen_at:string};
type Summary={hours:number;sampleCount:number;averageMs:number;p95Ms:number;errorRate:number;slowCount:number;routes:RouteSummary[]};
type SlowQuery={query_fingerprint:string;calls:number;mean_exec_ms:number;total_exec_ms:number;rows_returned:number};

export default async function ObservabilityPage({searchParams}:{searchParams:Promise<{hours?:string;page?:string}>}){
  const [employee,params]=await Promise.all([requireCurrentEmployee(),searchParams]);
  const canView=employee.roleCodes.some(role=>["admin","chairman"].includes(role));
  const hours=[1,6,24,72,168,720].includes(Number(params.hours))?Number(params.hours):24;
  const page=Math.max(1,Number(params.page)||1); const pageSize=10;
  const supabase=await createClient();
  const [{data:summaryData,error:summaryError},{data:slowQueries,error:slowError}]=canView?await Promise.all([supabase.rpc("performance_observability_summary",{p_hours:hours}),supabase.rpc("database_slow_query_summary",{p_limit:20})]):[{data:null,error:null},{data:[],error:null}];
  const summary=(summaryData??{hours,sampleCount:0,averageMs:0,p95Ms:0,errorRate:0,slowCount:0,routes:[]}) as Summary;
  const routes=(summary.routes??[]).slice((page-1)*pageSize,page*pageSize);
  const queries=(slowQueries??[]) as SlowQuery[];
  return <WorkflowShell activeItem="系统管理" breadcrumb="系统管理 / 性能监控" currentUser={{name:employee.name,roleLabel:employee.title??"内部员工"}}><main className="mx-auto max-w-[1320px] p-4 sm:p-6 xl:p-8">
    <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-8"><Gauge className="absolute right-10 top-1/2 size-32 -translate-y-1/2 text-white/[.06]"/><div className="text-[10px] tracking-[.15em] text-[#79d8d5]">OBSERVABILITY · LATENCY · DATABASE</div><h1 className="mt-3 text-2xl font-semibold">性能监控与慢查询治理</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">从真实业务请求定位高延迟和错误热点，以匿名 SQL 指纹治理数据库慢查询，不在页面暴露敏感语句。</p><form className="mt-5"><select className="h-9 rounded-full border border-white/15 bg-white/10 px-4 text-[10px] text-white" defaultValue={hours} name="hours"><option className="text-slate-900" value="6">最近 6 小时</option><option className="text-slate-900" value="24">最近 24 小时</option><option className="text-slate-900" value="72">最近 3 天</option><option className="text-slate-900" value="168">最近 7 天</option><option className="text-slate-900" value="720">最近 30 天</option></select><button className="ml-2 h-9 rounded-full bg-[#48c1bd] px-4 text-[10px] font-medium text-[#073b4b]">更新视图</button></form></section>
    {!canView?<div className="mt-5 rounded-[18px] border border-[#ead8d8] bg-white p-8 text-center text-xs text-[#965151]">当前账号无权查看性能中心。</div>:<>
      {(summaryError||slowError)&&<div className="mt-4 rounded-xl border border-[#efd6d6] bg-[#fff7f7] p-3 text-[10px] text-[#a24f55]">部分性能数据暂不可用，请确认观测迁移已应用；pg_stat_statements 未启用时慢查询列表会保持为空。</div>}
      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{icon:Activity,label:"采样量",value:summary.sampleCount.toLocaleString("zh-CN"),note:`最近 ${hours} 小时`},{icon:Gauge,label:"P95 延迟",value:`${summary.p95Ms} ms`,note:`平均 ${summary.averageMs} ms`},{icon:TriangleAlert,label:"错误率",value:`${summary.errorRate}%`,note:`慢请求 ${summary.slowCount} 次`},{icon:Database,label:"慢查询指纹",value:String(queries.length),note:slowError?"暂不可用":"已隐藏原始 SQL"}].map(card=><article className="rounded-[18px] border border-border bg-white p-5" key={card.label}><card.icon className="size-4 text-primary"/><div className="mt-3 text-[9px] text-muted-foreground">{card.label}</div><div className="mt-1 text-lg font-semibold">{card.value}</div><div className="mt-1 text-[9px] text-muted-foreground">{card.note}</div></article>)}</section>
      <h2 className="mb-3 mt-7 text-sm font-semibold">接口性能热点</h2><BusinessDataTable columns={[{key:"route",label:"路由 / 操作",className:"min-w-[280px]"},{key:"samples",label:"样本",align:"right"},{key:"average",label:"平均",align:"right"},{key:"p95",label:"P95",align:"right"},{key:"errors",label:"错误",align:"right"},{key:"last",label:"最后采样"}]} rows={routes.map(row=>({route:<div><div className="font-mono text-primary">{row.route}</div><div className="mt-1 text-[9px] text-muted-foreground">{row.operation}</div></div>,samples:row.sample_count,average:`${row.average_ms} ms`,p95:<span className={row.p95_ms>=1000?"font-semibold text-[#bd4e58]":row.p95_ms>=500?"text-[#9b6b23]":""}>{row.p95_ms} ms</span>,errors:row.error_count,last:new Intl.DateTimeFormat("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(row.last_seen_at))}))} rowKeys={routes.map(row=>`${row.route}:${row.operation}`)} total={summary.routes?.length??0} page={page} pageSize={pageSize} pathname="/system/observability" searchParams={{hours:String(hours)}} emptyTitle="还没有性能样本" emptyDescription="访问已接入观测的业务页面后，这里会逐步形成真实基线。" density="compact"/>
      <h2 className="mb-3 mt-7 text-sm font-semibold">数据库慢查询指纹</h2><BusinessDataTable columns={[{key:"fingerprint",label:"查询指纹",className:"min-w-[280px]"},{key:"calls",label:"调用次数",align:"right"},{key:"mean",label:"平均执行",align:"right"},{key:"total",label:"累计执行",align:"right"},{key:"rows",label:"返回行数",align:"right"}]} rows={queries.map(row=>({fingerprint:<span className="font-mono text-primary">{row.query_fingerprint}</span>,calls:Number(row.calls).toLocaleString("zh-CN"),mean:`${row.mean_exec_ms} ms`,total:`${row.total_exec_ms} ms`,rows:Number(row.rows_returned).toLocaleString("zh-CN")}))} rowKeys={queries.map(row=>row.query_fingerprint)} total={queries.length} page={1} pageSize={Math.max(1,queries.length)} pathname="/system/observability" searchParams={{hours:String(hours)}} emptyTitle="暂无慢查询统计" emptyDescription="请在 Supabase 数据库启用 pg_stat_statements；系统只读取摘要，不自动修改数据库扩展配置。" density="compact"/>
    </>}
  </main></WorkflowShell>
}
