/**
 * Custom JSON formatter for template index files
 *
 * Formats JSON with compact single-line objects for simple template entries,
 * while maintaining readability for the overall structure.
 *
 * Example output:
 * {
 *   "categories": [
 *     {
 *       "title": "Image",
 *       "type": "image",
 *       "templates": [
 *         { "name": "template1", "title": "Template 1", "description": "...", "mediaType": "image", "mediaSubtype": "webp" },
 *         { "name": "template2", "title": "Template 2", "description": "...", "mediaType": "image", "mediaSubtype": "webp", "tags": ["tag1", "tag2"] }
 *       ]
 *     }
 *   ]
 * }
 */

/**
 * Check if a value is a simple object (no nested objects/arrays, or simple arrays of primitives)
 */
function isSimpleObject(obj: any): boolean {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return false
  }

  for (const value of Object.values(obj)) {
    if (value === null || value === undefined) {
      continue
    }

    // Allow primitive types
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      continue
    }

    // Allow arrays of primitives (like tags, models)
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      if (value.every(item => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')) {
        continue
      }
      return false // Array contains complex objects
    }

    // Any other type (nested object, etc.) makes this not simple
    return false
  }

  return true
}

/**
 * Format a simple object with each property on its own line,
 * but values (including arrays) kept inline
 *
 * baseIndent is the indentation level where this object is being placed
 */
function formatSimpleObject(obj: any, baseIndent: number, indent: number): string {
  const propIndent = baseIndent + indent
  const propIndentStr = ' '.repeat(propIndent)
  const baseIndentStr = ' '.repeat(baseIndent)

  const parts: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue

    const jsonValue = JSON.stringify(value)
    parts.push(`${propIndentStr}"${key}": ${jsonValue}`)
  }

  // Return without leading indentation - caller will add it
  return '{\n' + parts.join(',\n') + '\n' + baseIndentStr + '}'
}

/**
 * Format JSON with custom formatting for template objects
 */
export function formatTemplateJson(data: any, indent = 2): string {
  function formatValue(value: any, currentIndent: number): string {
    const currentIndentStr = ' '.repeat(currentIndent)
    const nextIndent = currentIndent + indent
    const nextIndentStr = ' '.repeat(nextIndent)

    // Handle null
    if (value === null) {
      return 'null'
    }

    // Handle primitives
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return JSON.stringify(value)
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '[]'
      }

      // Check if all items are simple objects (like template entries)
      const allSimple = value.every(item => isSimpleObject(item))

      if (allSimple) {
        // Format each template object with properties on separate lines
        // Pass nextIndent so properties are correctly indented
        const items = value.map(item => {
          const formattedItem = formatSimpleObject(item, nextIndent, indent)
          // Add indentation for the opening brace
          return nextIndentStr + formattedItem
        })
        return '[\n' + items.join(',\n') + '\n' + currentIndentStr + ']'
      }

      // Check if all items are primitives (like tags array)
      const allPrimitives = value.every(item =>
        typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
      )

      if (allPrimitives) {
        // Keep primitive arrays on single line if short
        const singleLine = JSON.stringify(value)
        if (singleLine.length <= 60) {
          return singleLine
        }
      }

      // Default array formatting (one item per line)
      const items = value.map(item => formatValue(item, nextIndent))
      return '[\n' + items.map(item => nextIndentStr + item).join(',\n') + '\n' + currentIndentStr + ']'
    }

    // Handle objects
    if (typeof value === 'object') {
      const keys = Object.keys(value)

      if (keys.length === 0) {
        return '{}'
      }

      // Check if this is a simple template object
      if (isSimpleObject(value)) {
        return formatSimpleObject(value, currentIndent, indent)
      }

      // Default object formatting (one property per line)
      const props = keys
        .filter(key => value[key] !== undefined)
        .map(key => {
          const formattedValue = formatValue(value[key], nextIndent)
          return `${nextIndentStr}"${key}": ${formattedValue}`
        })

      return '{\n' + props.join(',\n') + '\n' + currentIndentStr + '}'
    }

    // Fallback
    return JSON.stringify(value)
  }

  return formatValue(data, 0)
}
