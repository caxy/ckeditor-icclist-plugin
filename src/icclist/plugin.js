/*global CKEDITOR*/
import IccListPlugin from './modules/IccListPlugin'
import IccListPluginConfiguration from './IccListPluginConfiguration'

CKEDITOR.plugins.list = new IccListPlugin()
CKEDITOR.plugins.add('icclist', new IccListPluginConfiguration())
