import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="container-app py-24">
      <section className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">404</p>
        <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Back to Home</Link>
        </Button>
      </section>
    </main>
  );
}
