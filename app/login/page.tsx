import AuthForm from "@/components/AuthForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
      <AuthForm callbackUrl={callbackUrl} />
    </div>
  );
}
