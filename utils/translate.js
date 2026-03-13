const LANG_MAP = {
  tr: 'tr',
  en: 'en',
  es: 'es',
  fr: 'fr',
  ga: 'ga',
};

const CHUNK_SIZE = 450;

async function translateChunk(chunk, langPair) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${langPair}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) return chunk;
  const data = await response.json();
  if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
    return data.responseData.translatedText;
  }
  return chunk;
}

async function translateText(text, targetLang, sourceLang = 'auto') {
  if (!text || !text.trim()) return text;
  if (targetLang === sourceLang) return text;

  const target = LANG_MAP[targetLang] || targetLang;
  const source = sourceLang === 'auto' ? 'auto' : (LANG_MAP[sourceLang] || sourceLang);
  const langPair = source === 'auto' ? `autodetect|${target}` : `${source}|${target}`;

  try {
    if (text.length <= CHUNK_SIZE) {
      return await translateChunk(text, langPair);
    }

    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    const chunks = [];
    let current = '';
    for (const sentence of sentences) {
      if ((current + sentence).length > CHUNK_SIZE) {
        if (current) chunks.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());

    const translated = [];
    for (const chunk of chunks) {
      const result = await translateChunk(chunk, langPair);
      translated.push(result);
    }
    return translated.join(' ');
  } catch (err) {
    console.error('Translation error:', err.message);
    return text;
  }
}

module.exports = { translateText };
