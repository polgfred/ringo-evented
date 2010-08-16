/**
 * Chain the derived ctor's prototype to the base ctor's. Simplifies inheritance.
 */
exports.extend = function (derived, base, attributes) {
  var proto = function () {};
  proto.prototype = base.prototype;
  derived.prototype = new proto();
  derived.prototype.constructor = derived;
  for each (var attr in Object.keys(attributes || {})) {
    derived.prototype[attr] = attributes[attr];
  }
};
