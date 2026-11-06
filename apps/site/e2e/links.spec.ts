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
      section.locator('ul.link-list').getByRole('link', {
        name: 'Rendering-Demo',
      }),
    ).toHaveAttribute('href', '/p/rendering-demo/');
  });

  test('external domains link to the entries that reference them', async ({
    page,
  }) => {
    await page.goto('/p/rendering-demo/');
    await expect(
      page.locator('section.links .link-domain', { hasText: 'example.org' }),
    ).toHaveCount(1);
    const domain = page.locator('section.links .link-domain a', {
      hasText: 'example.org',
    });
    await domain.click();
    await expect(page).toHaveURL(/node=domain%3Aexample.org&depth=1/);
    await expect(page.locator('[data-graph-depth]')).toHaveValue('1');
    const graph = await (await page.request.get('/graph.json')).json();
    const sources = graph.edges
      .filter((e: { to: string }) => e.to === 'domain:example.org')
      .map((e: { from: string }) => e.from);
    const visible = await page
      .locator('[data-graph-entry]:visible')
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-graph-entry')),
      );
    expect(visible.sort()).toEqual(sources.sort());
    await expect(page.locator('.node')).toHaveCount(sources.length + 1);
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

test.describe('Tag navigation', () => {
  for (const path of ['/p/hallo-welt/', '/m/memo-text/', '/g/cache/']) {
    test(`tags open their filtered overview from ${path} without JavaScript`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(path);
      const tag = page.locator('article .tags a').first();
      const text = await tag.innerText();
      const href = await tag.getAttribute('href');
      await tag.click();
      expect(new URL(page.url()).pathname).toBe(href);
      await expect(page.locator('h1')).toHaveText(ui.tags.heading(text));
      await expect(page.locator('article.entry').first()).toBeVisible();
      await context.close();
    });
  }
});

test('focused graph defaults to two hops and depth changes in both directions', async ({
  page,
}) => {
  const graph = {
    nodes: [
      { id: '/g/cache/', kind: 'glossary', title: 'Cache' },
      { id: '/p/a/', kind: 'post', title: 'A' },
      { id: '/p/b/', kind: 'post', title: 'B' },
      { id: 'domain:x.org', kind: 'domain', title: 'x.org' },
      { id: '/p/isolated/', kind: 'post', title: 'Isolated' },
    ],
    edges: [
      { from: '/p/a/', to: '/g/cache/' },
      { from: '/p/a/', to: '/p/b/' },
      { from: '/p/b/', to: 'domain:x.org' },
    ],
  };
  await page.route('**/graph.json', (route) => route.fulfill({ json: graph }));
  await page.goto('/graph/?node=%2Fg%2Fcache%2F');
  const depth = page.locator('[data-graph-depth]');
  await expect(depth).toHaveValue('2');
  await expect(page.locator('.node')).toHaveCount(3);
  await expect(page.locator('.edge[marker-end]')).toHaveCount(2);
  await depth.fill('1');
  await depth.dispatchEvent('change');
  await expect(page.locator('.node')).toHaveCount(2);
  await depth.fill('3');
  await depth.dispatchEvent('change');
  await expect(page.locator('.node')).toHaveCount(4);
  await page.reload();
  await expect(depth).toHaveValue('3');
  await expect(page.locator('.node')).toHaveCount(4);
  await page.locator('.node-domain').focus();
  await page.keyboard.press('Enter');
  await expect(depth).toHaveValue('1');
  await expect(page.locator('.node')).toHaveCount(2);
  await page.locator('[data-graph-center]').selectOption('');
  await expect(page.locator('.node')).toHaveCount(5);
});

test('a sparse local graph leaves no large blank area before comments', async ({
  page,
}) => {
  await page.route('**/graph.json', (route) =>
    route.fulfill({
      json: {
        nodes: [
          { id: '/g/cache/', kind: 'glossary', title: 'Cache' },
          { id: '/p/rendering-demo/', kind: 'post', title: 'Rendering-Demo' },
        ],
        edges: [{ from: '/p/rendering-demo/', to: '/g/cache/' }],
      },
    }),
  );
  await page.goto('/g/cache/');
  const svg = page.locator('.graph-local svg');
  await expect(svg).toBeVisible();
  const spacing = await svg.evaluate((el) => {
    const graph = el as SVGSVGElement;
    const content = graph.getBBox();
    const box = graph.viewBox.baseVal;
    return {
      height: graph.getBoundingClientRect().height,
      blank: box.y + box.height - content.y - content.height,
    };
  });
  const labelsFit = await svg.evaluate((el) => {
    const graph = el as SVGSVGElement;
    const content = graph.getBBox();
    const box = graph.viewBox.baseVal;
    return (
      content.x >= box.x &&
      content.y >= box.y &&
      content.x + content.width <= box.x + box.width &&
      content.y + content.height <= box.y + box.height
    );
  });
  expect(labelsFit).toBe(true);
  expect(spacing.blank).toBeLessThan(30);
  expect(spacing.height).toBeLessThan(150);
  const svgBounds = await svg.boundingBox();
  const heading = await page.locator('#comments h2').boundingBox();
  expect(heading).not.toBeNull();
  expect(heading!.y - (svgBounds!.y + svgBounds!.height)).toBeLessThan(65);
  await page.setViewportSize({ width: 360, height: 800 });
  expect((await svg.boundingBox())!.height).toBeLessThan(150);
});
