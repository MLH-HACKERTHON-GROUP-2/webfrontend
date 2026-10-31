import Link from 'next/link';
export default function NotFound() {
  return <div className="app-loading"><span className="eyebrow">EMERALD CARE · 404</span><h1>Let’s get you back on track.</h1><p>This page isn’t part of your workspace.</p><Link className="button primary" href="/dashboard">Back to dashboard</Link></div>;
}
