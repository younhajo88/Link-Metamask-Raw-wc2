import { useId, useState, type ReactNode } from 'react';

interface PanelProps {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Panel({
  title,
  summary,
  defaultOpen = false,
  children,
}: PanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section>
      <h2>
        <button
          type="button"
          aria-controls={contentId}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          {title}
        </button>
      </h2>
      {summary ? <p>{summary}</p> : null}
      {isOpen ? (
        <div id={contentId} role="region" aria-label={title}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
