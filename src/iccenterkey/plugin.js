/*global CKEDITOR*/
((() => {
  CKEDITOR.plugins.add(
    'iccenterkey', {
      init (editor) {
        editor.addCommand(
          'enter', {
            modes: {wysiwyg: 1},
            editorFocus: false,
            exec (editor) {
              enter(editor)
            }
          }
        )

        editor.addCommand(
          'shiftEnter', {
            modes: {wysiwyg: 1},
            editorFocus: false,
            exec (editor) {
              shiftEnter(editor)
            }
          }
        )

        editor.setKeystroke(
          [
            [13, 'enter'],
            [CKEDITOR.SHIFT + 13, 'shiftEnter']
          ]
        )
      }
    }
  )

  const whitespaces = CKEDITOR.dom.walker.whitespaces()
  const bookmark = CKEDITOR.dom.walker.bookmark()
  const headerTagRegex = /^h[1-6]$/

  CKEDITOR.plugins.enterkey = {
    enterInEmptyBlockquote (block, range) {
      block.breakParent(block.getParent())

      // If we were at the start of <blockquote>, there will be an empty element before it now.
      if (!block.getPrevious().getFirst(CKEDITOR.dom.walker.invisible(1))) {
        block.getPrevious().remove()
      }

      // If we were at the end of <blockquote>, there will be an empty element after it now.
      if (!block.getNext().getFirst(CKEDITOR.dom.walker.invisible(1))) {
        block.getNext().remove()
      }

      range.moveToElementEditStart(block)
      range.select()
    },
    calculateNewListIndex (previousListItemNode) {
      let newListIndex = 1

      if (previousListItemNode && previousListItemNode.findOne('p span.label')) {
        const prevLabel = previousListItemNode.findOne('p span.label')
        const labelParts = CKEDITOR.plugins.list.parseOrdinal(prevLabel.getHtml())

        if (labelParts) {
          const newOrdinal = CKEDITOR.plugins.list.translateOrdinal(labelParts.ordinal, 1)
          newListIndex = labelParts.replaceOrdinal(newOrdinal)
        }
      }
      return newListIndex
    },
    /**
     *
     * @param {CKEDITOR.dom.element}  newBlock
     * @param {CKEDITOR.dom.document} doc
     * @param {CKEDITOR.dom.element}  previousListItemNode
     * @param {boolean}                  orderedList
     * @returns {*}
     */
    addListItemElements (newBlock, doc, previousListItemNode = null, orderedList = false) {
      let pNode
      if (newBlock.is('li')) {
        if (
          newBlock.getChildren().count() > 0 &&
          newBlock.getChildren().getItem(0).type === CKEDITOR.NODE_ELEMENT &&
          newBlock.getChildren().getItem(0).getName() === 'p'
        ) {
          pNode = newBlock.getChildren().getItem(0)
        } else {
          pNode = doc.createElement('p')
          if (newBlock.getChildren().count() > 0) {
            pNode.insertBefore(newBlock.getChildren().getItem(0))
          } else {
            pNode.appendTo(newBlock)
          }
        }
      } else if (newBlock.is('p')) {
        pNode = newBlock
      }

      // Add label and next index for ordered lists.
      if (orderedList) {
        // Calculate the new index...
        const newListIndex = this.calculateNewListIndex(previousListItemNode)

        if (pNode) {
          let labelNode
          if (
            pNode.getChildren().count() > 0 &&
            pNode.getChildren().getItem(0) === CKEDITOR.NODE_ELEMENT &&
            pNode.getChildren().getItem(0).getName() === 'span' &&
            pNode.getChildren().getItem(0).hasClass('label')
          ) {
            // Label exists.
            labelNode = pNode.getChildren().getItem(0)
            if (!labelNode.getFirst()) {
              labelNode.appendText(newListIndex)
            }
          } else {
            labelNode = doc.createElement('span')
            labelNode.addClass('label')
            labelNode.appendText(newListIndex)
            if (pNode.getFirst()) {
              labelNode.insertBefore(pNode.getFirst())
            } else {
              pNode.append(labelNode)
            }
          }

          if (labelNode) {
            // Insert space after label node.
            doc.createText(' ').insertAfter(labelNode)
          }
        }
      }

      // Return paragraph node to set cursor.
      return pNode
    },
    /**
     *
     * @param {CKEDITOR.dom.element} listItem
     * @param {CKEDITOR.editor} editor
     */
    isListItemEmpty (listItem, editor) {
      const length = listItem.getChildCount()
      let isEmpty = true
      for (let i = 0; i < length; i++) {
        const child = listItem.getChild(i)
        if (
          child && !(
            bookmark(child) ||
            whitespaces(child) ||
            (child.type === CKEDITOR.NODE_TEXT && child.getText() === '\xa0') ||
            (child.type === CKEDITOR.NODE_ELEMENT &&
              (
                (child.getName() === 'span' && child.hasClass('label')) ||
                (child.getName() === 'p' && this.isListItemEmpty(child, editor)) ||
                child.getName() in CKEDITOR.dtd.$empty
              )
            )
          )) {
          isEmpty = false
          break
        }
      }

      return isEmpty
    },
    /**
     * @param {CKEDITOR.dom.element} block
     */
    inOrderedList (block) {
      const list = block.getAscendant({ul: 1, ol: 1})

      return list && list.getName() === 'ol'
    },
    enterBlock (editor, mode, range, forceMode) {
      range = range || getRange(editor)
      // We may not have valid ranges to work on, like when inside a
      // contenteditable=false element.
      if (!range) {
        return
      }

      // When range is in nested editable, we have to replace range with this one,
      // which have root property set to closest editable, to make auto paragraphing work. (#12162)
      range = replaceRangeWithClosestEditableRoot(range)

      const doc = range.document

      let atBlockStart = range.checkStartOfBlock()
      let atBlockEnd = range.checkEndOfBlock()
      let path = editor.elementPath(range.startContainer)
      let block = path.block
      let blockTag = (mode == CKEDITOR.ENTER_DIV ? 'div' : 'p')
      /** @type {CKEDITOR.dom.element} */
      let newBlock
      const isInOrderedList = (block.getAscendant('li', true) && CKEDITOR.plugins.enterkey.inOrderedList(block))
      const parentList = block.getAscendant({ul: 1, ol: 1})

      // Exit the list when we're inside an empty list item block.
      if (
        (atBlockStart && atBlockEnd) ||
        (
          isInOrderedList &&
          CKEDITOR.plugins.enterkey.isListItemEmpty(block.getAscendant('li', true), editor)
        )
      ) {
        // Exit the list when we're inside an empty list item block. (#5376)
        if (block && (block.is('li') || block.getParent().is('li'))) {
          CKEDITOR.plugins.enterkey.enterInEmptyListItem(block, editor, path, newBlock, doc, mode)

          return
        }

        if (block && block.getParent().is('blockquote')) {
          CKEDITOR.plugins.enterkey.enterInEmptyBlockquote(block, range)

          return
        }
      } else if (block && block.is('pre')) {
        // Don't split <pre> if we're in the middle of it, act as shift enter key.
        if (!atBlockEnd) {
          CKEDITOR.plugins.enterkey.enterBr(editor, mode, range, forceMode)

          return
        }
      }

      // Split the range.
      const splitInfo = range.splitBlock(blockTag)

      if (!splitInfo) {
        return
      }

      // Get the current blocks.
      const previousBlock = splitInfo.previousBlock
      const nextBlock = splitInfo.nextBlock

      const isStartOfBlock = splitInfo.wasStartOfBlock
      const isEndOfBlock = splitInfo.wasEndOfBlock

      let node
      let previousListItemNode

      // If this is a block under a list item, split it as well. (#1647)
      if (nextBlock) {
        node = nextBlock.getParent()
        if (node.is('li')) {
          previousListItemNode = node.clone()
          nextBlock.breakParent(node)
          nextBlock.move(nextBlock.getNext(), 1)
        }
      } else if (previousBlock && (node = previousBlock.getParent()) && node.is('li')) {
        previousListItemNode = node.clone()
        previousBlock.breakParent(node)
        node = previousBlock.getNext() // = <li></li>
        range.moveToElementEditStart(node)
        previousBlock.move(previousBlock.getPrevious()) // move p tag back into the <li>

        if (node.getFirst() && (node.getFirst().is('ol') || node.getFirst().is('ul'))) {
          // If the next list item has a list as first child, add empty label.
          const paragraphNode = doc.createElement('p')
          const labelNode = doc.createElement('span')
          labelNode.addClass('label')
          paragraphNode.insertBefore(node.getFirst())
          range.moveToElementEditStart(node)
        }
      }

      // If we have both the previous and next blocks, it means that the
      // boundaries were on separated blocks, or none of them where on the
      // block limits (start/end).
      if (!isStartOfBlock && !isEndOfBlock) {
        // If the next block is an <li> with another list tree as the first
        // child, we'll need to append a filler (<br>/NBSP) or the list item
        // wouldn't be editable. (#1420)
        if (nextBlock.is('li')) {
          const walkerRange = range.clone()
          walkerRange.selectNodeContents(nextBlock)
          const walker = new CKEDITOR.dom.walker(walkerRange)
          walker.evaluator = node => !(bookmark(node) || whitespaces(node) || node.type == CKEDITOR.NODE_ELEMENT && node.getName() in CKEDITOR.dtd.$inline && !(node.getName() in CKEDITOR.dtd.$empty))

          node = walker.next()
          if (node && node.type == CKEDITOR.NODE_ELEMENT && node.is('ul', 'ol')) {
            (CKEDITOR.env.needsBrFiller ? doc.createElement('br') : doc.createText('\xa0')).insertBefore(node)
          }
        }

        // Set reference to the preceding list item, which is used to determine the new list number.
        if (previousBlock && (previousBlock.is('li'))) {
          previousListItemNode = previousBlock
        } else if (previousBlock.getParent() && previousBlock.getParent().is('li')) {
          previousListItemNode = previousBlock.getParent()
        }

        // Move the selection to the end block.
        if (nextBlock) {
          const newParagraphBlock = CKEDITOR.plugins.enterkey.addListItemElements(
            nextBlock,
            doc,
            previousListItemNode,
            isInOrderedList
          )
          range.moveToElementEditEnd(newParagraphBlock)
        }
      } else {
        let newBlockDir

        if (previousBlock) {
          // Do not enter this block if it's a header tag, or we are in
          // a Shift+Enter (#77). Create a new block element instead
          // (later in the code).
          if (previousBlock.is('li') || !(headerTagRegex.test(previousBlock.getName()) || previousBlock.is('pre'))) {
            previousListItemNode = previousBlock.getAscendant('li', true)
            // Otherwise, duplicate the previous block.
            newBlock = previousBlock.clone()
          }
        } else if (nextBlock) {
          newBlock = nextBlock.clone()
        }

        if (!newBlock) {
          // We have already created a new list item. (#6849)
          if (node && node.is('li')) {
            newBlock = node
          } else {
            newBlock = doc.createElement(blockTag)
            if (previousBlock && (newBlockDir = previousBlock.getDirection())) {
              newBlock.setAttribute('dir', newBlockDir)
            }
          }
        } else if (forceMode && !newBlock.is('li')) {
          // Force the enter block unless we're talking of a list item.
          newBlock.renameNode(blockTag)
        }

        // Recreate the inline elements tree, which was available
        // before hitting enter, so the same styles will be available in
        // the new block.
        const elementPath = splitInfo.elementPath
        if (elementPath) {
          for (let i = 0, len = elementPath.elements.length; i < len; i++) {
            let element = elementPath.elements[i]

            if (element.equals(elementPath.block) || element.equals(elementPath.blockLimit)) {
              break
            }

            if (CKEDITOR.dtd.$removeEmpty[element.getName()]) {
              element = element.clone()
              newBlock.moveChildren(element)
              newBlock.append(element)
            }
          }
        }

        const newParagraphBlock = CKEDITOR.plugins.enterkey.addListItemElements(
          newBlock,
          doc,
          previousListItemNode,
          isInOrderedList
        )

        newBlock.appendBogus()

        if (!newBlock.getParent()) {
          range.insertNode(newBlock)
        }

        // list item start number should not be duplicated (#7330), but we need
        // to remove the attribute after it's onto the DOM tree because of old IEs (#7581).
        newBlock.is('li') && newBlock.removeAttribute('value')

        // This is tricky, but to make the new block visible correctly
        // we must select it.
        // The previousBlock check has been included because it may be
        // empty if we have fixed a block-less space (like ENTER into an
        // empty table cell).
        if (CKEDITOR.env.ie && isStartOfBlock && (!isEndOfBlock || !previousBlock.getChildCount())) {
          // Move the selection to the new block.
          range.moveToElementEditStart(isEndOfBlock ? previousBlock : newBlock)
          range.select()
        }

        // Move the selection to the new block.
        range.moveToElementEditEnd(newParagraphBlock)
      }

      if (parentList && isInOrderedList) {
        // Renumber list.
        console.log('--- here')
        console.log(parentList)
        CKEDITOR.plugins.list.updateOrderedListLabels(parentList, doc, editor)
      }

      range.select()
      range.scrollIntoView()
    },

    enterAtEndOfHeader (startBlock, doc, range) {
      let newBlock
      let newBlockDir

      if ((newBlockDir = startBlock.getDirection())) {
        newBlock = doc.createElement('div')
        newBlock.setAttribute('dir', newBlockDir)
        newBlock.insertAfter(startBlock)
        range.setStart(newBlock, 0)
      } else {
        // Insert a <br> after the current paragraph.
        doc.createElement('br').insertAfter(startBlock)

        // A text node is required by Gecko only to make the cursor blink.
        if (CKEDITOR.env.gecko) {
          doc.createText('').insertAfter(startBlock)
        }

        // IE has different behaviors regarding position.
        range.setStartAt(
          startBlock.getNext(),
          CKEDITOR.env.ie ? CKEDITOR.POSITION_BEFORE_START : CKEDITOR.POSITION_AFTER_START
        )
      }
    },
    enterBr (editor, mode, range, forceMode) {
      range = range || getRange(editor)
      // We may not have valid ranges to work on, like when inside a
      // contenteditable=false element.
      if (!range) {
        return
      }

      const doc = range.document

      const isEndOfBlock = range.checkEndOfBlock()

      const elementPath = new CKEDITOR.dom.elementPath(editor.getSelection().getStartElement())

      const startBlock = elementPath.block
      const startBlockTag = startBlock && elementPath.block.getName()

      // Handle via enterBlock when not in forceMode and when in a list item or child of list item.
      if (!forceMode && (startBlock && (startBlock.getParent().getName() == 'li' || startBlockTag == 'li'))) {
        CKEDITOR.plugins.enterkey.enterBlock(editor, mode, range, forceMode)
        return
      }

      // If we are at the end of a header block.
      if (!forceMode && isEndOfBlock && headerTagRegex.test(startBlockTag)) {
        this.enterAtEndOfHeader(startBlock, doc, range)
      } else {
        let lineBreak

        // IE<8 prefers text node as line-break inside of <pre> (#4711).
        if (startBlockTag == 'pre' && CKEDITOR.env.ie && CKEDITOR.env.version < 8) {
          lineBreak = doc.createText('\r')
        } else {
          lineBreak = doc.createElement('br')
        }

        // Remove the selected content and replace it with the linebreak.
        range.deleteContents()
        range.insertNode(lineBreak)

        // Old IEs have different behavior regarding position.
        if (!CKEDITOR.env.needsBrFiller) {
          range.setStartAt(lineBreak, CKEDITOR.POSITION_AFTER_END)
        } else {
          // A text node is required by Gecko only to make the cursor blink.
          // We need some text inside of it, so the bogus <br> is properly
          // created.
          doc.createText('\ufeff').insertAfter(lineBreak)

          // If we are at the end of a block, we must be sure the bogus node is available in that block.
          if (isEndOfBlock) {
            // In most situations we've got an elementPath.block (e.g. <p>), but in a
            // blockless editor or when autoP is false that needs to be a block limit.
            (startBlock || elementPath.blockLimit).appendBogus()
          }

          // Now we can remove the text node contents, so the caret doesn't
          // stop on it.
          lineBreak.getNext().$.nodeValue = ''

          range.setStartAt(lineBreak.getNext(), CKEDITOR.POSITION_AFTER_START)
        }
      }

      // This collapse guarantees the cursor will be blinking.
      range.collapse(true)

      range.select()
      range.scrollIntoView()
    },
    /**
     *
     * @param {CKEDITOR.dom.element} block
     * @param {CKEDITOR.editor} editor
     * @param path
     * @param {CKEDITOR.dom.element} newBlock
     * @param {CKEDITOR.dom.document} doc
     * @param mode
     * @returns {{block: *, newBlock: *}}
     */
    enterInEmptyListItem (block, editor, path, newBlock, doc, mode) {
      // todo: renumber if list item moved up nested lists.
      // Make sure to point to the li when dealing with empty list item.
      if (!block.is('li')) {
        block = block.getParent()
      }

      const blockParent = block.getParent()
      const blockGrandParent = blockParent.getParent()
      const firstChild = !block.hasPrevious()
      const lastChild = !block.hasNext()
      const selection = editor.getSelection()
      const bookmarks = selection.createBookmarks()
      const orgDir = block.getDirection(1)
      const className = block.getAttribute('class')
      const style = block.getAttribute('style')
      const dirLoose = blockGrandParent.getDirection(1) != orgDir
      const enterMode = editor.enterMode
      const needsBlock = enterMode != CKEDITOR.ENTER_BR || dirLoose || style || className
      let child
      const isGrandParentListWrapper = blockGrandParent && (blockGrandParent.getName() === 'div' || blockGrandParent.hasClass(
          'list'
        ))
      const targetParentNode = isGrandParentListWrapper ? blockGrandParent : blockParent
      let newSelectionTarget

      if (blockGrandParent.is('li')) {
        // If block is the first or the last child of the parent
        // list, degrade it and move to the outer list:
        // before the parent list if block is first child and after
        // the parent list if block is the last child, respectively.
        //
        //  <ul>                         =>      <ul>
        //      <li>                     =>          <li>
        //          <ul>                 =>              <ul>
        //              <li>x</li>       =>                  <li>x</li>
        //              <li>^</li>       =>              </ul>
        //          </ul>                =>          </li>
        //      </li>                    =>          <li>^</li>
        //  </ul>                        =>      </ul>
        //
        //                              AND
        //
        //  <ul>                         =>      <ul>
        //      <li>                     =>          <li>^</li>
        //          <ul>                 =>          <li>
        //              <li>^</li>       =>              <ul>
        //              <li>x</li>       =>                  <li>x</li>
        //          </ul>                =>              </ul>
        //      </li>                    =>          </li>
        //  </ul>                        =>      </ul>

        if (firstChild || lastChild) {
          // If it's only child, we don't want to keep perent ul anymore.
          if (firstChild && lastChild) {
            blockParent.remove()
          }

          block[lastChild ? 'insertAfter' : 'insertBefore'](blockGrandParent)

          // If the empty block is neither first nor last child
          // then split the list and the block as an element
          // of outer list.
          //
          //                              =>      <ul>
          //                              =>          <li>
          //  <ul>                        =>              <ul>
          //      <li>                    =>                  <li>x</li>
          //          <ul>                =>              </ul>
          //              <li>x</li>      =>          </li>
          //              <li>^</li>      =>          <li>^</li>
          //              <li>y</li>      =>          <li>
          //          </ul>               =>              <ul>
          //      </li>                   =>                  <li>y</li>
          //  </ul>                       =>              </ul>
          //                              =>          </li>
          //                              =>      </ul>
        } else {
          block.breakParent(blockGrandParent)
        }

        const parentList = blockGrandParent.getAscendant({ul: 1, ol: 1})
        CKEDITOR.plugins.list.updateListLabels(parentList, doc, editor)
      } else if (!needsBlock) {
        block.appendBogus(true)

        // If block is the first or last child of the parent
        // list, move all block's children out of the list:
        // before the list if block is first child and after the list
        // if block is the last child, respectively.
        //
        //  <ul>                       =>      <ul>
        //      <li>x</li>             =>          <li>x</li>
        //      <li>^</li>             =>      </ul>
        //  </ul>                      =>      ^
        //
        //                            AND
        //
        //  <ul>                       =>      ^
        //      <li>^</li>             =>      <ul>
        //      <li>x</li>             =>          <li>x</li>
        //  </ul>                      =>      </ul>

        if (firstChild || lastChild) {
          if (!CKEDITOR.plugins.enterkey.isListItemEmpty(block, editor)) {
            while ((child = block[firstChild ? 'getFirst' : 'getLast']())) {
              child[firstChild ? 'insertBefore' : 'insertAfter'](targetParentNode)
            }
          } else {
            // Append just bogus, list item was empty.
            const placeholderNode = doc.createElement('p')
            placeholderNode.appendBogus(true)
            placeholderNode[firstChild ? 'insertBefore' : 'insertAfter'](targetParentNode)
            newSelectionTarget = placeholderNode
          }

          const parentList = blockParent.getAscendant({ul: 1, ol: 1}, true)
          CKEDITOR.plugins.list.updateListLabels(parentList, doc, editor)
        } else {
          // If the empty block is neither first nor last child
          // then split the list and put all the block contents
          // between two lists.
          //
          //  <ul>                       =>      <ul>
          //      <li>x</li>             =>          <li>x</li>
          //      <li>^</li>             =>      </ul>
          //      <li>y</li>             =>      ^
          //  </ul>                      =>      <ul>
          //                             =>          <li>y</li>
          //                             =>      </ul>
          // If grandparent is div.list, then break on that instead of the list.
          block.breakParent(targetParentNode)

          let nextList = block.getNext()

          if (!CKEDITOR.plugins.enterkey.isListItemEmpty(block, editor)) {
            while ((child = block.getLast())) {
              child.insertAfter(targetParentNode)
            }
          } else {
            // Append just bogus, list item was empty.
            const placeholderNode = doc.createElement('p')
            placeholderNode.appendBogus(true)
            placeholderNode.insertAfter(targetParentNode)
            newSelectionTarget = placeholderNode
          }

          const parentList = blockParent.getAscendant({ul: 1, ol: 1}, true)

          if (isGrandParentListWrapper) {
            nextList = nextList.findOne('ul, ol')
          }

          CKEDITOR.plugins.list.updateListLabels(parentList, doc, editor)
          if (nextList && (nextList.type === CKEDITOR.NODE_ELEMENT && (nextList.is('ul') || nextList.is('ol')))) {
            CKEDITOR.plugins.list.updateListLabels(nextList, doc, editor)
          }
        }

        block.remove()
      } else {
        // Original path block is the list item, create new block for the list item content.
        if (path.block.is('li')) {
          // Use <div> block for ENTER_BR and ENTER_DIV.
          newBlock = doc.createElement(mode == CKEDITOR.ENTER_P ? 'p' : 'div')

          if (dirLoose) {
            newBlock.setAttribute('dir', orgDir)
          }

          style && newBlock.setAttribute('style', style)
          className && newBlock.setAttribute('class', className)

          // Move all the child nodes to the new block.
          block.moveChildren(newBlock)
        } else {
          // The original path block is not a list item, just copy the block to out side of the list.
          newBlock = path.block
        }

        // If block is the first or last child of the parent
        // list, move it out of the list:
        // before the list if block is first child and after the list
        // if block is the last child, respectively.
        //
        //  <ul>                       =>      <ul>
        //      <li>x</li>             =>          <li>x</li>
        //      <li>^</li>             =>      </ul>
        //  </ul>                      =>      <p>^</p>
        //
        //                            AND
        //
        //  <ul>                       =>      <p>^</p>
        //      <li>^</li>             =>      <ul>
        //      <li>x</li>             =>          <li>x</li>
        //  </ul>                      =>      </ul>

        if (firstChild || lastChild) {
          newBlock[firstChild ? 'insertBefore' : 'insertAfter'](targetParentNode)

          const parentList = blockParent.getAscendant({ul: 1, ol: 1}, true)
          CKEDITOR.plugins.list.updateListLabels(parentList, doc, editor)
        } else {
          // If the empty block is neither first nor last child
          // then split the list and put the new block between
          // two lists.
          //
          //                             =>       <ul>
          //     <ul>                    =>           <li>x</li>
          //         <li>x</li>          =>       </ul>
          //         <li>^</li>          =>       <p>^</p>
          //         <li>y</li>          =>       <ul>
          //     </ul>                   =>           <li>y</li>
          //                             =>       </ul>
          block.breakParent(targetParentNode)
          let nextList = block.getNext()
          newBlock.insertAfter(targetParentNode)

          const parentList = blockParent.getAscendant({ul: 1, ol: 1}, true)

          if (isGrandParentListWrapper) {
            nextList = nextList.find('ul, ol')
          }

          CKEDITOR.plugins.list.updateListLabels(parentList, doc, editor)
          if (nextList.is('ul') || nextList.is('ol')) {
            CKEDITOR.plugins.list.updateListLabels(nextList, doc, editor)
          }
        }

        block.remove()
      }

      if (newSelectionTarget) {
        const range = editor.createRange()
        range.selectNodeContents(editor.editable())
        range.moveToElementEditEnd(newSelectionTarget)
        range.select()
      } else {
        selection.selectBookmarks(bookmarks)
      }
      return {block, newBlock}
    }
  }

  function shiftEnter (editor) {
    // On SHIFT+ENTER:
    // 1. We want to enforce the mode to be respected, instead
    // of cloning the current block. (#77)
    return enter(editor, editor.activeShiftEnterMode, 1)
  }

  function enter (editor, mode, forceMode) {
    forceMode = editor.config.forceEnterMode || forceMode

    // Only effective within document.
    if (editor.mode != 'wysiwyg') {
      return
    }

    if (!mode) {
      mode = editor.activeEnterMode
    }

    // TODO this should be handled by setting editor.activeEnterMode on selection change.
    // Check path block specialities:
    // 1. Cannot be a un-splittable element, e.g. table caption;
    const path = editor.elementPath()
    if (!path.isContextFor('p')) {
      mode = CKEDITOR.ENTER_BR
      forceMode = 1
    }

    editor.fire('saveSnapshot') // Save undo step.

    if (mode == CKEDITOR.ENTER_BR) {
      CKEDITOR.plugins.enterkey.enterBr(editor, mode, null, forceMode)
    } else {
      CKEDITOR.plugins.enterkey.enterBlock(editor, mode, null, forceMode)
    }

    editor.fire('saveSnapshot')
  }

  function getRange (editor) {
    // Get the selection ranges.
    const ranges = editor.getSelection().getRanges(true)

    // Delete the contents of all ranges except the first one.
    for (let i = ranges.length - 1; i > 0; i--) {
      ranges[i].deleteContents()
    }

    // Return the first range.
    return ranges[0]
  }

  function replaceRangeWithClosestEditableRoot (range) {
    const closestEditable = range.startContainer.getAscendant(
      node => node.type == CKEDITOR.NODE_ELEMENT && node.getAttribute('contenteditable') == 'true',
      true
    )

    if (range.root.equals(closestEditable)) {
      return range
    } else {
      const newRange = new CKEDITOR.dom.range(closestEditable)

      newRange.moveToRange(range)
      return newRange
    }
  }
}))()
