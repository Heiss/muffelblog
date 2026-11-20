import { expect, test } from '@playwright/test';

// The fixture post /p/rendering-demo/ ends with an open comment (with a reply),
// a resolved comment and a footnote.
const PAGE = '/p/rendering-demo/';

test.describe('Notes in the margin, wide screen', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('comments and footnotes stand to the right of their paragraph, at its height', async ({
    page,
  }) => {
    await page.goto(PAGE);
    const annotated = page.locator('.annotated').first();
    await expect(annotated).toBeVisible();
    const paragraph = (await annotated.locator(':scope > p').boundingBox())!;
    const notes = annotated.locator('aside.margin-note');
    await expect(notes).toHaveCount(2);
    const comment = (await notes.nth(0).boundingBox())!;
    const footnote = (await notes.nth(1).boundingBox())!;
    // Next to the text, not below it.
    expect(comment.x).toBeGreaterThan(paragraph.x + paragraph.width);
    expect(Math.abs(comment.y - paragraph.y)).toBeLessThan(30);
    // The notes of a paragraph are stacked, in the order of the text.
    expect(footnote.y).toBeGreaterThan(comment.y + comment.height - 1);
    expect(footnote.x).toBeCloseTo(comment.x, 0);
    // They are inside the window: the page does not scroll sideways.
    expect(comment.x + comment.width).toBeLessThanOrEqual(1440);
    const sideways = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(sideways).toBe(false);
  });

  test('shows the thread of an open comment and marks the passage; a resolved comment leaves nothing', async ({
    page,
  }) => {
    await page.goto(PAGE);
    const comment = page.locator('aside.margin-comment');
    await expect(comment).toContainText('peter');
    await expect(comment.locator('strong').nth(1)).toHaveText('offener');
    await expect(comment.locator('.mn-reply')).toContainText('sam');
    await expect(comment.locator('.mn-reply')).toContainText(
      'Und eine Antwort darauf.',
    );
    await expect(page.locator('mark.doc-comment')).toHaveText(
      'einem Kommentar in der Randspalte',
    );
    // Resolved: the text stays, the comment and its thread do not appear anywhere.
    await expect(
      page.getByText('gelöster Kommentar bleibt unsichtbar.'),
    ).toBeVisible();
    const source = await page.content();
    expect(source).not.toContain('erledigt und geheim');
    expect(source).not.toContain('<!--co:');
    expect(source).not.toContain('<!--c:');
  });

  test('the footnote is also in the margin, the list at the end stays and its links work', async ({
    page,
  }) => {
    await page.goto(PAGE);
    const note = page.locator('aside.margin-footnote');
    await expect(note).toContainText('Text der Fußnote für die Randspalte.');
    await expect(note.locator('.mn-number')).toHaveText('1');
    const list = page.locator('section[data-footnotes] li');
    await expect(list).toContainText('Text der Fußnote für die Randspalte.');
    // The jump from the reference to the list and back finds its target.
    const ref = page.locator('a[data-footnote-ref]');
    const target = (await ref.getAttribute('href'))!.slice(1);
    await expect(page.locator(`[id="${target}"]`)).toHaveCount(1);
    const back = page.locator('a[data-footnote-backref]');
    const backTarget = (await back.getAttribute('href'))!.slice(1);
    await expect(page.locator(`[id="${backTarget}"]`)).toHaveCount(1);
  });

  test('the label of a note is hidden next to the text, and the notes are open', async ({
    page,
  }) => {
    await page.goto(PAGE);
    const details = page.locator('aside.margin-note > details');
    await expect(details.first().locator('summary')).toBeHidden();
    for (const d of await details.all())
      await expect(d).toHaveAttribute('open', '');
  });
});

test.describe('Notes in the margin, narrow screen', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('the notes stand below their paragraph, closed, and open with a click', async ({
    page,
  }) => {
    await page.goto(PAGE);
    const annotated = page.locator('.annotated').first();
    const paragraph = (await annotated.locator(':scope > p').boundingBox())!;
    const notes = annotated.locator('aside.margin-note');
    const first = notes.nth(0);
    const box = (await first.boundingBox())!;
    expect(box.y).toBeGreaterThan(paragraph.y + paragraph.height - 1);
    await expect(first.locator('details')).not.toHaveAttribute('open', '');
    const summary = first.locator('summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('Comment by peter');
    await expect(first.locator('.mn-message')).toBeHidden();
    await summary.click();
    await expect(first.locator('.mn-message')).toBeVisible();
    const sideways = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(sideways).toBe(false);
  });
});

test('without JavaScript the notes are there, open, below the paragraph', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 800 },
  });
  const page = await context.newPage();
  await page.goto(PAGE);
  await expect(page.locator('aside.margin-comment .mn-message')).toBeVisible();
  await expect(page.locator('aside.margin-footnote')).toBeVisible();
  await context.close();
});

test('a memo in the feed shows no notes', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).not.toContain('margin-note');
});
