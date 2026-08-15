import Link from 'next/link';
import './not-found.css';

export default function NotFound() {
  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <h1 className="error-code">404</h1>
        <h2 className="error-title">Page Not Found</h2>
        <p className="error-message">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/dashboard" className="btn btn-primary btn-home">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
