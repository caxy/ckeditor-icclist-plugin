/*global CKEDITOR*/
import _ from 'lodash'
import { toArabic, toRoman } from 'roman-numerals'
import { ORDINAL_TYPE_DEFAULT } from './IccListPlugin'

export const whitespaces = CKEDITOR.dom.walker.whitespaces()
export const bookmarks = CKEDITOR.dom.walker.bookmark()
export const headerTagRegex = /^h[1-6]$/
export const elementType = CKEDITOR.dom.walker.nodeType(CKEDITOR.NODE_ELEMENT)
export const blockBogus = CKEDITOR.dom.walker.bogus()

export const cleanUpDirection = element => {
  const dir = element.getDirection()
  let parent
  let parentDir

  if (dir) {
    parent = element.getParent()
    while (parent && !(parentDir = parent.getDirection())) {
      parent = parent.getParent()
    }

    if (dir == parentDir) {
      element.removeAttribute('dir')
    }
  }
}

// Inherit inline styles from another element.
export const inheritInlineStyles = (parent, el) => {
  const style = parent.getAttribute('style')

  // Put parent styles before child styles.
  style && el.setAttribute('style', style.replace(/([^;])$/, '$1;') + (el.getAttribute('style') || ''))
}

/**
 * Merge list adjacent, of same type lists.
 *
 * @param listNode
 */
export const mergeListSiblings = (listNode) => {
  function mergeSibling (rtl) {
    const listWrapper = listNode.is('div') && listNode.hasClass('list') ? listNode : null
    let sibling = listNode[ rtl ? 'getPrevious' : 'getNext' ](nonEmpty)
    let siblingWrapper
    let thisListNode = listNode

    if (listWrapper && sibling && sibling.type == CKEDITOR.NODE_ELEMENT && sibling.is('div') && sibling.hasClass('list')) {
      thisListNode = listWrapper.findOne('> ul, > ol')
      if (!thisListNode) {
        return
      }

      siblingWrapper = sibling
      sibling = siblingWrapper.findOne(`> ${thisListNode.getName()}`)
    }

    if (sibling && sibling.type == CKEDITOR.NODE_ELEMENT && sibling.is(thisListNode.getName())) {
      // Move children order by merge direction.(#3820)
      mergeChildren(thisListNode, sibling, null, !rtl)

      if (listWrapper && siblingWrapper) {
        mergeChildren(listWrapper, siblingWrapper, null, !rtl)
      }

      thisListNode.remove()
      listWrapper.remove()
      listNode = siblingWrapper || sibling
    }
  }

  mergeSibling()
  mergeSibling(1)
}

/**
 * Check if node is block element that recieves text.
 *
 * @param node
 * @returns {boolean|*}
 */
export const isTextBlock = (node) => {
  return node.type == CKEDITOR.NODE_ELEMENT && (node.getName() in CKEDITOR.dtd.$block || node.getName() in CKEDITOR.dtd.$listItem) && CKEDITOR.dtd[ node.getName() ][ '#' ]
}

// Join visually two block lines.
export const joinNextLineToCursor = (editor, cursor, nextCursor) => {
  editor.fire('saveSnapshot')

  // Merge with previous block's content.
  nextCursor.enlarge(CKEDITOR.ENLARGE_LIST_ITEM_CONTENTS)
  const frag = nextCursor.extractContents()

  cursor.trim(false, true)
  const bm = cursor.createBookmark()

  // Kill original bogus;
  const currentPath = new CKEDITOR.dom.elementPath(cursor.startContainer)
  const pathBlock = currentPath.block
  const currentBlock = currentPath.lastElement.getAscendant('li', 1) || pathBlock
  let nextPath = new CKEDITOR.dom.elementPath(nextCursor.startContainer)
  const nextLi = nextPath.contains(CKEDITOR.dtd.$listItem)
  const nextList = nextPath.contains(CKEDITOR.dtd.$list)
  let last

  // Remove bogus node the current block/pseudo block.
  if (pathBlock) {
    const bogus = pathBlock.getBogus()
    bogus && bogus.remove()
  } else if (nextList) {
    last = nextList.getPrevious(nonEmpty)
    if (last && blockBogus(last)) {
      last.remove()
    }
  }

  // Remove label, if exists.
  const first = frag.getFirst()
  if (first && first.type === CKEDITOR.NODE_ELEMENT && first.is('span') && first.hasClass('label')) {
    first.remove()
  }

  // Kill the tail br in extracted.
  last = frag.getLast()
  if (last && last.type == CKEDITOR.NODE_ELEMENT && last.is('br')) {
    last.remove()
  }

  // Insert fragment at the range position.
  const nextNode = cursor.startContainer.getChild(cursor.startOffset)
  if (nextNode) {
    frag.insertBefore(nextNode)
  } else {
    cursor.startContainer.append(frag)
  }

  // Move the sub list nested in the next list item.
  if (nextLi) {
    const sublist = getSubList(nextLi)
    if (sublist) {
      // If next line is in the sub list of the current list item.
      if (currentBlock.contains(nextLi)) {
        mergeChildren(sublist, nextLi.getParent(), nextLi)
        sublist.remove()
      }
      // Migrate the sub list to current list item.
      else {
        currentBlock.append(sublist)
      }
    }
  }

  let nextBlock
  let parent
  // Remove any remaining zombies path blocks at the end after line merged.
  while (nextCursor.checkStartOfBlock() && nextCursor.checkEndOfBlock()) {
    nextPath = nextCursor.startPath()
    nextBlock = nextPath.block

    // Abort when nothing to be removed (#10890).
    if (!nextBlock) { break }

    // Check if also to remove empty list.
    if (nextBlock.is('li')) {
      parent = nextBlock.getParent()
      if (nextBlock.equals(parent.getLast(nonEmpty)) && nextBlock.equals(parent.getFirst(nonEmpty))) {
        nextBlock = parent
      }
    }

    nextCursor.moveToPosition(nextBlock, CKEDITOR.POSITION_BEFORE_START)
    nextBlock.remove()
  }

  // Check if need to further merge with the list resides after the merged block. (#9080)
  const walkerRng = nextCursor.clone()
  const editable = editor.editable()
  walkerRng.setEndAt(editable, CKEDITOR.POSITION_BEFORE_END)
  const walker = new CKEDITOR.dom.walker(walkerRng)
  walker.evaluator = node => nonEmpty(node) && !blockBogus(node)
  const next = walker.next()
  if (
    next &&
    next.type == CKEDITOR.NODE_ELEMENT &&
    (
      next.getName() in CKEDITOR.dtd.$list ||
      (next.getName() === 'div' && next.hasClass('list'))
    )
  ) {
    mergeListSiblings(next)
  }

  cursor.moveToBookmark(bm)

  // Make fresh selection.
  cursor.select()

  editor.fire('saveSnapshot')
}

export const getSubList = (li) => {
  const last = li.getLast(nonEmpty)
  return last && last.type == CKEDITOR.NODE_ELEMENT && last.getName() in listNodeNames ? last : null
}

export const nonEmpty = node => !(whitespaces(node) || bookmarks(node))

export const listNodeNames = { ol: 1, ul: 1 }

/**
 *
 * @param {CKEDITOR.dom.document} doc
 * @returns {string}
 */
export const createGuid = () => {
  const s4 = () => {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1)
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4()
}

/**
 *
 * @param {CKEDITOR.dom.document} doc
 * @param {string} type
 * @returns {*}
 */
export const createListNode = (doc, type) => {
  // todo: check if this is child list and skip inserting wrapper div.
  const divNode = doc.createElement('div')
  divNode.addClass('list')
  const listNode = doc.createElement(type)

  if (type === 'ol') {
    listNode.addClass('no_mark')
  }

  divNode.append(listNode)
  divNode.setAttribute('id', createGuid())

  // Set the list type, using default ordinal type.
  listNode.setCustomData('listType', ORDINAL_TYPE_DEFAULT)

  return divNode
}

/**
 *
 * @param {CKEDITOR.dom.document} doc
 * @param {string} type
 * @param {string|number} index
 * @param {boolean} insertLabel
 */
export const createListItemNode = (doc, type, index = 1, insertLabel = true) => {
  const listItem = doc.createElement('li')
  const paragraphNode = doc.createElement('p')

  // Add the paragraph as child of list item.
  paragraphNode.appendTo(listItem)

  // Add span for label if numbered list.
  if (type === 'ol' && insertLabel) {
    const labelNode = doc.createElement('span')
    labelNode.addClass('label')
    labelNode.appendText(`${index}.`)
    // Add label to the paragraph node.
    labelNode.appendTo(paragraphNode)

    // Insert space after label.
    const textNode = doc.createText(' ')
    textNode.insertAfter(labelNode)
  }

  return listItem
}

export const changeListType = (editor, groupObj, database, listsCreated, type) => {
  // This case is easy...
  // 1. Convert the whole list into a one-dimensional array.
  // 2. Change the list type by modifying the array.
  // 3. Recreate the whole list by converting the array to a list.
  // 4. Replace the original list with the recreated list.
  const listArray = CKEDITOR.plugins.list.listToArray(groupObj.root, database)
  const selectedListItems = []
  const root = groupObj.root
  const doc = root.getDocument()

  for (var i = 0; i < groupObj.contents.length; i++) {
    let itemNode = groupObj.contents[ i ]
    itemNode = itemNode.getAscendant('li', true)

    if (!itemNode || itemNode.getCustomData('list_item_processed')) {
      continue
    }

    selectedListItems.push(itemNode)
    CKEDITOR.dom.element.setMarker(database, itemNode, 'list_item_processed', true)
  }

  let listNode
  let newListNode

  for (i = 0; i < selectedListItems.length; i++) {
    const listIndex = selectedListItems[ i ].getCustomData('listarray_index')
    listNode = listArray[ listIndex ].parent

    // Switch to new list node for this particular item.
    if (!listNode.is(type)) {
      newListNode = createListNode(doc, type).getFirst()
      // Copy all attributes, except from 'start' and 'type'.
      listNode.copyAttributes(newListNode, { start: 1, type: 1 })
      // The list-style-type property should be ignored.
      newListNode.removeStyle('list-style-type')
      listArray[ listIndex ].parent = newListNode
    }
  }

  const newList = CKEDITOR.plugins.list.arrayToList(listArray, database, null, editor.config.enterMode)
  var child
  const length = newList.listNode.getChildCount()
  for (i = 0; i < length && (child = newList.listNode.getChild(i)); i++) {
    if (child.getName() == type) {
      listsCreated.push(child)
    }
  }

  newList.listNode.replace(groupObj.root)

  const listCount = listsCreated.length
  for (let i = 0; i < listCount; i++) {
    const child = listsCreated[i]
    if (child.getName() == 'ol') {
      const grandparent = child.getParent().getParent()
      const isExceptionList = grandparent && grandparent.hasClass('exception')
      const listAscendant = grandparent.getAscendant('ol')
      const descendedFromList = listAscendant && listAscendant.getParent().hasClass('list')

      if(!(isExceptionList && descendedFromList)) {
        CKEDITOR.plugins.list.updateOrderedListLabels(child, doc, editor)
      }
    } else if (child.getName() == 'ul') {
      CKEDITOR.plugins.list.updateUnorderedListLabels(child, doc, editor)
    }
  }

  editor.fire('contentDomInvalidated')
}

export const createList = ({config}, groupObj, listsCreated, type) => {
  const contents = groupObj.contents
  const doc = groupObj.root.getDocument()
  const listContents = []

  // It is possible to have the contents returned by DomRangeIterator to be the same as the root.
  // e.g. when we're running into table cells.
  // In such a case, enclose the childNodes of contents[0] into a <div>.
  if (contents.length == 1 && contents[ 0 ].equals(groupObj.root)) {
    const divBlock = doc.createElement('div')
    contents[ 0 ].moveChildren && contents[ 0 ].moveChildren(divBlock)
    contents[ 0 ].append(divBlock)
    contents[ 0 ] = divBlock
  }

  // Calculate the common parent node of all content blocks.
  let commonParent = groupObj.contents[ 0 ].getParent()
  for (var i = 0; i < contents.length; i++) {
    commonParent = commonParent.getCommonAncestor(contents[ i ].getParent())
  }

  let useComputedState = config.useComputedState
  let listDir
  let explicitDirection

  useComputedState = useComputedState === undefined || useComputedState

  // We want to insert things that are in the same tree level only, so calculate the contents again
  // by expanding the selected blocks to the same tree level.
  for (i = 0; i < contents.length; i++) {
    let contentNode = contents[ i ]
    let parentNode
    while ((parentNode = contentNode.getParent())) {
      if (parentNode.equals(commonParent)) {
        listContents.push(contentNode)

        // Determine the lists's direction.
        if (!explicitDirection && contentNode.getDirection()) {
          explicitDirection = 1
        }

        const itemDir = contentNode.getDirection(useComputedState)

        if (listDir !== null) {
          // If at least one LI have a different direction than current listDir, we can't have listDir.
          if (listDir && listDir != itemDir) {
            listDir = null
          } else {
            listDir = itemDir
          }
        }

        break
      }
      contentNode = parentNode
    }
  }

  if (listContents.length < 1) {
    return
  }

  // Insert the list to the DOM tree.
  const insertAnchor = listContents[ listContents.length - 1 ].getNext()
  const listNodeWrapper = createListNode(doc, type)
  const listNode = listNodeWrapper.getFirst()

  listsCreated.push(listNode)

  let contentBlock
  let listItem
  let listIndex = 1

  while (listContents.length) {
    contentBlock = listContents.shift()

    // If content block already has a label, no need to insert one.
    const insertLabel = !contentBlock.findOne('> p > span.label')

    listItem = createListItemNode(doc, type, listIndex, insertLabel)
    const targetContentNode = listItem.findOne('> p') || listItem

    // If current block should be preserved, append it to list item instead of
    // transforming it to <li> element.
    if (shouldPreserveBlock(contentBlock)) {
      // todo: instead of blindly appending into the <p> tag,
      // we should check if this block is compatible.
      contentBlock.appendTo(targetContentNode)
    } else {
      contentBlock.copyAttributes(listItem)
      // Remove direction attribute after it was merged into list root. (#7657)
      if (listDir && contentBlock.getDirection()) {
        listItem.removeStyle('direction')
        listItem.removeAttribute('dir')
      }
      contentBlock.moveChildren(targetContentNode)
      contentBlock.remove()
    }

    listItem.appendTo(listNode)

    listIndex++
  }

  // Apply list root dir only if it has been explicitly declared.
  if (listDir && explicitDirection) {
    listNode.setAttribute('dir', listDir)
  }

  if (insertAnchor) {
    listNodeWrapper.insertBefore(insertAnchor)
  } else { listNodeWrapper.appendTo(commonParent) }

  return listNodeWrapper.getAttribute('id')
}

export const removeList = (editor, {root, contents}, database) => {
  // This is very much like the change list type operation.
  // Except that we're changing the selected items' indent to -1 in the list array.
  const listArray = CKEDITOR.plugins.list.listToArray(root, database)
  const selectedListItems = []

  for (var i = 0; i < contents.length; i++) {
    let itemNode = contents[ i ]
    itemNode = itemNode.getAscendant('li', true)
    if (!itemNode || itemNode.getCustomData('list_item_processed')) {
      continue
    }
    selectedListItems.push(itemNode)
    CKEDITOR.dom.element.setMarker(database, itemNode, 'list_item_processed', true)
  }

  let lastListIndex = null
  for (i = 0; i < selectedListItems.length; i++) {
    const listIndex = selectedListItems[ i ].getCustomData('listarray_index')
    listArray[ listIndex ].indent = -1
    lastListIndex = listIndex
  }

  // After cutting parts of the list out with indent=-1, we still have to maintain the array list
  // model's nextItem.indent <= currentItem.indent + 1 invariant. Otherwise the array model of the
  // list cannot be converted back to a real DOM list.
  for (i = lastListIndex + 1; i < listArray.length; i++) {
    if (listArray[ i ].indent > listArray[ i - 1 ].indent + 1) {
      const indentOffset = listArray[ i - 1 ].indent + 1 - listArray[ i ].indent
      const oldIndent = listArray[ i ].indent
      while (listArray[ i ] && listArray[ i ].indent >= oldIndent) {
        listArray[ i ].indent += indentOffset
        i++
      }
      i--
    }
  }

  const newList = CKEDITOR.plugins.list.arrayToList(listArray, database, null, editor.config.enterMode, root.getAttribute('dir'))

  // Compensate <br> before/after the list node if the surrounds are non-blocks.(#3836)
  const docFragment = newList.listNode
  let boundaryNode
  let siblingNode

  function compensateBrs (isStart) {
    if (
      (boundaryNode = docFragment[ isStart ? 'getFirst' : 'getLast' ]()) &&
      !(boundaryNode.is && boundaryNode.isBlockBoundary()) &&
      (siblingNode = root[ isStart ? 'getPrevious' : 'getNext' ](CKEDITOR.dom.walker.invisible(true))) &&
      !(siblingNode.is && siblingNode.isBlockBoundary({ br: 1 }))
    ) {
      editor.document.createElement('br')[ isStart ? 'insertBefore' : 'insertAfter' ](boundaryNode)
    }
  }
  compensateBrs(true)
  compensateBrs()

  docFragment.replace(root)

  editor.fire('contentDomInvalidated')
}

/**
 * Checks whether this block should be element preserved (not transformed to <li>) when creating list.
 *
 * @param block
 * @returns {*|boolean}
 */
export const shouldPreserveBlock = (block) => {
  return (
    // #5335
    block.is('pre') ||
    // #5271 - this is a header.
    headerTagRegex.test(block.getName()) ||
    // 11083 - this is a non-editable element.
    block.getAttribute('contenteditable') == 'false'
  )
}

/**
 * Merge child nodes with direction preserved. (#7448)
 *
 * @param from
 * @param into
 * @param refNode
 * @param forward
 */
export const mergeChildren = (from, into, refNode, forward) => {
  let child
  let itemDir
  while ((child = from[ forward ? 'getLast' : 'getFirst' ](elementType))) {
    if ((itemDir = child.getDirection(1)) !== into.getDirection(1)) { child.setAttribute('dir', itemDir) }

    child.remove()

    refNode ? child[ forward ? 'insertBefore' : 'insertAfter' ](refNode) : into.append(child, forward)
  }
}

/**
 * Check if this list item is inside a nested exception list
 *
 * @param from
 * @param into
 * @param refNode
 * @param forward
 */
export const isNestedExceptionList = (parent) => {
  const grandparent = parent.getParent().getParent()
  const isExceptionList = grandparent && grandparent.hasClass('exception')
  const listAscendant = grandparent && grandparent.getAscendant('ol')
  const descendedFromList = listAscendant && listAscendant.getParent().hasClass('list')

  return isExceptionList && descendedFromList
}
