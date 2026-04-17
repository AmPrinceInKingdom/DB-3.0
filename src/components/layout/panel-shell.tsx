import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  sideTitle: string;
  nav: ReactNode;
  headerEyebrow: string;
  headerTitle: string;
  headerAction?: ReactNode;
  sidebarClassName?: string;
  containerClassName?: string;
};

export function PanelShell({
  children,
  sideTitle,
  nav,
  headerEyebrow,
  headerTitle,
  headerAction,
  sidebarClassName = "lg:grid-cols-[240px_1fr]",
  containerClassName = "container-app py-6",
}: Props) {
  return (
    <div className={containerClassName}>
      <div className={`grid gap-6 ${sidebarClassName}`}>
        <aside className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">{sideTitle}</p>
          {nav}
        </aside>
        <section className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {headerEyebrow}
              </p>
              <p className="text-sm font-semibold">{headerTitle}</p>
            </div>
            {headerAction ?? null}
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
