import React, { useState } from 'react';
import { Copy, Check, Sparkles } from 'lucide-react';

const MAX_DIFF_CELLS = 1000000;
const MAX_DIFF_EDIT_DISTANCE = 1200;

function tokenize(text) {
  return text.match(/\s+|[^\s]+/g) || [];
}

function findUniqueAnchors(original, revised) {
  const countPositions = (tokens) => {
    const positions = new Map();
    tokens.forEach((token, index) => {
      const current = positions.get(token);
      positions.set(token, current === undefined ? index : null);
    });
    return positions;
  };
  const originalPositions = countPositions(original);
  const revisedPositions = countPositions(revised);
  const candidates = [];

  originalPositions.forEach((originalIndex, token) => {
    const revisedIndex = revisedPositions.get(token);
    if (originalIndex !== null && revisedIndex !== null && revisedIndex !== undefined) {
      candidates.push({ originalIndex, revisedIndex });
    }
  });
  candidates.sort((left, right) => left.originalIndex - right.originalIndex);

  const tails = [];
  const tailCandidateIndices = [];
  const previousCandidates = new Array(candidates.length).fill(-1);
  candidates.forEach((candidate, candidateIndex) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (tails[middle] < candidate.revisedIndex) low = middle + 1;
      else high = middle;
    }
    if (low > 0) {
      previousCandidates[candidateIndex] = tailCandidateIndices[low - 1];
    }
    tails[low] = candidate.revisedIndex;
    tailCandidateIndices[low] = candidateIndex;
  });

  if (tailCandidateIndices.length === 0) return [];
  const anchors = [];
  let candidateIndex = tailCandidateIndices[tailCandidateIndices.length - 1];
  while (candidateIndex !== undefined && candidateIndex >= 0) {
    anchors.push(candidates[candidateIndex]);
    candidateIndex = previousCandidates[candidateIndex];
  }
  return anchors.reverse();
}

function buildMyersOperations(original, revised) {
  const trace = [];
  let frontier = new Map([[1, 0]]);
  const maxDistance = Math.min(
    original.length + revised.length,
    MAX_DIFF_EDIT_DISTANCE,
  );

  for (let distance = 0; distance <= maxDistance; distance += 1) {
    trace.push(new Map(frontier));
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const down = frontier.get(diagonal + 1);
      const right = frontier.get(diagonal - 1);
      let originalIndex;
      if (
        diagonal === -distance
        || (
          diagonal !== distance
          && (right ?? -1) < (down ?? -1)
        )
      ) {
        originalIndex = down ?? 0;
      } else {
        originalIndex = (right ?? 0) + 1;
      }

      let revisedIndex = originalIndex - diagonal;
      while (
        originalIndex < original.length
        && revisedIndex < revised.length
        && original[originalIndex] === revised[revisedIndex]
      ) {
        originalIndex += 1;
        revisedIndex += 1;
      }
      frontier.set(diagonal, originalIndex);

      if (originalIndex >= original.length && revisedIndex >= revised.length) {
        const reversed = [];
        let x = original.length;
        let y = revised.length;
        for (let step = trace.length - 1; step >= 0; step -= 1) {
          const previousFrontier = trace[step];
          const previousDiagonal = x - y;
          const previousRight = previousFrontier.get(previousDiagonal + 1);
          const previousLeft = previousFrontier.get(previousDiagonal - 1);
          const nextDiagonal = (
            previousDiagonal === -step
            || (
              previousDiagonal !== step
              && (previousLeft ?? -1) < (previousRight ?? -1)
            )
          )
            ? previousDiagonal + 1
            : previousDiagonal - 1;
          const previousX = previousFrontier.get(nextDiagonal) ?? 0;
          const previousY = previousX - nextDiagonal;

          while (x > previousX && y > previousY) {
            reversed.push({ type: 'equal', text: original[x - 1] });
            x -= 1;
            y -= 1;
          }
          if (step === 0) break;
          if (x === previousX) {
            y -= 1;
            reversed.push({ type: 'added', text: revised[y] });
          } else {
            x -= 1;
            reversed.push({ type: 'removed', text: original[x] });
          }
        }
        return reversed.reverse();
      }
    }
  }
  return null;
}

function buildDiff(originalText, revisedText, depth = 0) {
  if (originalText === revisedText) return [];

  const original = tokenize(originalText);
  const revised = tokenize(revisedText);
  let operations;
  if (original.length * revised.length <= MAX_DIFF_CELLS) {
    const lengths = Array.from(
      { length: original.length + 1 },
      () => new Uint32Array(revised.length + 1),
    );
    for (let originalIndex = original.length - 1; originalIndex >= 0; originalIndex -= 1) {
      for (let revisedIndex = revised.length - 1; revisedIndex >= 0; revisedIndex -= 1) {
        lengths[originalIndex][revisedIndex] = original[originalIndex] === revised[revisedIndex]
          ? lengths[originalIndex + 1][revisedIndex + 1] + 1
          : Math.max(
            lengths[originalIndex + 1][revisedIndex],
            lengths[originalIndex][revisedIndex + 1],
          );
      }
    }

    operations = [];
    let originalIndex = 0;
    let revisedIndex = 0;
    while (originalIndex < original.length || revisedIndex < revised.length) {
      if (
        originalIndex < original.length
        && revisedIndex < revised.length
        && original[originalIndex] === revised[revisedIndex]
      ) {
        operations.push({ type: 'equal', text: original[originalIndex] });
        originalIndex += 1;
        revisedIndex += 1;
      } else if (
        originalIndex < original.length
        && (
          revisedIndex >= revised.length
          || lengths[originalIndex + 1][revisedIndex]
            >= lengths[originalIndex][revisedIndex + 1]
        )
      ) {
        operations.push({ type: 'removed', text: original[originalIndex] });
        originalIndex += 1;
      } else {
        operations.push({ type: 'added', text: revised[revisedIndex] });
        revisedIndex += 1;
      }
    }
  } else {
    operations = buildMyersOperations(original, revised);
    if (!operations) {
      if (depth < 8) {
        const anchors = findUniqueAnchors(original, revised);
        if (anchors.length > 0) {
          const anchoredSegments = [];
          let originalStart = 0;
          let revisedStart = 0;
          anchors.forEach(({ originalIndex, revisedIndex }) => {
            const originalGap = original.slice(originalStart, originalIndex).join('');
            const revisedGap = revised.slice(revisedStart, revisedIndex).join('');
            if (originalGap === revisedGap) {
              if (originalGap) anchoredSegments.push({ type: 'equal', text: originalGap });
            } else {
              anchoredSegments.push(
                ...buildDiff(originalGap, revisedGap, depth + 1),
              );
            }
            anchoredSegments.push({
              type: 'equal',
              text: original[originalIndex],
            });
            originalStart = originalIndex + 1;
            revisedStart = revisedIndex + 1;
          });
          const originalTail = original.slice(originalStart).join('');
          const revisedTail = revised.slice(revisedStart).join('');
          if (originalTail === revisedTail) {
            if (originalTail) anchoredSegments.push({ type: 'equal', text: originalTail });
          } else {
            anchoredSegments.push(
              ...buildDiff(originalTail, revisedTail, depth + 1),
            );
          }
          return anchoredSegments;
        }
      }
      return [
        { type: 'removed', text: originalText },
        { type: 'added', text: revisedText },
      ];
    }
  }

  const segments = [];
  let removed = '';
  let added = '';
  const flushChanges = () => {
    if (removed && added) {
      segments.push({ type: 'modified', before: removed, after: added });
    } else if (removed) {
      segments.push({ type: 'removed', text: removed });
    } else if (added) {
      segments.push({ type: 'added', text: added });
    }
    removed = '';
    added = '';
  };

  operations.forEach((operation) => {
    if (operation.type === 'equal') {
      flushChanges();
      segments.push(operation);
    } else if (operation.type === 'removed') {
      removed += operation.text;
    } else {
      added += operation.text;
    }
  });
  flushChanges();
  return segments;
}

function renderSide(segments, side) {
  return segments.map((segment, index) => {
    if (segment.type === 'equal') {
      return <span key={index}>{segment.text}</span>;
    }
    if (segment.type === 'modified') {
      const isBefore = side === 'before';
      return (
        <mark
          key={index}
          data-diff-kind="modified"
          data-diff-side={side}
          data-diff-highlight={isBefore ? 'removed' : 'added'}
          title={side === 'before' ? 'Modified text before' : 'Modified text after'}
          className={isBefore
            ? 'rounded bg-rose-200 px-0.5 text-rose-950 line-through'
            : 'rounded bg-emerald-200 px-0.5 text-emerald-950'}
        >
          {side === 'before' ? segment.before : segment.after}
        </mark>
      );
    }
    if ((side === 'before' && segment.type === 'removed')
      || (side === 'after' && segment.type === 'added')) {
      const isAdded = segment.type === 'added';
      return (
        <mark
          key={index}
          data-diff-kind={segment.type}
          data-diff-side={side}
          data-diff-highlight={segment.type}
          title={isAdded ? 'Added text' : 'Removed text'}
          className={isAdded
            ? 'rounded bg-emerald-200 px-0.5 text-emerald-950'
            : 'rounded bg-rose-200 px-0.5 text-rose-950 line-through'}
        >
          {segment.text}
        </mark>
      );
    }
    return null;
  });
}

function UnifiedDiff({ segments }) {
  return segments.map((segment, index) => {
    if (segment.type === 'equal') {
      return <span key={index}>{segment.text}</span>;
    }
    if (segment.type === 'modified') {
      return (
        <React.Fragment key={index}>
          <div
            data-diff-kind="modified"
            data-diff-side="before"
            data-diff-highlight="removed"
            className="bg-rose-50 px-2 text-rose-900"
          >
            <span className="mr-2 font-bold">−</span>{segment.before}
          </div>
          <div
            data-diff-kind="modified"
            data-diff-side="after"
            data-diff-highlight="added"
            className="bg-emerald-50 px-2 text-emerald-900"
          >
            <span className="mr-2 font-bold">+</span>{segment.after}
          </div>
        </React.Fragment>
      );
    }
    const isAdded = segment.type === 'added';
    return (
      <div
        key={index}
        data-diff-kind={segment.type}
        data-diff-side={isAdded ? 'after' : 'before'}
        data-diff-highlight={isAdded ? 'added' : 'removed'}
        className={isAdded
          ? 'bg-emerald-50 px-2 text-emerald-900'
          : 'bg-rose-50 px-2 text-rose-900'}
      >
        <span className="mr-2 font-bold">{isAdded ? '+' : '−'}</span>{segment.text}
      </div>
    );
  });
}

export default function DiffViewer({
  originalText,
  correctedText,
  onApplyAll,
  complianceApproved = false,
  heading = 'Brand Revision',
  originalLabel = 'Original Copy',
  correctedLabel = 'Brand-Aligned Version',
  showComplianceStatus = true,
  allowEmptyText = false,
}) {
  const [viewMode, setViewMode] = useState('split');
  const [copied, setCopied] = useState(false);
  const beforeText = typeof originalText === 'string' ? originalText : '';
  const afterText = typeof correctedText === 'string' ? correctedText : '';
  const hasTextPair = typeof originalText === 'string'
    && typeof correctedText === 'string';
  const isIdentical = beforeText === afterText;
  const computedSegments = !hasTextPair || isIdentical
    ? []
    : buildDiff(beforeText, afterText);
  const segments = hasTextPair
    && !isIdentical
    && !computedSegments.some((segment) => segment.type !== 'equal')
    ? [
      { type: 'removed', text: beforeText },
      { type: 'added', text: afterText },
    ]
    : computedSegments;
  const handleCopy = () => {
    if (!afterText) return;
    navigator.clipboard.writeText(afterText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!allowEmptyText && (
    typeof correctedText !== 'string'
    || correctedText.length === 0
  )) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs">
        No corrected revision generated yet. Run analysis to view brand-aligned copy.
      </div>
    );
  }

  if (!hasTextPair) {
    return (
      <div role="status" className="p-8 text-center text-slate-500 text-xs">
        Comparison data is unavailable for these versions.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            {heading}
          </span>
          <div className="flex items-center bg-slate-200/80 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'split' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setViewMode('inline')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'inline' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unified
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-xs"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          {onApplyAll && !isIdentical && (
            <button
              onClick={onApplyAll}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
            >
              <Check className="w-3 h-3" />
              <span>Adopt All</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 pt-3 text-[10px] text-slate-600">
        <span><span className="inline-block w-2 h-2 rounded-sm bg-rose-300 mr-1" />Removed</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-emerald-300 mr-1" />Added</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-amber-300 mr-1" />Modified</span>
      </div>

      <div className="p-4 flex-1 overflow-y-auto text-xs sm:text-sm leading-relaxed">
        {isIdentical ? (
          <div role="status" className="p-6 text-center text-slate-500 text-xs">
            These versions contain identical text.
          </div>
        ) : viewMode === 'split' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            <div className="flex flex-col bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2 pb-2 border-b border-slate-200">
                <span>{originalLabel}</span>
                <span className="text-[10px] text-slate-400 uppercase font-medium">Before</span>
              </div>
              <div
                data-diff-text-side="before"
                className="text-slate-700 whitespace-pre-wrap leading-relaxed font-sans"
              >
                {renderSide(segments, 'before')}
              </div>
            </div>

            <div className="flex flex-col bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2 pb-2 border-b border-slate-200">
                <span>{correctedLabel}</span>
                {showComplianceStatus && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    complianceApproved
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {complianceApproved ? 'Compliance Approved' : 'Needs Review'}
                  </span>
                )}
              </div>
              <div
                data-diff-text-side="after"
                className="text-slate-800 whitespace-pre-wrap leading-relaxed font-sans font-medium"
              >
                {renderSide(segments, 'after')}
              </div>
            </div>
          </div>
        ) : (
          <div
            data-diff-mode="unified"
            className="whitespace-pre-wrap font-mono text-xs leading-relaxed"
          >
            <UnifiedDiff segments={segments} />
          </div>
        )}
      </div>
    </div>
  );
}
