import type { Metadata } from 'next';
import { StoreProvider } from '@/lib/store';
import './globals.css';
export const metadata: Metadata = {
  title: {
    default: 'Emerald Care — Clinical Workspace',
    template: '%s | Emerald Care'
  },
  description: 'A connected clinical workspace for appointments, patient care, medical records and pharmacy management.'
};
export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <html lang="en"><body><StoreProvider>{children}</StoreProvider></body></html>;
}
