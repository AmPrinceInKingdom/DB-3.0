import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
};

export function SectionHeader({
  title,
  subtitle,
  href,
  hrefLabel = "View all",
}: Props) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold md:text-2xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          {hrefLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
