/*global CKEDITOR*/
import {
  nonEmpty,
  listNodeNames,
  bookmarks,
  inheritInlineStyles,
  cleanUpDirection
} from './iccListUtils'
import { toRoman, toArabic } from 'roman-numerals'
import _ from 'lodash'

export const ordinalParseRegex = /^(\s*(?:\(|Class|CHAPTER)?\s*)([a-zA-Z0-9\.]+?)(\s*?(?:[\.\)])?.*?)$/iu
export const ORDINAL_TYPE_NUMBER = 'number'
export const ORDINAL_TYPE_ALPHA_LOWER = 'lower-alpha'
export const ORDINAL_TYPE_ALPHA_UPPER = 'upper-alpha'
export const ORDINAL_TYPE_ROMAN_LOWER = 'lower-roman'
export const ORDINAL_TYPE_ROMAN_UPPER = 'upper-roman'
export const ORDINAL_TYPES = {
  ORDINAL_TYPE_NUMBER,
  ORDINAL_TYPE_ALPHA_LOWER,
  ORDINAL_TYPE_ALPHA_UPPER,
  ORDINAL_TYPE_ROMAN_LOWER,
  ORDINAL_TYPE_ROMAN_UPPER
}
export const ORDINAL_CASE_UPPER = 'upper'
export const ORDINAL_CASE_LOWER = 'lower'
export const ORDINAL_CASE_DEFAULT = ORDINAL_CASE_LOWER

class IccListPlugin {
  /**
   * @param {string} ordinal
   * @returns {string}
   */
  getOrdinalCase (ordinal) {
    if (ordinal == ordinal.toUpperCase()) {
      return ORDINAL_CASE_UPPER
    } else if (ordinal == ordinal.toLowerCase()) {
      return ORDINAL_CASE_LOWER
    } else {
      // String has both upper and lower, so use default.
      return ORDINAL_CASE_DEFAULT
    }
  }

  getOrdinalTypeFromListItem (listNode) {
    const firstLi = listNode.is('li') ? listNode : listNode.findOne('> li')
    const labelNode = firstLi.findOne('> p > span.label')

    if (!labelNode) {
      return
    }

    const labelParts = this.parseOrdinal(labelNode.getHtml())

    return labelParts ? this.getOrdinalType(labelParts.ordinal) : null
  }

  getOrdinalType (ordinal) {
    // Check if ordinal is number.
    if (!isNaN(ordinal)) {
      return ORDINAL_TYPE_NUMBER
    }

    // Determine if ordinal is uppercase or lowercase.
    const ordinalCase = this.getOrdinalCase(ordinal)

    // Try to parse as roman numeral and if error is thrown then ordinal type is alpha.
    try {
      toArabic(ordinal)
      // TODO If ordinal string could also be alpha instead of roman, compare against others in the list.
      return ordinalCase === ORDINAL_CASE_UPPER ? ORDINAL_TYPE_ROMAN_UPPER : ORDINAL_TYPE_ROMAN_LOWER
    } catch (e) {
      return ordinalCase === ORDINAL_CASE_UPPER ? ORDINAL_TYPE_ALPHA_UPPER : ORDINAL_TYPE_ALPHA_LOWER
    }
  }

  convertNumberToOrdinal (num, ordinalType) {
    switch (ordinalType) {
      case ORDINAL_TYPE_NUMBER:
        return num

      case ORDINAL_TYPE_ALPHA_LOWER:
      case ORDINAL_TYPE_ALPHA_UPPER:
        const alphaNum = this.numberToChars(num)
        return alphaNum[ordinalType === ORDINAL_TYPE_ALPHA_LOWER ? 'toLowerCase' : 'toUpperCase']()

      case ORDINAL_TYPE_ROMAN_LOWER:
      case ORDINAL_TYPE_ROMAN_UPPER:
        const romanNum = toRoman(num)
        return romanNum[ordinalType === ORDINAL_TYPE_ROMAN_LOWER ? 'toLowerCase' : 'toUpperCase']()

      default:
        throw new Error(`Unknown ordinal type ${ordinalType} in convertNumberToOrdinal`)
    }
  }

  convertOrdinalToNumber (ordinal, ordinalType = null) {
    if (!ordinalType) {
      ordinalType = this.getOrdinalType(ordinal)
    }

    switch (ordinalType) {
      case ORDINAL_TYPE_NUMBER:
        return ordinal

      case ORDINAL_TYPE_ALPHA_LOWER:
      case ORDINAL_TYPE_ALPHA_UPPER:
        return this.charsToNumber(ordinal)

      case ORDINAL_TYPE_ROMAN_LOWER:
      case ORDINAL_TYPE_ROMAN_UPPER:
        return toArabic(ordinal)

      default:
        throw new Error(`Unknown ordinal type ${ordinalType} in convertOrdinalToNumber`)
    }
  }

  translateOrdinal (ordinal, offset, ordinalType = null) {
    if (!ordinalType) {
      ordinalType = this.getOrdinalType(ordinal)
    }

    let prefix = ''
    let numberPart = ordinal
    let suffix = ''

    // num is a string since there can be ordinals like 1.2.3.4. In which case we only translate the last part.
    if (ordinal.includes('.')) {
      let parts = ordinal.split('.')

      if (_.last(parts).length === 0) {
        suffix += '.'
        parts = _.slice(parts, 0, parts.length - 1)
      }

      if (parts.length > 0) {
        prefix = _.join(_.slice(parts, 0, parts.length - 1), '.')
        numberPart = _.last(parts)
      }
    }

    const num = this.convertOrdinalToNumber(numberPart, ordinalType)
    const newNum = _.toNumber(num) + offset
    const newOrdinal = prefix + newNum + suffix

    return this.convertNumberToOrdinal(newOrdinal, ordinalType)
  }

  /**
   * @param {string} label
   * @param {string} ordinal
   * @param {string} replacementPattern
   * @returns {*}
   */
  replaceOrdinal (label, ordinal, replacementPattern = '$1{0}$3') {
    return label.replace(ordinalParseRegex, replacementPattern.replace(/\{0}/, _.escapeRegExp(ordinal)))
  }

  parseOrdinal (text) {
    text = text.replace(/(\s|&nbsp;)+$/, '')
    const parseMatches = text.match(ordinalParseRegex)

    if (!parseMatches) {
      return
    }

    const [match, prefix, ordinal, suffix] = parseMatches

    return {
      match,
      prefix,
      ordinal,
      suffix,
      replaceOrdinal: ordinal => this.replaceOrdinal(match, ordinal)
    }
  }

  numberToChars (num) {
    const ordA = 'a'.charCodeAt(0)
    const ordZ = 'z'.charCodeAt(0)
    const len = ordZ - ordA + 1

    let s = ''
    while (num >= 0) {
      s = String.fromCharCode(num % len + ordA) + s
      num = Math.floor(num / len) - 1
    }
    return s
  }

  charsToNumber (chars) {
    const ordA = 'a'.charCodeAt(0)

    let num = 0
    // Loop through each character from left to right and sum up the results of this formula:
    // x = 26^i * n
    // where i = (length of string) - (zero-based index of char in string) - 1
    // and   n = (ASCII code of the character) - (ASCII code of character 'a') + 1
    for (let i = chars.length - 1; i >= 0; i--) {
      const n = chars.charCodeAt(i) - ordA + 1
      num += (Math.pow(26, i) * n)
    }

    return num
  }

  updateOrderedListLabels (listNode, doc) {
    if (!listNode.is('ol')) {
      return
    }

    const length = listNode.getChildCount()

    // Try to determine the ordinal type.
    const ordinalType = this.getOrdinalTypeFromListItem(listNode)

    for (let i = 0; i < length; i++) {
      const child = listNode.getChild(i)

      let newOrdinal
      try {
        newOrdinal = this.convertNumberToOrdinal(i + 1, ordinalType)
      } catch (e) {
        newOrdinal = i + 1
      }

      let pNode = child.findOne('> p')
      let labelNode

      if (pNode) {
        labelNode = pNode.findOne('> span.label')
      } else {
        pNode = doc.createElement('p')
        if (child.getFirst()) {
          pNode.insertBefore(child.getFirst())
        } else {
          pNode.appendTo(child)
        }
      }

      if (!labelNode) {
        labelNode = doc.createElement('span')
        labelNode.addClass('label')

        const labelParts = this.parseOrdinal(newOrdinal)

        labelNode.appendText(labelParts.replaceOrdinal(newOrdinal))
        if (pNode.getFirst()) {
          labelNode.insertBefore(pNode.getFirst())
        } else {
          labelNode.appendTo(pNode)
        }

        const textNode = doc.createText(' ')
        textNode.insertAfter(labelNode)
      }

      const childrenCount = child.getChildCount()
      for (let k = 0; k < childrenCount.length; k++) {
        if (child.getChild(k).is('ol')) {
          this.updateOrderedListLabels(child.getChild(k), doc)
        }
      }
    }
  }

  updateUnorderedListLabels (listNode, doc, editor) {
    if (!listNode.is('ul')) {
      return
    }

    const length = listNode.getChildCount()

    for (let i = 0; i < length; i++) {
      const child = listNode.getChild(i)
      let labelNode

      // Search for label node in this item.
      const labelNodes = child.find('p span.label')
      const labelNodeCount = labelNodes.count()
      for (let j = 0; j < labelNodeCount; j++) {
        const childLabel = labelNodes.getItem(j)
        // Verify this label node's parent li is current li.
        if (childLabel && childLabel.getAscendant('li').equals(child)) {
          labelNode = labelNodes.getItem(j)
          break
        }
      }

      if (labelNode) {
        const space = labelNode.getNext()

        // Remove space following label.
        if (space && space.type === CKEDITOR.NODE_TEXT) {
          let text = space.getText()
          if (text.startsWith(' ') || text.startsWith('\xa0')) {
            text = text.replace(/(?:^\s+)/g, '')

            if (text.length === 0) {
              space.remove()
            } else {
              space.setText(text)
            }
          }
        }

        const existingWidget = editor.widgets.getByElement(labelNode)

        if (existingWidget) {
          const widgetWrapper = existingWidget.wrapper
          widgetWrapper.remove()
          editor.widgets.destroy(existingWidget, true)
          editor.widgets.checkWidgets(child)
          labelNode.remove()
        } else {
          labelNode.remove()
        }
      }

      const childrenCount = child.getChildCount()
      for (let k = 0; k < childrenCount; k++) {
        if (child.getChild(k).is('ul')) {
          this.updateUnorderedListLabels(child.getChild(k), doc, editor)
        }
      }
    }
  }

  listToArray (listNode, database, baseArray = [], baseIndentLevel = 0, grandparentNode) {
    if (!listNodeNames[listNode.getName()]) {
      return []
    }

    // Iterate over all list items to and look for inner lists.
    for (let i = 0, count = listNode.getChildCount(); i < count; i++) {
      const listItem = listNode.getChild(i)

      // Fixing malformed nested lists by moving it into a previous list item. (#6236)
      if (listItem.type === CKEDITOR.NODE_ELEMENT && listItem.getName() in CKEDITOR.dtd.$list) {
        CKEDITOR.plugins.list.listToArray(listItem, database, baseArray, baseIndentLevel + 1)
      }

      // It may be a text node or some funny stuff.
      if (listItem.$.nodeName.toLowerCase() !== 'li') { continue }

      const itemObj = { parent: listNode, indent: baseIndentLevel, element: listItem, contents: [] }
      if (grandparentNode) {
        itemObj.grandparent = grandparentNode
      } else {
        itemObj.grandparent = listNode.getParent()
        if (itemObj.grandparent && itemObj.grandparent.$.nodeName.toLowerCase() === 'li') {
          itemObj.grandparent = itemObj.grandparent.getParent()
        }
      }

      if (database) {
        CKEDITOR.dom.element.setMarker(database, listItem, 'listarray_index', baseArray.length)
      }

      baseArray.push(itemObj)

      for (let j = 0, itemChildCount = listItem.getChildCount(), child; j < itemChildCount; j++) {
        child = listItem.getChild(j)
        if (child.type === CKEDITOR.NODE_ELEMENT && listNodeNames[child.getName()]) {
          // Note the recursion here, it pushes inner list items with
          // +1 indentation in the correct order.
          CKEDITOR.plugins.list.listToArray(child, database, baseArray, baseIndentLevel + 1, itemObj.grandparent)
        } else {
          itemObj.contents.push(child)
        }
      }
    }

    return baseArray
  }

  arrayToList (listArray, database, baseIndex, paragraphMode, dir) {
    if (!baseIndex) {
      baseIndex = 0
    }

    if (!listArray || listArray.length < baseIndex + 1) { return null }

    let i
    const doc = listArray[baseIndex].parent.getDocument()
    const retval = new CKEDITOR.dom.documentFragment(doc)
    let rootNode = null
    let currentIndex = baseIndex
    let indentLevel = Math.max(listArray[baseIndex].indent, 0)
    let currentListItem = null
    let orgDir
    let block
    let paragraphName = (paragraphMode == CKEDITOR.ENTER_P ? 'p' : 'div')

    while (1) {
      const item = listArray[currentIndex]
      const itemGrandParent = item.grandparent

      orgDir = item.element.getDirection(1)

      if (item.indent == indentLevel) {
        if (!rootNode || listArray[currentIndex].parent.getName() != rootNode.getName()) {
          rootNode = listArray[currentIndex].parent.clone(false, 1)
          dir && rootNode.setAttribute('dir', dir)
          retval.append(rootNode)
        }

        currentListItem = rootNode.append(item.element.clone(0, 1))

        if (orgDir != rootNode.getDirection(1)) {
          currentListItem.setAttribute('dir', orgDir)
        }

        for (i = 0; i < item.contents.length; i++) {
          currentListItem.append(item.contents[i].clone(1, 1))
        }

        currentIndex++
      } else if (item.indent == Math.max(indentLevel, 0) + 1) {
        // Maintain original direction (#6861).
        const currDir = listArray[currentIndex - 1].element.getDirection(1)
        const listData = CKEDITOR.plugins.list.arrayToList(listArray, null, currentIndex, paragraphMode, currDir != orgDir ? orgDir : null)

        // If the next block is an <li> with another list tree as the first
        // child, we'll need to append a filler (<br>/NBSP) or the list item
        // wouldn't be editable. (#6724)
        if (!currentListItem.getChildCount() && CKEDITOR.env.needsNbspFiller && doc.$.documentMode <= 7) {
          currentListItem.append(doc.createText('\xa0'))
        }

        currentListItem.append(listData.listNode)
        currentIndex = listData.nextIndex
      } else if (item.indent == -1 && !baseIndex && itemGrandParent) {
        if (listNodeNames[itemGrandParent.getName()]) {
          currentListItem = item.element.clone(false, true)
          if (orgDir != itemGrandParent.getDirection(1)) { currentListItem.setAttribute('dir', orgDir) }
        } else {
          currentListItem = new CKEDITOR.dom.documentFragment(doc)
        }

        // Migrate all children to the new container,
        // apply the proper text direction.
        const dirLoose = itemGrandParent.getDirection(1) != orgDir

        const li = item.element
        const className = li.getAttribute('class')
        const style = li.getAttribute('style')

        const needsBlock = currentListItem.type == CKEDITOR.NODE_DOCUMENT_FRAGMENT && (paragraphMode != CKEDITOR.ENTER_BR || dirLoose || style || className)

        var child
        const count = item.contents.length
        let cachedBookmark

        for (i = 0; i < count; i++) {
          child = item.contents[i]

          // Append bookmark if we can, or cache it and append it when we'll know
          // what to do with it. Generally - we want to keep it next to its original neighbour.
          // Exception: if bookmark is the only child it hasn't got any neighbour, so handle it normally
          // (wrap with block if needed).
          if (bookmarks(child) && count > 1) {
            // If we don't need block, it's simple - append bookmark directly to the current list item.
            if (!needsBlock) {
              currentListItem.append(child.clone(1, 1))
            } else {
              cachedBookmark = child.clone(1, 1)
            }
          }
          // Block content goes directly to the current list item, without wrapping.
          else if (child.type == CKEDITOR.NODE_ELEMENT && child.isBlockBoundary()) {
            // Apply direction on content blocks.
            if (dirLoose && !child.getDirection()) { child.setAttribute('dir', orgDir) }

            inheritInlineStyles(li, child)

            className && child.addClass(className)

            // Close the block which we started for inline content.
            block = null
            // Append bookmark directly before current child.
            if (cachedBookmark) {
              currentListItem.append(cachedBookmark)
              cachedBookmark = null
            }
            // Append this block element to the list item.
            currentListItem.append(child.clone(1, 1))
          }
          // Some inline content was found - wrap it with block and append that
          // block to the current list item or append it to the block previously created.
          else if (needsBlock) {
            // Establish new block to hold text direction and styles.
            if (!block) {
              block = doc.createElement(paragraphName)
              currentListItem.append(block)
              dirLoose && block.setAttribute('dir', orgDir)
            }

            // Copy over styles to new block;
            style && block.setAttribute('style', style)
            className && block.setAttribute('class', className)

            // Append bookmark directly before current child.
            if (cachedBookmark) {
              block.append(cachedBookmark)
              cachedBookmark = null
            }

            block.append(child.clone(1, 1))
          }
          // E.g. BR mode - inline content appended directly to the list item.
          else {
            currentListItem.append(child.clone(1, 1))
          }
        }

        // No content after bookmark - append it to the block if we had one
        // or directly to the current list item if we finished directly in the current list item.
        if (cachedBookmark) {
          (block || currentListItem).append(cachedBookmark)
          cachedBookmark = null
        }

        // Remove label content is found.
        let labelElement
        const childrenCount = currentListItem.$.children.length

        for (let k = 0; k < childrenCount; k++) {
          const child = currentListItem.$.children[k]
          // Find the p tag
          if (child.nodeName.toLowerCase() === 'p') {
            const subChildrenCount = child.children.length
            // Loop through children to find span.label.
            for (let j = 0; j < subChildrenCount; j++) {
              const subChild = child.children[j]

              if (
                subChild.nodeName.toLowerCase() === 'span' &&
                subChild.attributes['class'] &&
                subChild.attributes['class'].nodeValue.includes('label')
              ) {
                // Remove the list item's label.
                child.removeChild(subChild)
                break
              }
            }
          }
        }

        if (labelElement) {
          labelElement.remove()
        }

        if (currentListItem.type == CKEDITOR.NODE_DOCUMENT_FRAGMENT && currentIndex != listArray.length - 1) {
          let last

          // Remove bogus <br> if this browser uses them.
          if (CKEDITOR.env.needsBrFiller) {
            last = currentListItem.getLast()
            if (last && last.type == CKEDITOR.NODE_ELEMENT && last.is('br')) {
              last.remove()
            }
          }

          // If the last element is not a block, append <br> to separate merged list items.
          last = currentListItem.getLast(nonEmpty)
          if (!(last && last.type == CKEDITOR.NODE_ELEMENT && last.is(CKEDITOR.dtd.$block))) {
            currentListItem.append(doc.createElement('br'))
          }
        }

        const currentListItemName = currentListItem.$.nodeName.toLowerCase()
        if (currentListItemName == 'div' || currentListItemName == 'p') {
          currentListItem.appendBogus()
        }

        retval.append(currentListItem)
        rootNode = null
        currentIndex++
      } else {
        return null
      }

      block = null

      if (listArray.length <= currentIndex || Math.max(listArray[currentIndex].indent, 0) < indentLevel) {
        break
      }
    }

    if (database) {
      let currentNode = retval.getFirst()

      while (currentNode) {
        if (currentNode.type == CKEDITOR.NODE_ELEMENT) {
          // Clear marker attributes for the new list tree made of cloned nodes, if any.
          CKEDITOR.dom.element.clearMarkers(database, currentNode)

          // Clear redundant direction attribute specified on list items.
          if (currentNode.getName() in CKEDITOR.dtd.$listItem) { cleanUpDirection(currentNode) }
        }

        currentNode = currentNode.getNextSourceNode()
      }
    }

    return { listNode: retval, nextIndex: currentIndex }
  }
}

export default IccListPlugin
