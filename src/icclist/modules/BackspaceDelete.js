/*global CKEDITOR*/
import {
  nonEmpty,
  listNodeNames,
  isTextBlock,
  blockBogus,
  getSubList,
  joinNextLineToCursor
} from './iccListUtils'

/** @constructor */
class BackspaceDelete {
  /**
   * @constructor
   * @param {CKEDITOR.editor} editor
   */
  constructor (editor) {
    this.editor = editor
  }

  /**
   * @param {CKEDITOR.eventInfo} evt
   */
  keyListener ({ data: { domEvent }, cancel }) {
    // Use getKey directly in order to ignore modifiers.
    // Justification: http://dev.ckeditor.com/ticket/11861#comment:13
    const key = domEvent.getKey()

    // DEL/BACKSPACE
    if (this.editor.mode != 'wysiwyg' || !(key in { 8: 1, 46: 1 })) {
      return
    }

    const sel = this.editor.getSelection()
    const range = sel.getRanges()[0]
    const path = range && range.startPath()

    if (!range || !range.collapsed) {
      return
    }

    const isBackspace = key == 8
    const editable = this.editor.editable()
    const walker = new CKEDITOR.dom.walker(range.clone())
    walker.evaluator = node => nonEmpty(node) && !blockBogus(node)
    // Backspace/Del behavior at the start/end of table is handled in core.
    walker.guard = (node, isOut) => !(isOut && node.type == CKEDITOR.NODE_ELEMENT && node.is('table'))

    const cursor = range.clone()

    if (isBackspace) {
      this.handleBackspace(path, range, cursor, walker, editable, cancel)
    } else {
      this.handleDeleteKey(path, range, cursor, walker, editable, cancel)
    }

    // The backspace/del could potentially put cursor at a bad position,
    // being it handled or not, check immediately the selection to have it fixed.
    setTimeout(() => this.editor.selectionChange(1))
  }

  /**
   * @param {CKEDITOR.dom.elementPath} path
   * @param {CKEDITOR.dom.range} range
   * @param {CKEDITOR.dom.range} cursor
   * @param {CKEDITOR.dom.walker} walker
   * @param {CKEDITOR.editable} editable
   * @callback cancel
   */
  handleBackspace (path, range, cursor, walker, editable, cancel) {
    let previous
    let joinWith

    // Join a sub list's first line, with the previous visual line in parent.
    if (
      (previous = path.contains(listNodeNames)) &&
      range.checkBoundaryOfElement(previous, CKEDITOR.START) &&
      (previous = previous.getParent()) && previous.is('li') &&
      (previous = getSubList(previous))
    ) {
      joinWith = previous
      previous = previous.getPrevious(nonEmpty)
      // Place cursor before the nested list.
      cursor.moveToPosition(
        previous && blockBogus(previous) ? previous : joinWith,
        CKEDITOR.POSITION_BEFORE_START
      )
    } else {
      // Join any line following a list, with the last visual line of the list.
      walker.range.setStartAt(editable, CKEDITOR.POSITION_AFTER_START)
      walker.range.setEnd(range.startContainer, range.startOffset)

      previous = walker.previous()

      if (
        previous && previous.type == CKEDITOR.NODE_ELEMENT &&
        (
          previous.getName() in listNodeNames ||
          previous.is('li') ||
          (previous.is('div') && previous.hasClass('list'))
        )
      ) {
        if (previous.is('div') && previous.hasClass('list')) {
          const previousList = previous.findOne('> ul,> ol')

          if (previousList) {
            previous = previousList
          }
        }

        if (!previous.is('li')) {
          walker.range.selectNodeContents(previous)
          walker.reset()
          walker.evaluator = isTextBlock
          previous = walker.previous()
        }

        joinWith = previous
        if (joinWith) {
          // Place cursor at the end of previous block.
          cursor.moveToElementEditEnd(joinWith)

          // And then just before end of closest block element.
          cursor.moveToPosition(cursor.endPath().block, CKEDITOR.POSITION_BEFORE_END)
        }
      }
    }

    if (joinWith) {
      joinNextLineToCursor(this.editor, cursor, range)

      // Renumber the list if an ordered list.
      if (CKEDITOR.plugins.list.isInOrderedList(joinWith)) {
        CKEDITOR.plugins.list.updateOrderedListLabels(
          CKEDITOR.plugins.list.getParentListNode(joinWith),
          editable.getDocument(),
          this.editor
        )
      }

      cancel()
    } else {
      const list = path.contains(listNodeNames)
      let li
      // Backspace pressed at the start of list outdents the first line item.
      if (list && range.checkBoundaryOfElement(list, CKEDITOR.start)) {
        li = list.getFirst(nonEmpty)

        if (range.checkBoundaryOfElement(li, CKEDITOR.START)) {
          previous = list.getPrevious(nonEmpty)

          // Only if the list item contains a sub list, do nothing
          // but simply move cursor backward one character.
          if (getSubList(li)) {
            if (previous) {
              range.moveToElementEditEnd(previous)
              range.select()
            }

            cancel()
          } else {
            this.editor.execCommand('outdent')
            cancel()
          }
        }
      }
    }
  }

  /**
   * @param {CKEDITOR.dom.elementPath} path
   * @param {CKEDITOR.dom.range} range
   * @param {CKEDITOR.dom.range} cursor
   * @param {CKEDITOR.dom.walker} walker
   * @param {CKEDITOR.editable} editable
   * @callback cancel
   */
  handleDeleteKey (path, range, cursor, walker, editable, cancel) {
    let next
    let nextLine
    let li = path.contains('li')

    if (li) {
      walker.range.setEndAt(editable, CKEDITOR.POSITION_BEFORE_END)

      const last = li.getLast(nonEmpty)
      const block = last && isTextBlock(last) ? last : li

      // Indicate cursor at the visual end of an list item.
      let isAtEnd = 0

      next = walker.next()

      // When list item contains a sub list.
      if (
        next && next.type == CKEDITOR.NODE_ELEMENT &&
        next.getName() in listNodeNames &&
        next.equals(last)
      ) {
        isAtEnd = 1

        // Move to the first item in sub list.
        next = walker.next()
      } else if (range.checkBoundaryOfElement(block, CKEDITOR.END)) {
        // Right at the end of list item.
        isAtEnd = 2
      }

      if (isAtEnd && next) {
        // Put cursor range there.
        nextLine = range.clone()
        nextLine.moveToElementEditStart(next)

        // #13409
        // For the following case and similar
        //
        // <ul>
        // 	<li>
        // 		<p><a href="#one"><em>x^</em></a></p>
        // 		<ul>
        // 			<li><span>y</span></li>
        // 		</ul>
        // 	</li>
        // </ul>
        if (isAtEnd == 1) {
          // Move the cursor to <em> if attached to "x" text node.
          cursor.optimize()

          // Abort if the range is attached directly in <li>, like
          //
          // <ul>
          // 	<li>
          // 		x^
          // 		<ul>
          // 			<li><span>y</span></li>
          // 		</ul>
          // 	</li>
          // </ul>
          if (!cursor.startContainer.equals(li)) {
            let node = cursor.startContainer
            let farthestInlineAscendant

            // Find <a>, which is farthest from <em> but still inline element.
            while (node.is(CKEDITOR.dtd.$inline)) {
              farthestInlineAscendant = node
              node = node.getParent()
            }

            // Move the range so it does not contain inline elements.
            // It prevents <span> from being included in <em>.
            //
            // <ul>
            // 	<li>
            // 		<p><a href="#one"><em>x</em></a>^</p>
            // 		<ul>
            // 			<li><span>y</span></li>
            // 		</ul>
            // 	</li>
            // </ul>
            //
            // so instead of
            //
            // <ul>
            // 	<li>
            // 		<p><a href="#one"><em>x^<span>y</span></em></a></p>
            // 	</li>
            // </ul>
            //
            // pressing DELETE produces
            //
            // <ul>
            // 	<li>
            // 		<p><a href="#one"><em>x</em></a>^<span>y</span></p>
            // 	</li>
            // </ul>
            if (farthestInlineAscendant) {
              cursor.moveToPosition(farthestInlineAscendant, CKEDITOR.POSITION_AFTER_END)
            }
          }
        }

        // Moving `cursor` and `next line` only when at the end literally.
        if (isAtEnd == 2) {
          cursor.moveToPosition(cursor.endPath().block, CKEDITOR.POSITION_BEFORE_END)

          // Next line might be text node not wrapped in block element.
          if (nextLine.endPath().block) {
            nextLine.moveToPosition(nextLine.endPath().block, CKEDITOR.POSITION_AFTER_START)
          }
        }

        joinNextLineToCursor(this.editor, cursor, nextLine)

        // Renumber the list if an ordered list.
        const listNode = cursor.startContainer.getAscendant({ul: 1, ol: 1})
        if (listNode && listNode.is('ol')) {
          CKEDITOR.plugins.list.updateOrderedListLabels(
            listNode,
            editable.getDocument(),
            this.editor
          )
        }

        cancel()
      }
    } else {
      // Handle Del key pressed before the list.
      walker.range.setEndAt(editable, CKEDITOR.POSITION_BEFORE_END)
      next = walker.next()

      if (next && next.type == CKEDITOR.NODE_ELEMENT && next.is(listNodeNames)) {
        // The start <li>.
        next = next.getFirst(nonEmpty)

        // Simply remove the current empty block, move cursor to the
        // subsequent list.
        if (path.block && range.checkStartOfBlock() && range.checkEndOfBlock()) {
          path.block.remove()
          range.moveToElementEditStart(next)
          range.select()
          cancel()
        } else if (getSubList(next)) {
          // Preventing the default (merge behavior), but simply move
          // the cursor one character forward if subsequent list item
          // contains sub list.
          range.moveToElementEditStart(next)
          range.select()
          cancel()
        } else {
          // Merge the first list item with the current line.
          nextLine = range.clone()
          nextLine.moveToElementEditStart(next)
          joinNextLineToCursor(this.editor, cursor, nextLine)

          // Renumber the list if an ordered list.
          if (CKEDITOR.plugins.list.isInOrderedList(next)) {
            CKEDITOR.plugins.list.updateOrderedListLabels(
              CKEDITOR.plugins.list.getParentListNode(next),
              editable.getDocument(),
              this.editor
            )
          }

          cancel()
        }
      }
    }
  }
}

export default BackspaceDelete
