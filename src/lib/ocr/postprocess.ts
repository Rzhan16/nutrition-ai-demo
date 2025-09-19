export const cleanOcrText = (input: string): string => {
  if (!input) return ''

  let result = input.normalize('NFKC')

  // Normalize common punctuation variants to ASCII
  result = result
    .replace(/[\u2018\u2019\u2032\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')

  // Trim redundant whitespace while preserving newlines
  result = result.replace(/[ \t]+/g, ' ')
  result = result.replace(/ *\n+/g, '\n')
  result = result.replace(/\n+ */g, '\n')

  // Targeted word-level corrections
  result = result.replace(/\bmq\b/gi, 'mg')
  result = result.replace(/\bVitamn\b/gi, 'Vitamin')

  return result.trim()
}
