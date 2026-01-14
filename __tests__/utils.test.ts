import { decodePolyline } from '../src/utils';

describe('decodePolyline', () => {
  it('decodes a simple polyline', () => {
    const coords = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(coords.length).toBeGreaterThan(0);
    expect(coords[0]).toHaveProperty('latitude');
    expect(coords[0]).toHaveProperty('longitude');
  });
});
