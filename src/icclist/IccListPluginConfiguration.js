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

    const backspaceDelete = new BackspaceDelete(editor)

    // Handled backspace/del key to join list items.
    editor.on('key', backspaceDelete.keyListener.bind(backspaceDelete))
  }
}

export default IccListPluginConfiguration
