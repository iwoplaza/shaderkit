import { print, tokenize } from 'shaderkit'
import { describe, expect, it } from 'vitest'
import { type HoistNode, hoistPreprocessorDirectives, segmentDirectives } from '../src/hoister.js'

const glslSiblingConditions = `\
vec3 color = getColor(
  #ifdef VIEW_NORMALMAP
    normalMap,
  #else
    colorMap,
  #endif
  #ifdef HIGH_P
    vUvHigh
  #else
    vUvLow
  #endif
);`

// function printRecursive(obj: HoistNode): unknown {
//   return {
//     prefix: print(obj.prefix),
//     cases: obj.cases.map((case_) => ({
//       cond: print(case_.cond),
//       node: printRecursive(case_.node),
//     })),
//   }
// }

describe('segmentDirectives', () => {
  it('segments directives', () => {
    const inTokens = tokenize(glslSiblingConditions)
    const segments = segmentDirectives(inTokens)
    expect(
      segments.map((seg) => ({
        suffix: print(seg.suffix),
        directive: seg.directive ? print(seg.directive) : undefined,
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "directive": undefined,
          "suffix": "vec3 color = getColor(
        ",
        },
        {
          "directive": "#ifdef VIEW_NORMALMAP",
          "suffix": "
          normalMap,
        ",
        },
        {
          "directive": "#else",
          "suffix": "
          colorMap,
        ",
        },
        {
          "directive": "#endif",
          "suffix": "
        ",
        },
        {
          "directive": "#ifdef HIGH_P",
          "suffix": "
          vUvHigh
        ",
        },
        {
          "directive": "#else",
          "suffix": "
          vUvLow
        ",
        },
        {
          "directive": "#endif",
          "suffix": "
      );",
        },
      ]
    `)
  })
})

describe('hoistPreprocessorDirectives', () => {
  it('hoists preprocessor directives', () => {
    const inCode = `\
vec3 color = getColor(
  #ifdef VIEW_NORMALMAP
    normalMap,
  #else
    colorMap,
  #endif
  #ifdef HIGH_P
    vUvHigh
  #else
    vUvLow
  #endif
);`

    const inTokens = tokenize(inCode)
    const outCode = print(hoistPreprocessorDirectives(inTokens, 0, inTokens.length))
    expect(outCode).toMatchInlineSnapshot(`
      "#ifdef VIEW_NORMALMAP
      #ifdef HIGH_P
      vec3 color = getColor(
        
          normalMap,
        
        
          vUvHigh
        
      );
      );#else
      vec3 color = getColor(
        
          normalMap,
        
        
          vUvLow
        
      );
      );#endif
      #else
      #ifdef HIGH_P
      vec3 color = getColor(
        
          colorMap,
        
        
          vUvHigh
        
      );
      );#else
      vec3 color = getColor(
        
          colorMap,
        
        
          vUvLow
        
      );
      );#endif
      #endif
      "
    `)
  })
})
