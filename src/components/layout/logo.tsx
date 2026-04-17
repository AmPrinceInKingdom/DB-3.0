import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  name?: string;
  logoUrl?: string;
};

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "DB";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function normalizeLogoUrl(logoUrl?: string) {
  const value = logoUrl?.trim();
  if (!value) return "";
  if (value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return "";
}

export function Logo({ className, name = "Deal Bazaar", logoUrl = "" }: Props) {
  const initials = getInitials(name);
  const safeLogoUrl = normalizeLogoUrl(logoUrl);

  return (
    <Link href="/" className={cn("inline-flex items-center gap-2", className)}>
      {safeLogoUrl ? (
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted bg-cover bg-center"
          style={{ backgroundImage: `url("${safeLogoUrl}")` }}
          aria-label={`${name} logo`}
        />
      ) : (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          {initials}
        </span>
      )}
      <span className="font-display text-lg font-bold text-foreground">{name}</span>
    </Link>
  );
}
