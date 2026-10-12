export default function NotFound() {
  return (
    <html lang="en">
      <body className="antialiased font-sans bg-[#F8F9FA] text-slate-900">
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">404</h1>
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Page Not Found</h2>
          <p className="text-slate-500 max-w-md mb-8">
            Sorry, the page you are looking for does not exist or has been moved.
          </p>
          <a
            href="/"
            className="px-6 py-2.5 rounded-xl bg-[#0D4F3C] text-white font-medium hover:bg-[#0A3F30] transition"
          >
            Return to Home
          </a>
        </div>
      </body>
    </html>
  );
}
