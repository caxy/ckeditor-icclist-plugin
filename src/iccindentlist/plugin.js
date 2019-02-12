/*global CKEDITOR*/
((() => {
  const isNotWhitespaces = CKEDITOR.dom.walker.whitespaces(true)
  const isNotBookmark = CKEDITOR.dom.walker.bookmark(false, true)
  const TRISTATE_DISABLED = CKEDITOR.TRISTATE_DISABLED
  const TRISTATE_OFF = CKEDITOR.TRISTATE_OFF

  CKEDITOR.plugins.add('iccindentlist', {
    requires: 'indent',
    init (editor) {
      const globalHelpers = CKEDITOR.plugins.indent

      // Register commands.
      globalHelpers.registerCommands(editor, {
        indentlist: new commandDefinition(editor, 'indentlist', true),
        outdentlist: new commandDefinition(editor, 'outdentlist')
      })

      function commandDefinition (editor) {
        globalHelpers.specificDefinition.apply(this, arguments)

        // Require ul OR ol list.
        this.requiredContent = [ 'ul', 'ol' ]

        // Indent and outdent lists with TAB/SHIFT+TAB key. Indenting can
        // be done for any list item that isn't the first child of the parent.
        editor.on('key', function (evt) {
          if (editor.mode != 'wysiwyg') {
            return
          }

          if (evt.data.keyCode == this.indentKey) {
            const list = this.getContext(editor.elementPath())

            if (list) {
              // Don't indent if in first list item of the parent.
              // Outdent, however, can always be done to collapse
              // the list into a paragraph (div).
              if (this.isIndent && CKEDITOR.plugins.indentList.firstItemInPath(this.context, editor.elementPath(), list)) {
                return
              }

              // Exec related global indentation command. Global
              // commands take care of bookmarks and selection,
              // so it's much easier to use them instead of
              // content-specific commands.
              editor.execCommand(this.relatedGlobal)

              // Cancel the key event so editor doesn't lose focus.
              evt.cancel()
            }
          }
        }, this)

        // There are two different jobs for this plugin:
        //
        //	* Indent job (priority=10), before indentblock.
        //
        //	  This job is before indentblock because, if this plugin is
        //	  loaded it has higher priority over indentblock. It means that,
        //	  if possible, nesting is performed, and then block manipulation,
        //	  if necessary.
        //
        //	* Outdent job (priority=30), after outdentblock.
        //
        //	  This job got to be after outdentblock because in some cases
        //	  (margin, config#indentClass on list) outdent must be done on
        //	  block-level.

        this.jobs[ this.isIndent ? 10 : 30 ] = {
          refresh: this.isIndent
            ? function (editor, path) {
              const list = this.getContext(path)
              const inFirstListItem = CKEDITOR.plugins.indentList.firstItemInPath(this.context, path, list)

              if (!list || !this.isIndent || inFirstListItem) { return TRISTATE_DISABLED }

              return TRISTATE_OFF
            } : function (editor, path) {
              const list = this.getContext(path)

              if (!list || this.isIndent) {
                return TRISTATE_DISABLED
              }

              return TRISTATE_OFF
            },

          exec: CKEDITOR.tools.bind(indentList, this)
        }
      }

      CKEDITOR.tools.extend(commandDefinition.prototype, globalHelpers.specificDefinition.prototype, {
        // Elements that, if in an elementpath, will be handled by this
        // command. They restrict the scope of the plugin.
        context: { ol: 1, ul: 1 }
      })
    }
  })

  function indentList (editor) {
    const that = this
    const database = this.database
    const context = this.context

    function indent (listNode) {
      // Our starting and ending points of the range might be inside some blocks under a list item...
      // So before playing with the iterator, we need to expand the block to include the list items.
      let startContainer = range.startContainer

      let endContainer = range.endContainer
      while (startContainer && !startContainer.getParent().equals(listNode)) {
        startContainer = startContainer.getParent()
      }
      while (endContainer && !endContainer.getParent().equals(listNode)) {
        endContainer = endContainer.getParent()
      }

      if (!startContainer || !endContainer) {
        return false
      }

      // Now we can iterate over the individual items on the same tree depth.
      let block = startContainer

      const itemsToMove = []
      let stopFlag = false

      while (!stopFlag) {
        if (block.equals(endContainer)) { stopFlag = true }

        itemsToMove.push(block)
        block = block.getNext()
      }

      if (itemsToMove.length < 1) {
        return false
      }

      // Do indent or outdent operations on the array model of the list, not the
      // list's DOM tree itself. The array model demands that it knows as much as
      // possible about the surrounding lists, we need to feed it the further
      // ancestor node that is still a list.
      const listParents = listNode.getParents(true)
      for (var i = 0; i < listParents.length; i++) {
        if (listParents[ i ].getName && context[ listParents[ i ].getName() ]) {
          listNode = listParents[ i ]
          break
        }
      }

      const indentOffset = that.isIndent ? 1 : -1
      const startItem = itemsToMove[ 0 ]
      const lastItem = itemsToMove[ itemsToMove.length - 1 ]

      const // Convert the list DOM tree into a one dimensional array.
      listArray = CKEDITOR.plugins.list.listToArray(listNode, database)

      const // Apply indenting or outdenting on the array.
      baseIndent = listArray[ lastItem.getCustomData('listarray_index') ].indent

      for (i = startItem.getCustomData('listarray_index'); i <= lastItem.getCustomData('listarray_index'); i++) {
        listArray[ i ].indent += indentOffset
        // Make sure the newly created sublist get a brand-new element of the same type. (#5372)
        if (indentOffset > 0) {
          const listRoot = listArray[ i ].parent
          listArray[ i ].parent = new CKEDITOR.dom.element(listRoot.getName(), listRoot.getDocument())
          if (listRoot.hasClass('no_mark')) {
            listArray[ i ].parent.addClass('no_mark')
          }
        }
      }

      for (i = lastItem.getCustomData('listarray_index') + 1; i < listArray.length && listArray[ i ].indent > baseIndent; i++) {
        listArray[ i ].indent += indentOffset
      }

      // Convert the array back to a DOM forest (yes we might have a few subtrees now).
      // And replace the old list with the new forest.
      const newList = CKEDITOR.plugins.list.arrayToList(listArray, database, null, editor.config.enterMode, listNode.getDirection())

      // Avoid nested <li> after outdent even they're visually same,
      // recording them for later refactoring.(#3982)
      if (!that.isIndent) {
        var parentLiElement
        if ((parentLiElement = listNode.getParent()) && parentLiElement.is('li')) {
          const children = newList.listNode.getChildren()
          var pendingLis = []
          const count = children.count()
          let child

          for (i = count - 1; i >= 0; i--) {
            if ((child = children.getItem(i)) && child.is && child.is('li')) { pendingLis.push(child) }
          }
        }
      }

      if (newList) {
        // Update the list labels - renumbering for ordered lists and removing labels for unordered.
        const newListChildCount = newList.listNode.getChildCount()

        // Loop over newList.listNode's children.
        for (let k = 0; k < newListChildCount; k++) {
          const listNodeChild = newList.listNode.getChild(k)


          // If the child node is <div class="list">, then loop over its children to find lists.
          // Otherwise, we simply use an array with listNodeChild as the only element to loop over.
          let childListNodes = [listNodeChild]
          if (
            listNodeChild && listNodeChild.type === CKEDITOR.NODE_ELEMENT &&
            listNodeChild.is('div') && listNodeChild.hasClass('list')
          ) {
            // Reset childListNodes array so it doesn't include listNodeChild.
            childListNodes = []
            // Loop over the div's children and add them to childListNodes array.
            const divListWrapperChildCount = listNodeChild.getChildCount()
            for (let l = 0; l < divListWrapperChildCount; l++) {
              childListNodes.push(listNodeChild.getChild(l))
            }
          }

          // Loop over the nodes in childListNodes array, and call updateListLabels on any ul or ol elements.
          for (let childIndex = 0; childIndex < childListNodes.length; childIndex++) {
            if (
              childListNodes[childIndex] &&
              childListNodes[childIndex].type === CKEDITOR.NODE_ELEMENT &&
              (childListNodes[childIndex].is('ol') || childListNodes[childIndex].is('ul'))
            ) {
              CKEDITOR.plugins.list.updateListLabels(childListNodes[childIndex], range.document, editor, that.isIndent)
            }
          }
        }

        // If the list node's parent is div.list wrapper, then replace the entire wrapper element,
        // since the result of arrayToList will return a doc fragment of div.list elements to replace it.
        let listNodeToReplace = listNode
        if (
          listNode.getParent() && listNode.getParent().type === CKEDITOR.NODE_ELEMENT &&
          listNode.getParent().is('div') &&
          listNode.getParent().hasClass('list')
        ) {
          listNodeToReplace = listNode.getParent()
        }

        newList.listNode.replace(listNodeToReplace)
      }

      // Move the nested <li> to be appeared after the parent.
      if (pendingLis && pendingLis.length) {
        for (i = 0; i < pendingLis.length; i++) {
          const li = pendingLis[ i ]
          let followingList = li

          // Nest preceding <ul>/<ol> inside current <li> if any.
          while ((followingList = followingList.getNext()) && followingList.is && followingList.getName() in context) {
            // IE requires a filler NBSP for nested list inside empty list item,
            // otherwise the list item will be inaccessiable. (#4476)
            if (CKEDITOR.env.needsNbspFiller && !li.getFirst(neitherWhitespacesNorBookmark)) {
              li.append(range.document.createText('\u00a0'))
            }

            li.append(followingList)
          }

          li.insertAfter(parentLiElement)
        }

        const parentListNode = parentLiElement.getAscendant({ul: 1, ol: 1})

        if (parentListNode) {
          const grandparent = parentListNode.getParent().getParent()
          const isExceptionList = grandparent && grandparent.hasClass('exception')
          const listAscendant = grandparent.getAscendant('ol')
          const descendedFromList = listAscendant && listAscendant.getParent().hasClass('list')

          if (!(isExceptionList && descendedFromList)) {
            CKEDITOR.plugins.list.updateListLabels(parentListNode, range.document, editor)
          }
        }
      }

      if (newList) {
        editor.fire('contentDomInvalidated')
      }

      return true
    }

    const selection = editor.getSelection()
    const ranges = selection && selection.getRanges()
    const iterator = ranges.createIterator()
    var range

    while ((range = iterator.getNextRange())) {
      let nearestListBlock = range.getCommonAncestor()

      while (nearestListBlock && !(nearestListBlock.type == CKEDITOR.NODE_ELEMENT && context[ nearestListBlock.getName() ])) {
        // Avoid having plugin propagate to parent of editor in inline mode by canceling the indentation. (#12796)
        if (editor.editable().equals(nearestListBlock)) {
          nearestListBlock = false
          break
        }
        nearestListBlock = nearestListBlock.getParent()
      }

      // Avoid having selection boundaries out of the list.
      // <ul><li>[...</li></ul><p>...]</p> => <ul><li>[...]</li></ul><p>...</p>
      if (!nearestListBlock) {
        if ((nearestListBlock = range.startPath().contains(context))) { range.setEndAt(nearestListBlock, CKEDITOR.POSITION_BEFORE_END) }
      }

      // Avoid having selection enclose the entire list. (#6138)
      // [<ul><li>...</li></ul>] =><ul><li>[...]</li></ul>
      if (!nearestListBlock) {
        const selectedNode = range.getEnclosedNode()
        if (selectedNode && selectedNode.type == CKEDITOR.NODE_ELEMENT && selectedNode.getName() in context) {
          range.setStartAt(selectedNode, CKEDITOR.POSITION_AFTER_START)
          range.setEndAt(selectedNode, CKEDITOR.POSITION_BEFORE_END)
          nearestListBlock = selectedNode
        }
      }

      // Avoid selection anchors under list root.
      // <ul>[<li>...</li>]</ul> =>	<ul><li>[...]</li></ul>
      if (nearestListBlock && range.startContainer.type == CKEDITOR.NODE_ELEMENT && range.startContainer.getName() in context) {
        var walker = new CKEDITOR.dom.walker(range)
        walker.evaluator = listItem
        range.startContainer = walker.next()
      }

      if (nearestListBlock && range.endContainer.type == CKEDITOR.NODE_ELEMENT && range.endContainer.getName() in context) {
        walker = new CKEDITOR.dom.walker(range)
        walker.evaluator = listItem
        range.endContainer = walker.previous()
      }

      if (nearestListBlock) {
        return indent(nearestListBlock)
      }
    }
    return 0
  }

  // Determines whether a node is a list <li> element.
  function listItem (node) {
    return node.type == CKEDITOR.NODE_ELEMENT && node.is('li')
  }

  function neitherWhitespacesNorBookmark (node) {
    return isNotWhitespaces(node) && isNotBookmark(node)
  }

  /**
   * Global namespace for methods exposed by the Indent List plugin.
   *
   * @singleton
   * @class
   */
  CKEDITOR.plugins.indentList = {}

  /**
   * Checks whether the first child of the list is in the path.
   * The list can be extracted from the path or given explicitly
   * e.g. for better performance if cached.
   *
   * @since 4.4.6
   * @param {Object} query See the {@link CKEDITOR.dom.elementPath#contains} method arguments.
   * @param {CKEDITOR.dom.elementPath} path
   * @param {CKEDITOR.dom.element} [list]
   * @returns {Boolean}
   * @member CKEDITOR.plugins.indentList
   */
  CKEDITOR.plugins.indentList.firstItemInPath = (query, path, list) => {
    const firstListItemInPath = path.contains(listItem)
    if (!list) {
      list = path.contains(query)
    }

    return list && firstListItemInPath && firstListItemInPath.equals(list.getFirst(listItem))
  }
}))()
