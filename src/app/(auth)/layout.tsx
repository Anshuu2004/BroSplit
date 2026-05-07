export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center justify-center gap-2">
        <span className="inline-block h-7 w-7 rounded-md bg-primary" aria-hidden />
        <span className="text-2xl font-semibold tracking-tight">Brosplit</span>
      </div>
      {children}
    </main>
  );
}
