'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadStore, usePermitStore } from '@/lib/store';

export default function PrintIndexPage() {
  const router = useRouter();
  const store = usePermitStore();
  useEffect(() => {
    loadStore().finally(() => {
      const latest = store.batches[0];
      if (latest) router.replace(`/print/${latest.id}`);
    });
  }, [router, store.batches]);
  return <div className="p-6">Loading print view...</div>;
}
