'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — silently no-op.
    }
  };
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-lipro-200/60 bg-[#0d1117] dark:border-lipro-700/40">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">{language || 'text'}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-6 text-white/90"><code>{code}</code></pre>
    </div>
  );
}

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { className, children } = props as { className?: string; children?: React.ReactNode; inline?: boolean };
            const isInline = !className;
            const text = String(children ?? '').replace(/\n$/, '');
            if (isInline) {
              return <code className="rounded bg-lipro-500/10 px-1.5 py-0.5 font-mono text-[0.85em] text-lipro-700 dark:text-lipro-300">{text}</code>;
            }
            const language = /language-(\w+)/.exec(className || '')?.[1] || '';
            return <CodeBlock language={language} code={text} />;
          },
          pre({ children }) {
            // CodeBlock already renders its own <pre>; avoid double-wrapping.
            return <>{children}</>;
          },
          a({ href, children }) {
            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-lipro-600 underline decoration-lipro-300 underline-offset-2 dark:text-lipro-400">{children}</a>;
          },
          ul({ children }) { return <ul className="my-1.5 list-disc space-y-1 pl-5">{children}</ul>; },
          ol({ children }) { return <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>; },
          p({ children }) { return <p className="mb-2 last:mb-0">{children}</p>; },
          strong({ children }) { return <strong className="font-semibold">{children}</strong>; },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
