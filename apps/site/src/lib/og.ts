import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import satori from 'satori';
import sharp from 'sharp';

/** Size of a social preview image (Open Graph). */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export interface OgCard {
  siteName: string;
  /** "Post", "Memo", "Term" in the language of the build. */
  kindLabel: string;
  title: string;
  /** Formatted date, already in the language of the build. */
  date: string;
  excerpt?: string;
}

// Solarized Light, the default theme of the site.
const COLORS = {
  background: '#fdf6e3',
  text: '#073642',
  muted: '#586e75',
  accent: '#268bd2',
};

/** Shortens a text at a word boundary, with an ellipsis. */
export function shorten(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Path of the preview image of a page, for example `/og/p/hello.png`. */
export function ogImagePath(pageUrl: string): string | undefined {
  const m = pageUrl.match(/^\/([pmg])\/([^/]+)\/$/);
  return m ? `/og/${m[1]}/${m[2]}.png` : undefined;
}

const require = createRequire(import.meta.url);
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700 }[]>;

function loadFonts() {
  const file = (weight: number) =>
    require.resolve(
      `@fontsource/source-sans-3/files/source-sans-3-latin-${weight}-normal.woff`,
    );
  fonts ??= Promise.all(
    ([400, 700] as const).map(async (weight) => ({
      name: 'Source Sans 3',
      data: await readFile(file(weight)),
      weight,
    })),
  );
  return fonts;
}

type Node = { type: string; props: Record<string, unknown> };
const el = (
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
): Node => ({ type, props: { style, children } });

/** Renders the card as a PNG of 1200 x 630 pixels. */
export async function renderOgCard(card: OgCard): Promise<Buffer> {
  const title = shorten(card.title, 110);
  const excerpt = card.excerpt ? shorten(card.excerpt, 160) : '';
  const content = el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      // Without box-sizing in satori: the size here excludes the padding.
      width: OG_WIDTH - 24 - 2 * 72,
      height: OG_HEIGHT - 2 * 56,
      margin: '56px 72px',
    },
    [
      el(
        'div',
        {
          display: 'flex',
          fontSize: 30,
          color: COLORS.accent,
          fontWeight: 700,
        },
        card.kindLabel,
      ),
      el('div', { display: 'flex', flexDirection: 'column' }, [
        el(
          'div',
          {
            display: 'flex',
            fontSize: title.length > 60 ? 54 : 68,
            fontWeight: 700,
            lineHeight: 1.15,
          },
          title,
        ),
        ...(excerpt
          ? [
              el(
                'div',
                {
                  display: 'flex',
                  marginTop: 24,
                  fontSize: 30,
                  color: COLORS.muted,
                  lineHeight: 1.35,
                },
                excerpt,
              ),
            ]
          : []),
      ]),
      el(
        'div',
        {
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 28,
          color: COLORS.muted,
        },
        [
          el(
            'div',
            { display: 'flex', fontWeight: 700, color: COLORS.text },
            card.siteName,
          ),
          el('div', { display: 'flex' }, card.date),
        ],
      ),
    ],
  );
  const tree = el(
    'div',
    {
      display: 'flex',
      width: OG_WIDTH,
      height: OG_HEIGHT,
      backgroundColor: COLORS.background,
      fontFamily: 'Source Sans 3',
      color: COLORS.text,
    },
    [
      el('div', {
        display: 'flex',
        width: 24,
        height: OG_HEIGHT,
        backgroundColor: COLORS.accent,
      }),
      content,
    ],
  );
  const svg = await satori(tree as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: await loadFonts(),
  });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
