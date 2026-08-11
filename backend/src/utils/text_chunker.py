"""
Text chunking for the RAG ingestion pipeline.

Pure functions — no network, no database, no LLM. Everything here is
deterministic and testable in isolation.

Strategy: split at the largest semantic boundary that works.
    1. If the whole text fits, don't split at all.
    2. Split on paragraphs (the author's own boundaries).
    3. If a paragraph is still too long, pack sentences up to target size.
    4. Only hard-cut when a single "sentence" has no punctuation to split on
       (tables, code blocks, OCR noise).

No overlap between chunks. Neighbour context is recovered at retrieval time
by walking chunk_index, which is cheaper than duplicating text in the index.
"""

from __future__ import annotations

import re

from src.config import CONFIG


# --------------------------------------------------------------------------
# Regexes (patterns live in config.yaml under `regex`)
# --------------------------------------------------------------------------

_REGEX = CONFIG.get("regex", {})

# Sentence boundary: terminal punctuation, whitespace, then a capital or digit.
# The lookahead avoids splitting on "Dr. Smith", "v1.2", "etc. and so on".
_SENTENCE_END = re.compile(_REGEX["SENTENCE_END"])

# A hyphen at end of line means a word was broken across the line wrap.
_HYPHEN_WRAP = re.compile(_REGEX["HYPHEN_WRAP"])

# A single newline that is NOT a paragraph break and NOT before a list marker
# is a visual line wrap from the PDF extractor, not a real break.
_SOFT_WRAP = re.compile(_REGEX["SOFT_WRAP"])

_MULTI_SPACE = re.compile(_REGEX["MULTI_SPACE"])
_MULTI_NEWLINE = re.compile(_REGEX["MULTI_NEWLINE"])
_PARAGRAPH = re.compile(_REGEX["PARAGRAPH"])


class TextChunker:
    """
    Splits document text into retrieval-sized chunks.

    Args:
        target: preferred chunk size in characters. Sentences are packed
            up to this before starting a new chunk.
        hard_max: nothing is emitted longer than this. Text with no
            sentence boundaries gets cut here.
        min_size: chunks shorter than this are merged into a neighbour.
            Stops stray headings like "3. Results" becoming their own chunk.
    """

    def __init__(
        self,
        target: int = 700,
        hard_max: int = 1000,
        min_size: int = 100,
    ) -> None:
        if not 0 < min_size < target <= hard_max:
            raise ValueError(
                f"expected 0 < min_size < target <= hard_max, "
                f"got {min_size}, {target}, {hard_max}"
            )
        self.target = target
        self.hard_max = hard_max
        self.min_size = min_size

    def chunk(self, text: str) -> list[str]:
        """Normalize and split text into chunks. Entry point."""
        text = self.normalize(text)
        if not text:
            return []
        if len(text) <= self.hard_max:
            return [text]

        pieces: list[str] = []
        for para in self._split_paragraphs(text):
            if len(para) <= self.hard_max:
                pieces.append(para)
            else:
                pieces.extend(self._split_sentences(para))

        return self._merge_small(pieces)

    def normalize(self, text: str) -> str:
        """
        Repair PDF extraction artefacts.

        pymupdf inserts a newline at every *visual* line break, not at
        sentence ends. Without this step the sentence splitter never fires
        and chunks come out shredded.
        """
        if not text:
            return ""

        text = _HYPHEN_WRAP.sub(r"\1\2", text)   # re-join hyphenated words
        text = _SOFT_WRAP.sub(" ", text)         # join wrapped lines
        text = _MULTI_SPACE.sub(" ", text)       # collapse runs of spaces
        text = _MULTI_NEWLINE.sub("\n\n", text)  # collapse blank-line runs

        return text.strip()

    # --------------------------------------------------------------- private

    def _split_paragraphs(self, text: str) -> list[str]:
        return [p.strip() for p in _PARAGRAPH.split(text) if p.strip()]

    def _split_sentences(self, text: str) -> list[str]:
        """Pack sentences into chunks up to `target`."""
        chunks: list[str] = []
        buf = ""

        for sentence in _SENTENCE_END.split(text):
            sentence = sentence.strip()
            if not sentence:
                continue

            # A single sentence longer than hard_max has no usable boundary.
            if len(sentence) > self.hard_max:
                if buf:
                    chunks.append(buf)
                    buf = ""
                chunks.extend(self._hard_split(sentence))
                continue

            candidate = f"{buf} {sentence}".strip() if buf else sentence
            if len(candidate) <= self.target:
                buf = candidate
            else:
                if buf:
                    chunks.append(buf)
                buf = sentence

        if buf:
            chunks.append(buf)
        return chunks

    def _hard_split(self, text: str) -> list[str]:
        """
        Last resort for text with no sentence boundaries.
        Break on whitespace where possible so words stay intact.
        """
        chunks: list[str] = []
        remaining = text

        while len(remaining) > self.hard_max:
            window = remaining[: self.hard_max]
            cut = window.rfind(" ")
            if cut < self.target // 2:   # no sensible space — cut mid-word
                cut = self.hard_max
            chunks.append(remaining[:cut].strip())
            remaining = remaining[cut:].strip()

        if remaining:
            chunks.append(remaining)
        return chunks

    def _merge_small(self, chunks: list[str]) -> list[str]:
        """
        Fold undersized chunks into a neighbour.

        Prefers merging forward (a short heading belongs with the text that
        follows it) and falls back to merging backward at the end of a list.
        """
        if not chunks:
            return []

        merged: list[str] = []
        i = 0

        while i < len(chunks):
            current = chunks[i]

            if len(current) >= self.min_size:
                merged.append(current)
                i += 1
                continue

            # too short — try merging forward
            if i + 1 < len(chunks):
                combined = f"{current}\n{chunks[i + 1]}"
                if len(combined) <= self.hard_max:
                    chunks[i + 1] = combined
                    i += 1
                    continue

            # try merging backward
            if merged:
                combined = f"{merged[-1]}\n{current}"
                if len(combined) <= self.hard_max:
                    merged[-1] = combined
                    i += 1
                    continue

            # nowhere to put it — keep it as-is
            merged.append(current)
            i += 1

        return merged
