import LoginForm from './LoginForm';

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-oasis p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="bg-oasis px-6 py-5">
          <img src="/logo.png" alt="Oasis Fresh Market" className="mx-auto h-16 w-auto" />
        </div>
        <div className="p-6 pt-5">
        <h1 className="text-2xl font-extrabold">Command Center</h1>
        {searchParams.error === 'notallowed' && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            This email does not have access. Please use your approved email.
          </p>
        )}
        <LoginForm />
        </div>
      </div>
    </main>
  );
}
