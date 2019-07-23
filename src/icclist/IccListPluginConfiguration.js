/*global CKEDITOR*/
import BackspaceDelete from './modules/BackspaceDelete'
import IccListCommand from './commands/IccListCommand'

/**
 * @constructor
 */
class IccListPluginConfiguration {
  /**
   * @constructor
   */
  constructor () {
    this.icons = 'iccbulletedlist,iccnumberedlist'
    this.hidpi = true
  }

  /**
   * @param {CKEDITOR.editor} editor
   */
  init (editor) {
    if (editor.blockless) {
      return
    }

    // Register commands.
    editor.addCommand('iccnumberedlist', new IccListCommand('iccnumberedlist', 'ol'))
    editor.addCommand('iccbulletedlist', new IccListCommand('iccbulletedlist', 'ul'))

    // Register the toolbar buttons.
    if (editor.ui.addButton) {
      editor.ui.addButton(
        'IccNumberedList', {
          label: 'Insert/Remove Numbered List',
          command: 'iccnumberedlist',
          directional: true,
          toolbar: 'list,10'
        }
      )

      editor.ui.addButton(
        'IccBulletedList', {
          label: 'Insert/Remove Bulleted List',
          command: 'iccbulletedlist',
          directional: true,
          toolbar: 'list,20'
        }
      )
    }

    // Add styles
    editor.addContentsCss(this.path + 'style/icclist.css')

    const backspaceDelete = new BackspaceDelete(editor)

    // Handled backspace/del key to join list items.
    editor.on('key', backspaceDelete.keyListener.bind(backspaceDelete))
    editor.on('contentDom', () => {
      const lists = editor.document.find('div.list')

      lists.toArray().forEach(list => {
        list.unselectable()
        list.setAttribute('contenteditable', false)
      })
    })

    // Exit div.list if that's where the cursor is.
    editor.on('key', evt => {
      // Use getKey directly in order to ignore modifiers.
      // Justification: http://dev.ckeditor.com/ticket/11861#comment:13
      const domEvent = evt.data.domEvent
      const sel = editor.getSelection()
      const range = sel.getRanges()[0]

      if (!range || !range.collapsed) {
        return
      }

      const start = range.startContainer
      const ascendant = start.getAscendant((el) => el && el.getName && el.getName() === 'div' && el.hasClass('list'))

      if (ascendant) {
        // Cancel all key events so the list cannot be edited directly
        if (typeof domEvent.cancelable !== 'boolean' || domEvent.cancelable) {
          domEvent.preventDefault();
        }
      }
    })

    // If the target element has a list ancestor, dispatch a custom event with its id.
    editor.on('doubleclick', evt => {
      const target = evt.data.element
      const ascendant = target.getAscendant((el) => el && el.getName && el.getName() === 'div' && el.hasClass('list'))
      const exceptionAscendant =  target.getAscendant((el) => {
        return el && el.getName && el.getName() === 'div' && el.hasClass('exception')
      })

      if (ascendant && !exceptionAscendant) {
        const listCreatedEvent = new CustomEvent('list-edit', { detail: ascendant.getAttribute('id') })

        const target = document.getElementById('list-event-listener')
        target && target.dispatchEvent(listCreatedEvent)
      }
    })
  }
}

export default IccListPluginConfiguration
