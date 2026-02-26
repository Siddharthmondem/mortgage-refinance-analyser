export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
        <p className="text-gray-500 mb-6">Page not found.</p>
        <a
          href="/"
          className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
        >
          ← Back to calculator
        </a>
      </div>
    </div>
  );
}
