import { useState, useMemo } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

/**
 * Format inline markdown text:
 * - Bold: **text**
 * - Italic: *text* or _text_
 * - Inline code: `code`
 * - Links: [title](url)
 * - RAG Citations: [S1], [S2], [S10] -> clickable citation badges
 */
function formatInlineText(text, onCitationClick) {
  if (!text) return null;

  // Tokenize string for citations [S1], [S2] and links [title](url) and code `code`
  // We can do this with regex matching and React element array
  const tokens = [];
  // Regex to match:
  // 1. Citation: \[S(\d+)\]
  // 2. Markdown Link: \[(.*?)\]\(((?:https?:\/\/|\/)[^\s)]+)\)
  // 3. Inline Code: `([^`]+)`
  // 4. Bold: \*\*(.*?)\*\*
  // 5. Italic: \*(.*?)\*
  const combinedRegex = /(\[S\d+\])|(\[(.*?)\]\(((?:https?:\/\/|\/)[^\s)]+)\))|(`[^`]+`)|(\*\*.*?\*\*)|(\*[^*]+\*)/g;

  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = combinedRegex.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index));
    }

    const matchedStr = match[0];

    // Case 1: Citation [S1], [S2]
    if (match[1]) {
      const sourceId = matchedStr.slice(1, -1); // e.g. "S1"
      tokens.push(
        <button
          key={`cit-${keyIndex++}`}
          type="button"
          className="citation-pill"
          onClick={() => onCitationClick?.(sourceId)}
          title={`Xem chi tiết căn cứ văn bản ${sourceId}`}
          aria-label={`Xem nguồn ${sourceId}`}
        >
          {sourceId}
        </button>
      );
    }
    // Case 2: Markdown Link [title](url)
    else if (match[2]) {
      const linkTitle = match[3];
      const linkUrl = match[4];
      tokens.push(
        <a
          key={`link-${keyIndex++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="msg-inline-link"
          title={`Mở liên kết: ${linkUrl}`}
        >
          <span>{linkTitle}</span>
          <ExternalLink size={11} className="inline-link-icon" />
        </a>
      );
    }
    // Case 3: Inline code `code`
    else if (match[5]) {
      const codeContent = matchedStr.slice(1, -1);
      tokens.push(
        <code key={`code-${keyIndex++}`} className="inline-code">
          {codeContent}
        </code>
      );
    }
    // Case 4: Bold **text**
    else if (match[6]) {
      const boldText = matchedStr.slice(2, -2);
      tokens.push(
        <strong key={`bold-${keyIndex++}`}>
          {formatInlineText(boldText, onCitationClick)}
        </strong>
      );
    }
    // Case 5: Italic *text*
    else if (match[7]) {
      const italicText = matchedStr.slice(1, -1);
      tokens.push(
        <em key={`italic-${keyIndex++}`}>
          {formatInlineText(italicText, onCitationClick)}
        </em>
      );
    }

    lastIndex = match.index + matchedStr.length;
  }

  // Push remaining trailing text
  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex));
  }

  return tokens.length > 0 ? tokens : text;
}

/**
 * Code Block with Copy Button
 */
function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span className="code-block-lang">{language || 'text'}</span>
        <button
          type="button"
          className="code-copy-btn"
          onClick={handleCopy}
          title="Sao chép toàn bộ mã"
          aria-label="Copy code"
        >
          {copied ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
          <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
        </button>
      </div>
      <pre className="code-block-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Markdown Table Renderer
 */
function MarkdownTable({ rows, onCitationClick }) {
  if (!rows || rows.length < 2) return null;

  // First row is header
  const headerCells = rows[0]
    .split('|')
    .map((c) => c.trim())
    .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

  // Rows after delimiter
  const dataRows = rows.slice(2).map((r) =>
    r
      .split('|')
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
  );

  return (
    <div className="markdown-table-wrapper">
      <table className="markdown-table">
        <thead>
          <tr>
            {headerCells.map((th, i) => (
              <th key={i}>{formatInlineText(th, onCitationClick)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td key={cIdx}>{formatInlineText(cell, onCitationClick)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Complete MarkdownRenderer Component
 */
export function MarkdownRenderer({ content, onCitationClick }) {
  const parsedElements = useMemo(() => {
    if (!content) return null;

    const lines = content.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // 1. Code blocks: ```
      if (line.trim().startsWith('```')) {
        const lang = line.trim().slice(3).trim();
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        elements.push(
          <CodeBlock
            key={`code-block-${elements.length}`}
            code={codeLines.join('\n')}
            language={lang}
          />
        );
        i++;
        continue;
      }

      // 2. Tables: Lines starting with '|' and followed by '| --- |'
      if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
        const tableLines = [line, lines[i + 1]];
        i += 2;
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        elements.push(
          <MarkdownTable
            key={`table-${elements.length}`}
            rows={tableLines}
            onCitationClick={onCitationClick}
          />
        );
        continue;
      }

      // 3. Blockquotes: > Quote text
      if (line.trim().startsWith('>')) {
        const quoteLines = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        elements.push(
          <blockquote key={`quote-${elements.length}`} className="markdown-blockquote">
            {quoteLines.map((ql, qIdx) => (
              <p key={qIdx}>{formatInlineText(ql, onCitationClick)}</p>
            ))}
          </blockquote>
        );
        continue;
      }

      // 4. Headings: ### or ####
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={`h3-${elements.length}`} className="msg-h3">
            {formatInlineText(line.slice(4), onCitationClick)}
          </h4>
        );
        i++;
        continue;
      }
      if (line.startsWith('#### ')) {
        elements.push(
          <h5 key={`h4-${elements.length}`} className="msg-h4">
            {formatInlineText(line.slice(5), onCitationClick)}
          </h5>
        );
        i++;
        continue;
      }

      // 5. Unordered List Items: - or *
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const listItems = [];
        while (
          i < lines.length &&
          (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
        ) {
          listItems.push(lines[i].trim().slice(2));
          i++;
        }
        elements.push(
          <ul key={`ul-${elements.length}`} className="msg-unordered-list">
            {listItems.map((item, idx) => (
              <li key={idx} className="msg-list-item">
                {formatInlineText(item, onCitationClick)}
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // 6. Ordered List Items: 1. 2.
      const orderedMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
      if (orderedMatch) {
        const orderedItems = [];
        while (i < lines.length) {
          const matchNum = lines[i].trim().match(/^(\d+)\.\s+(.*)/);
          if (!matchNum) break;
          orderedItems.push({ num: matchNum[1], text: matchNum[2] });
          i++;
        }
        elements.push(
          <div key={`ol-${elements.length}`} className="msg-ordered-list">
            {orderedItems.map((item, idx) => (
              <div key={idx} className="msg-numbered-item">
                <span className="msg-num-badge">{item.num}.</span>
                <span className="msg-numbered-text">
                  {formatInlineText(item.text, onCitationClick)}
                </span>
              </div>
            ))}
          </div>
        );
        continue;
      }

      // 7. Empty line spacer
      if (!line.trim()) {
        elements.push(<div key={`spacer-${elements.length}`} className="line-break" />);
        i++;
        continue;
      }

      // 8. Regular paragraph
      elements.push(
        <p key={`p-${elements.length}`} className="msg-paragraph">
          {formatInlineText(line, onCitationClick)}
        </p>
      );
      i++;
    }

    return elements;
  }, [content, onCitationClick]);

  return <div className="markdown-rendered-content">{parsedElements}</div>;
}
