export default function PermissionCenterLoading() {
  return <div className="mx-auto max-w-[1440px] animate-pulse space-y-5 p-6">
    <div className="h-40 rounded-md bg-muted" />
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="h-80 rounded-md bg-muted" />
      <div className="h-80 rounded-md bg-muted lg:col-span-2" />
    </div>
  </div>;
}
