export const generateClientId = (): string => {
  return `client-${Math.random().toString(36).substr(2, 9)}`;
};

export const generateDisplayName = (): string => {
  const adjectives = ['Cool', 'Smart', 'Fast', 'Bright', 'Happy', 'Brave', 'Kind', 'Wise'];
  const nouns = ['Tiger', 'Eagle', 'Lion', 'Wolf', 'Fox', 'Bear', 'Hawk', 'Falcon'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
};


