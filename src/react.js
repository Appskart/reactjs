/*
 * 
 * Copyright (c) 2011 Christopher Aue
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */

//react.js extends Javascript in the following ways:
//- Create objects, overload their operators and use them within react().
//- Save data in variables inside of react() and combine them with operators
//  without accessing the stored value before evaluation (reactive programming)

( function( undefined ) {
	if ( typeof Object.create !== "function" )
		Object.create = function( o ) {
			var F = function() {};
			F.prototype = o;
			return new F;
		};
	
	var equiv = function( arr1, arr2 ) {
			if ( arr1 === arr2 )
				return true;
			
			if ( !arr1 || arr1.constructor !== Array || !arr2 || arr2.constructor !== Array ||
				 arr1.length !== arr2.length)
				return false;
			
			var i = arr1.length;
			while ( i-- ) {
				if ( arr1[ i ].constructor === Array ) {
					if ( equivArr( arr1[ i ], arr2[ i ] ) )
						continue;
					else
						return false;
				
				} else if ( arr1[ i ] !== arr2[ i ] ) {
					return false;
				}
			}
			
			return true;
		},
		each = function( obj, func ) {
			var id, len;
			
			if ( obj.constructor === Array ) {
				for ( id = 0, len = obj.length; id < len; id++ )
					func( id, obj[ id ] );
			
			} else {
				for ( id in obj )
					if ( obj.hasOwnProperty( id ) )
						func( id, obj[ id ] );
			}
		},
		isEmptyObj = function( obj ) {
			if ( typeof obj !== "object" || obj === null || obj.constructor === Array )
				return false;
			
			for ( var key in obj )
				if ( key in obj )
					return false;
			
			return true;
		};
	
	var error = function( msg ) {
			throw new Error( "react.js | " + msg );
		};
	
	var ctxtVarCarrier = {
			ctxtVarCarrier : true,
			func : null
		};
	
	var Datatype = ( function() {
			var valueOf = function( ctxt, data ) {
					try {
						if ( this._isCtxtEval )
							return this._valueOf( ctxt, data );
						
						if ( this._evaled === null )
							this._evaled = this._valueOf();
						
						return this._evaled;
					
					} catch( e ) {
						error( "react.datatype.valueOf: " + e.message );
					}
				},
				toString = function( ctxt, data ) {
					try {
						if ( this._isCtxtEval )
							return this._toString ? this._toString( ctxt, data ) : String( this.valueOf( ctxt, data ) );
						
						if ( this._string === null )
							this._string = this._toString  ? this._toString() : String( this.valueOf() );
						
						return this._string;
					
					} catch( e ) {
						error( "react.datatype.toString: " + e.message );
					}
				},
				_valueOf = function() {
					return undefined;
				},
				_toString = function( ctxt, data ) {
					return String( this.valueOf( ctxt, data ) );
				};
			
			return function( ini, proto ) {
				var key, type, constr, dataProps = [], fixnew;
				
				//identify data properties reflecting the instances state
				for ( key in proto ) {
					type = typeof proto[ key ];
					if ( proto[ key ] === null || ( type !== "object" && type !== "function" ) )
						dataProps.push( key );
				}
				
				constr = function() {
					if ( fixnew && this instanceof constr )
						return this;
					
					var ret = this;
					
					//instantiation without "new" operator
					if ( !(this instanceof constr) ) {
						fixnew = true;
						ret = new constr;
						fixnew = false;
					}
					
					ini.apply( ret, arguments );
					
					//check, if instance needs to be reactive
					for ( var idx = 0, len = dataProps.length; idx < len; idx++ ) {
						var data = ret[ dataProps[ idx ] ];
						
						if ( data !== undefined && data._isReactive ) {
							if ( !ret._isReactive )
								reactive( ret );
							
							ret.addDep( data._key ? data : data._dep );
						}				
					}
					
					if ( ret._valueOf.length )
						ret._isCtxtEval = true;
					else
						delete ret._isCtxtEval;
					
					return ret;
				};
				
				constr.prototype = Object.create( proto );
				
				constr.prototype._valueOf   = proto.hasOwnProperty( "valueOf" )   ? proto.valueOf   : _valueOf;
				constr.prototype._toString  = proto.hasOwnProperty( "toString" )  ? proto.toString  : _toString;
				
				proto = constr.prototype;
				
				proto.valueOf    = valueOf;
				proto.toString   = toString;
				
				proto._evaled = null;
				proto._string = null;
				
				return constr;
			};
		}() );
	
	var Reactive = function( val, noPartOf ) {
			var r;
			if ( this instanceof Reactive )
				r = this;
			else
				r = Object.create( Reactive.prototype );
			
			r._guid	  = Reactive.prototype._guid++;
			r._dep 	  = null;
			r._partOf = {};
			r._funcs  = [];
			
			r.set( val, noPartOf );
			
			return r;
		};
	
	Reactive.prototype = {
		valueOf : function( ctxt, data ) {
			try {
				if ( "_prev" in this )
					return this._valueOf();
				
				if ( this._isCtxtEval )
					return this._value.call( ctxt, data );
				
				if ( this._hasCtxtEval )
					return this._valueOf( ctxt, data );
				
				if ( !("_evaled" in this) )
					this._evaled = this._valueOf();
				
				return this._evaled;
			
			} catch( e ) {
				error( "react.reactive.valueOf: " + e.message );
			}
		},
		toString : function( ctxt, data ) {
			try {
				if ( this._isCtxtEval )
					return String( this._value.apply( ctxt, data ) );
				
				if ( this._hasCtxtEval )
					return this._toString  ? this._toString( ctxt, data ) : String( this.valueOf( ctxt, data ) );
				
				if ( !("_string" in this) )
					this._string = this._toString  ? this._toString() : String( this.valueOf() );
				
				return this._string;
			
			} catch( e ) {
				error( "react.reactive.toString: " + e.message );
			}
		},
		_prevValueOf : function( ctxt, data ) {
			return  "_prev" in this ? 
					( this._prev && this._prev._prevValueOf ?
						this._prev._prevValueOf( ctxt, data ) :
						this._prev ) :
					this._value && this._value._prevValueOf ?
						this._value._prevValueOf( ctxt, data ) :
						this._value;
		},
		
		_bind : function( f, args, eval ) {
			this._funcs.push( {
				func : f,
				args : args,
				eval : eval
			} );
			
			return this;
		},
		_unbind : function( f, args ) {
			if ( arguments.length === 0 ) {
				//unbind all functions, if no function is specified
				this._funcs.length = 0;
			}
			
			var fIdx = this._funcs.length,
				call,
				argIdx,
				funcsEquiv,
				argsEquiv;
			
			
			while ( fIdx-- ) {
				call = this._funcs[ fIdx ];
				
				//compare function and arguments
				argIdx = args.length;
				if ( equiv( call.func, f ) && equiv( call.args, args ) ) {
					this._funcs.splice( fIdx, 1 )
					return true;
				}
			}
			
			return false;
		},
		_trigger : function() {
			var i = 0,
				l = this._funcs.length,
				call, func, ctxt,
				j, m, args;
			//debugger;
			while ( i < l ) {
				call = this._funcs[ i++ ];
				args = call.args;
				
				if ( call.func._isValArray && call.func._propAccess ) {
					var ctxt = call.func[ 1 ].valueOf(),
						prop,
						j = 2,
						m = call.func.length-1;
					
					while ( j<m )
						ctxt = ctxt[ call.func[ j++ ].valueOf() ];
					
					prop = call.func[ j ].valueOf();
					
					func = ctxt[ prop ];
				
				} else {
					func = call.func._isValArray ? call.func.valueOf() : call.func._isVar ? call.func._value : call.func;
				}
				
				if ( call.eval ) {
					args = [];
					j = call.args.length;
					while ( j-- ) {
						args[ j ] = call.args[ j ].valueOf();
					}
				}
				
				try {
					func.apply( ctxt || this, args );
				} catch( e ) {
					error( "A reactive function call causes problems: " + e.message );
				}
			}
			
			return this;
		},
		_invalidate : function() {
			delete this._evaled;
			delete this._string;
			
			this._hasCtxtEval = false;
			for ( var id in this._dep ) {
				if ( this._dep[ id ]._hasCtxtEval ) {
					this._hasCtxtEval = true;
					break;
				}
			}
			
			for ( var id in this._partOf )
				this._partOf[ id ]._invalidate();
			
			if ( this._funcs.length )
				this._trigger();
			
			return this;
		},
		
		/*addDep : function() {
			var i, l = arguments.length, arg, id;
			
			if ( l && this._dep === null )
				this._dep = { depObj:true };
			
			for ( i = 0; i < l; i++ ) {
				arg = arguments[ i ];
				
				if ( !arg )
					continue;
				
				if ( arg.depObj ) {
					for ( id in arg ) {
						if ( id === "depObj" )
							continue;
						
						if ( arg[ id ] && arg[ id ]._isVar ) {
							this._dep[ arg[ id ]._guid ] = arg[ id ];
							arg[ id ]._partOf[ this._guid ] = this;
							
							if ( arg[ id ]._hasCtxtEval )
								this._hasCtxtEval = true;
						}
					}
				
				} else if ( arg._isVar ) {
					this._dep[ arg._guid ] = arg;
					arg._partOf[ this._guid ] = this;
					
					if ( arg._hasCtxtEval )
						this._hasCtxtEval = true;
				}
			}
			
			return this;
		},*/
		/*rmvDep : function() {
			var i, l = arguments.length, arg, id;
			
			if ( this._dep === null )
				return this;
			
			for ( i = 0; i < l; i++ ) {
				arg = arguments[ i ];
				
				if ( !arg )
					continue;
				
				if ( arg._isVar ) {
					delete arg._partOf[ this._guid ];
					delete this._dep[ arg._guid ];
				}
			}
			
			if ( !this._hasCtxtEval )
				return this;
			
			//check, if object is still evaluating under context
			for ( id in this._dep ) {
				if ( this._dep[ id ]._hasCtxtEval )
					return this;
			}
			
			this._hasCtxtEval = false;
			
			return this;
		},*/
		
		set : function( val, noPartOf ) {
			var id;
			
			//save previous value temporarily, so invalidation has access to it, if necessary
			this._prev = this._value;
			
			//set new value
			this._value = val && val.ctxtVarCarrier ? val.func : val;
			
			//delete partOfs on dependencies side
			for ( id in this._dep ) {
				if ( id === "depObj" )
					continue;
				
				if ( this._dep[ id ]._partOf )
					delete this._dep[ id ]._partOf[ this._guid ];
			}
			
			//set new dependency
			if ( val )
				this._dep = ( val && val._dep ) || null;
			
			//invalidate
			this._invalidate();
			
			//delete previous value
			delete this._prev;
			
			//identify context evaluation
			this._isCtxtEval  = false;
			this._hasCtxtEval = false;
			if ( val && val.ctxtVarCarrier )
				this._isCtxtEval = true;
			else if ( val && ( val._isCtxtEval || val._hasCtxtEval ) )
				this._hasCtxtEval = true;
			
			if ( !noPartOf ) {
				//set new partOf on dependencies' side
				for ( id in this._dep ) {
					if ( id === "depObj" )
						continue;
					
					this._dep[ id ]._partOf[ this._guid ] = this;
				}
			}
			
			return this;
		},
		"delete" : function() {
			var id;
			
			//save previous value temporarily, so invalidation has access to it, if necessary
			//this._prev = this._value;
			
			delete this._value;
			
			//invalidate
			//this._invalidate();
			
			//delete previous value
			//delete this._prev;
			
			//delete partOfs on dependencies side
			for ( id in this._dep ) {
				if ( id === "depObj" )
					continue;
				
				if ( this._dep[ id ]._partOf )
					delete this._dep[ id ]._partOf[ this._guid ];
			}
			
			delete this._string;
			delete this._evaled;
			
			delete this._isReactive;
			delete this._isCtxtEval;
			delete this._hasCtxtEval;
			
			delete this._guid
			delete this._dep;
			delete this._partOf;
			this._funcs.length = 0;
			delete this._funcs;
			
			return true;
		},
		
		_value  : undefined,
		
		_isReactive  : true,
		_isCtxtEval  : false,
		_hasCtxtEval : false,
		
		_guid   : 0,
		_dep    : null,
		_partOf : null,
		_funcs  : null
	};
	
	var Interpreter = ( function() {
			//streamlined pratt interpreter - derived from http://javascript.crockford.com/tdop/tdop.html
			//expression evaluation directly included into the interpret process
			
			var noPartOf = false;
			
			//value array properties
			var makeValArray = ( function() {
					var valueOf = function( ctxt, data ) {
							try {
								var op = this[ 0 ],
									len = this.length-1,
									ret,
									cur;
								
								if ( this.length === 2 ) {
									//unary
									if ( this[ 1 ]._isVar )
										cur = this[ 1 ].valueOf( ctxt, data );
									//else if ( typeof this[ 1 ] === "function" )
									//	cur = this[ 1 ]( ctxt, data );
									else
										cur = this[ 1 ];
									
									return operators[ op ].nudEval.call( this, cur, ret );
								}
								
								//binary with two or more operands
								for ( var idx = this.length-1; idx > 0; idx-- ) {
									if ( this[ idx ]._isVar )
										cur = this[ idx ].valueOf( ctxt, data );
									//else if ( typeof this[ idx ] === "function" )
									//	cur = this[ idx ]( ctxt, data );
									else
										cur = this[ idx ];
									
									ret = ( ret === undefined  ) ? cur : operators[ op ].ledEval.call( this, cur, ret );
								}
								
								return ret;
							
							} catch( e ) {
								error( "_isValArray.valueOf: " + e.message );
							}
						},
						toString = function() {
							try {
								var str = "",
									op = this[ 0 ];
								
								for ( var idx = 1, len = this.length; idx < len; idx++ ) {
									if ( !this[ idx ] ) {
										str += this[ idx ];
									
									} else if ( this[ idx ]._isValArray ) {
										//replace + with - in case of negative number and summation
										if ( op === "+" && this[ idx ][ 0 ] === "*" && this[ idx ][ 1 ] < 0 ) {
											str = str.slice( 0, -op.length );
										}
										
										if ( ( op === "*" && this[ idx ][ 0 ] === "+" ) || op === "^" )
											str += "(";
										
										str += toString.call( this[ idx ] );
										
										if ( ( op === "*" && this[ idx ][ 0 ] === "+" ) || op === "^" )
											str += ")";
									
									} else {
										if ( op === "^" && idx > 2 && len > 3 )
											str = "(" + str;
										
										if ( idx === 1 && op === "*" && this[ idx ] === -1 ) {
											str += "-";
											continue;
										}
										
										if ( this[ idx ]._isVar ) {
											if ( this[ idx ]._isNamed )
												str += this[ idx ]._key;
											else
												str += "{" + this[ idx ].toString() + "}";
										
										} else {
											if ( typeof this[ idx ] === "number" && op === "+" && this[ idx ] < 0 ) {
												str = str.slice( 0, -op.length );
												str += "-" + Math.abs( this[ idx ] );
											} else {
												str += this[ idx ];
											}
										}
										
										if ( op === "^" && idx < len-1 && len > 3 )
											str += ")";
									}
									
									if ( idx > 1 ) {
										if ( op === "(" )
											str += " ) ";
										else if ( op === "[" )
											str += " ] ";
										else if ( op === "{" )
											str += " } ";
									}
									
									if ( idx < len-1 )
										str += " " + op + " ";
								}
								
								return str;
							
							} catch( e ) {
								error( "_isValArray.toString:" + e.message );
							}
						},
						_prevValueOf = function( ctxt, data ) {
							try {
								var op = this[ 0 ],
									len = this.length-1,
									ret,
									cur;
								
								if ( this.length === 2 ) {
									//unary
									if ( this[ 1 ]._isVar )
										cur = this[ 1 ]._prevValueOf( ctxt, data );
									//else if ( typeof this[ 1 ] === "function" )
									//	cur = this[ 1 ]( ctxt, data );
									else
										cur = this[ 1 ];
									
									return operators[ op ].nudEval.call( this, cur, ret );
								}
								
								//binary with two or more operands
								for ( var idx = this.length-1; idx > 0; idx-- ) {
									if ( this[ idx ]._isVar )
										cur = this[ idx ]._prevValueOf( ctxt, data );
									//else if ( typeof this[ idx ] === "function" )
									//	cur = this[ idx ]( ctxt, data );
									else
										cur = this[ idx ];
									
									ret = ( ret === undefined  ) ? cur : operators[ op ].ledEval.call( this, cur, ret );
								}
								
								return ret;
							
							} catch( e ) {
								error( "_isValArray._prevValueOf: " + e.message );
							}
						},
						addDep = function() {
							//add new dependancies
							var i, l = arguments.length, arg, id;
							
							if ( l && this._dep === null )
								this._dep = { depObj:true };
							
							for ( i = 0; i < l; i++ ) {
								arg = arguments[ i ];
								
								if ( !arg )
									continue;
								
								if ( arg.depObj ) {
									for ( id in arg ) {
										if ( id === "depObj" )
											continue;
										
										this._dep[ arg[ id ]._guid ] = arg[ id ];
										
										if ( arg[ id ]._isCtxtEval )
											this._isCtxtEval = true;
									}
								
								} else if ( arg && arg._isVar ) {
									this._dep[ arg._guid ] = arg;
									
									if ( arg._isCtxtEval )
										this._isCtxtEval = true;
								}
							}
							
							return this;
						},
						_checkDep = function( _dep ) {
							var i, l, id1, id2, stayFuncVar;
							
							if ( _dep.constructor === Array ) {
								_dep = _dep._dep;
								DEPLOOP : for ( id2 in _dep ) {
									if ( id2 === "depObj" )
										continue;
									
									for ( i = 1, l = this.length; i < l; i++ ) {
										if ( this[ i ] && this[ i ].constructor === Array ) {
											for ( id1 in this[ i ]._dep ) {
												if ( this[ i ]._dep[ id1 ] === _dep[ id2 ] ) {
													continue DEPLOOP;
												}
												
												if ( this[ i ]._dep[ id1 ]._isCtxtEval )
													stayFuncVar = true;
											}
										
										} else {
											if ( this[ i ] === _dep[ id2 ] ) {
												continue DEPLOOP;
											}
											
											if ( this[ i ]._isCtxtEval )
												stayFuncVar = true;
										}
									}
									
									delete this._dep[ id2 ];
								}
							
							} else {
								for ( i = 1, l = this.length; i < l; i++ ) {
									if ( this[ i ] && this[ i ].constructor === Array ) {
										for ( id1 in this[ i ]._dep ) {
											if ( this[ i ]._dep[ id1 ] === _dep ) {
												return;
											}
											
											if ( this[ i ]._dep[ id1 ]._isCtxtEval )
												stayFuncVar = true;
										}
									
									} else {
										if ( this[ i ] === _dep ) {
											return;
										}
										
										if ( this[ i ]._isCtxtEval )
											stayFuncVar = true;
									}
								}
								
								delete this._dep[ _dep._guid ];
							}
							
							if ( !stayFuncVar )
								delete this._isCtxtEval
						},
						del = function() {
							var ret = true;
							//delete partOfs on dependencies side
							for ( id in this._dep ) {
								if ( id === "depObj" )
									continue;
								
								if ( this._dep[ id ]._partOf )
									ret = ret && delete this._dep[ id ]._partOf[ this._guid ];
							}
							
							return ret;
						},
						makeVar = function() {
							delete this._checkDep;
							delete this.addDep;
							delete this.makeVar;
						};
					
					return function( arr ) {
						var i, l, id, arg;
						
						arr.valueOf 	 = valueOf;
						arr.toString     = toString;
						arr._prevValueOf = _prevValueOf;
						
						arr._isValArray  = true;
						arr.makeVar		 = makeVar;
						arr._dep		 = arr._dep || null;
						arr._checkDep 	 = _checkDep;
						arr.addDep		 = addDep;
						arr[ "delete" ]  = del;
						
						arr.addDep.apply( arr, Array.prototype.slice.call( arguments, 1 ) );
						
						if ( arr[ 0 ] === "." )
							arr._propAccess = true;
						
						return arr;
					};
				}() );
			
			//token parsing and evaluation
			var operators = {},		//table holding defined operators

				itself = function( expr ) {
					expr.o[ expr.p ] = this;
					return expr;
				},
				
				nudUndef = function() {
					error( "Token " + this.value + " is undefined." );
				},
				
				ledUndef = function ( left ) {
					error( "Token \"" + this.value + "\" is no infix operator." );
				},
				
				opType = {
					infix : function( s, bp, led ) {
						s.led = led || function ( expr ) {
							this.first = expr.o[ expr.p ];
							this.second = undefined;
							this.ledEval = operators[ this.id ].ledEval;
							expr.o[ expr.p ] = this;
							
							return {
								o : this,
								p : "second",
								rbp : bp,
								end : null,
								parent : expr,
								prevToken : expr.o.id
							};
						};
						return s;
					},
					
					infixr : function( s, bp, led ) {
						s.led = led || function ( expr ) {
							this.first = expr.o[ expr.p ];
							this.second = undefined;
							this.ledEval = operators[ this.id ].ledEval;
							expr.o[ expr.p ] = this;
							
							return {
								o : this,
								p : "second",
								rbp : bp-2,
								end : null,
								parent : expr,
								prevToken : expr.o.id
							};
						};
						return s;
					},

					prefix : function( s, bp, nud ) {
						s.nud = nud || function ( expr ) {
							this.first = undefined;
							this.nudEval = operators[ this.id ].nudEval;
							expr.o[ expr.p ] = this;
							
							return {
								o : this,
								p : "first",
								rbp : bp,
								end : null,
								parent : expr,
								prevToken : expr.o.id
							};
						};
						return s;
					},
					
					assignment : function( s, bp, led ) {
						return opType.infixr( s, bp, led || function ( expr ) {
							this.first = expr.o[ expr.p ];
							this.second = undefined;
							this.assignment = true;
							this.ledEval = operators[ this.id ].ledEval;
							expr.o[ expr.p ] = this; 
							
							if ( this.first )
								assignTo = this.first.id === "(id)" ? this.first.value : this.first._key;
							
							return {
								o : this,
								p : "second",
								rbp : bp-2,
								end : null,
								parent : expr,
								prevToken : expr.o.id
							};
						} );
					},
					
					"delete" : function( s, bp, nud ) {
						return opType.prefix( s, bp, nud || function ( expr ) {
							this.first = undefined;
							this.assignment = true;
							this.nudEval = operators[ this.id ].nudEval;
							expr.o[ expr.p ] = this;
							
							return {
								o : this,
								p : "first",
								rbp : this.lbp,
								end : null,
								parent : expr,
								prevToken : expr.o.id
							};
						} );
					},
					
					call : function( s, bp, led ) {
						return opType.infix( s, bp, led || function( expr ) {
							this.first = expr.o[ expr.p ];
							this.second = undefined;
							this.call = true;
							this.ledEval = operators[ this.id ].ledEval;
							expr.o[ expr.p ] = this;
							
							return {
								o : this,
								p : "second",
								rbp : 0,
								end : ")",
								parent : expr,
								prevToken : expr.o.id
							};
						} );
					}
				},
			
				operator = function( id, type, bp, interpret, eval, composed ) {
					var op = operators[ id ],
						stdFunc;
					
					bp = bp || 0;
					if ( !op ) {
						op = {};
						op.id = op.value = id;
						op.lbp = bp;
						operators[ id ] = op;
					}
					
					if ( type ) 
						opType[ type ]( op, bp, interpret );
					
					if ( eval ) {
						if ( type === "prefix" || type === "delete" ) {
							id = "prefix"+id;
							stdFunc = typeof eval === "function" ?
											eval :
											function( operand ) {
												var type = typeof operand;
												
												if ( operand && operand._isValArray ) {
													//reactive value arrays are referenced externally, copy them
													operand = makeValArray( operand.slice( 0 ), operand._dep );
													type = "arr";
												} else {
													type = !operand || type === "number" || type === "string" || type === "boolean" ? 
																"lit" :
															operand._isValArray ?
																"arr" :
															operand._key ?
																"ref" :
																"lit";
												}
												
												return op.nudEval[ type ].apply( this, arguments );
											};
							
							op.nudEval = function( operand, undef, interpreter ) {
								//check for overloaded operators
								if ( operand && operand[ id ] )
									return operand[ id ].call( operand );
								
								//standard operator behavior
								return stdFunc.call( this, operand, interpreter );
							};
							
							//append lit, ref and arr functions to base eval function
							if ( typeof eval === "object" )
								each( eval, function( key, value ) { op.nudEval[ key ] = value; } );
						
						} else {
							id = "infix"+id;
							stdFunc = typeof eval === "function" ?
											eval :
											function( left, right ) {
												var typeL, typeR;
												
												typeL = typeof left;
												if ( left && left._isValArray ) {
													//reactive value arrays are referenced externally, copy them
													left = makeValArray( left.slice( 0 ), left._dep );
													typeL = "arr";
												} else {
													typeL = !left ? 
																"lit" :
															left._isValArray ?
																"arr" :
															left._key  || ( left._value && left._value._isValArray ) ?
																"ref" :
																"lit";
												}
												
												typeR = typeof right;
												if ( right && right._isValArray ) {
													//reactive value arrays are referenced externally, copy them
													right = makeValArray( right.slice( 0 ), right._dep );
													typeR = "arr";
												} else {
													typeR = !right ? 
																"lit" :
															right._isValArray ?
																"arr" :
															right._key || ( right._value && right._value._isValArray ) ?
																"ref" :
																"lit";
												}
												
												return op.ledEval[ typeL ][ typeR ].apply( this, arguments );
											};
							
							op.ledEval = function( left, right, interpreter ) {
								//check for overloaded operators
								if ( left && left[ id ] )
									return left[ id ].call( left, right );
								
								if ( right && right[ id ] )
									return right[ id ].call( right, left, true );
								
								//standard operator behavior
								return stdFunc.call( this, left, right, interpreter );
							};
							
							//append lit, ref and arr functions to base eval function
							if ( typeof eval === "object" )
								each( eval, function( key, value ) { op.ledEval[ key ] = value; } );
						}
					}
					
					return op;
				};
			
			//define operators
			var opTypes = [ "lit", "ref", "arr" ];
			operator( ";" );
			operator( ")" );		
			operator( "]" );
			
			operator( "clean", "prefix", 0, null, function( undef, interpreter ) {
				return interpreter.varTable.clean();
			} );
			
			operator( "cleanExcept", "prefix", 4, null, function( vars, interpreter ) {
				if ( vars === undefined )
					error( "'except' has to be followed by a list of one or more variable names" );
				
				if ( vars.id !== "(id)" && ( !vars._isValArray || vars[ 0 ] !== "," ) )
					error( "'except' has to be followed by a list of one or more variable names" );
				
				var varObj = {};
				if ( vars._isValArray ) {
					vars.shift();
					
					var i = vars.length;
					
					while ( i-- ) {
						varObj[ vars[ i ]._key ] = vars[ i ];
					}
				
				} else {
					varObj[ vars._key ] = vars;
				}
				
				return interpreter.varTable.clean( varObj );
			} );
			
			operator( ",", "infix", 5, null, ( function() {
					var ret = {},
						func = function( left, right ) {
							return makeValArray(
								[ ",", left, right ],
								left,
								right && right._isValArray ? right._dep : right
							);
						},
						funcArr = function( left, right ) {
							if ( right._isValArray && right[ 0 ] === "," ) {
								right.unshift( left );
								right.addDep( left._dep );
								
								return right;
							}
							
							return makeValArray(
								[ ",", left, right ],
								left._dep,
								right && right._isValArray ? right._dep : right
							);
						},
						arrFunc = function( left, right ) {
							if ( left[ 0 ] === "," ) {
								if ( right._isValArray && right[ 0 ] === "," ) {
									right.splice( 0, 0, left.length, 0 );
									left.splice.apply( left, right );
									left.addDep( right._dep );
								} else {
									left.push( right );
									left.addDep( right );
								}
								
								return left;
							
							} else if ( right._isValArray && right[ 0 ] === "," ) {
								right.unshift( left );
								right.addDep( left._dep );
								
								return right;
							}
							
							return makeValArray(
								[ ",", left, right ],
								left._dep,
								right && right._isValArray ? right._dep : right
							);
						};
					
					each( [ "lit", "ref" ], function( idxL, typeL ) {
						ret[ typeL ] = {};
						each( [ "lit", "ref" ], function( idxR, typeR ) {
							ret[ typeL ][ typeR ] = func;
						} );
						ret[ typeL ].arr = funcArr;
					} );
					
					ret.arr = {};
					each( [ "lit", "ref", "arr" ], function( idx, type ) {
						ret.arr[ type ] = arrFunc;
					} );
					
					return ret;
				}() )
			);
			
			var updateProp = function( path ) {
					var oldO, oldP,
						i = 2, l = path.length-1,
						ctxtProp,
						pathObj = reactPaths.search( path );
					
					//get old ctxt and old prop
					oldO = path[ 1 ]._prevValueOf ? path[ 1 ]._prevValueOf() : path[ 1 ];
					for ( i = 2; i<l; i++ )
						oldO = [ path[ i ]._prevValueOf ? path[ i ]._prevValueOf() : path[ i ] ];
					
					oldP = path[ l ]._prevValueOf ? path[ l ]._prevValueOf() : path[ l ];
					
					//restore value of old ctxt and prop
					revProps.rev( oldO, oldP, pathObj );
					
					//update object property value
					ctxtProp = reactPaths.inCtxtProp( path );
					revProps.set( ctxtProp.ctxt, ctxtProp.prop, pathObj );
				};
			
			var revProps = [];
				
				revProps.set = function( ctxt, prop, pathObj ) {
					//get new ctxt and prop
					var propIdx = this.search( ctxt, prop ),
						pathIdx,
						path = pathObj.path,
						val = pathObj.val,
						del = pathObj.del,
						rev = pathObj.rev,
						pathIdx,
						reactProp;
					
					//test for reactive value and make it literal
					if ( val && ( val._isVar || val._isValArray ) )
						val = val.valueOf();
					
					if ( rev ) {
						if ( propIdx === undefined ) {
							reactProp = {
								ctxt : ctxt,
								prop : prop,
								backupDel : !(prop in ctxt),
								backup : ctxt[ prop ],
								val : val,
								del : del,
								reactPaths : [ path ]
							};
							
							this.push( reactProp );
						
						} else {
							reactProp = this[ propIdx ];
							
							//test, if path is known to this object property
							var pathIdx = reactProp.reactPaths.length;
							while ( pathIdx-- ) {
								if ( equiv( reactProp.reactPaths[ pathIdx ], path ) ) {
									break;
								}
							}
							
							//path has not been registered previously for this object property
							//add it
							if ( pathIdx < 0 )
								reactProp.reactPaths.push( path );
							
							//update value
							reactProp.val = val;
							reactProp.del = del;
						}
					}
					
					//update property
					if ( del )
						return delete ctxt[ prop ];
					else
						return ctxt[ prop ] = val;
				};
				
				revProps.rev = function( ctxt, prop, pathObj ) {
					var propIdx = revProps.search( ctxt, prop ),
						pathIdx,
						reactProp;
					
					if ( !pathObj.rev )
						return true;
					
					if ( propIdx === undefined )
						return false;
					
					reactProp = revProps[ propIdx ];
					
					//remove path
					pathIdx = reactProp.reactPaths.length;
					while ( pathIdx-- ) {
						if ( equiv( pathObj.path, reactProp.reactPaths[ pathIdx ] ) ) {
							reactProp.reactPaths.splice( pathIdx, 1 );
							break;
						}
					}
					
					//restore value
					if ( reactProp.reactPaths.length === 0 ) {
						if ( reactProp.backupDel )
							delete reactProp.ctxt[ reactProp.prop ];
						else
							reactProp.ctxt[ reactProp.prop ] = reactProp.backup;
						
						revProps.splice( propIdx, 1 );
					}
					
					return true;
				};
				
				revProps.search = function( ctxt, prop ) {
					for ( var i in this ) {
						if ( this[ i ].ctxt === ctxt && this[ i ].prop === prop )
							return i;
					}
					
					return undefined;
				};
				
			var reactPaths = [];
				
				reactPaths.inCtxtProp = function( path ) {
					var o = path[ 1 ].valueOf(),
						p,
						i = 2,
						l = path.length-1;
					
					while ( i<l )
						o = o[ path[ i++ ].valueOf() ];
					
					p = path[ i ].valueOf();
					
					return {
						ctxt : o,
						prop : p,
					};
				};
				
				reactPaths.search = function( path ) {
					var i = this.length;
					while ( i-- ) {
						if ( equiv( path, this[ i ].path ) ) {
							return this[ i ];
						}
					}
					
					return undefined;
				};
				
				reactPaths.set = function( path, val, del, rev ) {
					var pathObj,
						i = this.length;
					
					while ( i-- ) {
						if ( equiv( path, this[ i ].path ) ) {
							break;
						}
					}
					
					if ( i < 0 ) {
						//path is new; add it to list and bind handler
						pathObj = {
							path : path,
							val  : val,
							del  : del,
							rev  : rev
						};
						
						this.push( pathObj );
						
						for ( var key in path._dep ) {
							if ( key === "depObj" )
								continue;
							
							path._dep[ key ]._bind( updateProp, [ path ] );
						}
					
					} else {
						//path is known
						pathObj = this[ i ];
						
						//unbind value handlers
						if ( pathObj.val && ( pathObj.val._isVar || pathObj.val._isValArray ) ) {
							if ( pathObj.val._isVar )
								val._unbind( updateProp, [ path ] );
							else
								for ( var key in pathObj.val._dep ) {
									if ( key === "depObj" )
										continue;
									
									pathObj.val._dep[ key ]._unbind( updateProp, [ path ] );
								}
						}
						
						//update values
						pathObj.val = val;
						pathObj.del = del;
						pathObj.rev = rev;
					}
					
					//check, if new value is reactive
					if ( val ) {
						if ( val._isVar )
							val._bind( updateProp, [ path ] );
						
						else if ( val._isValArray )
							for ( var key in val._dep ) {
								if ( key === "depObj" )
									continue;
								
								val._dep[ key ]._bind( updateProp, [ path ] );
							}
					}
					
					return pathObj;
				};
				
				reactPaths.rmv = function( path ) {
					var i = this.length,
						key;
					
					while ( i-- ) {
						if ( equiv( path, this[ i ].path ) ) {
							var pathObj = this[ i ];
							
							//unbind path handlers
							for ( key in pathObj.path._dep ) {
								if ( key === "depObj" )
									continue;
								
								pathObj.path._dep[ key ]._unbind( updateProp, [ pathObj.path ] );
							}
							
							//unbind value handlers
							if ( pathObj.val ) {
								if ( pathObj.val._isVar )
									pathObj.val._unbind( updateProp, [ pathObj.path ] );
									
								else if ( pathObj.val._isValArray )
									for ( key in pathObj.val._dep ) {
										if ( key === "depObj" )
											continue;
										
										pathObj.val._dep[ key ]._unbind( updateProp, [ pathObj.path ] );
									}
							}
							
							this.splice( i, 1 );
							
							return pathObj;
						}
					}
				};
			
			operator( "=", "assignment", 10, null, function( v, val, interpreter ) {
				if ( !v || ( !v._isVar && v.id !== "(id)" && !v._propAccess ) )
					error( "Bad lvalue: no variable or object property." );
				
				assignTo = null;	//extern variable to keep track of assignments
				
				if ( v._propAccess ) {
					//used for setting object properties
					var ctxtProp = reactPaths.inCtxtProp( v );
					
					//test literal object property path
					var i = v.length || 1;
					while( --i ) {
						if ( v[ i ] && ( v[ i ]._isVar || v[ i ]._isValArray ) )
							break;
					}
					
					if ( i )	//complex path
						reactPaths.set( v, val, false, false );
					
					//test for reactive value
					if ( val && ( val._isVar || val._isValArray ) ) {
						if ( !i )
							reactPaths.set( v, val, false, false );
						
						val = val.valueOf();
					} else if ( !i ) {
						reactPaths.rmv( v );
					}
					
					return ctxtProp.ctxt[ ctxtProp.prop ] = val;
				}
				
				if ( ( v._isVar && v === val ) || ( v.id === "(id)" && val && v.value === val._key ) )
					return val;
				
				return interpreter.varTable.set( v._key || v.value, val );
			} );
			
			operator( "(op=)", "infixr", 10, function( expr ) {
					var op, token;
					
					op = operators[ "=" ];
					token = {
						nud 	: op.nud || nudUndef,
						led 	: op.led || ledUndef,
						ledEval : op.ledEval,
						lbp 	: op.lbp,
						value 	: "=",
						id 		: "=",
						arity 	: "operator"
					};
					expr = token.led( expr );
					expr.o.second = expr.o.first;
					
					op = operators[ this.value ];
					token = {
						nud 	: op.nud || nudUndef,
						led 	: op.led || ledUndef,
						ledEval : op.ledEval,
						lbp 	: op.lbp,
						value 	: this.value,
						id 		: this.value,
						arity 	: "operator"
					};
					expr = token.led( expr );
					
					op = operators[ "(" ];
					token = {
						nud 	: op.nud || nudUndef,
						led 	: op.led || ledUndef,
						nudEval : op.nudEval,
						lbp 	: op.lbp,
						value 	: "(",
						id 		: "(",
						arity 	: "operator"
					};
					expr = token.nud( expr );
					expr.end = null;
					expr.rbp = 10;
					
					return expr;
				},
				null
			);
			
			operator( "(op=)", "prefix", 10, function( expr ) {
					var op, token;
					
					if ( this.value === "(" ) {
						op = operators[ this.value ];
						token = {
							nud 	: op.nud || nudUndef,
							led 	: op.led || ledUndef,
							nudEval : op.nudEval,
							lbp 	: op.lbp,
							value 	: this.value,
							id 		: this.value,
							arity 	: "operator"
						};
						expr = token.nud( expr );
					}
					
					op = operators[ "=" ];
					token = {
						nud 	: op.nud || nudUndef,
						led 	: op.led || ledUndef,
						ledEval : op.ledEval,
						lbp 	: op.lbp,
						value 	: "=",
						id 		: "=",
						arity 	: "operator"
					};
					expr = token.led( expr );
					expr.o.second = expr.o.first;
					
					if ( this.value !== "(" ) {
						op = operators[ this.value ];
						token = {
							nud 	: op.nud || nudUndef,
							led 	: op.led || ledUndef,
							nudEval : op.nudEval,
							lbp 	: op.lbp,
							value 	: this.value,
							id 		: this.value,
							arity 	: "operator"
						};
						expr = token.nud( expr );
					}
					
					return expr;
				},
				null
			);
			
			operator( "~=", "assignment", 10, null, function( path, val ) {
				if ( !path || !path._propAccess )
					error( "Bad lvalue: no object property." );
				
				var ctxtProp = reactPaths.inCtxtProp(path );
				
				return revProps.set( ctxtProp.ctxt, ctxtProp.prop, reactPaths.set( path, val, false, true ) );
			} );
			
			operator( "?", "infix", 20, null, ( function() {
					var ret = {};
					
					//choice is always an array
					ret.lit = {};
					ret.lit.arr = function( cond, choice ) {
						return cond ? choice[1] : choice[2];
					};
					
					ret.ref = {};
					ret.ref.arr = function( cond, choice ) {
						return makeValArray( [ "?", cond, choice ], cond, choice._dep );
					};
					
					ret.arr = {};
					ret.arr.arr = function( cond, choice ) {
						return makeValArray( [ "?", cond, choice ], cond._dep, choice._dep );
					};
					
					return ret;
				}() )
			);
			
			operator( ":", "infixr", 21, null, ( function() {
					var ret = {};
					
					ret.lit = {};
					ret.lit.lit = function( onTrue, onFalse ) {
						return makeValArray( [ ":", onTrue, onFalse ] );
					};
					ret.lit.ref = function( onTrue, onFalse ) {
						return makeValArray( [ ":", onTrue, onFalse ], onFalse );
					};
					ret.lit.arr = function( onTrue, onFalse ) {
						return makeValArray( [ ":", onTrue, onFalse ], onFalse._dep );
					};
					
					ret.ref = {};
					ret.ref.lit = function( onTrue, onFalse ) {
						return makeValArray( [ ":", onTrue, onFalse ], onTrue );
					};
					ret.ref.ref = function( onTrue, onFalse ) {
						return makeValArray( [ ":", onTrue, onFalse ], onTrue, onFalse );
					};
					ret.ref.arr = function( onTrue, onFalse ) {
						return makeValArray( [ ":", onTrue, onFalse ], onTrue, onFalse._dep );
					};
					
					ret.arr = {};
					ret.arr.lit = function( onTrue, onFalse ) {
						return makeValArray( [ ":", onTrue, onFalse ], onTrue._dep );
					};
					ret.arr.ref = function( onTrue, onFalse ) {
						return makeValArray( [ ":", onTrue, onFalse ], onTrue._dep, onFalse );
					};
					ret.arr.arr = function( onTrue, onFalse ) {
						return makeValArray( [ ":", onTrue, onFalse ], onTrue._dep, onFalse._dep );
					};
					
					return ret;
				}() )
			);
			
			each(
				{
					"||" : {
						bp : 30,
						litlit : function( lit1, lit2 ) {
							return lit1 || lit2;
						},
						litref : function( left, right ) {
							if ( left )
								return left;
							
							return makeValArray( [ op, left, right ], right );
						},
						litarr : function( left, right ) {
							if ( left )
								return left;
							
							return makeValArray( [ op, left, right ], right );
						}
					},
					"&&" : {
						bp : 30,
						litlit : function( lit1, lit2 ) {
							return lit1 && lit2;
						}
					}
				},
				function( op, opProps ) {
					operator( op, "infixr", opProps.bp, null, ( function() {
						var ret = {},
							
							compare = function( left, right ) {
								return makeValArray( [ op, left, right ], left, right );
							},
							
							compareArr = function( left, right ) {
								if ( left.constructor === Array && left[ 0 ] === op ) {
									if ( right.constructor === Array && right[ 0 ] === op ) {
										//reuse right array
										right[ 0 ] = 0;
										right.unshift( left.length );
										
										//-> left.splice( left.length, 0, right[ 1 ], right[ 2 ], ... )
										Array.prototype.splice.apply( left, right );
										left.addDep( right._dep );
									
									} else {
										left.push( right );
										left.addDep( right );
									}
									
									return left;
								
								} else if ( right.constructor === Array && right[ 0 ] === op ) {
									right.splice( 1, 0, left );
									right.addDep( left );
									
									return right;
								} else {
									return makeValArray(
										[ op, left, right ],
										left._isValArray ? left._dep : left,
										right._isValArray ? right._dep : right._dep
									);
								}
							};
						
						each( [ "lit", "ref", "arr" ], function( idxL, typeL ) {
							ret[ typeL ] = {};
							each( [ "lit", "ref", "arr" ], function( idxR, typeR ) {
								if ( opProps[ typeL + typeR ] )
									ret[ typeL ][ typeR ] = opProps[ typeL + typeR ];
								
								else if ( typeL !== "arr" && typeR !== "arr" )
									ret[ typeL ][ typeR ] = compare;
								
								else
									ret[ typeL ][ typeR ] = compareArr;
							} );
						} );
						
						return ret;
					}() ) );
				}
			);
			
			each(
				{
					"==" : {
						bp : 40,
						litlit : function( lit1, lit2 ) {
							return lit1 == lit2;
						}
					},
					"===" : {
						bp : 40,
						litlit : function( lit1, lit2 ) {
							return lit1 === lit2;
						}
					},
					"<" : {
						bp : 50,
						litlit : function( lit1, lit2 ) {
							return lit1 < lit2;
						}
					},
					">" : {
						bp : 50,
						litlit : function( lit1, lit2 ) {
							return lit1 > lit2;
						}
					}
				},
				function( op, opProps ) {
					operator( op, "infixr", opProps.bp, null, ( function() {
						var ret = {},
							
							refref = function( left, right ) {
								return makeValArray( [ op, left, right ], left, right );
							},
							refarr = function( left, right ) {
								return makeValArray( [ op, left, right ], left, right._dep );
							},
							arrref = function( left, right ) {
								return makeValArray( [ op, left, right ], left._dep, right );
							},
							arrarr = function( left, right ) {
								return makeValArray( [ op, left, right ], left._dep, right._dep );
							},
						
							compare = {
								litref : refref,
								litarr : refarr,
								reflit : refref,
								refref : refref,
								refarr : refarr,
								arrlit : arrref,
								arrref : arrref,
								arrarr : arrarr
							};
						
						each( [ "lit", "ref", "arr" ], function( idxL, typeL ) {
							ret[ typeL ] = {};
							each( [ "lit", "ref", "arr" ], function( idxR, typeR ) {
								ret[ typeL ][ typeR ] = opProps[ typeL + typeR ] || compare[ typeL + typeR ];
							} );
						} );
						
						return ret;
					}() ) );
				}
			);
			
			operator( "!=", "infixr", 40, null, function( left, right ) {
				return operators[ "!" ].nudEval.call( this, operators[ "==" ].ledEval.call( this, left, right ) );
			}, true );
			
			operator( "!==", "infixr", 40, null, function( left, right ) {
				return operators[ "!" ].nudEval.call( this, operators[ "===" ].ledEval.call( this, left, right ) );
			}, true );
			
			operator( "<=", "infixr", 50, null, function( left, right ) {
				return operators[ "||" ].ledEval.call( this, operators[ "<" ].ledEval.call( this, left, right ), operators[ "==" ].ledEval.call( this, left, right ) );
			}, true );
			
			operator( ">=", "infixr", 50, null, function( left, right ) {
				return operators[ "||" ].ledEval.call( this, operators[ ">" ].ledEval.call( this, left, right ), operators[ "==" ].ledEval.call( this, left, right ) );
			}, true );
			
			each(
				{
					"in" : function( left, right ) {
						return left in right;
					},
					"instanceof" : function( left, right ) {
						return left instanceof right;
					}
				},
				function( op, litlit ) {
					operator( op, "infixr", 50, null, ( function() {
						var ret = {},
							
							func = function( left, right ) {
								return makeValArray(
									[ op, left, right ],
									left._isValArray ? left._dep : left,
									right._isValArray ? right._dep : right
								);
							};
						
						each( [ "lit", "ref", "arr" ], function( idxL, typeL ) {
							ret[ typeL ] = {};
							each( [ "lit", "ref", "arr" ], function( idxR, typeR ) {
								ret[ typeL ][ typeR ] = func;
							} );
						} );
						
						ret.lit.lit = litlit;
						
						return ret;
					}() ) );
				}
			);
			
			operator( "+", "infix", 60, null, ( function() {
				var ret = {},
					
					factorOut = function( fst, snd ) {
						var shared = 1,
							base1, base2,
							exp1, exp2;
						
						if ( fst.constructor === Array && fst[ 0 ] === "^" && fst.length > 2 ) {
							base1 = fst[ 1 ];
							exp1  = fst.length > 3 ? ( fst.splice( 1, 1 ), fst ) : fst[ 2 ];
						} else {
							base1 = fst;
							exp1  = 1;
						}
						
						if ( snd.constructor === Array && snd[ 0 ] === "^" && snd.length > 2 ) {
							base2 = snd[ 1 ];
							exp2  = snd.length > 3 ? ( snd.splice( 1, 1 ), snd ) : snd[ 2 ];
						} else {
							base2 = snd;
							exp2  = 1;
						}
						
						if ( base1 === base2 && typeof base1 !== "number" && typeof base2 !== "number" ) {
							if ( exp1 === exp2 ) {
								shared = fst;
								fst = snd = 1;
							} else if ( typeof exp1 === "number" && typeof exp2 === "number" &&
										( ( exp1 < 0 && exp2 < 0 ) || ( exp1 > 0 && exp2 > 0 ) ) ) {
								var tmp = Math.abs( exp1 ) < Math.abs( exp2 ) ? exp1 : exp2;
								shared = tmp === 1 ? base1 : makeValArray( [ "^", base1, tmp ], base1._isValArray ? base1._dep : base1 );
								tmp = operators[ "^" ].ledEval.call( this, shared, -1 );
								fst = operators[ "*" ].ledEval.call( this, fst, tmp );
								snd = operators[ "*" ].ledEval.call( this, snd, tmp );
							}
						} // else no shared factor, return input values
						
						return {
							shared : shared,
							fst : fst,
							snd : snd
						};
					},
					
					factorOutProducts = function( fst, snd ) {
						var res,
							shared = {
								front : 1,
								back  : 1
							},
							sel = {
								fst : fst,
								snd : snd
							},
							idx = {
								fst : typeof sel.fst[ 1 ] === "number" ? 2 : 1,
								snd : typeof sel.snd[ 1 ] === "number" ? 2 : 1
							}
						
						//gather shared factors from front and back
						for ( var dir in shared ) {
							while ( sel.fst !== 1 && sel.snd !== 1 ) {
								res = factorOut.call( this,
									( sel.fst && sel.fst[ 0 ] == "*" && sel.fst.length > 2 && 
									  sel.fst[ dir == "front" ? idx.fst : sel.fst.length-1 ]
									) || sel.fst,
									( sel.snd && sel.snd[ 0 ] == "*" && sel.snd.length > 2 && 
									  sel.snd[ dir == "front"  ? idx.snd : sel.snd.length-1 ]
									) || sel.snd
								);
								
								if ( res.shared === 1 )
									break;
								
								//add shared factor to output
								if ( shared[ dir ] === 1 ) {
									shared[ dir ] = res.shared;
								
								} else {
									if ( !shared[ dir ]._isValArray )
										shared[ dir ] = makeValArray( [ "*", shared[ dir ] ], shared[ dir ] );
									
									shared[ dir ].push( res.shared );
									shared[ dir ].addDep( res.shared._isValArray ? res.shared._dep : res.shared );
								}
								
								//reorganize fst/snd
								for ( var key in sel ) {
									if ( sel[ key ] && sel[ key ][ 0 ] == "*" && sel[ key ].length > 2 ) {
										if ( res[ key ] !== 1 ) {
											sel[ key ][ dir == "front" ? idx[ key ] : sel[ key ].length-1 ] = res[ key ];
										
										} else if ( sel[ key ].length > 3 ) {
											if ( dir == "front" )
												sel[ key ].splice( idx[ key ], 1 );
											else
												sel[ key ].pop();
											
											sel[ key ]._checkDep( sel[ key ] );
										
										} else { // sel[ key ].length === 3
											sel[ key ] = sel[ key ][ dir == "front" ? ( idx[ key ] === 2 ? 1 : 2 ) : 1 ];
										}
									
									} else {
										sel[ key ] = res[ key ];
									}
								}
							}
						}
						
						return {
							front : shared.front,
							back  : shared.back,
							fst   : sel.fst,
							snd   : sel.snd
						};
					},
				
					addSums = function( fst, snd ) {
						var res,
							fst_sel, snd_sel,
							fst_num, snd_num,
							fst_idx, snd_idx,
							fst_len, snd_len,
							fst_isOpArray, snd_isOpArray;
						
						snd_isOpArray = snd && snd[ 0 ] === "+" && snd.length > 2;
						snd_len = ( snd_isOpArray && snd.length-1 ) || 2;
						snd_idx = 0;
						
						fst_isOpArray = fst && fst[ 0 ] === "+" && fst.length > 2;
						fst_len = ( fst_isOpArray && fst.length ) || 2;
						
						SNDLOOP : while ( snd_idx < snd_len && snd_sel !== snd ) {
							snd_sel = snd_isOpArray ? snd[ ++snd_idx ] : snd;
							snd_num = typeof snd_sel === "number";
							
							fst_idx = fst_len;
							while ( fst_idx > 1 && fst_sel !== fst ) {
								fst_sel = fst_isOpArray ? fst[ --fst_idx ] : fst;
								fst_num = typeof fst_sel === "number";
								
								if ( snd_num ) {
									if ( !fst_num )
										continue;
									
									fst_sel += snd_sel;
									
									if ( fst_isOpArray ) {
										if ( fst_sel !== 0 ) {
											fst[ fst_idx ] = fst_sel;
										
										} else {
											if ( fst.length > 3 ) {
												fst.splice( fst_idx, 1 );
											} else {
												fst = fst_idx === 2 ? fst[ 1 ] : fst[ 2 ];
												fst_isOpArray = false;
											}
										}
									
									} else {
										fst = fst_sel;
									}
									
									continue SNDLOOP;
								
								} else {
									if ( fst_num )
										continue;
									
									res = factorOutProducts.call( this, fst_sel, snd_sel );
									
									if ( res.front !== 1 || res.back !== 1 ) {
										var sum = operators[ "+" ].ledEval.call( this, res.fst, res.snd );
										
										if ( sum === 0 ) {
											if ( fst_isOpArray ) {
												if ( fst.length > 3 ) {
													fst.splice( fst_idx, 1 );
													fst._checkDep( fst_sel );
												} else {
													fst = fst_idx === 2 ? fst[ 1 ] : fst[ 2 ];
													fst_isOpArray = false;
												}
											
											} else {
												fst = 0;
											}
											
											continue SNDLOOP;
										
										} else if ( res.front !== 1 && res.back !== 1 ) {
											//shared front and back
											//reuse existing arrays
											if ( res.front._isValArray && res.front[ 0 ] === "*" ) {
												fst_sel = res.front;
												
												if ( sum._isValArray && sum[ 0 ] === "*" ) {
													sum.shift();
													fst_sel.push.apply( sum );
													fst_sel.addDep( sum._dep )
												} else {
													if ( sum._isValArray )
														fst_sel.push( sum );
													else
														fst_sel.splice( 1, 0, sum );
													
													fst_sel.addDep( sum )
												}
												
												if ( res.back._isValArray && res.back[ 0 ] === "*" ) {
													res.back.shift();
													fst_sel.push.apply( res.back );
													fst_sel.addDep( res.back._dep )
												} else {
													fst_sel.push( res.back );
													fst_sel.addDep( res.back )
												}
											
											} else if ( sum._isValArray && sum[ 0 ] === "*" ) {
												fst_sel = sum;
												
												fst_sel.splice( 1, 0, res.front );
												fst_sel.addDep( res.front )
												
												if ( res.back._isValArray && res.back[ 0 ] === "*" ) {
													res.back.shift();
													fst_sel.push.apply( res.back );
													fst_sel.addDep( res.back._dep )
												} else {
													fst_sel.push( res.back );
													fst_sel.addDep( res.back )
												}
											
											} else if ( res.back._isValArray && res.back[ 0 ] === "*" ) {
												fst_sel = res.back;
												
												fst_sel.splice( 1, 0, res.front, sum );
												fst_sel.addDep( res.front, sum )
											
											} else {
												fst_sel = makeValArray(
													[ "*", sum._isValArray ? res.front : sum, sum._isValArray ? sum : res.front, res.back ],
													res.front._isValArray ? res.front._dep : res.front,
													sum._isValArray 	  ? sum._dep : sum,
													res.back._isValArray  ? res.back._dep : res.back
												);
											}
										
										} else if ( res.front !== 1 ) {
											//shared front only
											//reuse existing arrays
											if ( res.front._isValArray && res.front[ 0 ] === "*" ) {
												fst_sel = res.front;
												
												if ( sum._isValArray && sum[ 0 ] === "*" ) {
													sum.shift();
													fst_sel.push.apply( sum );
													fst_sel.addDep( sum._dep )
												} else {
													if ( sum._isValArray )
														fst_sel.push( sum );
													else
														fst_sel.splice( 1, 0, sum );
													
													fst_sel.addDep( sum )
												}
											
											} else if ( sum._isValArray && sum[ 0 ] === "*" ) {
												fst_sel = sum;
												
												fst_sel.splice( 1, 0, res.front );
												fst_sel.addDep( res.front )
											
											} else {
												fst_sel = makeValArray(
													[ "*", sum._isValArray ? res.front : sum, sum._isValArray ? sum : res.front ],
													res.front._isValArray ? res.front._dep : res.front,
													sum._isValArray 	  ? sum._dep : sum
												);
											}
										
										} else if ( res.back !== 1 ) {
											//shared back only
											//reuse existing arrays
											if ( sum._isValArray && sum[ 0 ] === "*" ) {
												fst_sel = sum;
												
												if ( res.back._isValArray && res.back[ 0 ] === "*" ) {
													res.back.shift();
													fst_sel.push.apply( res.back );
													fst_sel.addDep( res.back._dep )
												} else {
													fst_sel.push( res.back );
													fst_sel.addDep( res.back )
												}
											
											} else if ( res.back._isValArray && res.back[ 0 ] === "*" ) {
												fst_sel = res.back;
												
												fst_sel.splice( 1, 0, sum );
												fst_sel.addDep( sum )
											
											} else {
												fst_sel = makeValArray(
													[ "*", sum, res.back ],
													sum._isValArray 	 ? sum._dep : sum,
													res.back._isValArray ? res.back._dep : res.back
												);
											}
										}
										
										if ( fst_isOpArray )
											fst[ fst_idx ] = fst_sel;
										else
											fst = fst_sel;
										
										continue SNDLOOP;
									}
								}
							}
							
							//fst does not share summand parts with snd_sel, so just append snd_sel
							if ( fst_isOpArray ) {
								fst.push( snd_sel );
								fst.addDep( snd_sel._isValArray ? snd_sel._dep : snd_sel );
								fst_len += 1;
							
							} else if ( fst !== 0 ){
								fst = makeValArray(
									[ "+", fst, snd_sel ],
									snd_sel._isValArray ? snd_sel._dep : snd_sel,
									fst._isValArray     ? fst._dep     : fst
								);
								fst_isOpArray = true;
								fst_len = 3;
							
							} else {
								fst = snd_sel;
							}
						}
						
						return fst;
					};
				
				ret.lit = {
					lit : function( lit1, lit2 ) {
						return lit1 + lit2;
					},
					ref : function( lit, ref ) {
						return ret.ref.lit.call( this, ref, lit, true );
					},
					arr : function( lit, arr ) {
						return ret.arr.lit.call( this, arr, lit, true );
					}
				};
				
				ret.ref = {
					lit : function( ref, lit, swap ) {
						if ( typeof swap !== "boolean" )
							swap = undefined;
						
						if ( lit === 0 )
							return ref;
						
						if ( lit === Infinity || lit === -Infinity )
							return lit;
						
						return makeValArray( swap ? [ "+", lit, ref ] : [ "+", ref, lit ], ref );
					},
					ref : function( ref1, ref2 ) {
						if ( ref1 === ref2 )
							return makeValArray( [ "*", 2, ref1 ], ref1 );
						
						return makeValArray( [ "+", ref1, ref2 ], ref1, ref2 );
					},
					arr : function( ref, arr, swap ) {
						if ( typeof swap !== "boolean" )
							swap = undefined;
						
						return addSums.call( this, swap ? arr : ref, swap ? ref : arr );
					}
				};
				
				ret.arr = {
					lit : function( arr, lit, swap ) {
						if ( typeof swap !== "boolean" )
							swap = undefined;
						
						if ( lit === 0 )
							return arr;
						
						if ( lit === Infinity || lit === -Infinity )
							return lit;
						
						return addSums.call( this, swap ? lit : arr, swap ? arr : lit );

					},
					ref : function( arr, ref ) {
						return ret.ref.arr.call( this, ref, arr, true );
					},
					arr : function( arr1, arr2 ) {
						return addSums.call( this, arr1, arr2 );
					}
				};
				
				return ret;
			}() ) );
			
			operator( "-", "infix", 60, null, function( left, right ) {		// left + (-1)*right
				return operators[ "+" ].ledEval.call( this, left, operators[ "*" ].ledEval.call( this, -1, right ) );
			}, true );
			
			operator( "*", "infix", 70, null, ( function() {
				var ret = {},
					
					factorOutPowers = function( fst, snd ) {
						var base = false,
							exp = false,
							base1, base2,
							exp1, exp2;
						
						if ( fst && fst._isValArray && fst[ 0 ] === "^" && fst.length > 2 ) {
							base1 = fst[ 1 ];
							exp1  = fst.length > 3 ? ( fst.splice( 1, 1 ), fst ) : fst[ 2 ];
						} else {
							base1 = fst;
							exp1  = 1;
						}
						
						if ( snd && snd._isValArray && snd[ 0 ] === "^" && snd.length > 2 ) {
							base2 = snd[ 1 ];
							exp2  = snd.length > 3 ? ( snd.splice( 1, 1 ), snd ) : snd[ 2 ];
						} else {
							base2 = snd;
							exp2  = 1;
						}
						
						if ( base1 === base2 ) {
							base = base1;
							exp = operators[ "+" ].ledEval.call( this, exp1, exp2 );
						} else if ( exp1 !== 1 && exp1 === exp2 ) {
							base = operators[ "*" ].ledEval.call( this, base1, base2 );
							exp = exp1;
						}
						
						return {
							base : base,
							exp : exp
						};
					},
					
					mulPows = function( fst, snd ) {
						var res,
							fst_sel, snd_sel,
							fst_num, snd_num,
							fst_idx, snd_idx,
							fst_len, snd_len,
							fst_isOpArray, snd_isOpArray;
						
						snd_isOpArray = snd && snd[ 0 ] === "*" && snd.length > 2;
						snd_len = ( snd_isOpArray && snd.length-1 ) || 2;
						snd_idx = 0;
						
						fst_isOpArray = fst && fst[ 0 ] === "*" && fst.length > 2;
						fst_len = ( fst_isOpArray && fst.length ) || 2;
						
						while ( snd_idx < snd_len && snd_sel !== snd ) {
							snd_sel = snd_isOpArray ? snd[ ++snd_idx ] : snd;
							snd_num = typeof snd_sel === "number";
							
							if ( snd_num ) {
								//checking first entry of fst for number is sufficient
								fst_idx = 1;
								fst_sel = fst_isOpArray ? fst[ fst_idx ] : fst;
								
								if ( typeof fst_sel === "number" ) {
									fst_sel *= snd_sel;
									
									if ( fst_isOpArray ) {
										if ( fst_sel !== 1 ) {
											fst[ fst_idx ] = fst_sel;
										
										} else {
											if ( fst.length > 3 ) {
												fst.splice( fst_idx, 1 );
											} else {
												fst = fst_idx === 2 ? fst[ 1 ] : fst[ 2 ];
												fst_isOpArray = false;
											}
										}
									
									} else {
										fst = fst_sel;
									}
								
								} else {
									if ( fst_isOpArray ) {
										fst.splice( 1, 0, snd_sel );
										fst_len += 1;
									
									} else {
										fst = makeValArray(
											[ "*", snd_sel, fst ],
											fst._isValArray     ? fst._dep     : fst
										);
										fst_isOpArray = true;
										fst_len = 3;
									}
								}
								
							} else {
								//comparing factors with last entry of fst is sufficient
								fst_idx = fst_len;
								fst_sel = fst_isOpArray ? fst[ --fst_idx ] : fst;
								
								res = factorOutPowers.call( this, fst_sel, snd_sel );
								
								if ( res.base ) {
									//part of product shared
									var pow = operators[ "^" ].ledEval.call( this, res.base, res.exp );
									
									if ( pow === 1 ) {
										if ( fst_isOpArray ) {
											if ( fst.length > 3 ) {
												fst.splice( fst_idx, 1 );
												fst._checkDep( fst_sel );
											} else {
												fst = fst_idx === 2 ? fst[ 1 ] : fst[ 2 ];
												fst_isOpArray = false;
											}
										
										} else {
											fst = 1;
										}
									
									} else {
										if ( fst_isOpArray )
											fst[ fst_idx ] = pow;
										else
											fst = pow;
									}
								
								} else {
									//fst does not share summand parts with snd_sel, so just append snd_sel
									if ( fst_isOpArray ) {
										fst.splice( fst_len, 0, snd_sel );
										fst.addDep( snd_sel._isValArray ? snd_sel._dep : snd_sel );
										fst_len += 1;
									
									} else if ( fst !== 1 ) {
										fst = makeValArray(
											[ "*", fst, snd_sel ],
											fst._isValArray     ? fst._dep     : fst,
											snd_sel._isValArray ? snd_sel._dep : snd_sel
										);
										fst_isOpArray = true;
										fst_len = 3;
									
									} else {
										fst = snd_sel;
									}
								}
							}
						}
						
						return fst;
					};
					
				ret.lit = {
					lit : function( lit1, lit2 ) {
						return lit1 * lit2;
					},
					ref : function( lit, ref ) {
						return ret.ref.lit.call( this, ref, lit );
					},
					arr : function( lit, arr ) {
						return ret.arr.lit.call( this, arr, lit );
					}
				};
				
				ret.ref = {
					lit : function( ref, lit ) {
						if ( lit === 0 || lit === Infinity || lit === -Infinity )
							return lit;
						
						if ( lit === 1 )
							return ref;
						
						return makeValArray( [ "*", lit, ref ], ref );
					},
					ref : function( ref1, ref2 ) {
						if ( ref1 === ref2 )
							return makeValArray( [ "^", ref1, 2 ], ref1 );
						
						return makeValArray( [ "*", ref1, ref2 ], ref1, ref2 );
					},
					arr : function( ref, arr, swap ) {
						if ( typeof swap !== "boolean" )
							swap = undefined;
						
						return mulPows.call( this, swap ? arr : ref, swap ? ref : arr );
					}
				};
				
				ret.arr = {
					lit : function( arr, lit, swap ) {
						if ( typeof swap !== "boolean" )
							swap = undefined;
						
						if ( lit === 0 )
							return 0;
						
						if ( lit === 1 )
							return arr;
						
						if ( lit === Infinity || lit === -Infinity )
							return lit;
						
						return mulPows.call( this, swap ? lit : arr, swap ? arr : lit );

					},
					ref : function( arr, ref ) {
						return ret.ref.arr.call( this, ref, arr, true );
					},
					arr : function( arr1, arr2 ) {
						return mulPows.call( this, arr1, arr2 );
					}
				};
				
				return ret;
			}() ) );
			
			operator( "/", "infix", 70, null, function( left, right ) {		// left * right^(-1)
				return operators[ "*" ].ledEval.call( this, left, operators[ "^" ].ledEval.call( this, right, -1 ) );
			}, true );
			
			operator( "%", "infix", 70, null, ( function() {
				var ret = {},
					
					mod = function( left, right ) {
						if ( left === 0 )
							return 0;
						
						if ( left === right )
							return 0;
						
						if ( right === 0 )
							return NaN;
						
						if ( right === 1 )
							return 0;
						
						if ( left && left._isValArray && left[ 0 ] === "%" ) {
							if ( right && right._isValArray && right[ 0 ] === "%" ) {
								right.splice( 0, 1 );
								left.push.apply( left, right );
								left.addDep( right._dep );
								
							} else {
								left.push( right );
								left.addDep( right );
							}
							
							return left;
						}
						
						if ( right && right._isValArray && right[ 0 ] === "%" ) {
							right.splice( 1, 0, left );
							right.addDep( left );
							
							return right;
						}
						
						return makeValArray( [ "%", left, right ],
							left  && left._isValArray  ? left._dep  : left,
							right && right._isValArray ? right._dep : right
						);
					};
				
				each( [ "lit", "ref", "arr" ], function( idxL, typeL ) {
					ret[ typeL ] = {};
					each( [ "lit", "ref", "arr" ], function( idxR, typeR ) {
						ret[ typeL ][ typeR ] = mod;
					} );
				} );
				
				ret.lit.lit = function( lit1, lit2 ) {
					return lit1 % lit2;
				};
				
				return ret;
			}() ) );
			
			operator( "^", "infixr", 80, null, ( function() {
				var ret = {},
					
					pow = function( base, exp ) {
						if ( exp === 0 )
							return 1;		//defines 0^0 := 1
						
						if ( exp === 1 )
							return base;
						
						if ( base === 0 )
							return 0;
							
						if ( base === 1 )
							return 1;
						
						if ( exp && exp._isValArray && exp[ 0 ] === "^" ) {
							exp.splice( 1, 0, base );
							exp.addDep( base._isValArray ? base._dep : base );
							
							return exp;
						
						} else if ( typeof exp === "number" && base && base._isValArray &&
									base[ 0 ] === "^" && base.length === 3 &&
									typeof base[ 2 ] === "number" ) {
							base = makeValArray( base.slice(), base._dep );
							base[ 2 ] *= exp;
							
							return base;
						}
						
						return makeValArray(
							[ "^", base, exp ],
							base._isValArray ? base._dep : base,
							exp._isValArray  ? exp._dep  : exp
						);
					};
				
				each( [ "lit", "ref", "arr" ], function( idxB, typeB ) {
					ret[ typeB ] = {};
					each( [ "lit", "ref", "arr" ], function( idxE, typeE ) {
						ret[ typeB ][ typeE ] = pow;
					} );
				} );
				
				ret.lit.lit = function( base, exp ) {
					return exp === -1 ? 1/base : Math.pow( base, exp );
				};
				
				return ret;
			}() ) );
			
			operator( "!", "prefix", 90, null, {
				lit : function( lit ) {
					return !lit;
				},
				
				ref : function( ref ) {
					return makeValArray( [ "!", ref ], ref );
				},
				
				arr : function( arr ) {
					if ( arr[ 0 ] === "!" && arr[ 1 ].constructor === Array && arr[ 1 ][ 0 ] === "!" )
						return arr[ 1 ];
					else
						return makeValArray( [ "!", arr ], arr._dep );
				}
			} );
			
			operator( "+", "prefix", 90, null, {
				lit : function( lit ) {
					return +lit;
				},
				
				ref : function( ref ) {
					return makeValArray( [ "+", ref ], ref );
				},
				
				arr : function( arr ) {
					if ( arr && arr._isValArray && arr[ 0 ] === "+" && arr.length === 2 )
						return arr;
					
					return makeValArray( [ "+", arr ], arr._dep );
				}
			} );
			
			operator( "-", "prefix", 90, null, function( operand ) {	//-1 * operand
				return operators[ "*" ].ledEval.call( this, -1, operand );
			}, true );
			
			operator( "typeof", "prefix", 90, null, {
				lit : function( lit ) {
					return typeof lit;
				},
				
				ref : function( ref ) {
					return makeValArray( [ "typeof", ref ], ref );
				},
				
				arr : function( arr ) {
					if ( arr && arr._isValArray && arr[ 0 ] === "typeof" )
						return "string";
					
					return makeValArray( [ "typeof", arr ], arr._dep );
				}
			} );
			
			operator( "delete", "delete", 90, null, function( v, interpreter ) {
				if ( !v || ( !v._isVar && !v._isValArray && v.id !== "(id)" && !v._propAccess ) )
					error( "Bad lvalue: no variable or object property." );
				
				if ( v._propAccess ) {
					//used for deleting object properties
					var ctxtProp = reactPaths.inCtxtProp( v );
					
					//check for literal object property path
					var i = v.length || 1;
					while( --i ) {
						if ( v[ i ] && ( v[ i ]._isVar || v[ i ]._isValArray ) )
							break;
					}
					
					if ( i )	//complex path
						reactPaths.set( v, undefined, true, false );
					
					return delete ctxtProp.ctxt[ ctxtProp.prop ];
				}
				
				if ( v._isValArray )
					return v[ "delete" ]();
				
				return interpreter.varTable[ "delete" ]( v._key || v.value );
			} );
			
			operator( "~delete", "delete", 90, null, function( path ) {
				if ( !path || !path._propAccess )
					error( "Bad lvalue: no object property." );
				
				var ctxtProp = reactPaths.inCtxtProp( path );
				
				return revProps.set( ctxtProp.ctxt, ctxtProp.prop, reactPaths.set( path, undefined, true, true ) );
			} );
			
			operator( "~", "prefix", 90, null, 	function( path ) {
				if ( !path || !path._propAccess )
					error( "Bad lvalue: no reactive object property." );
				
				var ctxtProp = reactPaths.inCtxtProp( path );

				//find path
				var pathObj = reactPaths.rmv( path );
				
				if ( !pathObj ) //path was not registered
					return false;
				
				return revProps.rev( ctxtProp.ctxt, ctxtProp.prop, pathObj );
			} );
			
			operator( "#", "prefix", 90, null, {
				lit : function( lit ) {
					return lit;
				},
				
				ref : function( ref ) {
					return ref.valueOf( interpret.ctxt, interpret.data );
				},
				
				arr : function( arr ) {
					return arr.valueOf( interpret.ctxt, interpret.data );
				}
			} );
			
			operator( "contextVariable", "prefix", 90, null, function( f ) {
				if ( typeof f !== "function" )
					error( "'contextVariable' has to be followed by a function!" );
				
				if ( this.prevToken !== "=" )
					error( "'contextVariable' has to be preceded by an assignment!" );
				
				var ret = Object.create( ctxtVarCarrier );
				ret.func = f;
				
				return ret;
			} );
			
			var arrFunc = function( func, args ) {
					if ( func.inverse ) {
						if ( args && args._isValArray && args[ 0 ] === "(" && args[ 1 ] === func.inverse )
							return args[ 2 ];
						
					} else if ( func.projection ) {
						if ( args && args._isValArray && args[ 0 ] === "(" && args[ 1 ] === func )
							return args;
					}
					
					return makeValArray( [ "(", func, args ], args._isValArray ? args._dep : args );
				};
			
			operator( "(", "call", 100, null, function( func, args ) {
				var funcLit,
					ctxtLit = window,
					argLits = [],
					varInArgs = false,
					argsArr,
					tmp,
					rea;
				
				//create arguments array to bind
				if ( args && args._isValArray && args[ 0 ] === "," ) {
					argsArr = args.slice( 1 );
					argsArr._dep = args._dep;
					
				} else {
					argsArr = [ args ];
					
					if ( args )
						argsArr._dep = args._isValArray ? args._dep : args;
				}
				
				//handle function part
				if ( !func ) {
					funcLit = func;
				
				} else if ( func._isValArray ) {
					if ( !noPartOf )
						for ( var key in func._dep ) {
							if ( key === "depObj" )
								continue;
							
							func._dep[ key ]._bind( func, argsArr, true );
						}
					
					if ( func._dep )
						rea = makeValArray( [ "(", func ], func._dep );
					
					funcLit = func.valueOf();
					
					if ( func[ 0 ] === "." && func.length > 3 ) {
						tmp = func[ func.length-1 ].pop();
						ctxtLit = func.valueOf();
						func.push( tmp );
					
					} else {
						ctxtLit = func[ 1 ].valueOf();
					}
				
				} else if ( func._isVar ) {
					if ( !func._locked ) {
						if ( !noPartOf )
							func._bind( func, argsArr, true );
						rea = makeValArray( [ "(", func ], func );
					}
					funcLit = func._value;
				
				} else {
					funcLit = func;
				}
				
				//handle arguments part
				for ( var i = 0, l = argsArr.length; i<l; i++ ) {
					if ( !argsArr[ i ] ) {
						argLits.push( argsArr[ i ] );
					
					} else if ( argsArr[ i ]._isValArray ) {
						for ( var key in argsArr[ i ]._dep ) {
							if ( key === "depObj" )
								continue;
							
							if ( !noPartOf )
								argsArr[ i ]._dep[ key ]._bind( func, argsArr, true );
							
							varInArgs = true;
						}
						
						argLits.push( argsArr[ i ].valueOf() );
					
					} else if ( argsArr[ i ]._isVar ) {
						if ( !argsArr[ i ]._locked ) {
							if ( !noPartOf )
								argsArr[ i ]._bind( func, argsArr, true );
							
							varInArgs = true;
						}
						
						argLits.push( argsArr[ i ].valueOf() );
					
					} else {
						argLits.push( argsArr[ i ] );
					}
				}
				
				if ( rea )
					rea.addDep( args && args._isValArray ? args._dep : args ).push( args );
				else if ( varInArgs )
					rea = arrFunc( funcLit, args );
				
				try {
					tmp = funcLit.apply( ctxtLit, argLits );
				} catch ( e ) {
					error( "A reactive function call causes problems: " + e.message );
				}
				
				return rea || tmp;
			} );
			
			operator( ":(", "call", 100, null, function( func, args ) {
				var varInArgs = false,
					argsArr,
					tmp,
					rea;
				
				//create arguments array to bind
				if ( args && args._isValArray && args[ 0 ] === "," ) {
					argsArr = args.slice( 1 );
					argsArr._dep = args._dep;
					
				} else {
					argsArr = [ args ];
					
					if ( args )
						argsArr._dep = args._isValArray ? args._dep : args;
				}
				
				//handle function part
				if ( func ) {
					if ( func._isValArray ) {
						if ( !noPartOf )
							for ( var key in func._dep ) {
								if ( key === "depObj" )
									continue;
								
								func._dep[ key ]._bind( func, argsArr, true );
							}
						
						rea = makeValArray( [ "(", func ], func._dep );
					
					} else if ( func._isVar ) {
						if ( !func._locked ) {
							if ( !noPartOf )
								func._bind( func, argsArr, true );
							
							rea = makeValArray( [ "(", func ], func );
						}
					}
				}
				
				//handle arguments part
				for ( var i = 0, l = argsArr.length; i<l; i++ ) {
					if ( argsArr[ i ] ) {
						if ( argsArr[ i ]._isValArray ) {
							for ( var key in argsArr[ i ]._dep ) {
								if ( key === "depObj" )
									continue;
								
								if ( !noPartOf )
									argsArr[ i ]._dep[ key ]._bind( func, argsArr, true );
								
								varInArgs = true;
							}
						
						} else if ( argsArr[ i ]._isVar ) {
							if ( !argsArr[ i ]._locked ) {
								if ( !noPartOf )
									argsArr[ i ]._bind( func, argsArr, true );
								
								varInArgs = true;
							}
						}
					}
				}
				
				if ( rea )
					rea.addDep( args._isValArray ? args._dep : args ).push( args );
				else if ( varInArgs )
					rea = arrFunc( func, args );
				
				return rea;
			} );
			
			operator( "~(", "call", 100, null, function( func, args ) {
				var key, argsArr;
				
				//create arguments array
				if ( args && args._isValArray && args[ 0 ] === "," ) {
					argsArr = args.slice( 1 );
					argsArr._dep = args._dep;
					
				} else {
					argsArr = [ args ];
					
					if ( args._isValArray )
						argsArr._dep = args._dep;
					else if ( args._isVar )	
						argsArr._dep = args;
				}
				
				//handle function part
				if ( func ) {
					if ( func._isValArray ) {
						for ( key in func._dep ) {
							if ( key === "depObj" )
								continue;
							
							if ( !func._dep[ key ]._unbind( func, argsArr ) )
								return false
						}
					
					} else if ( func._isVar && !func._locked ) {
						if ( !func._unbind( func, argsArr ) )
							return false;
					}
				}
				
				//handle arguments part
				if ( argsArr._dep ) {
					if ( argsArr._dep._isVar ) {
						if ( !argsArr._dep._unbind( func, argsArr ) )
							return false;
					
					} else {
						for ( key in argsArr._dep ) {
							if ( key === "depObj" )
								continue;
								
							if ( !argsArr._dep[ key ]._unbind( func, argsArr ) )
								return false;
						}
					}
				}
				
				return true;
			} );
			
			var objPropEval = {
				lit : {
					lit : function( obj, prop ) {
						if ( prop.id === "(id)" )
							prop = prop.value;
						
						if ( this.nextToken === "=" || this.nextToken === "~=" ||
							 this.prevToken === "delete" || this.prevToken === "~delete" || this.prevToken === "~" ||
							 this.nextToken === "(" || this.nextToken === ":(" || this.nextToken === "~(" )
							return makeValArray( [ ".", obj, prop ] );
						
						return obj[ prop ];
					},
					ref :function( obj, prop ) {
						return makeValArray( [ ".", obj, prop ], prop );
					},
					arr :function( obj, prop ) {
						return makeValArray( [ ".", obj, prop ], prop._dep );
					}
				},
				ref : {
					lit : function( obj, prop ) {
						if ( prop.id === "(id)" )
							prop = prop.value;
						
						return makeValArray( [ ".", obj, prop ], obj );
					},
					ref :function( obj, prop ) {
						return makeValArray( [ ".", obj, prop ], obj, prop );
					},
					arr :function( obj, prop ) {
						return makeValArray( [ ".", obj, prop ], obj, prop._dep );
					}
				},
				arr : {
					lit : function( obj, prop ) {
						if ( prop.id === "(id)" )
							prop = prop.value;
						
						if ( obj[ 0 ] === "." ) {
							obj.push( prop );
							return obj;
						}
						
						return makeValArray( [ ".", obj, prop ], obj._dep );
					},
					ref :function( obj, prop ) {
						if ( obj[ 0 ] === "." ) {
							obj.addDep( prop ).push( prop );
							return obj;
						}
						
						return makeValArray( [ ".", obj, prop ], obj._dep, prop );
					},
					arr :function( obj, prop ) {
						if ( obj[ 0 ] === "." ) {
							obj.addDep( prop._dep ).push( prop );
							return obj;
						}
						
						return makeValArray( [ ".", obj, prop ], obj._dep, prop._dep );
					}
				}
			};
			
			operator( ".", "infix", 110, function( expr ) {
					this.first = expr.o[ expr.p ];
					this.second = undefined;
					this.dotPropAccess = true;
					this.ledEval = operators[ "." ].ledEval;
					expr.o[ expr.p ] = this;
					
					return {
						o : this,
						p : "second",
						rbp : this.lbp,
						end : null,
						parent : expr,
						prevToken : expr.o.id
					};
				},
				objPropEval
			);
			
			operator( "[", "infix", 110, function( expr ) {
					this.first = expr.o[ expr.p ];
					this.second = undefined;
					this.ledEval = operators[ "[" ].ledEval;
					expr.o[ expr.p ] = this;
					
					return {
						o : this,
						p : "second",
						rbp : 0,
						end : "]",
						parent : expr,
						prevToken : expr.o.id
					};
				},
				objPropEval
			);
			
			operator( "{", "infix", 120, function( expr ) {
					this.first = expr.o[ expr.p ];
					this.second = undefined;
					this.ledEval = operators[ "{" ].ledEval;
					expr.o[ expr.p ] = this;
					
					return {
						o : this,
						p : "second",
						rbp : 0,
						end : "}",
						parent : expr,
						prevToken : expr.o.id
					};
				},
				{}
			);
			
			operator( "(", "prefix", 130, function( expr ) {
					this.first = undefined;
					this.nudEval = operators[ "(" ].nudEval;
					expr.o[ expr.p ] = this;
					
					return {
						o : this,
						p : "first",
						rbp : 0,
						end : ")",
						parent : expr
					};
				},
				function( content ) {
					return content;
				}
			);
			
			//interpret function
			var assignTo = null,
				opParts = {			//parts, a multiple-character operator is allowed to be composed of
					"=" : true,
					"!" : true,
					"<" : true,
					">" : true,
					"&" : true,
					"|" : true,
					"+" : true,
					"-" : true,
					"*" : true,
					"/" : true,
					"%" : true,
					"^" : true,
					"#" : true,
					"~" : true,
					"?" : true,
					"." : true,
					"�" : true,
					"(" : true,
					")" : true,
					"[" : true,
					"]" : true
				},
				endExpr = function( expr, token ) {
					var parent = expr.parent;
					
					expr.nextToken = token.id;
					
					//get variable objects
					//Since variables cannot be deleted, while they are still referenced,
					//the pointer to the object stays the same as long as needed.
					if ( !expr.o.dotPropAccess && expr.o.second && expr.o.second.id === "(id)" ) {
						if ( !( expr.o.second.value in this.varTable.table ) )
							error( expr.o.second.value + " is not defined." );
						
						expr.o.second = this.varTable.table[ expr.o.second.value ];
					}
					
					if ( !expr.o.assignment && ( expr.o.call || expr.o.id !== "(" ) && expr.o.first && expr.o.first.id === "(id)" ) {
						if ( !( expr.o.first.value in this.varTable.table ) )
							error( expr.o.first.value + " is not defined." );
						
						expr.o.first = this.varTable.table[ expr.o.first.value ];
					}
					
					//use the value of a variable in case of assigning to the same variable
					if ( assignTo && !expr.o.assignment ) {
						if ( expr.o.first._key === assignTo ) {
							if ( expr.o.first._value._isValArray )
								expr.o.first = makeValArray( expr.o.first._value.slice( 0 ), expr.o.first._value._dep );
							else
								expr.o.first = expr.o.first._value;
						}
						
						if ( expr.o.second && expr.o.second._key === assignTo ) {
							if ( expr.o.second._value._isValArray )
								expr.o.second = makeValArray( expr.o.second._value.slice( 0 ), expr.o.second._value._dep );
							else
								expr.o.second = expr.o.second._value;
						}
					}
					
					/*
					if ( this.doesEval ) {				
						expr.o.second = expr.o.second && expr.o.second.valueOf( interpret.ctxt, interpret.data );
						
						if ( !expr.o.assignment )
							expr.o.first = expr.o.first && expr.o.first.valueOf( interpret.ctxt, interpret.data );
					}
					*/
					//evaluate expression
					parent.o[ parent.p ] = ( expr.o.nudEval || expr.o.ledEval ).call( expr, expr.o.first, expr.o.second, this );
					
					return parent;
				},
				processLiteral = function( token, expr ) {
					//put literal into expression
					if ( expr.o[ expr.p ] === undefined ) {
						//begin expression
						expr.o[ expr.p ] = token;
						
						if ( expr.parent && !expr.parent.o.first && expr.parent.o.assignment && expr.o[ expr.p ] !== undefined ) {
							//FIXME: hack for prefix assignment
							//not nice, but works
							if ( !expr.parent.o.first && expr.parent.o.assignment ) {
								assignTo = expr.o[ expr.p ].id === "(id)" ? expr.o[ expr.p ].value : expr.o[ expr.p ]._key;;
								expr.parent.o.first = expr.o[ expr.p ];
							} else if ( expr.parent.o.id === "(" && !expr.o.first && expr.o.assignment ) {
								assignTo = expr.o[ expr.p ].id === "(id)" ? expr.o[ expr.p ].value : expr.o[ expr.p ]._key;;
								expr.o.first = expr.o[ expr.p ];
							}
						}
						
					} else {
						//end expression
						while ( expr.rbp >= 0 ) {
							expr = endExpr.call( this, expr, token );
							
							if ( expr.rbp === 0 ) {
								expr = endExpr.call( this, expr, token );
								break;
							}
						}
					}
					
					return expr;
				},
				
				interpret = function() {
					var i,					//current position in s
						c,					//currently subatomInput character
						t,					//current token string
						token,				//current token
						expr,				//current expression working on
						ret = {				//object to contain the top level expression, that is returned
							value : undefined
						},
						newExpr = true,
						assignOp = false;
					
					//initialize top-level expression
					expr = {
						o : ret,
						p : "value",
						rbp : 0,
						end : null,
						parent : null
					};
					
					for ( var argIdx = 0, argsLen = arguments.length; argIdx < argsLen; argIdx++ ) {
						var s = arguments[ argIdx ];
						
						if ( newExpr && !expr.parent ) {
							ret.value = undefined;
							newExpr = false;
						}
						
						if ( typeof s !== "string" ) {
							if ( !this.litTable[ "obj" ] )
								error( "Bad Token: External objects not allowed." );
							
							expr = processLiteral.call( this, s, expr );
							newExpr = false;
						
						} else {
							i = 0;
							c = s.charAt( i++ );
							while ( c ) {
								//ignore whitespaces
								while ( c && c <= " " )
									c = s.charAt( i++ );
								
								if ( !c )
									break;
								
								if ( newExpr && !expr.parent ) {
									ret.value = undefined;
									newExpr = false;
								}
								
								var isNum = ( expr.o[ expr.p ] === undefined && c === "." ) || c >= "0" && c <= "9",
									isStr = c === "\"" || c === "'",
									isIdOrOp = ( c >= "a" && c <= "z" ) || ( c >= "A" && c <= "Z" ) || c === "_";
								
								//match literal
								if ( isNum || isStr ) {
									//match number
									if ( isNum ) {
										if ( !this.litTable[ "number" ] )
											error( "Bad Token: Numbers not allowed." );
										
										t = c;
										c = s.charAt( i++ );
										
										var decPoint = t !== "." ? false : true,
											exp = false;
										
										while ( c ) {
											//find digits
											if ( c >= "0" && c <= "9" ) {
												t += c;
												c = s.charAt( i++ );
											
											//find one decimal point in the numbers base
											} else if ( c === "." ) {
												if ( decPoint || exp )
													error( "Bad Token: Invalid number." );
												
												decPoint = true;
												
												t += c;
												c = s.charAt( i++ );
											
											//find one exponent with a possible sign
											} else if ( c === "e" || c === "E" ) {
												if ( exp )
													error( "Bad Token: Invalid number." );
												
												exp = true;
												t += c;
												c = s.charAt( i++ );
												
												if ( c === "+" || c === "-" ) {
													t += c;
													c = s.charAt( i++ );
												}
											
											} else if ( !( ( c >= "a" && c <= "z" ) ||
														   ( c >= "A" && c <= "Z" ) ) ) {
												break;
											} else {
												error( "Bad Token: Invalid number." );
											}
										}
										
										t = +t;
									
									//match string
									} else {
										if ( !this.litTable[ "string" ] )
											error( "Bad Token: Strings not allowed." );
										
										var q = c;
										//do not include the leading quote
										c = s.charAt( i++ );
										
										t = "";
										while ( c !== q ) {
											//look for escapement
											if ( c === "\\" ) {
												c = s.charAt( i++ );
												if ( !c )
													error( "Bad Token: Unterminated string." );
												
												switch ( c ) {
													case 'b':
														c = '\b';
														break;
													case 'f':
														c = '\f';
														break;
													case 'n':
														c = '\n';
														break;
													case 'r':
														c = '\r';
														break;
													case 't':
														c = '\t';
														break;
													case 'u':
														var uCode = "";
														for ( var i = 0; i < 4; i++ ) {
															c = s.charAt( i++ );
															if ( !c )
																error( "Bad Token: Unterminated string." );
															
															uCode += c;
														}
														c = String.fromCharCode( parseInt( uCode, 16 ) );
														break;
												}
											}
											
											t += c;
											c = s.charAt( i++ );
											
											if ( !c )
												error( "Bad Token: Unterminated string." );
										}				
										
										//select character after the closing quote
										c = s.charAt( i++ );
									}
									
									expr = processLiteral.call( this, t, expr );
								
								//match identifier or operator
								} else {
									//match identifier or possibly operator
									if ( isIdOrOp ) {
										t = "";
										
										while ( ( c >= "a" && c <= "z" ) || ( c >= "A" && c <= "Z" ) ||
												( c >= "0" && c <= "9" ) || c === "_" ) {
											t += c;
											c = s.charAt( i++ );
										}
										
										//intercept literals
										if ( t === "true" && this.litTable[ "boolean" ] ) {
											expr = processLiteral.call( this, true, expr );
											continue;
										} else if ( t === "false" && this.litTable[ "boolean" ] ) {
											expr = processLiteral.call( this, false, expr );
											continue;
										} else if ( t === "null" && this.litTable[ "null" ] ) {
											expr = processLiteral.call( this, null, expr );
											continue;
										} else if ( t === "undefined" ) {
											expr = processLiteral.call( this, undefined, expr );
											continue;
										} else if ( t === "NaN" ) {
											expr = processLiteral.call( this, NaN, expr );
											continue;
										} else if ( t === "Infinity" ) {
											expr = processLiteral.call( this, Infinity, expr );
											continue;
										}
									
									//match operator
									} else {
										t = c;
										c = s.charAt( i++ );
										
										while ( opParts[ c ] && this.opTable[ t+c ] ) {
											t += c;
											c = s.charAt( i++ );
										}
										
										//make exception for "~delete" operator and look ahead
										if ( t === "~" ) {
											var j = i,
												b = c;
											
											if ( b === "d" ) {
												b = s.charAt( j++ );
												if ( b === "e" ) {
													b = s.charAt( j++ );
													if ( b === "l" ) {
														b = s.charAt( j++ );
														if ( b === "e" ) {
															b = s.charAt( j++ );
															if ( b === "t" ) {
																b = s.charAt( j++ );
																if ( b === "e" ) {
																	b = s.charAt( j++ );
																	t += "delete";
																	i = j;
																	c = b;
																}
															}
														}
													}
												}
											}
										}
									}
									
									if ( this.opTable[ t ] ) {
										//token is operator
										var assign = false;
										if ( c === "=" ) {
											assign = true;
											c = s.charAt( i++ );
										
										} else if ( c === "." && s.charAt( i ) === "=" ) {
											c = s.charAt( i+1 );
											i += 2;
											assign = true;
										}
										
										if ( assign ) {
											token = {
												nud 	: this.opTable[ "(op=)" ].nud || nudUndef,
												led 	: this.opTable[ "(op=)" ].led || ledUndef,
												lbp 	: this.opTable[ "(op=)" ].lbp,
												value 	: t,
												id 		: "(op=)",
												arity 	: "operator"
											};
										
										} else {
											token = {
												nud 	: this.opTable[ t ].nud || nudUndef,
												led 	: this.opTable[ t ].led || ledUndef,
												lbp 	: this.opTable[ t ].lbp,
												value 	: t,
												id 		: t,
												arity 	: "operator"
											};
										}
									
									} else if ( !isIdOrOp ) {
										error( "Bad Token: Operator not supported: " + t + "." );
										
									} else {
										//token is a variable or constant name
										if ( !this.litTable[ "id" ] )
											error( "Bad Token: Identifiers not allowed." );
										
										token = {
											nud   : itself,
											led   : ledUndef,
											lbp   : 0,
											value : t,
											id    : "(id)",
											arity : "id"
										};
									}
									
									//put token into expression
									if ( expr.o[ expr.p ] === undefined && token.id !== ")" ) {
										expr = token.nud( expr );
										
										if ( expr.parent && expr.o[ expr.p ] ) {
											//FIXME: hack for prefix assignment
											//not nice, but works
											if ( !expr.parent.o.first && expr.parent.o.assignment ) {
												assignTo = expr.o[ expr.p ].id === "(id)" ? expr.o[ expr.p ].value : expr.o[ expr.p ]._key;;
												expr.parent.o.first = expr.o[ expr.p ];
											} else if ( expr.parent.o.id === "(" && !expr.o.first && expr.o.assignment ) {
												assignTo = expr.o[ expr.p ].id === "(id)" ? expr.o[ expr.p ].value : expr.o[ expr.p ]._key;;
												expr.o.first = expr.o[ expr.p ];
											}
										}
										continue;
									}
									
									//end expression
									while ( expr.rbp >= token.lbp ) {
										if ( expr.end ) {
											if ( expr.end !== token.id )
												error( "Expected " + expr.end + "." );
											
											//the complete sequence has a right binding power equal to the lbp of the starting token
											expr.rbp = expr.o.lbp;
											expr.end = null;
											
											//get next token
											break;
										}
										
										expr = endExpr.call( this, expr, token );
										
										if ( expr.rbp === token.lbp ) {
											if ( expr.end ) {
												if ( expr.end !== token.id )
													error( "Expected " + expr.end + "." );
												
												//the complete sequence has a right binding power equal to the lbp of the starting token
												expr.rbp = expr.o.lbp;
												expr.end = null;
												
												//get next token
												break;
											}
											
											if ( expr.parent )
												expr = endExpr.call( this, expr, token );
											else
												newExpr = true;
											
											break;
										}
									}
									
									//extend expression
									if ( expr.rbp < token.lbp )
										expr = token.led( expr );
								}
							}
						}
					}
					
					//end top-level expression
					while ( expr.parent )
						expr = endExpr.call( this, expr, token );
					
					//finetune return value
					if ( interpret.returns ) {
						if ( ret.value ) {
							if ( ret.value.id === "(id)" ) {
								if ( !( ret.value.value in this.varTable.table ) )
									error( ret.value.value + " is not defined." );
								
								ret.value = this.varTable.table[ ret.value.value ];
							}
							
							if ( !interpret.retVars && ( ret.value._isValArray || ret.value._isVar ) )
								return ret.value.valueOf( interpret.ctxt, interpret.data );
						}
					
						//return top-level expression
						return ret.value;
					}
					
					return undefined;
				};
			
			//initializing interpreter
			//Variable creation and properties
			var Variable = function( key, val ) {
					var v;
					if ( this instanceof Variable )
						v = this;
					else
						v = Object.create( Variable.prototype );
					
					if ( val && val._isValArray )
						val.makeVar();
					
					Reactive.call( v, val, noPartOf );
					
					if ( key ) {
						v._key = key;
						v._isNamed = true;
					
					} else {
						v._key = String( v._guid );
						v._isNamed = false;
					}
					
					return v;
				};
			
			Variable.prototype = Object.create( Reactive.prototype );
			
			each( {
				_valueOf : function( ctxt, data ) {
					return  this._value && this._value.valueOf ?
							this._value.valueOf( ctxt, data ) :
							this._value;
				},
				_toString : function() {
					var str = this._isNamed ? this._key : "";
					
					if ( this._value && this._value._isValArray )
						str += ( str ? " = " : "" ) + this._value.toString();
					else
						str += ( str ? " = " : "" ) + String( this._value );
					
					return str;
				},
				_prevValueOf : function( ctxt, data ) {
					return  "_prev" in this ? 
							( this._prev && this._prev._prevValueOf ?
								this._prev._prevValueOf( ctxt, data ) :
								this._prev ) :
							this._value && this._value._prevValueOf ?
								this._value._prevValueOf( ctxt, data ) :
								this._value;
				},
				_isVar : true
			}, function( key, prop ) {
				Variable.prototype[ key ] = prop;
			} );
			
			var VarTable = function( base ) {
					var t;
					if ( this instanceof VarTable )
						t = this;
					else
						t = Object.create( VarTable.prototype );
					
					t.table = base;
					
					return t;
				};
			
			VarTable.prototype = {
				table  : null,
				clean : function( vars ) {
					var ret = true,
						del = false,
						key,
						v;
					
					for ( key in this.table ) {
						v = this.table[ key ];
						
						if ( this.table.hasOwnProperty( key ) && ( !vars || !(key in vars) ) && !v._locked && isEmptyObj( v._partOf ) && !v._funcs.length ) {
							ret = ret && v[ "delete" ]();
							delete this.table[ key ];
							del = true;
						}
					}
					
					return del ? this.clean( vars ) : ret;
				},
				set : function( key, val ) {
					if ( key in this.table ) {
						if ( this.table[ key ]._locked )
							error( "Bad lvalue: variable is immutable (constant)." );
						
						return this.table[ key ].set( val, noPartOf );
					}
					
					var v = Variable( key, val );
					return this.table[ v._key ] = v;
				},
				"delete" : function( key ) {
					if ( key in this.table ) {
						if ( this.table[ key ]._locked )
							error( "Bad lvalue: variable is immutable (constant)." );
						
						for ( var id in this.table[ key ]._partOf )
							if ( this.table[ key ]._partOf.hasOwnProperty( id ) )
								error( "Cannot delete variable " + key + ". It is still used in: " + this.table[ key ]._partOf[ id ].toString() + "." );
						
						if ( this.table[ key ]._funcs.length )
							error( "Cannot delete variable " + key + ". It is still used in: " + this.table[ key ]._funcs[ 0 ].args + "." );
						
						var ret = this.table[ key ][ "delete" ]();
						
						delete this.table[ key ];
						
						return ret;
					}
					
					return true;
				}
			};
			
			var mathModule = ( function() {
					var ret = {
						pi		: Math.PI,
						e		: Math.E,
						ln2		: Math.LN2,
						ln10	: Math.LN10,
						log2e	: Math.LOG2E,
						log10e	: Math.LOG10E,
						sqrt2	: Math.SQRT2,
						sqrt1_2	: Math.SQRT1_2,
						abs 	: Math.abs,
						sgn 	: function( n ) {
									return n > 0 ? 1 : n < 0 ? -1 : 0;
								},
						floor 	: Math.floor,
						ceil 	: Math.ceil,
						round 	: Math.round,
						exp 	: Math.exp,
						log 	: Math.log,
						sin 	: Math.sin,
						asin 	: Math.asin,
						cos 	: Math.cos,
						acos 	: Math.acos,
						tan 	: Math.tan,
						atan 	: Math.atan
					};
					
					ret.abs.projection = ret.sgn.projection =
					ret.floor.projection = ret.ceil.projection =
					ret.round.projection = true;
					
					ret.exp.inverse = ret.log;
					ret.log.inverse = ret.exp;
					ret.sin.inverse = ret.asin;
					ret.asin.inverse = ret.sin;
					ret.cos.inverse = ret.acos;
					ret.acos.inverse = ret.cos;
					ret.tan.inverse = ret.atan;
					ret.atan.inverse = ret.tan;
					
					return ret;
				}() );
			
			var setupVars = function( consts, base, parseFunc ) {
					var table = base ? Object.create( base ) : {};
					
					if ( consts ) {
						consts = consts === "math" ? mathModule : consts;
						
						for ( var key in consts ) {
							if ( consts.hasOwnProperty( key ) ) {
								table[ key ] = Variable( key, consts[ key ].constructor === Array ? parseFunc.apply( this, consts[ key ] ) : consts[ key ] );
								table[ key ]._locked = true;
							}
						}
					}
					
					return VarTable( Object.create( table ) );
				},
				setupOps = function( ops, base ) {
					if ( !ops || !ops.length )
						return base || operators;
					
					var not = ops[ 0 ] === "not",
						ret = base ? Object.create( base ) : not ? Object.create( operators ) : {};
					
					for ( var idx = not ? 1 : 0, len = ops.length; idx < len; idx++ ) {
						if ( not ) {
							ret[ ops[ idx ] ] = undefined;
							if ( ops[ idx ] === "=" ) {
								ret[ "(op=)" ] = undefined;
								ret[ "delete" ] = undefined;
							}
						
						} else {
							ret[ ops[ idx ] ] = operators[ ops[ idx ] ];
							if ( ops[ idx ] === "=" ) {
								ret[ "(op=)" ] = operators[ "(op=)" ];
								ret[ "delete" ] = operators[ "delete" ];
							}
						}
					}
					
					return ret;
				},
				setupLits = function( lits, base ) {
					if ( !lits || !lits.length )
						return base || {
							"null" : true,
							"boolean" : true,
							number : true,
							string : true,
							"obj" : true,
							"id" : true
						};
					
					var not = lits[ 0 ] === "not",
						ret = Object.create( base ) || {};
					
					for ( var idx = 0; idx < lits.length; idx++ ) {
						if ( not )
							ret[ lits[ idx ] ] = undefined;
						else
							ret[ lits[ idx ] ] = true;
					}
					
					return ret;
				};
			
			return function Interpreter( template, consts, litTable, opTable ) {
				var react = function() {
						var ret;
						
						interpret.returns = true;
						interpret.retVars = false;
						
						ret = interpret.apply( react, arguments );
						
						interpret.ctxt = window;
						interpret.data = null;
						
						return ret;
					};
				
				react.context = function( ctxt, data ) {
					interpret.ctxt = ctxt;
					interpret.data = data;
					return react;
				};
				
				if ( template === "debugger" ) {
					delete template;
					
					react.leak = function() {
						try {
							var ret;
							
							if ( arguments[ 0 ] === "no partOf" ) {
								noPartOf = true;
								arguments = Array.prototype.slice.call( arguments, 1 );
							}
								
							interpret.returns = true;
							interpret.retVars = true;
							
							ret = interpret.apply( react, arguments );
							
							if ( ret._isValArray )
								ret = this.varTable.set( null, ret );
							
							interpret.ctxt = window;
							interpret.data = null;
							noPartOf = false;
							
							return ret;
						
						} catch ( error ) {
							interpret.ctxt = window;
							interpret.data = null;
							
							noPartOf = false;
							
							throw ( error );
						}
					}
				}
				
				react.litTable = setupLits( litTable, template && template.litTable );
				react.opTable  = setupOps( opTable, template && template.opTable );
				react.varTable = setupVars( consts, template && template.varTable, react );
				
				react.Datatype      = Datatype;
				//react.Reactive      = Reactive;
				react.Interpreter   = Interpreter;
				
				interpret.ctxt = window;
				interpret.data = null;
				
				return react;
			};
		}() );
	
	//expose
	react = Interpreter( null, "math" );
}() );