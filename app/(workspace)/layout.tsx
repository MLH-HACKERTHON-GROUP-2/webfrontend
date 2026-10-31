import { Suspense } from 'react';
import Shell from '@/components/shell';
export default function WorkspaceLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <Shell><Suspense fallback={<p className="muted">Opening your workspace…</p>}>{children}</Suspense></Shell>;
}
