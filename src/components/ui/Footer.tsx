export function Footer({ note }: { note?: string }) {
  return (
    <footer className="bg-ink text-[#dde1e5]">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-8 py-8 text-sm">
        <span className="font-semibold tracking-[0.04em] text-white">ESTAFET</span>
        <span>
          {note ?? "Prototype built for STACK 2026 by team Beban Server. Sample projects are simulated demo data."}
        </span>
      </div>
    </footer>
  );
}
