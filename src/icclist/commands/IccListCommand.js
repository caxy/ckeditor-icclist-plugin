/*global CKEDITOR*/
import {
  nonEmpty,
  listNodeNames,
  changeListType,
  createList,
  removeList,
  mergeListSiblings
} from '../modules/iccListUtils'

/**
 * @constructor
 */
class IccListCommand {
  /**
   * @constructor
   * @param {string} name
   * @param {string} type
   */
  constructor (name, type) {
    this.name = name
    this.type = type
    this.context = type
    this.allowedContent = `${type} li`
    this.requiredContent = type
  }

  exec (editor) {
    let groupObj
    let range
    // Run state check first of all.
    this.refresh(editor, editor.elementPath())

    const config = editor.config
    const selection = editor.getSelection()
    const ranges = selection && selection.getRanges()

    // Midas lists rule #1 says we can create a list even in an empty document.
    // But DOM iterator wouldn't run if the document is really empty.
    // So create a paragraph if the document is empty and we're going to create a list.
    if (this.state == CKEDITOR.TRISTATE_OFF) {
      const editable = editor.editable()
      if (!editable.getFirst(nonEmpty)) {
        config.enterMode == CKEDITOR.ENTER_BR ? editable.appendBogus() : ranges[0].fixBlock(1, config.enterMode == CKEDITOR.ENTER_P ? 'p' : 'div')

        selection.selectRanges(ranges)
      } else {
        // Maybe a single range there enclosing the whole list,
        // turn on the list state manually.
        range = ranges.length == 1 && ranges[0]
        const enclosedNode = range && range.getEnclosedNode()
        if (enclosedNode && enclosedNode.is && this.type == enclosedNode.getName()) {
          this.setState(CKEDITOR.TRISTATE_ON)
        }
      }
    }

    const bookmarks = selection.createBookmarks(true)

    // Group the blocks up because there are many cases where multiple lists have to be created,
    // or multiple lists have to be cancelled.
    const listGroups = []
    const database = {}
    const rangeIterator = ranges.createIterator()
    let index = 0

    while ((range = rangeIterator.getNextRange()) && ++index) {
      const boundaryNodes = range.getBoundaryNodes()
      const startNode = boundaryNodes.startNode
      const endNode = boundaryNodes.endNode

      if (startNode.type == CKEDITOR.NODE_ELEMENT && startNode.getName() == 'td') {
        range.setStartAt(boundaryNodes.startNode, CKEDITOR.POSITION_AFTER_START)
      }

      if (endNode.type == CKEDITOR.NODE_ELEMENT && endNode.getName() == 'td') {
        range.setEndAt(boundaryNodes.endNode, CKEDITOR.POSITION_BEFORE_END)
      }

      const iterator = range.createIterator()
      let block

      iterator.forceBrBreak = (this.state == CKEDITOR.TRISTATE_OFF)

      while ((block = iterator.getNextParagraph())) {
        // Avoid duplicate blocks get processed across ranges.
        if (block.getCustomData('list_block')) {
          continue
        } else {
          CKEDITOR.dom.element.setMarker(database, block, 'list_block', 1)
        }

        const path = editor.elementPath(block)
        const pathElements = path.elements
        const pathElementsCount = pathElements.length
        let processedFlag = 0
        const blockLimit = path.blockLimit
        let element

        // First, try to group by a list ancestor.
        for (let i = pathElementsCount - 1; i >= 0 && (element = pathElements[i]); i--) {
          // Don't leak outside block limit.
          if (listNodeNames[element.getName()] && blockLimit.contains(element)) {
            // If we've encountered a list inside a block limit
            // The last group object of the block limit element should
            // no longer be valid. Since paragraphs after the list
            // should belong to a different group of paragraphs before
            // the list.
            blockLimit.removeCustomData(`list_group_object_${index}`)

            groupObj = element.getCustomData('list_group_object')
            if (groupObj) {
              groupObj.contents.push(block)
            } else {
              groupObj = { root: element, contents: [block] }
              listGroups.push(groupObj)
              CKEDITOR.dom.element.setMarker(database, element, 'list_group_object', groupObj)
            }
            processedFlag = 1
            break
          }
        }

        if (processedFlag) {
          continue
        }

        // No list ancestor? Group by block limit, but don't mix contents from different ranges.
        const root = blockLimit
        if (root.getCustomData(`list_group_object_${index}`)) {
          root.getCustomData(`list_group_object_${index}`).contents.push(block)
        } else {
          groupObj = { root, contents: [block] }
          CKEDITOR.dom.element.setMarker(database, root, `list_group_object_${index}`, groupObj)
          listGroups.push(groupObj)
        }
      }
    }

    // Now we have two kinds of list groups, groups rooted at a list, and groups rooted at a block limit element.
    // We either have to build lists or remove lists, for removing a list does not makes sense when we are looking
    // at the group that's not rooted at lists. So we have three cases to handle.
    const listsCreated = []
    while (listGroups.length > 0) {
      groupObj = listGroups.shift()
      if (this.state == CKEDITOR.TRISTATE_OFF) {
        if (listNodeNames[groupObj.root.getName()]) {
          changeListType(editor, groupObj, database, listsCreated, this.type)
        } else {
          createList(editor, groupObj, listsCreated, this.type)
        }
      } else if (this.state == CKEDITOR.TRISTATE_ON && listNodeNames[groupObj.root.getName()]) {
        removeList.call(this, editor, groupObj, database)
      }
    }

    // For all new lists created, merge into adjacent, same type lists.
    for (let i = 0; i < listsCreated.length; i++) {
      mergeListSiblings(listsCreated[i])
    }

    // Clean up, restore selection and update toolbar button states.
    CKEDITOR.dom.element.clearAllMarkers(database)
    try {
      selection.selectBookmarks(bookmarks)
    } catch (e) {}
    editor.focus()
  }

  refresh (editor, path) {
    const list = path.contains(listNodeNames, 1)
    const limit = path.blockLimit || path.root

    // 1. Only a single type of list activate.
    // 2. Do not show list outside of block limit.
    if (list && limit.contains(list)) {
      this.setState(list.is(this.type) ? CKEDITOR.TRISTATE_ON : CKEDITOR.TRISTATE_OFF)
    } else {
      this.setState(CKEDITOR.TRISTATE_OFF)
    }
  }
}

export default IccListCommand
