!function(e){function t(r){if(n[r])return n[r].exports;var i=n[r]={i:r,l:!1,exports:{}};return e[r].call(i.exports,i,i.exports,t),i.l=!0,i.exports}var n={};return t.m=e,t.c=n,t.i=function(e){return e},t.d=function(e,n,r){t.o(e,n)||Object.defineProperty(e,n,{configurable:!1,enumerable:!0,get:r})},t.n=function(e){var n=e&&e.__esModule?function(){return e.default}:function(){return e};return t.d(n,"a",n),n},t.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},t.p="/",t(t.s=0)}([function(e,t,n){"use strict";!function(){function e(e){return t(e,e.activeShiftEnterMode,1)}function t(e,t,n){if(n=e.config.forceEnterMode||n,"wysiwyg"==e.mode){t||(t=e.activeEnterMode);var r=e.elementPath();r.isContextFor("p")||(t=CKEDITOR.ENTER_BR,n=1),e.fire("saveSnapshot"),t==CKEDITOR.ENTER_BR?CKEDITOR.plugins.enterkey.enterBr(e,t,null,n):CKEDITOR.plugins.enterkey.enterBlock(e,t,null,n),e.fire("saveSnapshot")}}function n(e){for(var t=e.getSelection().getRanges(!0),n=t.length-1;n>0;n--)t[n].deleteContents();return t[0]}function r(e){var t=e.startContainer.getAscendant(function(e){return e.type==CKEDITOR.NODE_ELEMENT&&"true"==e.getAttribute("contenteditable")},!0);if(e.root.equals(t))return e;var n=new CKEDITOR.dom.range(t);return n.moveToRange(e),n}CKEDITOR.plugins.add("iccenterkey",{init:function(n){n.addCommand("enter",{modes:{wysiwyg:1},editorFocus:!1,exec:function(e){t(e)}}),n.addCommand("shiftEnter",{modes:{wysiwyg:1},editorFocus:!1,exec:function(t){e(t)}}),n.setKeystroke([[13,"enter"],[CKEDITOR.SHIFT+13,"shiftEnter"]])}});var i=CKEDITOR.dom.walker.whitespaces(),s=CKEDITOR.dom.walker.bookmark(),l=/^h[1-6]$/;CKEDITOR.plugins.enterkey={enterInEmptyBlockquote:function(e,t){e.breakParent(e.getParent()),e.getPrevious().getFirst(CKEDITOR.dom.walker.invisible(1))||e.getPrevious().remove(),e.getNext().getFirst(CKEDITOR.dom.walker.invisible(1))||e.getNext().remove(),t.moveToElementEditStart(e),t.select()},calculateNewListIndex:function(e){var t=1;if(e&&e.findOne("p span.label")){var n=e.findOne("p span.label"),r=CKEDITOR.plugins.list.parseOrdinal(n.getHtml());if(r){var i=CKEDITOR.plugins.list.translateOrdinal(r.ordinal,1);t=r.replaceOrdinal(i)}}return t},addListItemElements:function(e,t){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:null,r=arguments.length>3&&void 0!==arguments[3]&&arguments[3],i=void 0;if(e.is("li")?e.getChildren().count()>0&&e.getChildren().getItem(0).type===CKEDITOR.NODE_ELEMENT&&"p"===e.getChildren().getItem(0).getName()?i=e.getChildren().getItem(0):(i=t.createElement("p"),e.getChildren().count()>0?i.insertBefore(e.getChildren().getItem(0)):i.appendTo(e)):e.is("p")&&(i=e),r){var s=this.calculateNewListIndex(n);if(i){var l=void 0;i.getChildren().count()>0&&i.getChildren().getItem(0)===CKEDITOR.NODE_ELEMENT&&"span"===i.getChildren().getItem(0).getName()&&i.getChildren().getItem(0).hasClass("label")?(l=i.getChildren().getItem(0),l.getFirst()||l.appendText(s)):(l=t.createElement("span"),l.addClass("label"),l.appendText(s),i.getFirst()?l.insertBefore(i.getFirst()):i.append(l)),l&&t.createText(" ").insertAfter(l)}}return i},isListItemEmpty:function(e,t){for(var n=e.getChildCount(),r=!0,l=0;l<n;l++){var a=e.getChild(l);if(a&&!(s(a)||i(a)||a.type===CKEDITOR.NODE_TEXT&&" "===a.getText()||a.type===CKEDITOR.NODE_ELEMENT&&("span"===a.getName()&&a.hasClass("label")||"p"===a.getName()&&this.isListItemEmpty(a,t)||a.getName()in CKEDITOR.dtd.$empty))){r=!1;break}}return r},inOrderedList:function(e){var t=e.getAscendant({ul:1,ol:1});return t&&"ol"===t.getName()},enterBlock:function(e,t,a,o){if(a=a||n(e)){a=r(a);var d=a.document,E=a.checkStartOfBlock(),u=a.checkEndOfBlock(),c=e.elementPath(a.startContainer),g=c.block,p=t==CKEDITOR.ENTER_DIV?"div":"p",m=void 0,f=g.getAscendant("li",!0)&&CKEDITOR.plugins.enterkey.inOrderedList(g),T=g.getAscendant({ul:1,ol:1});if(E&&u||f&&CKEDITOR.plugins.enterkey.isListItemEmpty(g.getAscendant("li",!0),e)){if(g&&(g.is("li")||g.getParent().is("li")))return void CKEDITOR.plugins.enterkey.enterInEmptyListItem(g,e,c,m,d,t);if(g&&g.getParent().is("blockquote"))return void CKEDITOR.plugins.enterkey.enterInEmptyBlockquote(g,a)}else if(g&&g.is("pre")&&!u)return void CKEDITOR.plugins.enterkey.enterBr(e,t,a,o);var v=a.splitBlock(p);if(v){var I=v.previousBlock,O=v.nextBlock,C=v.wasStartOfBlock,R=v.wasEndOfBlock,D=void 0,k=void 0;if(O)D=O.getParent(),D.is("li")&&(k=D.clone(),O.breakParent(D),O.move(O.getNext(),1));else if(I&&(D=I.getParent())&&D.is("li")&&(k=D.clone(),I.breakParent(D),D=I.getNext(),a.moveToElementEditStart(D),I.move(I.getPrevious()),D.getFirst()&&(D.getFirst().is("ol")||D.getFirst().is("ul")))){var K=d.createElement("p"),b=d.createElement("span");b.addClass("label"),K.insertBefore(D.getFirst()),a.moveToElementEditStart(D)}if(C||R){var L=void 0;I?(I.is("li")||!l.test(I.getName())&&!I.is("pre"))&&(k=I.getAscendant("li",!0),m=I.clone()):O&&(m=O.clone()),m?o&&!m.is("li")&&m.renameNode(p):D&&D.is("li")?m=D:(m=d.createElement(p),I&&(L=I.getDirection())&&m.setAttribute("dir",L));var N=v.elementPath;if(N)for(var y=0,h=N.elements.length;y<h;y++){var A=N.elements[y];if(A.equals(N.block)||A.equals(N.blockLimit))break;CKEDITOR.dtd.$removeEmpty[A.getName()]&&(A=A.clone(),m.moveChildren(A),m.append(A))}var B=CKEDITOR.plugins.enterkey.addListItemElements(m,d,k,f);m.appendBogus(),m.getParent()||a.insertNode(m),m.is("li")&&m.removeAttribute("value"),!CKEDITOR.env.ie||!C||R&&I.getChildCount()||(a.moveToElementEditStart(R?I:m),a.select()),a.moveToElementEditEnd(B)}else{if(O.is("li")){var P=a.clone();P.selectNodeContents(O);var x=new CKEDITOR.dom.walker(P);x.evaluator=function(e){return!(s(e)||i(e)||e.type==CKEDITOR.NODE_ELEMENT&&e.getName()in CKEDITOR.dtd.$inline&&!(e.getName()in CKEDITOR.dtd.$empty))},D=x.next(),D&&D.type==CKEDITOR.NODE_ELEMENT&&D.is("ul","ol")&&(CKEDITOR.env.needsBrFiller?d.createElement("br"):d.createText(" ")).insertBefore(D)}if(I&&I.is("li")?k=I:I.getParent()&&I.getParent().is("li")&&(k=I.getParent()),O){var S=CKEDITOR.plugins.enterkey.addListItemElements(O,d,k,f);a.moveToElementEditEnd(S)}}T&&f&&CKEDITOR.plugins.list.updateOrderedListLabels(T,d,e),a.select(),a.scrollIntoView()}}},enterAtEndOfHeader:function(e,t,n){var r=void 0,i=void 0;(i=e.getDirection())?(r=t.createElement("div"),r.setAttribute("dir",i),r.insertAfter(e),n.setStart(r,0)):(t.createElement("br").insertAfter(e),CKEDITOR.env.gecko&&t.createText("").insertAfter(e),n.setStartAt(e.getNext(),CKEDITOR.env.ie?CKEDITOR.POSITION_BEFORE_START:CKEDITOR.POSITION_AFTER_START))},enterBr:function(e,t,r,i){if(r=r||n(e)){var s=r.document,a=r.checkEndOfBlock(),o=new CKEDITOR.dom.elementPath(e.getSelection().getStartElement()),d=o.block,E=d&&o.block.getName();if(!i&&d&&("li"==d.getParent().getName()||"li"==E))return void CKEDITOR.plugins.enterkey.enterBlock(e,t,r,i);if(!i&&a&&l.test(E))this.enterAtEndOfHeader(d,s,r);else{var u=void 0;u="pre"==E&&CKEDITOR.env.ie&&CKEDITOR.env.version<8?s.createText("\r"):s.createElement("br"),r.deleteContents(),r.insertNode(u),CKEDITOR.env.needsBrFiller?(s.createText("\ufeff").insertAfter(u),a&&(d||o.blockLimit).appendBogus(),u.getNext().$.nodeValue="",r.setStartAt(u.getNext(),CKEDITOR.POSITION_AFTER_START)):r.setStartAt(u,CKEDITOR.POSITION_AFTER_END)}r.collapse(!0),r.select(),r.scrollIntoView()}},enterInEmptyListItem:function(e,t,n,r,i,s){e.is("li")||(e=e.getParent());var l=e.getParent(),a=l.getParent(),o=!e.hasPrevious(),d=!e.hasNext(),E=t.getSelection(),u=E.createBookmarks(),c=e.getDirection(1),g=e.getAttribute("class"),p=e.getAttribute("style"),m=a.getDirection(1)!=c,f=t.enterMode,T=f!=CKEDITOR.ENTER_BR||m||p||g,v=void 0,I=a&&("div"===a.getName()||a.hasClass("list")),O=I?a:l,C=void 0;if(a.is("li")){o||d?(o&&d&&l.remove(),e[d?"insertAfter":"insertBefore"](a)):e.breakParent(a);var R=a.getAscendant({ul:1,ol:1});console.log("--- updateListLabels 1"),CKEDITOR.plugins.list.updateListLabels(R,i,t)}else if(T){if(n.block.is("li")?(r=i.createElement(s==CKEDITOR.ENTER_P?"p":"div"),m&&r.setAttribute("dir",c),p&&r.setAttribute("style",p),g&&r.setAttribute("class",g),e.moveChildren(r)):r=n.block,o||d){r[o?"insertBefore":"insertAfter"](O);var D=l.getAscendant({ul:1,ol:1},!0);console.log("--- updateListLabels 5"),CKEDITOR.plugins.list.updateListLabels(D,i,t)}else{e.breakParent(O);var k=e.getNext();r.insertAfter(O);var K=l.getAscendant({ul:1,ol:1},!0);I&&(k=k.find("ul, ol")),console.log("--- updateListLabels 6"),CKEDITOR.plugins.list.updateListLabels(K,i,t),(k.is("ul")||k.is("ol"))&&(console.log("--- updateListLabels 7"),CKEDITOR.plugins.list.updateListLabels(k,i,t))}e.remove()}else{if(e.appendBogus(!0),o||d){if(CKEDITOR.plugins.enterkey.isListItemEmpty(e,t)){var b=i.createElement("p");b.appendBogus(!0),b[o?"insertBefore":"insertAfter"](O),C=b}else for(;v=e[o?"getFirst":"getLast"]();)v[o?"insertBefore":"insertAfter"](O);var L=l.getAscendant({ul:1,ol:1},!0);console.log("--- updateListLabels 2"),CKEDITOR.plugins.list.updateListLabels(L,i,t)}else{e.breakParent(O);var N=e.getNext();if(CKEDITOR.plugins.enterkey.isListItemEmpty(e,t)){var y=i.createElement("p");y.appendBogus(!0),y.insertAfter(O),C=y}else for(;v=e.getLast();)v.insertAfter(O);var h=l.getAscendant({ul:1,ol:1},!0);I&&(N=N.findOne("ul, ol")),console.log("--- updateListLabels 3"),CKEDITOR.plugins.list.updateListLabels(h,i,t),N&&N.type===CKEDITOR.NODE_ELEMENT&&(N.is("ul")||N.is("ol"))&&(console.log("--- updateListLabels 4"),CKEDITOR.plugins.list.updateListLabels(N,i,t))}e.remove()}if(C){var A=t.createRange();A.selectNodeContents(t.editable()),A.moveToElementEditEnd(C),A.select()}else E.selectBookmarks(u);return{block:e,newBlock:r}}}}()}]);