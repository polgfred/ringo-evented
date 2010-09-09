/**
 * A couple **really** simple helpers to facilitate constructor inheritance.
 */
var Class = {};

/**
 * Chain the derived ctor's prototype to the base's.
 */
Class.extend = function (ctor, base) {
  var proxy = function () {};
  proxy.prototype = base.prototype;
  ctor.prototype = new proxy();
  ctor.prototype.constructor = ctor;
};

/**
 * Mix the attributes namespace into the ctor's prototype.
 */
Class.include = function (ctor, attributes) {
  for each (var attr in Object.keys(attributes || {}))
    ctor.prototype[attr] = attributes[attr];
};

exports.Class = Class;
