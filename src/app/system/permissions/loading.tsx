export default function PermissionCenterLoading() {
  return <div className="mx-auto max-w-[1500px] animate-pulse space-y-5 p-6">
    <div className="h-40 rounded-[24px] bg-[#dce7ed]" />
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="h-80 rounded-[22px] bg-[#edf2f5]" />
      <div className="h-80 rounded-[22px] bg-[#edf2f5] lg:col-span-2" />
    </div>
  </div>;
}
