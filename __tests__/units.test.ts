import { formatDistanceDisplayUK, formatDistanceVoiceUK } from '../src/navigation/units';

describe('units formatting', () => {
  test('formats miles for 0.2 miles and above', () => {
    expect(formatDistanceDisplayUK(0.2 * 1609.344)).toBe('0.2 mi');
    expect(formatDistanceVoiceUK(0.2 * 1609.344)).toBe('0.2 miles');
  });

  test('formats yards for distances under 0.2 miles', () => {
    expect(formatDistanceDisplayUK(200)).toBe('220 yd');
    expect(formatDistanceVoiceUK(200)).toBe('220 yards');
  });

  test('formats exact yards under 20 yards', () => {
    expect(formatDistanceDisplayUK(9.144)).toBe('10 yd');
    expect(formatDistanceVoiceUK(9.144)).toBe('10 yards');
  });

  test('formats meters when configured', () => {
    expect(formatDistanceVoiceUK(20, 30)).toMatch(/metres/);
  });
});
