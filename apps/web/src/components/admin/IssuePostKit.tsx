'use client';

import { useDocumentInfo } from '@payloadcms/ui';
import { useEffect, useState } from 'react';

type Post = { channel: string; language: string; text: string };

export function IssuePostKit() {
  const { id } = useDocumentInfo();
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!id) return;
    void fetch(`/api/admin/digests/${id}/posts`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((body: { posts: Post[] }) => setPosts(body.posts))
      .catch(() => setPosts([]));
  }, [id]);

  if (posts.length === 0) return null;
  return (
    <div>
      {posts.map((post) => (
        <section key={`${post.channel}-${post.language}`}>
          <h3>
            {post.channel} ({post.language})
          </h3>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(post.text).catch(() => undefined);
            }}
          >
            Copy
          </button>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{post.text}</pre>
        </section>
      ))}
    </div>
  );
}
