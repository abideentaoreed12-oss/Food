export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold text-slate-900 font-display">404 - Page Not Found</h2>
        <p className="text-xs text-slate-500">The destination route does not exist.</p>
        <a
          href="/"
          className="inline-block px-5 py-2.5 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold transition-colors"
        >
          Return to Storefront
        </a>
      </div>
    </div>
  );
}
