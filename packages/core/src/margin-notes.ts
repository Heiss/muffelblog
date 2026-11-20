import type { Comment, Element, ElementContent, Root, RootContent } from 'hast';

/**
 * Notes in the margin, next to the paragraph they belong to:
 * - comments of the Obsidian plugin "Document Comments", which stores them in
 *   the note as HTML comments (`<!--c:ID-->text<!--/c:ID-->` around the passage
 *   and a block `<!--co:ID by:.. at:.. status:open ...` with the thread). Every
 *   open comment is shown, resolved ones never;
 * - footnotes (the list at the end stays).
 * A paragraph with notes is wrapped in `div.annotated`; its notes are `aside`s
 * with a `details` (open; the page closes them on narrow screens, where they
 * stand below the paragraph). All HTML comments are removed from the page.
 */

export interface NoteMessage {
  author: string;
  at: string;
  text: string;
}

export interface DocComment {
  id: string;
  status: string;
  messages: NoteMessage[];
}

const START = /^c:([A-Za-z0-9_-]+)$/;
const END = /^\/c:([A-Za-z0-9_-]+)$/;
const BLOCK = /^co:([A-Za-z0-9_-]+)(?=[\s]|$)([^\n]*)\n?([\s\S]*)$/;
const MESSAGE = /^(\S[^\n]*?) \(([^)\n]*)\): ?(.*)$/;
const ZERO_WIDTH = '​';

/** One line of a thread: a new message, a continuation of the one before, or nothing (reaction, empty). */
function addLine(messages: NoteMessage[], line: string): void {
  // Reactions ("+👍 kyle") are no text.
  if (line.startsWith('+')) return;
  const message = MESSAGE.exec(line);
  if (message) {
    messages.push({
      author: message[1] ?? '',
      at: message[2] ?? '',
      text: message[3] ?? '',
    });
    return;
  }
  // A line without a name continues the message before it.
  const last = messages[messages.length - 1];
  if (last && line.trim() !== '') last.text += `\n${line}`;
}

/** The thread stored in a `<!--co:ID ...-->` comment, or null if it is another comment. */
export function parseDocumentComment(value: string): DocComment | null {
  const match = BLOCK.exec(value.trim());
  if (!match) return null;
  const [, id = '', header = '', rest = ''] = match;
  const messages: NoteMessage[] = [];
  for (const line of rest.split('\n')) addLine(messages, line);
  return {
    id,
    status: /\bstatus:(\w+)/.exec(header)?.[1] ?? 'open',
    messages,
  };
}

export interface MarginLabels {
  comment: (author: string) => string;
  footnote: (number: string) => string;
}

export interface MarginOptions {
  locale: string;
  labels: MarginLabels;
  /** Markdown of a comment to sanitized hast nodes. */
  render: (markdown: string) => Promise<ElementContent[]>;
}

type Note =
  | { kind: 'comment'; comment: DocComment }
  | { kind: 'footnote'; number: string; content: ElementContent[] };

const text = (value: string): ElementContent => ({ type: 'text', value });

function element(
  tagName: string,
  properties: Element['properties'],
  children: ElementContent[] = [],
): Element {
  return { type: 'element', tagName, properties, children };
}

function isComment(node: RootContent | ElementContent): node is Comment {
  return node.type === 'comment';
}

/** Every `co:` block in the tree, by id. */
function collectComments(node: Root | Element, into: Map<string, DocComment>) {
  for (const child of node.children as RootContent[]) {
    if (isComment(child)) {
      const found = parseDocumentComment(child.value);
      if (found) into.set(found.id, found);
    } else if (child.type === 'element') collectComments(child, into);
  }
}

function hasProperty(node: Element, name: string): boolean {
  return (
    node.properties?.[name] !== undefined && node.properties[name] !== false
  );
}

/** The footnote definitions (`li` by id) of the list at the end. */
function collectFootnotes(node: Root | Element, into: Map<string, Element>) {
  for (const child of node.children as RootContent[]) {
    if (child.type !== 'element') continue;
    if (child.tagName === 'li' && typeof child.properties?.id === 'string')
      into.set(child.properties.id, child);
    collectFootnotes(child, into);
  }
}

/** The text of a footnote without its way back, if it is only paragraphs (else null). */
function footnoteContent(li: Element): ElementContent[] | null {
  const content: ElementContent[] = [];
  for (const child of li.children) {
    if (child.type === 'text') continue;
    if (child.type !== 'element' || child.tagName !== 'p') return null;
    const inner = child.children.filter(
      (c) => !(c.type === 'element' && hasProperty(c, 'dataFootnoteBackref')),
    );
    // The space in front of the way back goes with it.
    const last = inner[inner.length - 1];
    if (last?.type === 'text')
      inner[inner.length - 1] = text(last.value.trimEnd());
    content.push({ ...child, children: inner });
  }
  return content;
}

interface Walk {
  comments: Map<string, DocComment>;
  footnotes: Map<string, Element>;
  /** The notes of every top level block, in the order of the text. */
  notes: Map<number, Note[]>;
}

const add = (walk: Walk, top: number, note: Note) =>
  walk.notes.set(top, [...(walk.notes.get(top) ?? []), note]);

function endOf(children: ElementContent[], from: number, id: string): number {
  return children.findIndex(
    (c, i) => i >= from && isComment(c) && END.exec(c.value.trim())?.[1] === id,
  );
}

/** Drops a zero width space that the plugin writes in front of a marker at the start of a line. */
function trimmed(out: ElementContent[]): void {
  const last = out[out.length - 1];
  if (last?.type !== 'text' || !last.value.endsWith(ZERO_WIDTH)) return;
  last.value = last.value.slice(0, -ZERO_WIDTH.length);
  if (last.value === '') out.pop();
}

/** The footnote reference of a `sup`, as note, if there is one. */
function footnoteNote(node: Element, walk: Walk): Note | null {
  if (node.tagName !== 'sup') return null;
  const link = node.children.find(
    (c): c is Element =>
      c.type === 'element' && hasProperty(c, 'dataFootnoteRef'),
  );
  const href =
    typeof link?.properties?.href === 'string' ? link.properties.href : '';
  const li = walk.footnotes.get(href.replace(/^#/, ''));
  const content = li ? footnoteContent(li) : null;
  if (!link || !content || content.length === 0) return null;
  const number = link.children
    .map((c) => (c.type === 'text' ? c.value : ''))
    .join('');
  return { kind: 'footnote', number, content };
}

/** Wraps the marked passages, removes all comments, collects the notes of the children. */
function visit(
  parent: Root | Element,
  top: number | undefined,
  walk: Walk,
): void {
  const children = parent.children as ElementContent[];
  const out: ElementContent[] = [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as ElementContent;
    if (!isComment(child)) {
      out.push(child);
      continue;
    }
    const id = START.exec(child.value.trim())?.[1];
    const end = id === undefined ? -1 : endOf(children, i + 1, id);
    if (id === undefined || end < 0) continue;
    trimmed(out);
    const inner = children.slice(i + 1, end);
    const comment = walk.comments.get(id);
    if (comment?.status === 'open') {
      out.push(element('mark', { className: ['doc-comment'] }, inner));
      add(walk, top ?? out.length - 1, { kind: 'comment', comment });
    } else out.push(...inner);
    i = end;
  }
  parent.children = out as never;
  out.forEach((child, index) => {
    if (child.type !== 'element') return;
    const note = footnoteNote(child, walk);
    const block = top ?? index;
    if (note) add(walk, block, note);
    visit(child, block, walk);
  });
}

function meta(author: string, at: string, locale: string): Element {
  const date = new Date(at);
  const when = Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        timeZone: 'Europe/Berlin',
      }).format(date);
  return element('p', { className: ['mn-meta'] }, [
    element('strong', {}, [text(author)]),
    ...(when ? [text(` · ${when}`)] : []),
  ]);
}

async function commentNote(
  comment: DocComment,
  options: MarginOptions,
): Promise<Element> {
  const first = comment.messages[0];
  const parts: ElementContent[] = [];
  for (const [index, message] of comment.messages.entries()) {
    parts.push(
      element('div', { className: [index === 0 ? 'mn-message' : 'mn-reply'] }, [
        meta(message.author, message.at, options.locale),
        ...(await options.render(message.text)),
      ]),
    );
  }
  const label = options.labels.comment(first?.author ?? '');
  return aside('margin-comment', label, parts);
}

function aside(kind: string, label: string, body: ElementContent[]): Element {
  return element('aside', { className: ['margin-note', kind], role: 'note' }, [
    element('details', { open: true }, [
      element('summary', {}, [text(label)]),
      ...body,
    ]),
  ]);
}

function footnoteNoteElement(
  note: Extract<Note, { kind: 'footnote' }>,
  options: MarginOptions,
): Element {
  // On a wide screen the label (summary) is hidden, so the number stands in the text.
  const [first, ...rest] = note.content;
  const body =
    first?.type === 'element'
      ? [
          {
            ...first,
            children: [
              element('strong', { className: ['mn-number'] }, [
                text(note.number),
              ]),
              text(' '),
              ...first.children,
            ],
          },
          ...rest,
        ]
      : note.content;
  return aside('margin-footnote', options.labels.footnote(note.number), body);
}

/** Turns comments and footnotes into notes next to their paragraphs; removes every HTML comment. */
export async function addMarginNotes(
  tree: Root,
  options: MarginOptions,
): Promise<void> {
  const walk: Walk = {
    comments: new Map(),
    footnotes: new Map(),
    notes: new Map(),
  };
  collectComments(tree, walk.comments);
  collectFootnotes(tree, walk.footnotes);
  visit(tree, undefined, walk);
  if (walk.notes.size === 0) return;
  const children = tree.children as RootContent[];
  const wrapped: RootContent[] = [];
  for (const [index, child] of children.entries()) {
    const notes = walk.notes.get(index);
    if (!notes || child.type !== 'element') {
      wrapped.push(child);
      continue;
    }
    const asides: Element[] = [];
    for (const note of notes)
      asides.push(
        note.kind === 'comment'
          ? await commentNote(note.comment, options)
          : footnoteNoteElement(note, options),
      );
    wrapped.push(
      element('div', { className: ['annotated'] }, [child, ...asides]),
    );
  }
  tree.children = wrapped as never;
}
