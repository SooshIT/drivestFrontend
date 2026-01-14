const files = new Map<string, string>();

export const documentDirectory = 'file://mock-documents/';
export const EncodingType = { UTF8: 'utf8' };

export const getInfoAsync = async (uri: string) => ({
  exists: files.has(uri),
});

export const makeDirectoryAsync = async () => null;

export const writeAsStringAsync = async (uri: string, data: string) => {
  const current = files.get(uri) || '';
  files.set(uri, current + data);
};

export const readAsStringAsync = async (uri: string) => files.get(uri) || '';
