export default function KnowledgeLoading() {
  return (
    <main className="min-h-svh bg-[#f5f8fb] p-4 lg:pl-[276px] sm:p-6 xl:p-8">
      <div className="mx-auto max-w-[1600px] animate-pulse">
        <div className="h-[190px] rounded-[24px] bg-[#dfe9e5]" />
        <div className="mt-5 h-28 rounded-[22px] bg-white" />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div className="h-[285px] rounded-[22px] bg-white" key={item} />
          ))}
        </div>
      </div>
    </main>
  );
}
