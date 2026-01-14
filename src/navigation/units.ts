export const formatDistanceDisplayUK = (meters: number) => {
  if (!Number.isFinite(meters)) return '';
  const milesThreshold = 0.2 * 1609.344;
  if (meters >= milesThreshold) {
    const miles = meters / 1609.344;
    return `${miles.toFixed(1)} mi`;
  }
  const yards = meters * 1.09361;
  if (yards < 20) {
    return `${Math.max(1, Math.round(yards))} yd`;
  }
  const rounded = Math.round(yards / 10) * 10;
  return `${Math.max(20, rounded)} yd`;
};

export const formatDistanceVoiceUK = (meters: number, useMetersUnder = 0) => {
  if (!Number.isFinite(meters)) return '';
  if (useMetersUnder > 0 && meters < useMetersUnder) {
    return `${Math.round(meters)} metres`;
  }
  const milesThreshold = 0.2 * 1609.344;
  if (meters >= milesThreshold) {
    const miles = meters / 1609.344;
    return `${miles.toFixed(1)} miles`;
  }
  const yards = meters * 1.09361;
  if (yards < 20) {
    return `${Math.max(1, Math.round(yards))} yards`;
  }
  const rounded = Math.round(yards / 10) * 10;
  return `${Math.max(20, rounded)} yards`;
};
