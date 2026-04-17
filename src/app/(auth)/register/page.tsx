import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Create your Deal Bazaar account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Join now to save products, track orders, and access exclusive deals.
      </p>
      <div className="mt-6">
        <RegisterForm />
      </div>
      <p className="mt-4 text-right text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
