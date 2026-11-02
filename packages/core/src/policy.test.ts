import { describe, expect, it } from 'vitest';
import {
  ALLOWED_IMAGE_HOSTS,
  EMBED_RULES,
  isAllowedImageUrl,
  matchEmbed,
} from './policy.ts';

describe('isAllowedImageUrl', () => {
  it('erlaubt https-Bilder von freigegebenen Hosts', () => {
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

  it('lehnt andere Hosts ab', () => {
    expect(isAllowedImageUrl('https://example.org/bild.png')).toBe(false);
    expect(isAllowedImageUrl('https://github.com/o/r/raw/main/bild.png')).toBe(
      false,
    );
  });

  it('lehnt ähnlich aussehende Hosts ab', () => {
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

  it('lehnt unverschlüsseltes http, Zugangsdaten und fremde Ports ab', () => {
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

  it('lehnt andere Protokolle und Ungültiges ab', () => {
    expect(isAllowedImageUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isAllowedImageUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedImageUrl('//upload.wikimedia.org/bild.png')).toBe(false);
    expect(isAllowedImageUrl('kein url')).toBe(false);
    expect(isAllowedImageUrl('')).toBe(false);
  });

  it('führt genau die beschlossenen Hosts', () => {
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

  it('erkennt ein YouTube-Video ohne Cookies', () => {
    const treffer = matchEmbed(ok);
    expect(treffer).not.toBeNull();
    expect(treffer?.label).toBe('YouTube');
    expect(treffer?.src).toBe(ok);
    expect(treffer?.openUrl).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
  });

  it('lehnt YouTube mit Cookies und andere Hosts ab', () => {
    expect(matchEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBeNull();
    expect(matchEmbed('https://player.vimeo.com/video/1')).toBeNull();
    expect(matchEmbed('https://evil.example/embed/dQw4w9WgXcQ')).toBeNull();
  });

  it('lehnt ähnlich aussehende Hosts ab', () => {
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

  it('prüft den Pfad', () => {
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

  it('lehnt http, Parameter, Zugangsdaten und Ungültiges ab', () => {
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

  it('führt genau die beschlossene Regel', () => {
    expect(EMBED_RULES.map((r) => r.host)).toEqual([
      'www.youtube-nocookie.com',
    ]);
  });
});
