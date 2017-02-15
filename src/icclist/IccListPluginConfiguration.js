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

    // Exit div.list if that's where the cursor is.
    editor.on('key', ({ data: { domEvent }, cancel }) => {
      // Use getKey directly in order to ignore modifiers.
      // Justification: http://dev.ckeditor.com/ticket/11861#comment:13
      const key = domEvent.getKey()

      // ESC
      if (editor.mode !== 'wysiwyg' || key !== 27) {
        return
      }

      const sel = editor.getSelection()
      const range = sel.getRanges()[0]

      if (!range || !range.collapsed) {
        return
      }

      const start = range.startContainer
      const isListContainer = start.type == CKEDITOR.NODE_ELEMENT && start.is('div') && start.hasClass('list')
      const cursor = range.clone()

      if (start && isListContainer) {
        cursor.moveToPosition(start, CKEDITOR.POSITION_AFTER_END)
        cursor.select()
      }
    })
  }
}

export default IccListPluginConfiguration
