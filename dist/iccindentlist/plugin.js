!function(t){function e(i){if(n[i])return n[i].exports;var r=n[i]={i:i,l:!1,exports:{}};return t[i].call(r.exports,r,r.exports,e),r.l=!0,r.exports}var n={};return e.m=t,e.c=n,e.i=function(t){return t},e.d=function(t,n,i){e.o(t,n)||Object.defineProperty(t,n,{configurable:!1,enumerable:!0,get:i})},e.n=function(t){var n=t&&t.__esModule?function(){return t.default}:function(){return t};return e.d(n,"a",n),n},e.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},e.p="/",e(e.s=0)}([function(t,e,n){"use strict";!function(){function t(t){function i(e){for(var i=r.startContainer,l=r.endContainer;i&&!i.getParent().equals(e);)i=i.getParent();for(;l&&!l.getParent().equals(e);)l=l.getParent();if(!i||!l)return!1;for(var u=i,d=[],E=!1;!E;)u.equals(l)&&(E=!0),d.push(u),u=u.getNext();if(d.length<1)return!1;for(var g=e.getParents(!0),f=0;f<g.length;f++)if(g[f].getName&&o[g[f].getName()]){e=g[f];break}var c=a.isIndent?1:-1,C=d[0],I=d[d.length-1],T=CKEDITOR.plugins.list.listToArray(e,s),p=T[I.getCustomData("listarray_index")].indent;for(f=C.getCustomData("listarray_index");f<=I.getCustomData("listarray_index");f++)if(T[f].indent+=c,c>0){var D=T[f].parent;T[f].parent=new CKEDITOR.dom.element(D.getName(),D.getDocument()),D.hasClass("no_mark")&&T[f].parent.addClass("no_mark")}for(f=I.getCustomData("listarray_index")+1;f<T.length&&T[f].indent>p;f++)T[f].indent+=c;var O=CKEDITOR.plugins.list.arrayToList(T,s,null,t.config.enterMode,e.getDirection());if(!a.isIndent){var h;if((h=e.getParent())&&h.is("li")){var m=O.listNode.getChildren(),R=[],N=m.count(),v=void 0;for(f=N-1;f>=0;f--)(v=m.getItem(f))&&v.is&&v.is("li")&&R.push(v)}}if(O){for(var K=O.listNode.getChildCount(),y=0;y<K;y++){var x=O.listNode.getChild(y),_=[x];if(x&&x.type===CKEDITOR.NODE_ELEMENT&&x.is("div")&&x.hasClass("list")){_=[];for(var P=x.getChildCount(),L=0;L<P;L++)_.push(x.getChild(L))}for(var b=0;b<_.length;b++)_[b]&&_[b].type===CKEDITOR.NODE_ELEMENT&&(_[b].is("ol")||_[b].is("ul"))&&(console.log("--- listLabels 1"),CKEDITOR.plugins.list.updateListLabels(_[b],r.document,t,a.isIndent))}var w=e;e.getParent()&&e.getParent().type===CKEDITOR.NODE_ELEMENT&&e.getParent().is("div")&&e.getParent().hasClass("list")&&(w=e.getParent()),O.listNode.replace(w)}if(R&&R.length){for(f=0;f<R.length;f++){for(var k=R[f],A=k;(A=A.getNext())&&A.is&&A.getName()in o;)CKEDITOR.env.needsNbspFiller&&!k.getFirst(n)&&k.append(r.document.createText(" ")),k.append(A);k.insertAfter(h)}var M=h.getAscendant({ul:1,ol:1});M&&(console.log("--- listLabels 2"),CKEDITOR.plugins.list.updateListLabels(M,r.document,t))}return O&&t.fire("contentDomInvalidated"),!0}for(var r,a=this,s=this.database,o=this.context,l=t.getSelection(),u=l&&l.getRanges(),d=u.createIterator();r=d.getNextRange();){for(var E=r.getCommonAncestor();E&&(E.type!=CKEDITOR.NODE_ELEMENT||!o[E.getName()]);){if(t.editable().equals(E)){E=!1;break}E=E.getParent()}if(E||(E=r.startPath().contains(o))&&r.setEndAt(E,CKEDITOR.POSITION_BEFORE_END),!E){var g=r.getEnclosedNode();g&&g.type==CKEDITOR.NODE_ELEMENT&&g.getName()in o&&(r.setStartAt(g,CKEDITOR.POSITION_AFTER_START),r.setEndAt(g,CKEDITOR.POSITION_BEFORE_END),E=g)}if(E&&r.startContainer.type==CKEDITOR.NODE_ELEMENT&&r.startContainer.getName()in o){var f=new CKEDITOR.dom.walker(r);f.evaluator=e,r.startContainer=f.next()}if(E&&r.endContainer.type==CKEDITOR.NODE_ELEMENT&&r.endContainer.getName()in o&&(f=new CKEDITOR.dom.walker(r),f.evaluator=e,r.endContainer=f.previous()),E)return i(E)}return 0}function e(t){return t.type==CKEDITOR.NODE_ELEMENT&&t.is("li")}function n(t){return i(t)&&r(t)}var i=CKEDITOR.dom.walker.whitespaces(!0),r=CKEDITOR.dom.walker.bookmark(!1,!0),a=CKEDITOR.TRISTATE_DISABLED,s=CKEDITOR.TRISTATE_OFF;CKEDITOR.plugins.add("iccindentlist",{requires:"indent",init:function(e){function n(e){i.specificDefinition.apply(this,arguments),this.requiredContent=["ul","ol"],e.on("key",function(t){if("wysiwyg"==e.mode&&t.data.keyCode==this.indentKey){var n=this.getContext(e.elementPath());if(n){if(this.isIndent&&CKEDITOR.plugins.indentList.firstItemInPath(this.context,e.elementPath(),n))return;e.execCommand(this.relatedGlobal),t.cancel()}}},this),this.jobs[this.isIndent?10:30]={refresh:this.isIndent?function(t,e){var n=this.getContext(e),i=CKEDITOR.plugins.indentList.firstItemInPath(this.context,e,n);return n&&this.isIndent&&!i?s:a}:function(t,e){var n=this.getContext(e);return!n||this.isIndent?a:s},exec:CKEDITOR.tools.bind(t,this)}}var i=CKEDITOR.plugins.indent;i.registerCommands(e,{indentlist:new n(e,"indentlist",!0),outdentlist:new n(e,"outdentlist")}),CKEDITOR.tools.extend(n.prototype,i.specificDefinition.prototype,{context:{ol:1,ul:1}})}}),CKEDITOR.plugins.indentList={},CKEDITOR.plugins.indentList.firstItemInPath=function(t,n,i){var r=n.contains(e);return i||(i=n.contains(t)),i&&r&&r.equals(i.getFirst(e))}}()}]);