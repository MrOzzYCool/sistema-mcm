export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-mcm-text mb-2">404</h1>
        <p className="text-mcm-muted">Página no encontrada</p>
        <a href="/" className="mt-4 inline-block text-sm text-[#a93526] hover:underline">
          Volver al inicio
        </a>
      </div>
    </div>
  );
}
