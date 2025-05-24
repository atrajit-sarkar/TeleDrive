import { Send } from 'lucide-react';
import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
      <Send className="h-7 w-7" />
      <span className="text-2xl font-semibold">TeleDrive</span>
    </Link>
  );
}
