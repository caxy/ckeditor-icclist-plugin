!function(e){function t(r){if(n[r])return n[r].exports;var a=n[r]={i:r,l:!1,exports:{}};return e[r].call(a.exports,a,a.exports,t),a.l=!0,a.exports}var n={};return t.m=e,t.c=n,t.i=function(e){return e},t.d=function(e,n,r){t.o(e,n)||Object.defineProperty(e,n,{configurable:!1,enumerable:!0,get:r})},t.n=function(e){var n=e&&e.__esModule?function(){return e.default}:function(){return e};return t.d(n,"a",n),n},t.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},t.p="/",t(t.s=1)}([function(e,t){t=e.exports=function(e){if(e&&"object"==typeof e){var t=e.which||e.keyCode||e.charCode;t&&(e=t)}if("number"==typeof e)return o[e];var a=String(e),c=n[a.toLowerCase()];if(c)return c;var c=r[a.toLowerCase()];return c?c:1===a.length?a.charCodeAt(0):void 0};var n=t.code=t.codes={backspace:8,tab:9,enter:13,shift:16,ctrl:17,alt:18,"pause/break":19,"caps lock":20,esc:27,space:32,"page up":33,"page down":34,end:35,home:36,left:37,up:38,right:39,down:40,insert:45,delete:46,command:91,"left command":91,"right command":93,"numpad *":106,"numpad +":107,"numpad -":109,"numpad .":110,"numpad /":111,"num lock":144,"scroll lock":145,"my computer":182,"my calculator":183,";":186,"=":187,",":188,"-":189,".":190,"/":191,"`":192,"[":219,"\\":220,"]":221,"'":222},r=t.aliases={windows:91,"⇧":16,"⌥":18,"⌃":17,"⌘":91,ctl:17,control:17,option:18,pause:19,break:19,caps:20,return:13,escape:27,spc:32,pgup:33,pgdn:34,ins:45,del:46,cmd:91};/*!
 * Programatically add the following
 */
for(a=97;a<123;a++)n[String.fromCharCode(a)]=a-32;for(var a=48;a<58;a++)n[a-48]=a;for(a=1;a<13;a++)n["f"+a]=a+111;for(a=0;a<10;a++)n["numpad "+a]=a+96;var o=t.names=t.title={};for(a in n)o[n[a]]=a;for(var c in r)n[c]=r[c]},function(e,t,n){"use strict";function r(e){return e&&e.__esModule?e:{default:e}}var a=n(0),o=r(a);!function(){var e=function(e,t){if(e.root.equals(t))return e;var n=new CKEDITOR.dom.range(t);return n.moveToRange(e),n},t={requires:"widget",icons:"icclistlabel",init:function(t){var n=t.widgets;n.add("icclistlabel",{button:"Add a list label",template:'<span class="label">1.</span>',draggable:!1,upcast:function(e){return"span"===e.name&&e.hasClass("label")&&null!==e.getAscendant("p")&&null!==e.getAscendant("p").getAscendant("li")},init:function(){var t=this;this.editor.on("key",function(n){var r=n.data,a=r.keyCode,c=r.domEvent,l=n.cancel;if(t.element.equals(c.getTarget())&&(a===(0,o.default)("delete")||a===(0,o.default)("backspace"))){var u=t.editor.getSelection(),i=u.getRanges()[0];if(!i||!i.collapsed)return;i=e(i,t.element),i.checkStartOfBlock()&&i.getPreviousNode().equals(t.element)&&l()}})}})}};CKEDITOR.plugins.add("icclistlabel",t)}()}]);