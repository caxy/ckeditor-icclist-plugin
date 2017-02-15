/*global CKEDITOR*/
import keycode from 'keycode'

((() => {
  const replaceRangeWithClosestEditableRoot = (range, element) => {
    if (range.root.equals(element)) {
      return range
    } else {
      const newRange = new CKEDITOR.dom.range(element)

      newRange.moveToRange(range)
      return newRange
    }
  }

  const iccListLabel = {
    requires: 'widget',
    icons: 'icclistlabel',
    init ({widgets}) {
      widgets.add(
        'icclistlabel', {
          button: 'Add a list label',
          template: '<span class="label">1.</span>',
          editables: {
            label: {
              selector: 'span.label'
            }
          },
          draggable: false,

          /**
           * @param {CKEDITOR.htmlParser.element} element
           * @returns {boolean}
           */
          upcast: element => {
            return element.name === 'span' &&
              element.hasClass('label') &&
              element.getAscendant('p') !== null &&
              element.getAscendant('p').getAscendant('li') !== null
          },

          init () {
            this.editor.on(
              'key', ({data: {keyCode, domEvent}, cancel}) => {
                // Check if target element matches this widget's element.
                if (this.element.equals(domEvent.getTarget())) {
                  // Check if delete or backspace was pressed.

                  if (keyCode === keycode('delete') || keyCode === keycode('backspace')) {
                    const selection = this.editor.getSelection()
                    /** @type {CKEDITOR.dom.range} range */
                    let range = selection.getRanges()[0]

                    if (!range || !range.collapsed) {
                      return
                    }

                    range = replaceRangeWithClosestEditableRoot(range, this.element)

                    // If backspace is going to remove the label element, cancel the event.
                    if (range.checkStartOfBlock() && range.getPreviousNode().equals(this.element)) {
                      cancel()
                    }
                  }
                }
              }
            )
          }
        }
      )
    }
  }

  CKEDITOR.plugins.add('icclistlabel', iccListLabel)
}))()
