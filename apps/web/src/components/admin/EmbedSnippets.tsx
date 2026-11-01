'use client';

import { useDocumentInfo } from '@payloadcms/ui';
import { useEffect, useState } from 'react';

type Snippet = { locale: string; script: string; frame: string };
type Partner = { key: string; name: string; snippets: Snippet[] };

function CopyBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <h4>{label}</h4>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(text).catch(() => undefined);
        }}
      >
        Copy
      </button>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{text}</pre>
    </div>
  );
}

export function EmbedSnippets() {
  const { id } = useDocumentInfo();
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    if (!id) return;
    void fetch(`/api/admin/projects/${id}/embed-snippets`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { partners: [] }))
      .then((body: { partners: Partner[] }) => setPartners(body.partners))
      .catch(() => setPartners([]));
  }, [id]);

  if (partners.length === 0) return null;
  return (
    <div>
      <h3>Embed snippets</h3>
      {partners.map((partner) => (
        <section key={partner.key}>
          <h3>
            {partner.name} ({partner.key})
          </h3>
          {partner.snippets.map((snippet) => (
            <div key={snippet.locale}>
              <CopyBlock label={`Script snippet (${snippet.locale})`} text={snippet.script} />
              <CopyBlock label={`Plain frame (${snippet.locale})`} text={snippet.frame} />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
