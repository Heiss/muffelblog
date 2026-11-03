import { describe, expect, it } from 'vitest';
import {
  ALLOWED_IMAGE_HOSTS,
  EMBED_RULES,
  isAllowedImageUrl,
  matchEmbed,
} from './policy.ts';

describe('isAllowedImageUrl', () => {
  it('allows https images from allowed hosts', () => {
    expect(
      isAllowedImageUrl(
        'https://upload.wikimedia.org/wikipedia/commons/a/a9/Beispiel.jpg',
      ),
    ).toBe(true);
    expect(
      isAllowedImageUrl('https://raw.githubusercontent.com/o/r/main/bild.png'),
    ).toBe(true);
    expect(
      isAllowedImageUrl('https://user-images.githubusercontent.com/1/2.png'),
    ).toBe(true);
  });

  it('rejects other hosts', () => {
    expect(isAllowedImageUrl('https://example.org/bild.png')).toBe(false);
    expect(isAllowedImageUrl('https://github.com/o/r/raw/main/bild.png')).toBe(
      false,
    );
  });

  it('rejects look-alike hosts', () => {
    expect(
      isAllowedImageUrl('https://upload.wikimedia.org.evil.example/bild.png'),
    ).toBe(false);
    expect(isAllowedImageUrl('https://evilupload.wikimedia.org/bild.png')).toBe(
      false,
    );
    expect(
      isAllowedImageUrl('https://upload.wikimedia.org@evil.example/bild.png'),
    ).toBe(false);
    expect(
      isAllowedImageUrl('https://evil.example/upload.wikimedia.org/bild.png'),
    ).toBe(false);
  });

  it('rejects plain http, credentials and foreign ports', () => {
    expect(isAllowedImageUrl('http://upload.wikimedia.org/bild.png')).toBe(
      false,
    );
    expect(
      isAllowedImageUrl(
        'https://nutzer:passwort@upload.wikimedia.org/bild.png',
      ),
    ).toBe(false);
    expect(
      isAllowedImageUrl('https://upload.wikimedia.org:8443/bild.png'),
    ).toBe(false);
  });

  it('rejects other protocols and invalid input', () => {
    expect(isAllowedImageUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isAllowedImageUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedImageUrl('//upload.wikimedia.org/bild.png')).toBe(false);
    expect(isAllowedImageUrl('kein url')).toBe(false);
    expect(isAllowedImageUrl('')).toBe(false);
  });

  it('lists exactly the decided hosts', () => {
    expect([...ALLOWED_IMAGE_HOSTS].sort()).toEqual(
      [
        'raw.githubusercontent.com',
        'upload.wikimedia.org',
        'user-images.githubusercontent.com',
      ].sort(),
    );
  });
});

describe('matchEmbed', () => {
  const ok = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';

  it('recognizes a YouTube video without cookies', () => {
    const match = matchEmbed(ok);
    expect(match).not.toBeNull();
    expect(match?.label).toBe('YouTube');
    expect(match?.src).toBe(ok);
    expect(match?.openUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('rejects YouTube with cookies and other hosts', () => {
    expect(matchEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBeNull();
    expect(matchEmbed('https://player.vimeo.com/video/1')).toBeNull();
    expect(matchEmbed('https://evil.example/embed/dQw4w9WgXcQ')).toBeNull();
  });

  it('rejects look-alike hosts', () => {
    expect(
      matchEmbed(
        'https://www.youtube-nocookie.com.evil.example/embed/dQw4w9WgXcQ',
      ),
    ).toBeNull();
    expect(
      matchEmbed('https://evil-www.youtube-nocookie.com/embed/dQw4w9WgXcQ'),
    ).toBeNull();
    expect(
      matchEmbed(
        'https://www.youtube-nocookie.com@evil.example/embed/dQw4w9WgXcQ',
      ),
    ).toBeNull();
  });

  it('checks the path', () => {
    expect(
      matchEmbed('https://www.youtube-nocookie.com/watch?v=dQw4w9WgXcQ'),
    ).toBeNull();
    expect(
      matchEmbed('https://www.youtube-nocookie.com/embed/kurz'),
    ).toBeNull();
    expect(
      matchEmbed('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ/../x'),
    ).toBeNull();
  });

  it('rejects http, parameters, credentials and invalid input', () => {
    expect(
      matchEmbed('http://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'),
    ).toBeNull();
    expect(matchEmbed(`${ok}?autoplay=1`)).toBeNull();
    expect(
      matchEmbed('https://a:b@www.youtube-nocookie.com/embed/dQw4w9WgXcQ'),
    ).toBeNull();
    expect(matchEmbed('javascript:alert(1)')).toBeNull();
    expect(matchEmbed('')).toBeNull();
  });

  it('has exactly the decided rule', () => {
    expect(EMBED_RULES.map((r) => r.host)).toEqual([
      'www.youtube-nocookie.com',
    ]);
  });
});
