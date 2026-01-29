'use client';

import { useMemo } from 'react';
import DOMPurify from 'dompurify';

function looksLikeHtml(s: string) {
  return /<\/?(p|h\d|ul|ol|li|img|blockquote|pre|code|table|a|strong|em|span|div)\b/i.test(s);
}

function toParagraphs(content: string): string[] {
  return content
    .split(/\r?\n\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function BlogContent({ content }: { content: string }) {
  const safeHtml = useMemo(() => {
    if (!content) return '';
    if (!looksLikeHtml(content)) return '';

    // NOTE: We keep this permissive enough for TipTap output, but still sanitize.
    return DOMPurify.sanitize(content, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target', 'rel'],
    });
  }, [content]);

  if (safeHtml) {
    return <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: safeHtml }} />;
  }

  const paragraphs = toParagraphs(content || '');
  return (
    <div className="prose prose-gray max-w-none">
      {paragraphs.length ? paragraphs.map((p, i) => <p key={i}>{p}</p>) : <p>{content}</p>}
    </div>
  );
}
