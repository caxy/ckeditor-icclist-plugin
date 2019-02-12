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

export const ordinalParseRegex = /^(\s*(?:\(|Class|CHAPTER)?\s*(?:[a-zA-Z0-9]+\.)*)(?:([a-zA-Z0-9]+))(\s*?(?:[\.\)])?.*?)$/iu
export const ORDINAL_TYPE_NUMBER = 'number'
export const ORDINAL_TYPE_ALPHA_LOWER = 'lower-alpha'
export const ORDINAL_TYPE_ALPHA_UPPER = 'upper-alpha'
export const ORDINAL_TYPE_ROMAN_LOWER = 'lower-roman'
export const ORDINAL_TYPE_ROMAN_UPPER = 'upper-roman'
export const ORDINAL_TYPE_SECTION = 'section'
export const ORDINAL_TYPE_DEFAULT = ORDINAL_TYPE_SECTION

export const ORDINAL_TYPES = {
  ORDINAL_TYPE_NUMBER,
  ORDINAL_TYPE_ALPHA_LOWER,
  ORDINAL_TYPE_ALPHA_UPPER,
  ORDINAL_TYPE_ROMAN_LOWER,
  ORDINAL_TYPE_ROMAN_UPPER,
  ORDINAL_TYPE_SECTION
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
    const labelNode = firstLi.findOne('> p span.label')

    if (!labelNode) {
      return
    }

    const labelParts = this.parseOrdinal(labelNode.getHtml())

    return labelParts ? this.getOrdinalType(labelParts.ordinal, labelParts.prefix) : null
  }

  getOrdinalType (ordinal, prefix = null) {
    // Check if ordinal is number.
    if (!isNaN(ordinal)) {
      return ORDINAL_TYPE_SECTION
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
      case ORDINAL_TYPE_SECTION:
        return num.toString()

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
      case ORDINAL_TYPE_SECTION:
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
    return label.replace(ordinalParseRegex, replacementPattern.replace(/\{0\}/, ordinal))
  }

  /**
   * @param {string} label
   * @param {string} prefix
   * @param {string} replacementPattern
   * @returns {*}
   */
  replacePrefix (label, prefix, replacementPattern = '{0}$2$3') {
    return label.replace(ordinalParseRegex, replacementPattern.replace(/\{0\}/, prefix))
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
      replaceOrdinal: ordinal => this.replaceOrdinal(match, ordinal),
      replacePrefix: prefix => this.replacePrefix(match, prefix)
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

  /**
   * @param {CKEDITOR.dom.element} listItem
   *
   * @returns {boolean}
   */
  isInOrderedList (listItem) {
    const ascendant = listItem.getAscendant({ul: 1, ol: 1})

    return (ascendant && ascendant.is('ol'))
  }

  /**
   * @param {CKEDITOR.dom.element} listItem
   *
   * @returns {*|CKEDITOR.dom.node|CKEDITOR.htmlParser.element}
   */
  getParentListNode (listItem) {
    return listItem.getAscendant({ul: 1, ol: 1})
  }

  /**
   * @param {CKEDITOR.dom.element}  listNode
   * @param {CKEDITOR.dom.document} doc
   */
  findOrCreateLabelNode(listNode, doc) {
    let pNode = listNode.findOne('p')

    // Verify the paragraph tag is in this list item, not a child.
    if (pNode && pNode.getAscendant('li') && !pNode.getAscendant('li').equals(listNode)) {
      pNode = null
    }

    if (!pNode) {
      pNode = doc.createElement('p')
      if (listNode.getFirst()) {
        pNode.insertBefore(listNode.getFirst())
      } else {
        pNode.appendTo(listNode)
      }
    }

    return pNode
  }

  /**
   * This takes the parsed label parts and updates the ordinal, and if necessary, the prefix.
   *
   * @param {Object} labelParts
   * @param {String} prefix
   * @param {String} ordinal
   */
  updateLabel (labelParts, prefix, ordinal) {
    let newLabel = labelParts.replaceOrdinal(ordinal)

    if (labelParts.prefix !== prefix) {
      labelParts = this.parseOrdinal(newLabel)
      newLabel = labelParts.replacePrefix(prefix)
    }

    return newLabel
  }

  /**
   * Looks for an li ascendant of the given child and attempts to find its label.
   * Note that if listItem is a fragment, the ascendant may not be present.
   *
   * @param {CKEDITOR.dom.element}  listItem
   * @param {CKEDITOR.dom.document} doc
   */
  findAscendantOrdinal (listItem, doc) {
    const listItemAscendant = listItem.getAscendant('li')
    let ascendantOrdinal = false

    if (listItemAscendant && listItemAscendant.is('li')) {
      let pNode = this.findOrCreateLabelNode(listItemAscendant, doc)
      let labelNode = pNode ? pNode.findOne('span.label') : null

      ascendantOrdinal = labelNode ? labelNode.getHtml() : false
    }

    return ascendantOrdinal
  }

  /**
   * For section-style ordinals, attempt to find the parent's ordinal to use as a prefix.
   * If it can't be found and we're indenting, and the label already has a prefix, keep it.
   * Otherwise, reset the prefix to an empty string.
   *
   * @param {CKEDITOR.dom.element}  listItem
   * @param {CKEDITOR.dom.document} doc
   * @param {String}                prefix
   * @param {boolean}               indent
   */
  getSectionPrefix (listItem, doc, prefix, indent) {
    const ascendantOrdinal = this.findAscendantOrdinal(listItem, doc)

    return ascendantOrdinal || (indent && prefix !== '' ? prefix : '')
  }

  /**
   * @param {CKEDITOR.dom.element}  listNode
   * @param {CKEDITOR.dom.document} doc
   * @param {CKEDITOR.editor}       editor
   * @param {boolean}               indent
   */
  updateOrderedListLabels (listNode, doc, editor, indent = false) {
    if (!listNode.is('ol')) {
      return
    }

    console.log('--- updateOrderedListLabels')

    const length = listNode.getChildCount()

    // Try to determine the ordinal type.
    let ordinalType = listNode.getCustomData('listType')
    if (!ordinalType) {
      ordinalType = this.getOrdinalTypeFromListItem(listNode)
    }

    for (let i = 0; i < length; i++) {
      const child = listNode.getChild(i)

      let newOrdinal
      const newOrdinalIndex = (ordinalType !== ORDINAL_TYPE_ALPHA_LOWER && ordinalType !== ORDINAL_TYPE_ALPHA_UPPER)
        ? i + 1
        : i

      try {
        newOrdinal = this.convertNumberToOrdinal(newOrdinalIndex, ordinalType)
      } catch (e) {
        newOrdinal = (newOrdinalIndex).toString()
      }

      let pNode = this.findOrCreateLabelNode(child, doc)
      let labelNode = pNode ? pNode.findOne('span.label') : null

      if (labelNode) {
        const labelParts = this.parseOrdinal(labelNode.getHtml())
        const newPrefix = ordinalType === ORDINAL_TYPE_SECTION
          ? this.getSectionPrefix(child, doc, labelParts.prefix, indent)
          : ''

        labelNode.setHtml(this.updateLabel(labelParts, newPrefix, newOrdinal))
      } else {
        labelNode = doc.createElement('span')
        labelNode.addClass('label')

        const labelParts = this.parseOrdinal(newOrdinal + '.')
        const newPrefix = ordinalType === ORDINAL_TYPE_SECTION
          ? this.getSectionPrefix(child, doc, labelParts.prefix, indent)
          : ''

        labelNode.appendText(this.updateLabel(labelParts, newPrefix, newOrdinal))
        if (pNode.getFirst()) {
          labelNode.insertBefore(pNode.getFirst())
        } else {
          labelNode.appendTo(pNode)
        }

        const textNode = doc.createText(' ')
        textNode.insertAfter(labelNode)
      }

      const childrenCount = child.getChildCount()
      for (let k = 0; k < childrenCount; k++) {
        if (child.getChild(k).is('ol')) {
          this.updateOrderedListLabels(child.getChild(k), doc, editor)
        } else if (child.getChild(k).is('ul')) {
          this.updateUnorderedListLabels(child.getChild(k), doc, editor)
        }
      }
    }
  }

  updateListLabels (listNode, doc, editor, indent = false) {
    if (listNode.is('ol')) {
      this.updateOrderedListLabels(listNode, doc, editor, indent)
    } else if (listNode.is('ul')) {
      this.updateUnorderedListLabels(listNode, doc, editor)
    } else {
      throw new Error('Node is not a list.')
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
        } else if (child.getChild(k).is('ol')) {
          this.updateOrderedListLabels(child.getChild(k), doc, editor)
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

  /**
   * @param {Array}  listArray
   * @param {Object} database
   * @param {int}    baseIndex
   * @param {String} paragraphMode
   * @param dir
   * @returns {*}
   */
  arrayToList (listArray, database, baseIndex, paragraphMode, dir) {
    if (!baseIndex) {
      baseIndex = 0
    }

    if (!listArray || listArray.length < baseIndex + 1) { return null }

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
        ({ rootNode, currentListItem } = this.toListWithEqualIndent(
          rootNode,
          listArray,
          currentIndex,
          dir,
          retval,
          currentListItem,
          item,
          orgDir,
        ))

        currentIndex++
      } else if (item.indent == Math.max(indentLevel, 0) + 1) {
        currentIndex = this.toListWithIndent(
          listArray,
          currentIndex,
          paragraphMode,
          orgDir,
          currentListItem,
          doc
        )
      } else if (item.indent == -1 && !baseIndex && itemGrandParent) {
        ({
          currentListItem,
          block,
          currentIndex,
          rootNode
        } = this.toListWithOutdent(
          itemGrandParent,
          currentListItem,
          item,
          orgDir,
          doc,
          paragraphMode,
          block,
          paragraphName,
          currentIndex,
          listArray,
          retval,
          rootNode
        ))
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

  /**
   * @param {CKEDITOR.dom.element} itemGrandParent
   * @param {CKEDITOR.dom.element|CKEDITOR.dom.documentFragment} currentListItem
   * @param {Object} item
   * @param {CKEDITOR.dom.element} item.element
   * @param {String} orgDir
   * @param {CKEDITOR.dom.document} doc
   * @param paragraphMode
   * @param block
   * @param paragraphName
   * @param currentIndex
   * @param listArray
   * @param retval
   * @param rootNode
   * @returns {{currentListItem: *, block: *, currentIndex: *, rootNode: null}}
   */
  toListWithOutdent (itemGrandParent, currentListItem, item, orgDir, doc, paragraphMode, block, paragraphName, currentIndex, listArray, retval, rootNode) {
    // Check if grand parent is ol or ul
    if (listNodeNames[itemGrandParent.getName()]) {
      currentListItem = item.element.clone(false, true)
      if (orgDir != itemGrandParent.getDirection(1)) {
        currentListItem.setAttribute('dir', orgDir)
      }
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

    for (let i = 0; i < count; i++) {
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
        if (dirLoose && !child.getDirection()) {
          child.setAttribute('dir', orgDir)
        }

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
      } else {
        // E.g. BR mode - inline content appended directly to the list item.
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

    return {
      currentListItem,
      block,
      currentIndex,
      rootNode
    }
  }

  toListWithIndent (listArray, currentIndex, paragraphMode, orgDir, currentListItem, doc) {
    // Maintain original direction (#6861).
    const currDir = listArray[currentIndex - 1].element.getDirection(1)
    const listData = CKEDITOR.plugins.list.arrayToList(
      listArray,
      null,
      currentIndex,
      paragraphMode,
      currDir != orgDir ? orgDir : null
    )

    // If the next block is an <li> with another list tree as the first
    // child, we'll need to append a filler (<br>/NBSP) or the list item
    // wouldn't be editable. (#6724)
    if (!currentListItem.getChildCount() && CKEDITOR.env.needsNbspFiller && doc.$.documentMode <= 7) {
      currentListItem.append(doc.createText('\xa0'))
    }

    currentListItem.append(listData.listNode)
    currentIndex = listData.nextIndex

    return currentIndex
  }

  toListWithEqualIndent (rootNode, listArray, currentIndex, dir, retval, currentListItem, item, orgDir) {
    // Check if we need to create parent node for this list item.
    if (!rootNode || listArray[currentIndex].parent.getName() != rootNode.getName()) {
      rootNode = listArray[currentIndex].parent.clone(false, 1)
      dir && rootNode.setAttribute('dir', dir)

      // Check if grandparent is list div wrapper (div.list), and if indenting to base indent level.
      if (
        listArray[currentIndex].indent === 0 &&
        listArray[currentIndex].grandparent &&
        listArray[currentIndex].grandparent.getName() === 'div' &&
        listArray[currentIndex].grandparent.hasClass('list')
      ) {
        // Grandparent is div.list, so clone that, append rootNode, and then append the div.list to retval.
        const wrapperNode = listArray[currentIndex].grandparent.clone(false, true)
        wrapperNode.append(rootNode)
        retval.append(wrapperNode)
      } else {
        // Grandparent is not div.list, so append the list node to retval like normal.
        retval.append(rootNode)
      }
    }

    currentListItem = rootNode.append(item.element.clone(0, 1))

    if (orgDir != rootNode.getDirection(1)) {
      currentListItem.setAttribute('dir', orgDir)
    }

    for (let i = 0; i < item.contents.length; i++) {
      currentListItem.append(item.contents[i].clone(1, 1))
    }

    return {rootNode, currentListItem}
  }
}

export default IccListPlugin
