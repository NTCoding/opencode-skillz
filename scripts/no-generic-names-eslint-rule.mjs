import path from 'node:path'

const forbiddenWordSuggestions = {
  utils: 'Use a domain-specific name that describes what it does.',
  helpers: 'Use a purpose-specific name or fixtures for test data.',
  helper: 'Use a purpose-specific name or fixtures for test data.',
  service: 'Name it for the domain action it performs.',
  services: 'Name it for the domain action it performs.',
  manager: 'Name it for the responsibility it owns.',
  managers: 'Name it for the responsibility it owns.',
  processor: 'Name it for the domain work it performs.',
  processors: 'Name it for the domain work it performs.',
  data: 'Name it for the domain concept it represents.',
}

const forbiddenWords = Object.keys(forbiddenWordSuggestions)
const forbiddenFilenamePattern = new RegExp(
  `(^|/|-|[a-z])(${forbiddenWords.join('|')})(-|[.]ts$|[.]tsx$|/|$)`,
  'i',
)

const findForbiddenWord = (text) => {
  const lowercaseText = text.toLowerCase()
  return forbiddenWords.find((forbiddenWord) => lowercaseText.includes(forbiddenWord))
}

const isForbiddenName = (name) => {
  if (!name) {
    return false
  }

  const lowercaseName = name.toLowerCase()
  return forbiddenWords.some((forbiddenWord) => {
    return lowercaseName === forbiddenWord || lowercaseName.startsWith(forbiddenWord) || lowercaseName.endsWith(forbiddenWord)
  })
}

const createFilenameMessage = (filename) => {
  const forbiddenWord = findForbiddenWord(filename)

  if (!forbiddenWord) {
    return 'Generic filename. Use domain-specific naming.'
  }

  const guidance = forbiddenWordSuggestions[forbiddenWord]
  return `Generic word "${forbiddenWord}" in filename. ${guidance}`
}

const createClassMessage = (className) => {
  const forbiddenWord = findForbiddenWord(className)

  if (!forbiddenWord) {
    return `Generic class name "${className}". Use domain-specific naming.`
  }

  const guidance = forbiddenWordSuggestions[forbiddenWord]
  return `Generic word "${forbiddenWord}" in class "${className}". ${guidance}`
}

const noGenericNames = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbid generic names in filenames and class names.',
      recommended: true,
    },
  },
  create(context) {
    const filename = path.basename(context.getFilename() || '')

    return {
      ClassDeclaration(node) {
        if (!node.id) {
          return
        }

        if (!isForbiddenName(node.id.name)) {
          return
        }

        context.report({
          node: node.id,
          message: createClassMessage(node.id.name),
        })
      },
      Program(node) {
        if (!forbiddenFilenamePattern.test(filename)) {
          return
        }

        context.report({
          node,
          message: createFilenameMessage(filename),
        })
      },
    }
  },
}

export default noGenericNames
