/**
 * class.js
 *
 * A simple helper to facilitate constructor inheritance.
 */

/**
 * Wraps `method` so that any call to `this.super()` gets routed to the
 * supermethod `super`. If either argument is not a method, return `method`
 * as is.
 */
function wrap(method, super) {
  if (typeof method != 'function' || typeof super != 'function')
    return method;

  return function () {
    var original = this.super;

    try {
      this.super = super;
      return method.apply(this, arguments);
    } finally {
      this.super = original;
    }
  };
}

/**
 * Holder for methods that get copied to newly created classes.
 */
var ClassMethods = {};

/**
 * Return a new constructor whose prototype is chained to `this`'s
 * prototype. The new constructor will have all the `ClassMethods` copied
 * into it.
 *
 * @returns the new constructor
 */
ClassMethods.extend = function (ctor) {
  ctor = wrap(ctor, this) || function () {};

  var proxy = function () {};
  proxy.prototype = this.prototype;
  ctor.prototype = new proxy();
  ctor.prototype.constructor = ctor;

  for each (var name in Object.keys(ClassMethods))
    ctor[name] = ClassMethods[name];

  return ctor;
};

/**
 * Define a single named property on `this`'s prototype. If a property
 * named `name` already exists and is a method, wrap it in a special method
 * that routes `this.super()` to that method.
 *
 * @returns the (possibly wrapped) new value
 */
ClassMethods.define = function (name, value) {
  return this.prototype[name] = wrap(value, this.prototype[name]);
};

/**
 * Mix an entire namespace of properties into `this`'s prototype by means
 * of `define`.
 */
ClassMethods.include = function (properties) {
  for each (var name in Object.keys(properties || {}))
    this.define(name, properties[name]);
};

/**
 * The main module namespace.
 */
var Class = {};

/**
 * Create a new top-level constructor by copying the `ClassMethods` into it.
 *
 * @returns the new constructor
 */
Class.create = function (ctor) {
  ctor = ctor || function () {};

  for each (var name in Object.keys(ClassMethods))
    ctor[name] = ClassMethods[name];

  return ctor;
};

/**
 * Module exports.
 */
exports.Class = Class;
