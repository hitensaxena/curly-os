'use client';

// The reactive stage: renders the cards Curly pushes onto the screen as it
// recalls / saves / searches / thinks / acts. Newest card first, capped, with a
// glow on the freshest. Rich markdown bodies via react-markdown. (5c adds graph.)
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ContentCard, StageCard } from './types';
import { GraphPanel } from './GraphPanel';

const PROSE = 'prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-headings:text-foreground prose-a:text-accent-2 prose-code:text-accent-2 prose-pre:bg-surface-2 prose-pre:text-foreground';

function eyebrow(card: StageCard): string {
  switch (card.source) {
    case 'tool:remember':
      return 'Saved to your mind';
    case 'tool:think_hard':
      return 'Thought it through';
    case 'tool:web_search':
    case 'tool:web_fetch':
      return 'From the web';
    case 'tool:do_task':
      return 'Done';
    case 'tool:show':
      return 'Curly';
    default:
      return 'From your mind';
  }
}

function Card({ card, fresh }: { card: ContentCard; fresh: boolean }) {
  const accent = card.kind === 'web' ? 'text-accent-2' : card.kind === 'task' ? 'text-success' : 'text-accent';
  return (
    <article
      className={`pointer-events-auto w-full max-w-[640px] rounded-2xl border border-border bg-surface/80 p-4 backdrop-blur-md ${fresh ? 'glow' : ''}`}
      style={{ animation: 'cardin .38s cubic-bezier(.2,.8,.2,1)' }}
    >
      <div className={`mb-1 text-[11px] uppercase tracking-[0.15em] ${accent}`}>{eyebrow(card)}</div>
      {card.title && <div className="mb-2 text-sm font-medium text-foreground">{card.title}</div>}
      {card.body && (
        <div
          className={`${PROSE} max-h-[42dvh] overflow-hidden`}
          style={{ maskImage: 'linear-gradient(to bottom,#000 72%,transparent)', WebkitMaskImage: 'linear-gradient(to bottom,#000 72%,transparent)' }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.body}</ReactMarkdown>
        </div>
      )}
      {card.sourcePath && <div className="mt-2.5 break-all text-[10px] tracking-wide text-accent-2/85">{card.sourcePath}</div>}
    </article>
  );
}

export function Stage({ cards }: { cards: StageCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex flex-col items-center gap-2.5 px-5">
      {cards.slice(0, 6).map((c, i) =>
        c.kind === 'graph' ? (
          <div key={c.id} className="pointer-events-auto w-full max-w-[640px]">
            <GraphPanel nodeId={c.nodeId} title={c.title} />
          </div>
        ) : (
          <Card key={c.id} card={c} fresh={i === 0} />
        ),
      )}
    </div>
  );
}
