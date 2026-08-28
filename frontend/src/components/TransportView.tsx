type TransportViewProps = {
  active: boolean;
};

export function TransportView({ active }: TransportViewProps) {
  return (
    <div
      className="flex h-full flex-col gap-4 overflow-auto p-4 sm:p-6"
      style={{ background: "var(--bg-primary)" }}
      aria-hidden={!active}
    >
      <header>
        <h1
          className="text-lg font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Transport Model
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Transport modelling workspace
        </p>
      </header>

      <section
        className="flex min-h-48 flex-1 items-center justify-center rounded-lg border p-6 text-center"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border)",
          color: "var(--text-secondary)",
        }}
      >
        <p className="text-sm">Workflow and GIS workspace will appear here.</p>
      </section>
    </div>
  );
}
