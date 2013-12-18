/*
 * jsPlumb
 * 
 * Title:jsPlumb 1.6.0
 * 
 * Provides a way to visually connect elements on an HTML page, using either SVG, Canvas
 * elements, or VML.  
 * 
 * This file contains the base functionality for DOM type adapters. 
 *
 * Copyright (c) 2010 - 2013 Simon Porritt (http://jsplumb.org)
 * 
 * http://jsplumb.org
 * http://github.com/sporritt/jsplumb
 * http://code.google.com/p/jsplumb
 * 
 * Dual licensed under the MIT and GPL2 licenses.
 */
;(function() {
    
		var canvasAvailable = !!document.createElement('canvas').getContext,
		svgAvailable = !!window.SVGAngle || document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1"),
		vmlAvailable = function() {		    
            if (vmlAvailable.vml === undefined) { 
                var a = document.body.appendChild(document.createElement('div'));
            	a.innerHTML = '<v:shape id="vml_flag1" adj="1" />';
            	var b = a.firstChild;
            	if (b != null && b.style != null) {
	            	b.style.behavior = "url(#default#VML)";
	            	vmlAvailable.vml = b ? typeof b.adj == "object": true;
	            }
	            else
	            	vmlAvailable.vml = false;
            	a.parentNode.removeChild(a);
            }
            return vmlAvailable.vml;
		};
        
    /**
		Manages dragging for some instance of jsPlumb.
	*/
	var DragManager = function(_currentInstance) {		
		var _draggables = {}, _dlist = [], _delements = {}, _elementsWithEndpoints = {},			
			// elementids mapped to the draggable to which they belong.
			_draggablesForElements = {};			

        /**
            register some element as draggable.  right now the drag init stuff is done elsewhere, and it is
            possible that will continue to be the case.
        */
		this.register = function(el) {
            var jpcl = jsPlumb.CurrentLibrary,
            	id = _currentInstance.getId(el),
                parentOffset = jsPlumbAdapter.getOffset(el);
                    
            if (!_draggables[id]) {
                _draggables[id] = el;
                _dlist.push(el);
                _delements[id] = {};
            }
				
			// look for child elements that have endpoints and register them against this draggable.
			var _oneLevel = function(p, startOffset) {
				if (p) {
					for (var i = 0; i < p.childNodes.length; i++) {
						if (p.childNodes[i].nodeType != 3 && p.childNodes[i].nodeType != 8) {
							var cEl = jsPlumb.getElementObject(p.childNodes[i]),
								cid = _currentInstance.getId(p.childNodes[i], null, true);
							if (cid && _elementsWithEndpoints[cid] && _elementsWithEndpoints[cid] > 0) {
								var cOff = jpcl.getOffset(cEl);
								_delements[id][cid] = {
									id:cid,
									offset:{
										left:cOff.left - parentOffset.left,
										top:cOff.top - parentOffset.top
									}
								};
								_draggablesForElements[cid] = id;
							}
							_oneLevel(p.childNodes[i]);
						}
					}
				}
			};

			_oneLevel(el);
		};
		
		// refresh the offsets for child elements of this element. 
		this.updateOffsets = function(elId) {
			if (elId != null) {
				var domEl = jsPlumb.getDOMElement(elId),
					id = _currentInstance.getId(domEl),
					children = _delements[id],
					parentOffset = jsPlumbAdapter.getOffset(domEl);
					
				if (children) {
					for (var i in children) {
						var cel = jsPlumb.getElementObject(i),
							cOff = jpcl.getOffset(cel);
							
						_delements[id][i] = {
							id:i,
							offset:{
								left:cOff.left - parentOffset.left,
								top:cOff.top - parentOffset.top
							}
						};
						_draggablesForElements[i] = id;
					}
				}
			}
		};

		/**
			notification that an endpoint was added to the given el.  we go up from that el's parent
			node, looking for a parent that has been registered as a draggable. if we find one, we add this
			el to that parent's list of elements to update on drag (if it is not there already)
		*/
		this.endpointAdded = function(el) {
			var jpcl = jsPlumb.CurrentLibrary, b = document.body, id = _currentInstance.getId(el), 
				//c = jsPlumb.getElementObject(el), 
				cLoc = jsPlumbAdapter.getOffset(el),
				p = el.parentNode, done = p == b;

			_elementsWithEndpoints[id] = _elementsWithEndpoints[id] ? _elementsWithEndpoints[id] + 1 : 1;

			while (p != null && p != b) {
				var pid = _currentInstance.getId(p, null, true);
				if (pid && _draggables[pid]) {
					var idx = -1, pLoc = jsPlumbAdapter.getOffset(p);
					
					if (_delements[pid][id] == null) {						
						_delements[pid][id] = {
							id:id,
							offset:{
								left:cLoc.left - pLoc.left,
								top:cLoc.top - pLoc.top
							}
						};
						_draggablesForElements[id] = pid;
					}
					break;
				}
				p = p.parentNode;
			}	
		};

		this.endpointDeleted = function(endpoint) {
			if (_elementsWithEndpoints[endpoint.elementId]) {
				_elementsWithEndpoints[endpoint.elementId]--;
				if (_elementsWithEndpoints[endpoint.elementId] <= 0) {
					for (var i in _delements) {
						if (_delements[i]) {
                            delete _delements[i][endpoint.elementId];
                            delete _draggablesForElements[endpoint.elementId];
                        }
					}
				}
			}		
		};	
		
		this.changeId = function(oldId, newId) {				
			_delements[newId] = _delements[oldId];			
			_delements[oldId] = {};
			_draggablesForElements[newId] = _draggablesForElements[oldId];
			_draggablesForElements[oldId] = null;			
		};

		this.getElementsForDraggable = function(id) {
			return _delements[id];	
		};

		this.elementRemoved = function(elementId) {
			var elId = _draggablesForElements[elementId];
			if (elId) {
				delete _delements[elId][elementId];
				delete _draggablesForElements[elementId];
			}
		};

		this.reset = function() {
			_draggables = {};
			_dlist = [];
			_delements = {};
			_elementsWithEndpoints = {};
		};

		//
		// notification drag ended. from 1.6.0 we check automatically if need to update some
		// ancestor's offsets.
		//
		this.dragEnded = function(el) {			
			var id = _currentInstance.getId(el),
				ancestor = _draggablesForElements[id];

			if (ancestor) this.updateOffsets(ancestor);
		};

		this.setParent = function(el, elId, p, pId) {
			var current = _draggablesForElements[elId];
			if (current) {
				if (!_delements[pId])
					_delements[pId] = {};
				_delements[pId][elId] = _delements[current][elId];
				delete _delements[current][elId];
				var pLoc = jsPlumbAdapter.getOffset(p),
					cLoc = jsPlumbAdapter.getOffset(el);
				_delements[pId][elId].offset = {
					left:cLoc.left - pLoc.left,
					top:cLoc.top - pLoc.top
				};				
				_draggablesForElements[elId] = pId;
			}			
		};
		
	};
        
    // for those browsers that dont have it.  they still don't have it! but at least they won't crash.
	if (!window.console)
		window.console = { time:function(){}, timeEnd:function(){}, group:function(){}, groupEnd:function(){}, log:function(){} };
		
	var trim = function(str) {
			return str == null ? null : (str.replace(/^\s\s*/, '').replace(/\s\s*$/, ''));
		},
		_setClassName = function(el, cn) {
			cn = trim(cn);
			if (typeof el.className.baseVal != "undefined")  // SVG
				el.className.baseVal = cn;
			else
				el.className = cn;
		},
		_getClassName = function(el) {
			return (typeof el.className.baseVal == "undefined") ? el.className : el.className.baseVal;	
		},
		_classManip = function(el, add, clazz) {
			var classesToAddOrRemove = clazz.split(/\s+/),
				className = _getClassName(el),
				curClasses = className.split(/\s+/);
				
			for (var i = 0; i < classesToAddOrRemove.length; i++) {
				if (add) {
					if (curClasses.indexOf(classesToAddOrRemove[i]) == -1)
						curClasses.push(classesToAddOrRemove[i]);
				}
				else {
					var idx = curClasses.indexOf(classesToAddOrRemove[i]);
					if (idx != -1)
						curClasses.splice(idx, 1);
				}
			}
			_setClassName(el, curClasses.join(" "));
		},
		_each = function(spec, fn) {
			if (spec == null) return;
			if (typeof spec === "string") 
				fn(jsPlumb.getDOMElement(spec));
			else if (spec.length != null) {
				for (var i = 0; i < spec.length; i++)
					fn(jsPlumb.getDOMElement(spec[i]));
			}
			else
				fn(spec); // assume it's an element.
		}

    window.jsPlumbAdapter = {
        
        headless:false,

        getAttribute:function(el, attName) {
        	return el.getAttribute(attName);
        },

        setAttribute:function(el, a, v) {
        	el.setAttribute(a, v);
        },
        
        appendToRoot : function(node) {
            document.body.appendChild(node);
        },
        getRenderModes : function() {
            return [ "canvas", "svg", "vml" ];
        },
        isRenderModeAvailable : function(m) {
            return {
                "canvas":canvasAvailable,
                "svg":svgAvailable,
                "vml":vmlAvailable()
            }[m];
        },
        getDragManager : function(_jsPlumb) {
            return new DragManager(_jsPlumb);
        },
        setRenderMode : function(mode) {
            var renderMode;
            
            if (mode) {
				mode = mode.toLowerCase();            
			            
                var canvasAvailable = this.isRenderModeAvailable("canvas"),
                    svgAvailable = this.isRenderModeAvailable("svg"),
                    vmlAvailable = this.isRenderModeAvailable("vml");
                
                // now test we actually have the capability to do this.
                if (mode === "svg") {
                    if (svgAvailable) renderMode = "svg";
                    else if (canvasAvailable) renderMode = "canvas";
                    else if (vmlAvailable) renderMode = "vml";
                }
                else if (mode === "canvas" && canvasAvailable) renderMode = "canvas";
                else if (vmlAvailable) renderMode = "vml";
            }

			return renderMode;
        },
		addClass:function(el, clazz) {
			_each(el, function(e) {
				_classManip(e, true, clazz);
			});
		},
		hasClass:function(el, clazz) {
			el = jsPlumb.getDOMElement(el);
			if (el.classList) return el.classList.contains(clazz);
			else {
				return _getClassName(el).indexOf(clazz) != -1;
			}
		},
		removeClass:function(el, clazz) {
			_each(el, function(e) {
				_classManip(e, false, clazz);
			});
		},
		setClass:function(el, clazz) {
			_each(el, function(e) {
				_setClassName(e, clazz);
			});
		},
		setPosition:function(el, p) {
			el.style.left = p.left + "px";
			el.style.top = p.top + "px";
		},
		getPosition:function(el) {
			var _one = function(prop) {
				var v = el.style[prop];
				return v ? v.substring(0, v.length - 2) : 0;
			};
			return {
				left:_one("left"),
				top:_one("top")
			};
		},
		getOffset:function(el, relativeToRoot) {
			var l = el.offsetLeft, t = el.offsetTop, op = el.offsetParent;
			while (op != null) {
				l += op.offsetLeft;
				t += op.offsetTop;
				op = relativeToRoot ? op.offsetParent : null;
			}
			return {
				left:l, top:t
			};
		}
    };
   
})();