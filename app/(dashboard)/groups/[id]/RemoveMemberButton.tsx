'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RemoveMemberButton({ groupId, userId, userName }: { groupId: string, userId: string, userName: string }) {
  const router = useRouter();
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    if (!confirm(`Remove ${userName} from this group?`)) return;
    setIsRemoving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <button 
      className="btn btn-ghost btn-sm text-danger" 
      onClick={handleRemove}
      disabled={isRemoving}
    >
      {isRemoving ? '...' : 'Remove'}
    </button>
  );
}
