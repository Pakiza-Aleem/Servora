import { Link } from 'react-router-dom';
export default function NotFound() {
  return <div className="empty not-found"><h1 className="serif">Page not found</h1><p>That page doesn’t exist or you don’t have access.</p><Link className="btn" to="/">Go home</Link></div>;
}
