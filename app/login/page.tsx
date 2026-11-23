import LoginForm from './LoginForm';

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-oasis p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-oasis">Oasis Fresh Market</p>
        <h1 className="mt-1 text-2xl font-extrabold">Command Center</h1>
        {searchParams.error === 'notallowed' && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            This email does not have access. Please use your approved email.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
