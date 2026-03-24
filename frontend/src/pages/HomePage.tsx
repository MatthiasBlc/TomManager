export default function HomePage() {
  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content text-center">
        <div className="max-w-md">
          <h1 className="text-5xl font-bold">TomManager</h1>
          <p className="py-6">Welcome to TomManager. Start building your application.</p>
          <a href="/login" className="btn btn-primary">
            Get Started
          </a>
        </div>
      </div>
    </div>
  );
}
