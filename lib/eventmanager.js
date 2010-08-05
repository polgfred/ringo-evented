var EventManager = {};

EventManager.listen = function (evt, callback) {
  if (typeof evt === 'object') {
    for each (var ev in Object.keys(evt)) {
      this.listen(ev, evt[ev]);
    }
  } else {
    this._eventcbs = this._eventcbs || {};
    this._eventcbs[evt] = this._eventcbs[evt] || [];
    this._eventcbs[evt].push(callback);
  }
};

EventManager.notify = function (evt) {
  var args = Array.slice(arguments, 1);
  var cbs = this._eventcbs && this._eventcbs[evt];
  if (cbs) {
    for each (var callback in cbs) {
      callback.apply(this, args);
    }
  }
};

exports.EventManager = EventManager;
