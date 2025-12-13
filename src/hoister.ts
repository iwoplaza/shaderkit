import type { Token } from './tokenizer.js'

export interface HoistNode {
  prefix: Token[]
  cases: { cond: Token[]; node: HoistNode }[]
}

/**
 * A set of tokens optionally starting with a directive
 */
type PreprocessorSegment = {
  directive?: Token[] | undefined
  suffix: Token[]
  scope: number
}

const preScopeDelta = {
  if: 1,
  ifdef: 1,
  ifndef: 1,
} as Record<string, number>

const postScopeDelta = {
  endif: -1,
} as Record<string, number>

export function segmentDirectives(tokens: Token[]): PreprocessorSegment[] {
  const segments: PreprocessorSegment[] = []

  // Gathering the first non-directive segment, if it exists
  let cursor = 0
  let scope = 0
  const prefix: Token[] = []
  while (cursor < tokens.length && tokens[cursor].value !== '#') {
    prefix.push(tokens[cursor++])
  }

  if (prefix.length > 0) {
    segments.push({ suffix: prefix, scope })
  }

  while (cursor < tokens.length) {
    const directive: Token[] = []
    while (cursor < tokens.length && tokens[cursor].value !== '\\') {
      directive.push(tokens[cursor++])
    }
    directive.push(tokens[cursor++]) // push the '\\'

    const suffix: Token[] = []
    while (cursor < tokens.length && tokens[cursor].value !== '#') {
      suffix.push(tokens[cursor++])
    }

    const name = directive[1]?.value ?? ''
    scope += preScopeDelta[name] || 0
    segments.push({ directive, suffix, scope })
    scope += postScopeDelta[name] || 0
  }

  return segments
}

export function getDirectiveName(segment: PreprocessorSegment): string {
  return segment.directive?.[1]?.value ?? ''
}

function constructHoistTree(
  segments: PreprocessorSegment[],
  scope: number = 0,
  remainder: HoistNode | undefined = undefined,
): HoistNode {
  let seg = segments.length - 1

  let leafNode: HoistNode = {
    cases: remainder?.cases ?? [],
    // Merging the suffix of the last segment with the start of the remainder
    prefix: [...segments[seg].suffix, ...(remainder?.prefix ?? [])],
  }

  if (seg === 0) {
    // No more segments to explore
    return leafNode
  }

  let currentNode: HoistNode | undefined
  // The segment index that marks the end of the currently
  // explored case (exclusive)
  let caseEnd = seg

  while (seg >= 0) {
    if (segments[seg].scope > scope + 1) {
      continue // A nested segment, skip it
    }

    const name = getDirectiveName(segments[seg])
    if (name === '') {
      // The first segment, no directive
      if (currentNode) {
        currentNode.prefix = [...segments[seg].suffix, ...currentNode.prefix]
      }
    } else if (name === 'endif') {
      // Prepending the suffix of the endif segment before the leaf node
      leafNode.prefix = [...segments[seg].suffix, ...leafNode.prefix]
      caseEnd = seg
      currentNode = {
        cases: [],
        prefix: [],
      }
    } else if (name === 'else' || name === 'elif' || name === 'if' || name === 'ifdef' || name === 'ifndef') {
      const caseStart = seg
      const caseNode = constructHoistTree(segments.slice(caseStart, caseEnd), scope + 1, leafNode)
      caseEnd = seg // the next ends where the previous started
      currentNode?.cases.unshift({ cond: segments[caseStart].directive ?? [], node: caseNode })
    }

    if (name === 'if' || name === 'ifdef' || name === 'ifndef') {
      // We're finishing up a whole node
      leafNode = currentNode!
    }

    seg--
  }

  // No nested conditions in this node
  return leafNode
}

function flattenHoistNode(node: HoistNode, prefix: Token[]): Token[] {
  if (node.cases.length === 0) {
    return [...prefix, ...node.prefix]
  }

  return [
    ...node.cases.flatMap((case_) => {
      return [
        ...case_.cond,
        { type: 'whitespace' as const, value: '\n' },
        ...flattenHoistNode(case_.node, [...prefix, ...node.prefix]),
      ]
    }),
    { type: 'symbol', value: '#' },
    { type: 'keyword', value: 'endif' },
    { type: 'whitespace', value: '\n' },
  ]
}

/**
 * Hoists preprocessor directives on the token level
 */
export function hoistPreprocessorDirectives(tokens: Token[]): Token[] {
  const tree = constructHoistTree(segmentDirectives(tokens))

  return flattenHoistNode(tree, [])
}
