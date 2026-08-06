type SupplierFormValue = {
  id?: string;
  name?: string;
  short_name?: string | null;
  unified_credit_code?: string | null;
  category?: string;
  cooperation_level?: string;
  cooperation_status?: string;
  legal_representative?: string | null;
  business_scope?: string | null;
  address?: string | null;
  settlement_terms?: string | null;
  owner_employee_id?: string | null;
  note?: string | null;
};

export function SupplierFields({
  supplier,
  employees,
}: {
  supplier?: SupplierFormValue;
  employees: Array<{ id: string; name: string; employee_no: string }>;
}) {
  const inputClass =
    "h-10 rounded-xl border border-border bg-white px-3 text-xs text-foreground outline-none focus:border-primary/35";
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {supplier?.id && (
        <input name="supplierId" type="hidden" value={supplier.id} />
      )}
      <label className="grid gap-2 text-[10px] text-muted-foreground sm:col-span-2">
        供应商全称 *
        <input
          className={inputClass}
          defaultValue={supplier?.name}
          maxLength={160}
          name="name"
          required
        />
      </label>
      <label className="grid gap-2 text-[10px] text-muted-foreground">
        简称
        <input
          className={inputClass}
          defaultValue={supplier?.short_name ?? ""}
          maxLength={80}
          name="shortName"
        />
      </label>
      <label className="grid gap-2 text-[10px] text-muted-foreground">
        统一社会信用代码
        <input
          className={inputClass}
          defaultValue={supplier?.unified_credit_code ?? ""}
          maxLength={30}
          name="unifiedCreditCode"
        />
      </label>
      <label className="grid gap-2 text-[10px] text-muted-foreground">
        供应品类 *
        <select
          className={inputClass}
          defaultValue={supplier?.category ?? "rice"}
          name="category"
        >
          <option value="rice">大米粮食</option>
          <option value="oil">食用油</option>
          <option value="gift">礼盒礼赠</option>
          <option value="logistics">物流仓储</option>
          <option value="packaging">包装物料</option>
          <option value="service">服务类</option>
          <option value="other">其他</option>
        </select>
      </label>
      <label className="grid gap-2 text-[10px] text-muted-foreground">
        合作等级 *
        <select
          className={inputClass}
          defaultValue={supplier?.cooperation_level ?? "standard"}
          name="cooperationLevel"
        >
          <option value="core">核心</option>
          <option value="preferred">优选</option>
          <option value="standard">标准</option>
          <option value="backup">备选</option>
        </select>
      </label>
      <label className="grid gap-2 text-[10px] text-muted-foreground">
        合作状态 *
        <select
          className={inputClass}
          defaultValue={supplier?.cooperation_status ?? "candidate"}
          name="cooperationStatus"
        >
          <option value="candidate">待准入</option>
          <option value="active">合作中</option>
          <option value="suspended">暂停合作</option>
          <option value="inactive">已终止</option>
        </select>
      </label>
      <label className="grid gap-2 text-[10px] text-muted-foreground">
        内部负责人
        <select
          className={inputClass}
          defaultValue={supplier?.owner_employee_id ?? ""}
          name="ownerEmployeeId"
        >
          <option value="">暂不分配</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} · {employee.employee_no}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-[10px] text-muted-foreground">
        法定代表人
        <input
          className={inputClass}
          defaultValue={supplier?.legal_representative ?? ""}
          maxLength={80}
          name="legalRepresentative"
        />
      </label>
      <label className="grid gap-2 text-[10px] text-muted-foreground sm:col-span-2">
        结算约定
        <input
          className={inputClass}
          defaultValue={supplier?.settlement_terms ?? ""}
          maxLength={300}
          name="settlementTerms"
          placeholder="例如：月结 30 天；具体以合同为准"
        />
      </label>
      <label className="grid gap-2 text-[10px] text-muted-foreground sm:col-span-2">
        注册 / 经营地址
        <input
          className={inputClass}
          defaultValue={supplier?.address ?? ""}
          maxLength={500}
          name="address"
        />
      </label>
      <label className="grid gap-2 text-[10px] text-muted-foreground sm:col-span-2 xl:col-span-4">
        经营范围
        <textarea
          className="min-h-20 rounded-xl border border-border bg-white p-3 text-xs text-foreground outline-none focus:border-primary/35"
          defaultValue={supplier?.business_scope ?? ""}
          maxLength={1000}
          name="businessScope"
        />
      </label>
      <label className="grid gap-2 text-[10px] text-muted-foreground sm:col-span-2 xl:col-span-4">
        内部备注
        <textarea
          className="min-h-20 rounded-xl border border-border bg-white p-3 text-xs text-foreground outline-none focus:border-primary/35"
          defaultValue={supplier?.note ?? ""}
          maxLength={1000}
          name="note"
        />
      </label>
    </div>
  );
}
