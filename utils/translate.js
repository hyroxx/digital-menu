const LANG_MAP = {
  tr: 'tr',
  en: 'en',
  es: 'es',
  fr: 'fr',
  ga: 'ga',
};

async function translateText(text, targetLang, sourceLang = 'auto') {
  if (!text || !text.trim()) return text;
  if (targetLang === sourceLang) return text;

  const target = LANG_MAP[targetLang] || targetLang;
  const source = sourceLang === 'auto' ? 'auto' : (LANG_MAP[sourceLang] || sourceLang);
  const langPair = source === 'auto' ? `autodetect|${target}` : `${source}|${target}`;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return text;

    const data = await response.json();
    if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
    return text;
  } catch (err) {
    console.error('Translation error:', err.message);
    return text;
  }
}

module.exports = { translateText };
