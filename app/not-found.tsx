import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4 text-center">
      <div className="w-16 h-16 rounded-3xl bg-[#FFF1E8] border border-orange-200 text-[#FF5500] flex items-center justify-center font-black text-2xl mb-4">
        V
      </div>
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2 font-display">Page Not Found</h1>
      <p className="text-sm text-slate-500 max-w-md mb-6">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-[#FF5500] hover:bg-[#EA4C00] text-white font-bold text-sm rounded-2xl shadow-lg shadow-orange-500/20 transition-all inline-block"
      >
        Return to Storefront
      </Link>
    </div>
  );
}
