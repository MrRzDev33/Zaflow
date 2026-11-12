import React from 'react';

/**
 * Renderer ringan untuk balasan AI. Tujuannya menampilkan teks yang rapi tanpa
 * menampilkan simbol markdown mentah (###, **, *, dan sejenisnya).
 *
 * Semua konten dirender sebagai elemen React sehingga teks tetap ter-escape
 * dan aman dari HTML injection.
 */

type InlineToken = {
  type: 'text' | 'bold' | 'italic' | 'code';
  value: string;
};

const INLINE_PATTERN =
  /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/g;

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const parts = text.split(INLINE_PATTERN);

  for (const part of parts) {
    if (!part) continue;

    if (/^\*\*[^*\n]+\*\*$/.test(part) || /^__[^_\n]+__$/.test(part)) {
      tokens.push({ type: 'bold', value: part.slice(2, -2) });
    } else if (/^\*[^*\n]+\*$/.test(part) || /^_[^_\n]+_$/.test(part)) {
      tokens.push({ type: 'italic', value: part.slice(1, -1) });
    } else if (/^`[^`\n]+`$/.test(part)) {
      tokens.push({ type: 'code', value: part.slice(1, -1) });
    } else {
      tokens.push({ type: 'text', value: part });
    }
  }

  return tokens;
}

function renderInline(text: string): React.ReactNode {
  return parseInline(text).map((token, index) => {
    switch (token.type) {
      case 'bold':
        return (
          <strong key={index} className="font-semibold text-slate-900">
            {token.value}
          </strong>
        );
      case 'italic':
        return (
          <em key={index} className="italic">
            {token.value}
          </em>
        );
      case 'code':
        return (
          <code
            key={index}
            className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[11px] text-slate-700"
          >
            {token.value}
          </code>
        );
      default:
        return <React.Fragment key={index}>{token.value}</React.Fragment>;
    }
  });
}

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; items: string[] }
  | { type: 'number'; items: string[] }
  | { type: 'divider' };

const HEADING_PATTERN = /^\s{0,3}#{1,6}\s+(.*)$/;
const BULLET_PATTERN = /^\s*[-*•–]\s+(.*)$/;
const NUMBER_PATTERN = /^\s*(\d+)[.)]\s+(.*)$/;
const DIVIDER_PATTERN = /^\s*([-*_])\1{2,}\s*$/;

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let bulletItems: string[] = [];
  let numberItems: string[] = [];
  let paragraphLines: string[] = [];

  const flushBullet = () => {
    if (bulletItems.length > 0) {
      blocks.push({ type: 'bullet', items: bulletItems });
      bulletItems = [];
    }
  };
  const flushNumber = () => {
    if (numberItems.length > 0) {
      blocks.push({ type: 'number', items: numberItems });
      numberItems = [];
    }
  };
  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
      paragraphLines = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushBullet();
    flushNumber();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flushAll();
      continue;
    }

    if (DIVIDER_PATTERN.test(line)) {
      flushAll();
      blocks.push({ type: 'divider' });
      continue;
    }

    const heading = HEADING_PATTERN.exec(line);
    if (heading) {
      flushAll();
      const text = heading[1].replace(/\s*#+\s*$/, '').trim();
      if (text) blocks.push({ type: 'heading', level: heading[0].trim().split(' ')[0].length, text });
      continue;
    }

    const bullet = BULLET_PATTERN.exec(line);
    if (bullet) {
      flushParagraph();
      flushNumber();
      bulletItems.push(bullet[1].trim());
      continue;
    }

    const numbered = NUMBER_PATTERN.exec(line);
    if (numbered) {
      flushParagraph();
      flushBullet();
      numberItems.push(numbered[2].trim());
      continue;
    }

    flushBullet();
    flushNumber();
    paragraphLines.push(line.trim());
  }

  flushAll();
  return blocks;
}

interface ChatMessageContentProps {
  content: string;
}

export const ChatMessageContent: React.FC<ChatMessageContentProps> = ({ content }) => {
  const blocks = React.useMemo(() => parseBlocks(content), [content]);

  return (
    <div className="space-y-1.5">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <p key={index} className="text-[12px] font-bold text-slate-900">
                {renderInline(block.text)}
              </p>
            );
          case 'bullet':
            return (
              <ul key={index} className="space-y-1">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-1.5">
                    <span className="mt-[3px] shrink-0 text-[10px] leading-none text-slate-400">•</span>
                    <span className="min-w-0">{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'number':
            return (
              <ol key={index} className="space-y-1">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-1.5">
                    <span className="shrink-0 font-semibold text-slate-500">{itemIndex + 1}.</span>
                    <span className="min-w-0">{renderInline(item)}</span>
                  </li>
                ))}
              </ol>
            );
          case 'divider':
            return <hr key={index} className="border-slate-200/80" />;
          default:
            return (
              <p key={index} className="whitespace-pre-wrap">
                {renderInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
};
