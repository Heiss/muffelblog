import { expect, test } from '@playwright/test';
import { ui } from './helpers';

test.describe('Links between files (W20)', () => {
  test('a link to a file of the folder leads to its page', async ({ page }) => {
    await page.goto('/p/rendering-demo/');
    const link = page.locator('.content').getByRole('link', { name: 'Cache' });
    await expect(link).toHaveAttribute('href', '/g/cache/');
  });

  test('glossary terms are linked automatically on their first mention, with the definition as tooltip', async ({
    page,
  }) => {
    await page.goto('/p/rendering-demo/');
    const auto = page.locator('.content a.glossary-link');
    await expect(auto).toHaveCount(1);
    await expect(auto).toHaveText('Äther');
    await expect(auto).toHaveAttribute('href', '/g/aether/');
    await expect(auto).toHaveAttribute('title', /Umlaut/);
    // The alias "Zwischenspeicher" is text: the term Cache is already linked by hand above.
    await expect(page.locator('.content a[href="/g/cache/"]')).toHaveCount(1);
    // Not in code.
    await expect(
      page.locator('.content code', { hasText: 'Äther' }),
    ).toBeVisible();
    await expect(page.locator('.content code a')).toHaveCount(0);
  });

  test('a term does not link to itself, and the automatic link shows up in the link lists', async ({
    page,
  }) => {
    await page.goto('/g/aether/');
    await expect(page.locator('.content a[href="/g/aether/"]')).toHaveCount(0);
    const section = page.locator('section.links');
    await expect(
      section.getByRole('link', { name: 'Rendering-Demo', exact: true }),
    ).toBeVisible();
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

  test('the overall view has map controls in the corner, inside the picture and visible at once', async ({
    page,
  }) => {
    await page.goto('/graph/');
    const figure = page.locator('figure.graph-all');
    const svg = figure.locator('svg');
    await expect(svg).toBeVisible();
    const controls = figure.locator('.graph-controls');
    await expect(controls.getByRole('button')).toHaveCount(4);
    const picture = (await svg.boundingBox())!;
    const bar = (await controls.boundingBox())!;
    // In the top right corner of the picture, and on the first screen without scrolling.
    expect(bar.x).toBeGreaterThan(picture.x + picture.width / 2);
    expect(bar.y).toBeLessThan(picture.y + 60);
    expect(bar.y + bar.height).toBeLessThan(page.viewportSize()!.height);
  });

  test('the wheel zooms at the pointer, text and points keep their size, more labels appear', async ({
    page,
  }) => {
    await page.goto('/graph/');
    const svg = page.locator('figure.graph-all svg');
    await expect(svg.locator('.node').first()).toBeVisible();
    const scale = async () =>
      Number(
        /scale\(([\d.]+)\)/.exec(
          (await svg.locator('.graph-root').getAttribute('transform')) ?? '',
        )?.[1],
      );
    const labels = () => svg.locator('.node-label:not(.off)').count();
    const start = await scale();
    const labelsAtStart = await labels();
    const box = (await svg.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -1200);
    await expect.poll(scale).toBeGreaterThan(start * 1.5);
    // More detail when zoomed in.
    await expect.poll(labels).toBeGreaterThan(labelsAtStart);
    // A point is drawn at the same size on the screen, whatever the zoom.
    const body = await svg
      .locator('.node-body')
      .first()
      .getAttribute('transform');
    expect(Number(/scale\(([\d.]+)\)/.exec(body ?? '')?.[1])).toBeCloseTo(
      1 / (await scale()),
      3,
    );
  });

  test('the buttons zoom in and out and show everything again', async ({
    page,
  }) => {
    await page.goto('/graph/');
    const svg = page.locator('figure.graph-all svg');
    await expect(svg.locator('.node').first()).toBeVisible();
    const scale = async () =>
      Number(
        /scale\(([\d.]+)\)/.exec(
          (await svg.locator('.graph-root').getAttribute('transform')) ?? '',
        )?.[1],
      );
    const start = await scale();
    await page.getByRole('button', { name: ui.graph.zoomIn }).click();
    await expect.poll(scale).toBeGreaterThan(start);
    await page.getByRole('button', { name: ui.graph.zoomOut }).click();
    await page.getByRole('button', { name: ui.graph.zoomOut }).click();
    await expect.poll(scale).toBeLessThan(start);
    await page.getByRole('button', { name: ui.graph.zoomReset }).click();
    await expect.poll(scale).toBeCloseTo(start, 3);
  });

  test('a point can be dragged, stays where it was put, and "arrange again" lets it go', async ({
    page,
  }) => {
    await page.goto('/graph/');
    const svg = page.locator('figure.graph-all svg');
    const node = svg.locator('.node-post').nth(2);
    await expect(node).toBeVisible();
    const circle = node.locator('circle');
    const at = (await circle.boundingBox())!;
    const before = await node.getAttribute('transform');
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.down();
    await page.mouse.move(at.x + 120, at.y + 90, { steps: 8 });
    await page.mouse.up();
    await expect(node).toHaveClass(/pinned/);
    const after = await node.getAttribute('transform');
    expect(after).not.toBe(before);
    // It stays there while the rest settles.
    await page.waitForTimeout(600);
    expect(await node.getAttribute('transform')).toBe(after);
    // Dragging a point did not take the page along or open the page of the point.
    await expect(page).toHaveURL(/\/graph\/$/);
    await page.getByRole('button', { name: ui.graph.arrange }).click();
    await expect(node).not.toHaveClass(/pinned/);
  });

  test('dragging the background moves the whole picture', async ({ page }) => {
    await page.goto('/graph/');
    const svg = page.locator('figure.graph-all svg');
    await expect(svg.locator('.node').first()).toBeVisible();
    const root = svg.locator('.graph-root');
    const before = await root.getAttribute('transform');
    const box = (await svg.boundingBox())!;
    // A corner of the picture is empty.
    await page.mouse.move(box.x + 12, box.y + box.height - 12);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + box.height - 60, { steps: 6 });
    await page.mouse.up();
    expect(await root.getAttribute('transform')).not.toBe(before);
  });

  test('the small graph under a page zooms with the wheel only after a click into it', async ({
    page,
  }) => {
    await page.goto('/g/cache/');
    const svg = page.locator('figure.graph-local svg');
    await expect(svg.locator('.node').first()).toBeVisible();
    const transform = () =>
      svg.locator('.graph-root').getAttribute('transform');
    const start = await transform();
    const box = (await svg.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.wheel(0, -400);
    expect(await transform()).toBe(start);
    await page.mouse.click(box.x + 10, box.y + 10);
    await page.mouse.wheel(0, -400);
    await expect.poll(transform).not.toBe(start);
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
