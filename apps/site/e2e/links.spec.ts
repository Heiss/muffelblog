import { expect, test } from '@playwright/test';
import { ui } from './helpers';

test.describe('Links between files (W20)', () => {
  test('a link to a file of the folder leads to its page', async ({ page }) => {
    await page.goto('/p/rendering-demo/');
    const link = page.locator('.content').getByRole('link', { name: 'Cache' });
    await expect(link).toHaveAttribute('href', '/g/cache/');
  });

  test('a link to a draft is text, and its name does not appear', async ({
    request,
  }) => {
    const html = await (await request.get('/p/rendering-demo/')).text();
    expect(html).toContain('Entwurf');
    expect(html).not.toContain('ohne-publish');
    const graph = await (await request.get('/graph.json')).text();
    expect(graph).not.toContain('ohne-publish');
    expect(graph).not.toContain('Ohne Publish');
  });

  test('the target lists the page that links to it (backlink)', async ({
    page,
  }) => {
    await page.goto('/g/cache/');
    const section = page.locator('section.links');
    await expect(
      section.getByRole('heading', { name: ui.graph.linkedFrom }),
    ).toBeVisible();
    await expect(
      section.getByRole('link', { name: 'Rendering-Demo' }),
    ).toHaveAttribute('href', '/p/rendering-demo/');
  });

  test('external links appear as one entry per domain, without a link', async ({
    page,
  }) => {
    await page.goto('/p/rendering-demo/');
    await expect(
      page.locator('section.links .link-domain', { hasText: 'example.org' }),
    ).toHaveCount(1);
  });
});

test.describe('Graph (W21)', () => {
  test('graph.json has pages and domains, and edges only between known nodes', async ({
    request,
  }) => {
    const graph = (await (await request.get('/graph.json')).json()) as {
      nodes: { id: string; kind: string }[];
      edges: { from: string; to: string }[];
    };
    const ids = new Set(graph.nodes.map((n) => n.id));
    expect(ids.has('/g/cache/')).toBe(true);
    expect(ids.has('domain:example.org')).toBe(true);
    for (const e of graph.edges) {
      expect(ids.has(e.from), e.from).toBe(true);
      expect(ids.has(e.to), e.to).toBe(true);
      expect(e.from).not.toBe(e.to);
    }
  });

  test('the overall view draws the graph, every node can be reached by keyboard', async ({
    page,
  }) => {
    await page.goto('/graph/');
    const svg = page.locator('figure.graph-all svg');
    await expect(svg).toBeVisible();
    await expect(svg.locator('a[href="/g/cache/"]')).toHaveCount(1);
    const domain = svg.locator('.node-domain').first();
    await expect(domain).toHaveAttribute('tabindex', '0');
    await svg.locator('a[href="/g/cache/"]').focus();
    await expect(svg.locator('a[href="/g/cache/"]')).toBeFocused();
  });

  test('a page draws its neighbors, centered on itself', async ({ page }) => {
    await page.goto('/g/cache/');
    const svg = page.locator('figure.graph-local svg');
    await expect(svg).toBeVisible();
    await expect(svg.locator('.node-center')).toHaveCount(1);
    await expect(svg.locator('a[href="/p/rendering-demo/"]')).toHaveCount(1);
  });

  test('without JavaScript the lists are there and the drawing is hidden', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/graph/');
    await expect(page.locator('figure.graph-all')).toBeHidden();
    await expect(
      page
        .locator('section.links')
        .getByRole('link', { name: 'Rendering-Demo' }),
    ).toBeVisible();
    await context.close();
  });
});
