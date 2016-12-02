(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = dragDrop

var flatten = require('flatten')
var parallel = require('run-parallel')

function dragDrop (elem, listeners) {
  if (typeof elem === 'string') {
    elem = window.document.querySelector(elem)
  }

  if (typeof listeners === 'function') {
    listeners = { onDrop: listeners }
  }

  var timeout

  elem.addEventListener('dragenter', stopEvent, false)
  elem.addEventListener('dragover', onDragOver, false)
  elem.addEventListener('dragleave', onDragLeave, false)
  elem.addEventListener('drop', onDrop, false)

  // Function to remove drag-drop listeners
  return function remove () {
    removeDragClass()
    elem.removeEventListener('dragenter', stopEvent, false)
    elem.removeEventListener('dragover', onDragOver, false)
    elem.removeEventListener('dragleave', onDragLeave, false)
    elem.removeEventListener('drop', onDrop, false)
  }

  function onDragOver (e) {
    e.stopPropagation()
    e.preventDefault()
    if (e.dataTransfer.items) {
      // Only add "drag" class when `items` contains a file
      var items = toArray(e.dataTransfer.items).filter(function (item) {
        return item.kind === 'file'
      })
      if (items.length === 0) return
    }

    elem.classList.add('drag')
    clearTimeout(timeout)

    if (listeners.onDragOver) {
      listeners.onDragOver(e)
    }

    e.dataTransfer.dropEffect = 'copy'
    return false
  }

  function onDragLeave (e) {
    e.stopPropagation()
    e.preventDefault()

    if (listeners.onDragLeave) {
      listeners.onDragLeave(e)
    }

    clearTimeout(timeout)
    timeout = setTimeout(removeDragClass, 50)

    return false
  }

  function onDrop (e) {
    e.stopPropagation()
    e.preventDefault()

    if (listeners.onDragLeave) {
      listeners.onDragLeave(e)
    }

    clearTimeout(timeout)
    removeDragClass()

    var pos = {
      x: e.clientX,
      y: e.clientY
    }

    if (e.dataTransfer.items) {
      // Handle directories in Chrome using the proprietary FileSystem API
      var items = toArray(e.dataTransfer.items).filter(function (item) {
        return item.kind === 'file'
      })

      if (items.length === 0) return

      parallel(items.map(function (item) {
        return function (cb) {
          processEntry(item.webkitGetAsEntry(), cb)
        }
      }), function (err, results) {
        // This catches permission errors with file:// in Chrome. This should never
        // throw in production code, so the user does not need to use try-catch.
        if (err) throw err
        if (listeners.onDrop) {
          listeners.onDrop(flatten(results), pos)
        }
      })
    } else {
      var files = toArray(e.dataTransfer.files)

      if (files.length === 0) return

      files.forEach(function (file) {
        file.fullPath = '/' + file.name
      })

      if (listeners.onDrop) {
        listeners.onDrop(files, pos)
      }
    }

    return false
  }

  function removeDragClass () {
    elem.classList.remove('drag')
  }
}

function stopEvent (e) {
  e.stopPropagation()
  e.preventDefault()
  return false
}

function processEntry (entry, cb) {
  var entries = []

  if (entry.isFile) {
    entry.file(function (file) {
      file.fullPath = entry.fullPath  // preserve pathing for consumer
      cb(null, file)
    }, function (err) {
      cb(err)
    })
  } else if (entry.isDirectory) {
    var reader = entry.createReader()
    readEntries()
  }

  function readEntries () {
    reader.readEntries(function (entries_) {
      if (entries_.length > 0) {
        entries = entries.concat(toArray(entries_))
        readEntries() // continue reading entries until `readEntries` returns no more
      } else {
        doneEntries()
      }
    })
  }

  function doneEntries () {
    parallel(entries.map(function (entry) {
      return function (cb) {
        processEntry(entry, cb)
      }
    }), cb)
  }
}

function toArray (list) {
  return Array.prototype.slice.call(list || [], 0)
}

},{"flatten":2,"run-parallel":3}],2:[function(require,module,exports){
module.exports = function flatten(list, depth) {
  depth = (typeof depth == 'number') ? depth : Infinity;

  if (!depth) {
    if (Array.isArray(list)) {
      return list.map(function(i) { return i; });
    }
    return list;
  }

  return _flatten(list, 1);

  function _flatten(list, d) {
    return list.reduce(function (acc, item) {
      if (Array.isArray(item) && d < depth) {
        return acc.concat(_flatten(item, d + 1));
      }
      else {
        return acc.concat(item);
      }
    }, []);
  }
};

},{}],3:[function(require,module,exports){
(function (process){
module.exports = function (tasks, cb) {
  var results, pending, keys
  var isSync = true

  if (Array.isArray(tasks)) {
    results = []
    pending = tasks.length
  } else {
    keys = Object.keys(tasks)
    results = {}
    pending = keys.length
  }

  function done (err) {
    function end () {
      if (cb) cb(err, results)
      cb = null
    }
    if (isSync) process.nextTick(end)
    else end()
  }

  function each (i, err, result) {
    results[i] = result
    if (--pending === 0 || err) {
      done(err)
    }
  }

  if (!pending) {
    // empty
    done(null)
  } else if (keys) {
    // object
    keys.forEach(function (key) {
      tasks[key](function (err, result) { each(key, err, result) })
    })
  } else {
    // array
    tasks.forEach(function (task, i) {
      task(function (err, result) { each(i, err, result) })
    })
  }

  isSync = false
}

}).call(this,require('_process'))

},{"_process":68}],4:[function(require,module,exports){
(function (process,global){
/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/jakearchibald/es6-promise/master/LICENSE
 * @version   3.2.1
 */

(function() {
    "use strict";
    function lib$es6$promise$utils$$objectOrFunction(x) {
      return typeof x === 'function' || (typeof x === 'object' && x !== null);
    }

    function lib$es6$promise$utils$$isFunction(x) {
      return typeof x === 'function';
    }

    function lib$es6$promise$utils$$isMaybeThenable(x) {
      return typeof x === 'object' && x !== null;
    }

    var lib$es6$promise$utils$$_isArray;
    if (!Array.isArray) {
      lib$es6$promise$utils$$_isArray = function (x) {
        return Object.prototype.toString.call(x) === '[object Array]';
      };
    } else {
      lib$es6$promise$utils$$_isArray = Array.isArray;
    }

    var lib$es6$promise$utils$$isArray = lib$es6$promise$utils$$_isArray;
    var lib$es6$promise$asap$$len = 0;
    var lib$es6$promise$asap$$vertxNext;
    var lib$es6$promise$asap$$customSchedulerFn;

    var lib$es6$promise$asap$$asap = function asap(callback, arg) {
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len] = callback;
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len + 1] = arg;
      lib$es6$promise$asap$$len += 2;
      if (lib$es6$promise$asap$$len === 2) {
        // If len is 2, that means that we need to schedule an async flush.
        // If additional callbacks are queued before the queue is flushed, they
        // will be processed by this flush that we are scheduling.
        if (lib$es6$promise$asap$$customSchedulerFn) {
          lib$es6$promise$asap$$customSchedulerFn(lib$es6$promise$asap$$flush);
        } else {
          lib$es6$promise$asap$$scheduleFlush();
        }
      }
    }

    function lib$es6$promise$asap$$setScheduler(scheduleFn) {
      lib$es6$promise$asap$$customSchedulerFn = scheduleFn;
    }

    function lib$es6$promise$asap$$setAsap(asapFn) {
      lib$es6$promise$asap$$asap = asapFn;
    }

    var lib$es6$promise$asap$$browserWindow = (typeof window !== 'undefined') ? window : undefined;
    var lib$es6$promise$asap$$browserGlobal = lib$es6$promise$asap$$browserWindow || {};
    var lib$es6$promise$asap$$BrowserMutationObserver = lib$es6$promise$asap$$browserGlobal.MutationObserver || lib$es6$promise$asap$$browserGlobal.WebKitMutationObserver;
    var lib$es6$promise$asap$$isNode = typeof self === 'undefined' && typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

    // test for web worker but not in IE10
    var lib$es6$promise$asap$$isWorker = typeof Uint8ClampedArray !== 'undefined' &&
      typeof importScripts !== 'undefined' &&
      typeof MessageChannel !== 'undefined';

    // node
    function lib$es6$promise$asap$$useNextTick() {
      // node version 0.10.x displays a deprecation warning when nextTick is used recursively
      // see https://github.com/cujojs/when/issues/410 for details
      return function() {
        process.nextTick(lib$es6$promise$asap$$flush);
      };
    }

    // vertx
    function lib$es6$promise$asap$$useVertxTimer() {
      return function() {
        lib$es6$promise$asap$$vertxNext(lib$es6$promise$asap$$flush);
      };
    }

    function lib$es6$promise$asap$$useMutationObserver() {
      var iterations = 0;
      var observer = new lib$es6$promise$asap$$BrowserMutationObserver(lib$es6$promise$asap$$flush);
      var node = document.createTextNode('');
      observer.observe(node, { characterData: true });

      return function() {
        node.data = (iterations = ++iterations % 2);
      };
    }

    // web worker
    function lib$es6$promise$asap$$useMessageChannel() {
      var channel = new MessageChannel();
      channel.port1.onmessage = lib$es6$promise$asap$$flush;
      return function () {
        channel.port2.postMessage(0);
      };
    }

    function lib$es6$promise$asap$$useSetTimeout() {
      return function() {
        setTimeout(lib$es6$promise$asap$$flush, 1);
      };
    }

    var lib$es6$promise$asap$$queue = new Array(1000);
    function lib$es6$promise$asap$$flush() {
      for (var i = 0; i < lib$es6$promise$asap$$len; i+=2) {
        var callback = lib$es6$promise$asap$$queue[i];
        var arg = lib$es6$promise$asap$$queue[i+1];

        callback(arg);

        lib$es6$promise$asap$$queue[i] = undefined;
        lib$es6$promise$asap$$queue[i+1] = undefined;
      }

      lib$es6$promise$asap$$len = 0;
    }

    function lib$es6$promise$asap$$attemptVertx() {
      try {
        var r = require;
        var vertx = r('vertx');
        lib$es6$promise$asap$$vertxNext = vertx.runOnLoop || vertx.runOnContext;
        return lib$es6$promise$asap$$useVertxTimer();
      } catch(e) {
        return lib$es6$promise$asap$$useSetTimeout();
      }
    }

    var lib$es6$promise$asap$$scheduleFlush;
    // Decide what async method to use to triggering processing of queued callbacks:
    if (lib$es6$promise$asap$$isNode) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useNextTick();
    } else if (lib$es6$promise$asap$$BrowserMutationObserver) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMutationObserver();
    } else if (lib$es6$promise$asap$$isWorker) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMessageChannel();
    } else if (lib$es6$promise$asap$$browserWindow === undefined && typeof require === 'function') {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$attemptVertx();
    } else {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useSetTimeout();
    }
    function lib$es6$promise$then$$then(onFulfillment, onRejection) {
      var parent = this;

      var child = new this.constructor(lib$es6$promise$$internal$$noop);

      if (child[lib$es6$promise$$internal$$PROMISE_ID] === undefined) {
        lib$es6$promise$$internal$$makePromise(child);
      }

      var state = parent._state;

      if (state) {
        var callback = arguments[state - 1];
        lib$es6$promise$asap$$asap(function(){
          lib$es6$promise$$internal$$invokeCallback(state, child, callback, parent._result);
        });
      } else {
        lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection);
      }

      return child;
    }
    var lib$es6$promise$then$$default = lib$es6$promise$then$$then;
    function lib$es6$promise$promise$resolve$$resolve(object) {
      /*jshint validthis:true */
      var Constructor = this;

      if (object && typeof object === 'object' && object.constructor === Constructor) {
        return object;
      }

      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$resolve(promise, object);
      return promise;
    }
    var lib$es6$promise$promise$resolve$$default = lib$es6$promise$promise$resolve$$resolve;
    var lib$es6$promise$$internal$$PROMISE_ID = Math.random().toString(36).substring(16);

    function lib$es6$promise$$internal$$noop() {}

    var lib$es6$promise$$internal$$PENDING   = void 0;
    var lib$es6$promise$$internal$$FULFILLED = 1;
    var lib$es6$promise$$internal$$REJECTED  = 2;

    var lib$es6$promise$$internal$$GET_THEN_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$selfFulfillment() {
      return new TypeError("You cannot resolve a promise with itself");
    }

    function lib$es6$promise$$internal$$cannotReturnOwn() {
      return new TypeError('A promises callback cannot return that same promise.');
    }

    function lib$es6$promise$$internal$$getThen(promise) {
      try {
        return promise.then;
      } catch(error) {
        lib$es6$promise$$internal$$GET_THEN_ERROR.error = error;
        return lib$es6$promise$$internal$$GET_THEN_ERROR;
      }
    }

    function lib$es6$promise$$internal$$tryThen(then, value, fulfillmentHandler, rejectionHandler) {
      try {
        then.call(value, fulfillmentHandler, rejectionHandler);
      } catch(e) {
        return e;
      }
    }

    function lib$es6$promise$$internal$$handleForeignThenable(promise, thenable, then) {
       lib$es6$promise$asap$$asap(function(promise) {
        var sealed = false;
        var error = lib$es6$promise$$internal$$tryThen(then, thenable, function(value) {
          if (sealed) { return; }
          sealed = true;
          if (thenable !== value) {
            lib$es6$promise$$internal$$resolve(promise, value);
          } else {
            lib$es6$promise$$internal$$fulfill(promise, value);
          }
        }, function(reason) {
          if (sealed) { return; }
          sealed = true;

          lib$es6$promise$$internal$$reject(promise, reason);
        }, 'Settle: ' + (promise._label || ' unknown promise'));

        if (!sealed && error) {
          sealed = true;
          lib$es6$promise$$internal$$reject(promise, error);
        }
      }, promise);
    }

    function lib$es6$promise$$internal$$handleOwnThenable(promise, thenable) {
      if (thenable._state === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, thenable._result);
      } else if (thenable._state === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, thenable._result);
      } else {
        lib$es6$promise$$internal$$subscribe(thenable, undefined, function(value) {
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      }
    }

    function lib$es6$promise$$internal$$handleMaybeThenable(promise, maybeThenable, then) {
      if (maybeThenable.constructor === promise.constructor &&
          then === lib$es6$promise$then$$default &&
          constructor.resolve === lib$es6$promise$promise$resolve$$default) {
        lib$es6$promise$$internal$$handleOwnThenable(promise, maybeThenable);
      } else {
        if (then === lib$es6$promise$$internal$$GET_THEN_ERROR) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$GET_THEN_ERROR.error);
        } else if (then === undefined) {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        } else if (lib$es6$promise$utils$$isFunction(then)) {
          lib$es6$promise$$internal$$handleForeignThenable(promise, maybeThenable, then);
        } else {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        }
      }
    }

    function lib$es6$promise$$internal$$resolve(promise, value) {
      if (promise === value) {
        lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$selfFulfillment());
      } else if (lib$es6$promise$utils$$objectOrFunction(value)) {
        lib$es6$promise$$internal$$handleMaybeThenable(promise, value, lib$es6$promise$$internal$$getThen(value));
      } else {
        lib$es6$promise$$internal$$fulfill(promise, value);
      }
    }

    function lib$es6$promise$$internal$$publishRejection(promise) {
      if (promise._onerror) {
        promise._onerror(promise._result);
      }

      lib$es6$promise$$internal$$publish(promise);
    }

    function lib$es6$promise$$internal$$fulfill(promise, value) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }

      promise._result = value;
      promise._state = lib$es6$promise$$internal$$FULFILLED;

      if (promise._subscribers.length !== 0) {
        lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, promise);
      }
    }

    function lib$es6$promise$$internal$$reject(promise, reason) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }
      promise._state = lib$es6$promise$$internal$$REJECTED;
      promise._result = reason;

      lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publishRejection, promise);
    }

    function lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;

      parent._onerror = null;

      subscribers[length] = child;
      subscribers[length + lib$es6$promise$$internal$$FULFILLED] = onFulfillment;
      subscribers[length + lib$es6$promise$$internal$$REJECTED]  = onRejection;

      if (length === 0 && parent._state) {
        lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, parent);
      }
    }

    function lib$es6$promise$$internal$$publish(promise) {
      var subscribers = promise._subscribers;
      var settled = promise._state;

      if (subscribers.length === 0) { return; }

      var child, callback, detail = promise._result;

      for (var i = 0; i < subscribers.length; i += 3) {
        child = subscribers[i];
        callback = subscribers[i + settled];

        if (child) {
          lib$es6$promise$$internal$$invokeCallback(settled, child, callback, detail);
        } else {
          callback(detail);
        }
      }

      promise._subscribers.length = 0;
    }

    function lib$es6$promise$$internal$$ErrorObject() {
      this.error = null;
    }

    var lib$es6$promise$$internal$$TRY_CATCH_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$tryCatch(callback, detail) {
      try {
        return callback(detail);
      } catch(e) {
        lib$es6$promise$$internal$$TRY_CATCH_ERROR.error = e;
        return lib$es6$promise$$internal$$TRY_CATCH_ERROR;
      }
    }

    function lib$es6$promise$$internal$$invokeCallback(settled, promise, callback, detail) {
      var hasCallback = lib$es6$promise$utils$$isFunction(callback),
          value, error, succeeded, failed;

      if (hasCallback) {
        value = lib$es6$promise$$internal$$tryCatch(callback, detail);

        if (value === lib$es6$promise$$internal$$TRY_CATCH_ERROR) {
          failed = true;
          error = value.error;
          value = null;
        } else {
          succeeded = true;
        }

        if (promise === value) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$cannotReturnOwn());
          return;
        }

      } else {
        value = detail;
        succeeded = true;
      }

      if (promise._state !== lib$es6$promise$$internal$$PENDING) {
        // noop
      } else if (hasCallback && succeeded) {
        lib$es6$promise$$internal$$resolve(promise, value);
      } else if (failed) {
        lib$es6$promise$$internal$$reject(promise, error);
      } else if (settled === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, value);
      } else if (settled === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, value);
      }
    }

    function lib$es6$promise$$internal$$initializePromise(promise, resolver) {
      try {
        resolver(function resolvePromise(value){
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function rejectPromise(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      } catch(e) {
        lib$es6$promise$$internal$$reject(promise, e);
      }
    }

    var lib$es6$promise$$internal$$id = 0;
    function lib$es6$promise$$internal$$nextId() {
      return lib$es6$promise$$internal$$id++;
    }

    function lib$es6$promise$$internal$$makePromise(promise) {
      promise[lib$es6$promise$$internal$$PROMISE_ID] = lib$es6$promise$$internal$$id++;
      promise._state = undefined;
      promise._result = undefined;
      promise._subscribers = [];
    }

    function lib$es6$promise$promise$all$$all(entries) {
      return new lib$es6$promise$enumerator$$default(this, entries).promise;
    }
    var lib$es6$promise$promise$all$$default = lib$es6$promise$promise$all$$all;
    function lib$es6$promise$promise$race$$race(entries) {
      /*jshint validthis:true */
      var Constructor = this;

      if (!lib$es6$promise$utils$$isArray(entries)) {
        return new Constructor(function(resolve, reject) {
          reject(new TypeError('You must pass an array to race.'));
        });
      } else {
        return new Constructor(function(resolve, reject) {
          var length = entries.length;
          for (var i = 0; i < length; i++) {
            Constructor.resolve(entries[i]).then(resolve, reject);
          }
        });
      }
    }
    var lib$es6$promise$promise$race$$default = lib$es6$promise$promise$race$$race;
    function lib$es6$promise$promise$reject$$reject(reason) {
      /*jshint validthis:true */
      var Constructor = this;
      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$reject(promise, reason);
      return promise;
    }
    var lib$es6$promise$promise$reject$$default = lib$es6$promise$promise$reject$$reject;


    function lib$es6$promise$promise$$needsResolver() {
      throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
    }

    function lib$es6$promise$promise$$needsNew() {
      throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
    }

    var lib$es6$promise$promise$$default = lib$es6$promise$promise$$Promise;
    /**
      Promise objects represent the eventual result of an asynchronous operation. The
      primary way of interacting with a promise is through its `then` method, which
      registers callbacks to receive either a promise's eventual value or the reason
      why the promise cannot be fulfilled.

      Terminology
      -----------

      - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
      - `thenable` is an object or function that defines a `then` method.
      - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
      - `exception` is a value that is thrown using the throw statement.
      - `reason` is a value that indicates why a promise was rejected.
      - `settled` the final resting state of a promise, fulfilled or rejected.

      A promise can be in one of three states: pending, fulfilled, or rejected.

      Promises that are fulfilled have a fulfillment value and are in the fulfilled
      state.  Promises that are rejected have a rejection reason and are in the
      rejected state.  A fulfillment value is never a thenable.

      Promises can also be said to *resolve* a value.  If this value is also a
      promise, then the original promise's settled state will match the value's
      settled state.  So a promise that *resolves* a promise that rejects will
      itself reject, and a promise that *resolves* a promise that fulfills will
      itself fulfill.


      Basic Usage:
      ------------

      ```js
      var promise = new Promise(function(resolve, reject) {
        // on success
        resolve(value);

        // on failure
        reject(reason);
      });

      promise.then(function(value) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Advanced Usage:
      ---------------

      Promises shine when abstracting away asynchronous interactions such as
      `XMLHttpRequest`s.

      ```js
      function getJSON(url) {
        return new Promise(function(resolve, reject){
          var xhr = new XMLHttpRequest();

          xhr.open('GET', url);
          xhr.onreadystatechange = handler;
          xhr.responseType = 'json';
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.send();

          function handler() {
            if (this.readyState === this.DONE) {
              if (this.status === 200) {
                resolve(this.response);
              } else {
                reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
              }
            }
          };
        });
      }

      getJSON('/posts.json').then(function(json) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Unlike callbacks, promises are great composable primitives.

      ```js
      Promise.all([
        getJSON('/posts'),
        getJSON('/comments')
      ]).then(function(values){
        values[0] // => postsJSON
        values[1] // => commentsJSON

        return values;
      });
      ```

      @class Promise
      @param {function} resolver
      Useful for tooling.
      @constructor
    */
    function lib$es6$promise$promise$$Promise(resolver) {
      this[lib$es6$promise$$internal$$PROMISE_ID] = lib$es6$promise$$internal$$nextId();
      this._result = this._state = undefined;
      this._subscribers = [];

      if (lib$es6$promise$$internal$$noop !== resolver) {
        typeof resolver !== 'function' && lib$es6$promise$promise$$needsResolver();
        this instanceof lib$es6$promise$promise$$Promise ? lib$es6$promise$$internal$$initializePromise(this, resolver) : lib$es6$promise$promise$$needsNew();
      }
    }

    lib$es6$promise$promise$$Promise.all = lib$es6$promise$promise$all$$default;
    lib$es6$promise$promise$$Promise.race = lib$es6$promise$promise$race$$default;
    lib$es6$promise$promise$$Promise.resolve = lib$es6$promise$promise$resolve$$default;
    lib$es6$promise$promise$$Promise.reject = lib$es6$promise$promise$reject$$default;
    lib$es6$promise$promise$$Promise._setScheduler = lib$es6$promise$asap$$setScheduler;
    lib$es6$promise$promise$$Promise._setAsap = lib$es6$promise$asap$$setAsap;
    lib$es6$promise$promise$$Promise._asap = lib$es6$promise$asap$$asap;

    lib$es6$promise$promise$$Promise.prototype = {
      constructor: lib$es6$promise$promise$$Promise,

    /**
      The primary way of interacting with a promise is through its `then` method,
      which registers callbacks to receive either a promise's eventual value or the
      reason why the promise cannot be fulfilled.

      ```js
      findUser().then(function(user){
        // user is available
      }, function(reason){
        // user is unavailable, and you are given the reason why
      });
      ```

      Chaining
      --------

      The return value of `then` is itself a promise.  This second, 'downstream'
      promise is resolved with the return value of the first promise's fulfillment
      or rejection handler, or rejected if the handler throws an exception.

      ```js
      findUser().then(function (user) {
        return user.name;
      }, function (reason) {
        return 'default name';
      }).then(function (userName) {
        // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
        // will be `'default name'`
      });

      findUser().then(function (user) {
        throw new Error('Found user, but still unhappy');
      }, function (reason) {
        throw new Error('`findUser` rejected and we're unhappy');
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
        // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
      });
      ```
      If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.

      ```js
      findUser().then(function (user) {
        throw new PedagogicalException('Upstream error');
      }).then(function (value) {
        // never reached
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // The `PedgagocialException` is propagated all the way down to here
      });
      ```

      Assimilation
      ------------

      Sometimes the value you want to propagate to a downstream promise can only be
      retrieved asynchronously. This can be achieved by returning a promise in the
      fulfillment or rejection handler. The downstream promise will then be pending
      until the returned promise is settled. This is called *assimilation*.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // The user's comments are now available
      });
      ```

      If the assimliated promise rejects, then the downstream promise will also reject.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // If `findCommentsByAuthor` fulfills, we'll have the value here
      }, function (reason) {
        // If `findCommentsByAuthor` rejects, we'll have the reason here
      });
      ```

      Simple Example
      --------------

      Synchronous Example

      ```javascript
      var result;

      try {
        result = findResult();
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js
      findResult(function(result, err){
        if (err) {
          // failure
        } else {
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findResult().then(function(result){
        // success
      }, function(reason){
        // failure
      });
      ```

      Advanced Example
      --------------

      Synchronous Example

      ```javascript
      var author, books;

      try {
        author = findAuthor();
        books  = findBooksByAuthor(author);
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js

      function foundBooks(books) {

      }

      function failure(reason) {

      }

      findAuthor(function(author, err){
        if (err) {
          failure(err);
          // failure
        } else {
          try {
            findBoooksByAuthor(author, function(books, err) {
              if (err) {
                failure(err);
              } else {
                try {
                  foundBooks(books);
                } catch(reason) {
                  failure(reason);
                }
              }
            });
          } catch(error) {
            failure(err);
          }
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findAuthor().
        then(findBooksByAuthor).
        then(function(books){
          // found books
      }).catch(function(reason){
        // something went wrong
      });
      ```

      @method then
      @param {Function} onFulfilled
      @param {Function} onRejected
      Useful for tooling.
      @return {Promise}
    */
      then: lib$es6$promise$then$$default,

    /**
      `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
      as the catch block of a try/catch statement.

      ```js
      function findAuthor(){
        throw new Error('couldn't find that author');
      }

      // synchronous
      try {
        findAuthor();
      } catch(reason) {
        // something went wrong
      }

      // async with promises
      findAuthor().catch(function(reason){
        // something went wrong
      });
      ```

      @method catch
      @param {Function} onRejection
      Useful for tooling.
      @return {Promise}
    */
      'catch': function(onRejection) {
        return this.then(null, onRejection);
      }
    };
    var lib$es6$promise$enumerator$$default = lib$es6$promise$enumerator$$Enumerator;
    function lib$es6$promise$enumerator$$Enumerator(Constructor, input) {
      this._instanceConstructor = Constructor;
      this.promise = new Constructor(lib$es6$promise$$internal$$noop);

      if (!this.promise[lib$es6$promise$$internal$$PROMISE_ID]) {
        lib$es6$promise$$internal$$makePromise(this.promise);
      }

      if (lib$es6$promise$utils$$isArray(input)) {
        this._input     = input;
        this.length     = input.length;
        this._remaining = input.length;

        this._result = new Array(this.length);

        if (this.length === 0) {
          lib$es6$promise$$internal$$fulfill(this.promise, this._result);
        } else {
          this.length = this.length || 0;
          this._enumerate();
          if (this._remaining === 0) {
            lib$es6$promise$$internal$$fulfill(this.promise, this._result);
          }
        }
      } else {
        lib$es6$promise$$internal$$reject(this.promise, lib$es6$promise$enumerator$$validationError());
      }
    }

    function lib$es6$promise$enumerator$$validationError() {
      return new Error('Array Methods must be provided an Array');
    }

    lib$es6$promise$enumerator$$Enumerator.prototype._enumerate = function() {
      var length  = this.length;
      var input   = this._input;

      for (var i = 0; this._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
        this._eachEntry(input[i], i);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._eachEntry = function(entry, i) {
      var c = this._instanceConstructor;
      var resolve = c.resolve;

      if (resolve === lib$es6$promise$promise$resolve$$default) {
        var then = lib$es6$promise$$internal$$getThen(entry);

        if (then === lib$es6$promise$then$$default &&
            entry._state !== lib$es6$promise$$internal$$PENDING) {
          this._settledAt(entry._state, i, entry._result);
        } else if (typeof then !== 'function') {
          this._remaining--;
          this._result[i] = entry;
        } else if (c === lib$es6$promise$promise$$default) {
          var promise = new c(lib$es6$promise$$internal$$noop);
          lib$es6$promise$$internal$$handleMaybeThenable(promise, entry, then);
          this._willSettleAt(promise, i);
        } else {
          this._willSettleAt(new c(function(resolve) { resolve(entry); }), i);
        }
      } else {
        this._willSettleAt(resolve(entry), i);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._settledAt = function(state, i, value) {
      var promise = this.promise;

      if (promise._state === lib$es6$promise$$internal$$PENDING) {
        this._remaining--;

        if (state === lib$es6$promise$$internal$$REJECTED) {
          lib$es6$promise$$internal$$reject(promise, value);
        } else {
          this._result[i] = value;
        }
      }

      if (this._remaining === 0) {
        lib$es6$promise$$internal$$fulfill(promise, this._result);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._willSettleAt = function(promise, i) {
      var enumerator = this;

      lib$es6$promise$$internal$$subscribe(promise, undefined, function(value) {
        enumerator._settledAt(lib$es6$promise$$internal$$FULFILLED, i, value);
      }, function(reason) {
        enumerator._settledAt(lib$es6$promise$$internal$$REJECTED, i, reason);
      });
    };
    function lib$es6$promise$polyfill$$polyfill() {
      var local;

      if (typeof global !== 'undefined') {
          local = global;
      } else if (typeof self !== 'undefined') {
          local = self;
      } else {
          try {
              local = Function('return this')();
          } catch (e) {
              throw new Error('polyfill failed because global object is unavailable in this environment');
          }
      }

      var P = local.Promise;

      if (P && Object.prototype.toString.call(P.resolve()) === '[object Promise]' && !P.cast) {
        return;
      }

      local.Promise = lib$es6$promise$promise$$default;
    }
    var lib$es6$promise$polyfill$$default = lib$es6$promise$polyfill$$polyfill;

    var lib$es6$promise$umd$$ES6Promise = {
      'Promise': lib$es6$promise$promise$$default,
      'polyfill': lib$es6$promise$polyfill$$default
    };

    /* global define:true module:true window: true */
    if (typeof define === 'function' && define['amd']) {
      define(function() { return lib$es6$promise$umd$$ES6Promise; });
    } else if (typeof module !== 'undefined' && module['exports']) {
      module['exports'] = lib$es6$promise$umd$$ES6Promise;
    } else if (typeof this !== 'undefined') {
      this['ES6Promise'] = lib$es6$promise$umd$$ES6Promise;
    }

    lib$es6$promise$polyfill$$default();
}).call(this);


}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":68}],5:[function(require,module,exports){
/**
* Create an event emitter with namespaces
* @name createNamespaceEmitter
* @example
* var emitter = require('./index')()
*
* emitter.on('*', function () {
*   console.log('all events emitted', this.event)
* })
*
* emitter.on('example', function () {
*   console.log('example event emitted')
* })
*/
module.exports = function createNamespaceEmitter () {
  var emitter = { _fns: {} }

  /**
  * Emit an event. Optionally namespace the event. Separate the namespace and event with a `:`
  * @name emit
  * @param {String} event – the name of the event, with optional namespace
  * @param {...*} data – data variables that will be passed as arguments to the event listener
  * @example
  * emitter.emit('example')
  * emitter.emit('demo:test')
  * emitter.emit('data', { example: true}, 'a string', 1)
  */
  emitter.emit = function emit (event) {
    var args = [].slice.call(arguments, 1)
    var namespaced = namespaces(event)
    if (this._fns[event]) emitAll(event, this._fns[event], args)
    if (namespaced) emitAll(event, namespaced, args)
  }

  /**
  * Create en event listener.
  * @name on
  * @param {String} event
  * @param {Function} fn
  * @example
  * emitter.on('example', function () {})
  * emitter.on('demo', function () {})
  */
  emitter.on = function on (event, fn) {
    if (typeof fn !== 'function') { throw new Error('callback required') }
    (this._fns[event] = this._fns[event] || []).push(fn)
  }

  /**
  * Create en event listener that fires once.
  * @name once
  * @param {String} event
  * @param {Function} fn
  * @example
  * emitter.once('example', function () {})
  * emitter.once('demo', function () {})
  */
  emitter.once = function once (event, fn) {
    function one () {
      fn.apply(this, arguments)
      emitter.off(event, one)
    }
    this.on(event, one)
  }

  /**
  * Stop listening to an event. Stop all listeners on an event by only passing the event name. Stop a single listener by passing that event handler as a callback.
  * You must be explicit about what will be unsubscribed: `emitter.off('demo')` will unsubscribe an `emitter.on('demo')` listener, 
  * `emitter.off('demo:example')` will unsubscribe an `emitter.on('demo:example')` listener
  * @name off
  * @param {String} event
  * @param {Function} [fn] – the specific handler
  * @example
  * emitter.off('example')
  * emitter.off('demo', function () {})
  */
  emitter.off = function off (event, fn) {
    var keep = []

    if (event && fn) {
      for (var i = 0; i < this._fns.length; i++) {
        if (this._fns[i] !== fn) {
          keep.push(this._fns[i])
        }
      }
    }

    keep.length ? this._fns[event] = keep : delete this._fns[event]
  }

  function namespaces (e) {
    var out = []
    var args = e.split(':')
    var fns = emitter._fns
    Object.keys(fns).forEach(function (key) {
      if (key === '*') out = out.concat(fns[key])
      if (args.length === 2 && args[0] === key) out = out.concat(fns[key])
    })
    return out
  }

  function emitAll (e, fns, args) {
    for (var i = 0; i < fns.length; i++) {
      if (!fns[i]) break
      fns[i].event = e
      fns[i].apply(fns[i], args)
    }
  }

  return emitter
}

},{}],6:[function(require,module,exports){
'use strict';
var numberIsNan = require('number-is-nan');

module.exports = function (num) {
	if (typeof num !== 'number' || numberIsNan(num)) {
		throw new TypeError('Expected a number, got ' + typeof num);
	}

	var exponent;
	var unit;
	var neg = num < 0;
	var units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	if (neg) {
		num = -num;
	}

	if (num < 1) {
		return (neg ? '-' : '') + num + ' B';
	}

	exponent = Math.min(Math.floor(Math.log(num) / Math.log(1000)), units.length - 1);
	num = Number((num / Math.pow(1000, exponent)).toFixed(2));
	unit = units[exponent];

	return (neg ? '-' : '') + num + ' ' + unit;
};

},{"number-is-nan":7}],7:[function(require,module,exports){
'use strict';
module.exports = Number.isNaN || function (x) {
	return x !== x;
};

},{}],8:[function(require,module,exports){
// Generated by Babel
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.encode = encode;
/* global: window */

var _window = window;
var btoa = _window.btoa;
function encode(data) {
  return btoa(unescape(encodeURIComponent(data)));
}

var isSupported = exports.isSupported = "btoa" in window;
},{}],9:[function(require,module,exports){
// Generated by Babel
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.newRequest = newRequest;
exports.resolveUrl = resolveUrl;

var _resolveUrl = require("resolve-url");

var _resolveUrl2 = _interopRequireDefault(_resolveUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function newRequest() {
  return new window.XMLHttpRequest();
} /* global window */


function resolveUrl(origin, link) {
  return (0, _resolveUrl2.default)(origin, link);
}
},{"resolve-url":17}],10:[function(require,module,exports){
// Generated by Babel
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getSource = getSource;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var FileSource = function () {
  function FileSource(file) {
    _classCallCheck(this, FileSource);

    this._file = file;
    this.size = file.size;
  }

  _createClass(FileSource, [{
    key: "slice",
    value: function slice(start, end) {
      return this._file.slice(start, end);
    }
  }, {
    key: "close",
    value: function close() {}
  }]);

  return FileSource;
}();

function getSource(input) {
  // Since we emulate the Blob type in our tests (not all target browsers
  // support it), we cannot use `instanceof` for testing whether the input value
  // can be handled. Instead, we simply check is the slice() function and the
  // size property are available.
  if (typeof input.slice === "function" && typeof input.size !== "undefined") {
    return new FileSource(input);
  }

  throw new Error("source object may only be an instance of File or Blob in this environment");
}
},{}],11:[function(require,module,exports){
// Generated by Babel
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setItem = setItem;
exports.getItem = getItem;
exports.removeItem = removeItem;
/* global window, localStorage */

var hasStorage = false;
try {
  hasStorage = "localStorage" in window;
  // Attempt to access localStorage
  localStorage.length;
} catch (e) {
  // If we try to access localStorage inside a sandboxed iframe, a SecurityError
  // is thrown.
  if (e.code === e.SECURITY_ERR) {
    hasStorage = false;
  } else {
    throw e;
  }
}

var canStoreURLs = exports.canStoreURLs = hasStorage;

function setItem(key, value) {
  if (!hasStorage) return;
  return localStorage.setItem(key, value);
}

function getItem(key) {
  if (!hasStorage) return;
  return localStorage.getItem(key);
}

function removeItem(key) {
  if (!hasStorage) return;
  return localStorage.removeItem(key);
}
},{}],12:[function(require,module,exports){
// Generated by Babel
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DetailedError = function (_Error) {
  _inherits(DetailedError, _Error);

  function DetailedError(error) {
    var causingErr = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];
    var xhr = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

    _classCallCheck(this, DetailedError);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(DetailedError).call(this, error.message));

    _this.originalRequest = xhr;
    _this.causingError = causingErr;

    var message = error.message;
    if (causingErr != null) {
      message += ", caused by " + causingErr.toString();
    }
    if (xhr != null) {
      message += ", originated from request (response code: " + xhr.status + ", response text: " + xhr.responseText + ")";
    }
    _this.message = message;
    return _this;
  }

  return DetailedError;
}(Error);

exports.default = DetailedError;
},{}],13:[function(require,module,exports){
// Generated by Babel
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = fingerprint;
/**
 * Generate a fingerprint for a file which will be used the store the endpoint
 *
 * @param {File} file
 * @return {String}
 */
function fingerprint(file) {
  return ["tus", file.name, file.type, file.size, file.lastModified].join("-");
}
},{}],14:[function(require,module,exports){
// Generated by Babel
"use strict";

var _upload = require("./upload");

var _upload2 = _interopRequireDefault(_upload);

var _storage = require("./node/storage");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* global window */
var defaultOptions = _upload2.default.defaultOptions;


if (typeof window !== "undefined") {
  // Browser environment using XMLHttpRequest
  var _window = window;
  var XMLHttpRequest = _window.XMLHttpRequest;
  var Blob = _window.Blob;


  var isSupported = XMLHttpRequest && Blob && typeof Blob.prototype.slice === "function";
} else {
  // Node.js environment using http module
  var isSupported = true;
}

// The usage of the commonjs exporting syntax instead of the new ECMAScript
// one is actually inteded and prevents weird behaviour if we are trying to
// import this module in another module using Babel.
module.exports = {
  Upload: _upload2.default,
  isSupported: isSupported,
  canStoreURLs: _storage.canStoreURLs,
  defaultOptions: defaultOptions
};
},{"./node/storage":11,"./upload":15}],15:[function(require,module,exports){
// Generated by Babel
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /* global window */


// We import the files used inside the Node environment which are rewritten
// for browsers using the rules defined in the package.json


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fingerprint = require("./fingerprint");

var _fingerprint2 = _interopRequireDefault(_fingerprint);

var _error = require("./error");

var _error2 = _interopRequireDefault(_error);

var _extend = require("extend");

var _extend2 = _interopRequireDefault(_extend);

var _request = require("./node/request");

var _source = require("./node/source");

var _base = require("./node/base64");

var Base64 = _interopRequireWildcard(_base);

var _storage = require("./node/storage");

var Storage = _interopRequireWildcard(_storage);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var defaultOptions = {
  endpoint: "",
  fingerprint: _fingerprint2.default,
  resume: true,
  onProgress: null,
  onChunkComplete: null,
  onSuccess: null,
  onError: null,
  headers: {},
  chunkSize: Infinity,
  withCredentials: false,
  uploadUrl: null,
  uploadSize: null,
  overridePatchMethod: false,
  retryDelays: null
};

var Upload = function () {
  function Upload(file, options) {
    _classCallCheck(this, Upload);

    this.options = (0, _extend2.default)(true, {}, defaultOptions, options);

    // The underlying File/Blob object
    this.file = file;

    // The URL against which the file will be uploaded
    this.url = null;

    // The underlying XHR object for the current PATCH request
    this._xhr = null;

    // The fingerpinrt for the current file (set after start())
    this._fingerprint = null;

    // The offset used in the current PATCH request
    this._offset = null;

    // True if the current PATCH request has been aborted
    this._aborted = false;

    // The file's size in bytes
    this._size = null;

    // The Source object which will wrap around the given file and provides us
    // with a unified interface for getting its size and slice chunks from its
    // content allowing us to easily handle Files, Blobs, Buffers and Streams.
    this._source = null;

    // The current count of attempts which have been made. Null indicates none.
    this._retryAttempt = 0;

    // The timeout's ID which is used to delay the next retry
    this._retryTimeout = null;

    // The offset of the remote upload before the latest attempt was started.
    this._offsetBeforeRetry = 0;
  }

  _createClass(Upload, [{
    key: "start",
    value: function start() {
      var _this = this;

      var file = this.file;

      if (!file) {
        this._emitError(new Error("tus: no file or stream to upload provided"));
        return;
      }

      if (!this.options.endpoint) {
        this._emitError(new Error("tus: no endpoint provided"));
        return;
      }

      var source = this._source = (0, _source.getSource)(file, this.options.chunkSize);

      // Firstly, check if the caller has supplied a manual upload size or else
      // we will use the calculated size by the source object.
      if (this.options.uploadSize != null) {
        var size = +this.options.uploadSize;
        if (isNaN(size)) {
          throw new Error("tus: cannot convert `uploadSize` option into a number");
        }

        this._size = size;
      } else {
        var size = source.size;

        // The size property will be null if we cannot calculate the file's size,
        // for example if you handle a stream.
        if (size == null) {
          throw new Error("tus: cannot automatically derive upload's size from input and must be specified manually using the `uploadSize` option");
        }

        this._size = size;
      }

      var retryDelays = this.options.retryDelays;
      if (retryDelays != null) {
        if (Object.prototype.toString.call(retryDelays) !== "[object Array]") {
          throw new Error("tus: the `retryDelays` option must either be an array or null");
        } else {
          (function () {
            var errorCallback = _this.options.onError;
            _this.options.onError = function (err) {
              // Restore the original error callback which may have been set.
              _this.options.onError = errorCallback;

              // We will reset the attempt counter if
              // - we were already able to connect to the server (offset != null) and
              // - we were able to upload a small chunk of data to the server
              var shouldResetDelays = _this._offset != null && _this._offset > _this._offsetBeforeRetry;
              if (shouldResetDelays) {
                _this._retryAttempt = 0;
              }

              var isOnline = true;
              if (typeof window !== "undefined" && "navigator" in window && window.navigator.onLine === false) {
                isOnline = false;
              }

              // We only attempt a retry if
              // - we didn't exceed the maxium number of retries, yet, and
              // - this error was caused by a request or it's response and
              // - the browser does not indicate that we are offline
              var shouldRetry = _this._retryAttempt < retryDelays.length && err.originalRequest != null && isOnline;

              if (!shouldRetry) {
                _this._emitError(err);
                return;
              }

              var delay = retryDelays[_this._retryAttempt++];

              _this._offsetBeforeRetry = _this._offset;
              _this.options.uploadUrl = _this.url;

              _this._retryTimeout = setTimeout(function () {
                _this.start();
              }, delay);
            };
          })();
        }
      }

      // A URL has manually been specified, so we try to resume
      if (this.options.uploadUrl != null) {
        this.url = this.options.uploadUrl;
        this._resumeUpload();
        return;
      }

      // Try to find the endpoint for the file in the storage
      if (this.options.resume) {
        this._fingerprint = this.options.fingerprint(file);
        var resumedUrl = Storage.getItem(this._fingerprint);

        if (resumedUrl != null) {
          this.url = resumedUrl;
          this._resumeUpload();
          return;
        }
      }

      // An upload has not started for the file yet, so we start a new one
      this._createUpload();
    }
  }, {
    key: "abort",
    value: function abort() {
      if (this._xhr !== null) {
        this._xhr.abort();
        this._source.close();
        this._aborted = true;
      }

      if (this._retryTimeout != null) {
        clearTimeout(this._retryTimeout);
        this._retryTimeout = null;
      }
    }
  }, {
    key: "_emitXhrError",
    value: function _emitXhrError(xhr, err, causingErr) {
      this._emitError(new _error2.default(err, causingErr, xhr));
    }
  }, {
    key: "_emitError",
    value: function _emitError(err) {
      if (typeof this.options.onError === "function") {
        this.options.onError(err);
      } else {
        throw err;
      }
    }
  }, {
    key: "_emitSuccess",
    value: function _emitSuccess() {
      if (typeof this.options.onSuccess === "function") {
        this.options.onSuccess();
      }
    }

    /**
     * Publishes notification when data has been sent to the server. This
     * data may not have been accepted by the server yet.
     * @param  {number} bytesSent  Number of bytes sent to the server.
     * @param  {number} bytesTotal Total number of bytes to be sent to the server.
     */

  }, {
    key: "_emitProgress",
    value: function _emitProgress(bytesSent, bytesTotal) {
      if (typeof this.options.onProgress === "function") {
        this.options.onProgress(bytesSent, bytesTotal);
      }
    }

    /**
     * Publishes notification when a chunk of data has been sent to the server
     * and accepted by the server.
     * @param  {number} chunkSize  Size of the chunk that was accepted by the
     *                             server.
     * @param  {number} bytesAccepted Total number of bytes that have been
     *                                accepted by the server.
     * @param  {number} bytesTotal Total number of bytes to be sent to the server.
     */

  }, {
    key: "_emitChunkComplete",
    value: function _emitChunkComplete(chunkSize, bytesAccepted, bytesTotal) {
      if (typeof this.options.onChunkComplete === "function") {
        this.options.onChunkComplete(chunkSize, bytesAccepted, bytesTotal);
      }
    }

    /**
     * Set the headers used in the request and the withCredentials property
     * as defined in the options
     *
     * @param {XMLHttpRequest} xhr
     */

  }, {
    key: "_setupXHR",
    value: function _setupXHR(xhr) {
      xhr.setRequestHeader("Tus-Resumable", "1.0.0");
      var headers = this.options.headers;

      for (var name in headers) {
        xhr.setRequestHeader(name, headers[name]);
      }

      xhr.withCredentials = this.options.withCredentials;
    }

    /**
     * Create a new upload using the creation extension by sending a POST
     * request to the endpoint. After successful creation the file will be
     * uploaded
     *
     * @api private
     */

  }, {
    key: "_createUpload",
    value: function _createUpload() {
      var _this2 = this;

      var xhr = (0, _request.newRequest)();
      xhr.open("POST", this.options.endpoint, true);

      xhr.onload = function () {
        if (!(xhr.status >= 200 && xhr.status < 300)) {
          _this2._emitXhrError(xhr, new Error("tus: unexpected response while creating upload"));
          return;
        }

        _this2.url = (0, _request.resolveUrl)(_this2.options.endpoint, xhr.getResponseHeader("Location"));

        if (_this2.options.resume) {
          Storage.setItem(_this2._fingerprint, _this2.url);
        }

        _this2._offset = 0;
        _this2._startUpload();
      };

      xhr.onerror = function (err) {
        _this2._emitXhrError(xhr, new Error("tus: failed to create upload"), err);
      };

      this._setupXHR(xhr);
      xhr.setRequestHeader("Upload-Length", this._size);

      // Add metadata if values have been added
      var metadata = encodeMetadata(this.options.metadata);
      if (metadata !== "") {
        xhr.setRequestHeader("Upload-Metadata", metadata);
      }

      xhr.send(null);
    }

    /*
     * Try to resume an existing upload. First a HEAD request will be sent
     * to retrieve the offset. If the request fails a new upload will be
     * created. In the case of a successful response the file will be uploaded.
     *
     * @api private
     */

  }, {
    key: "_resumeUpload",
    value: function _resumeUpload() {
      var _this3 = this;

      var xhr = (0, _request.newRequest)();
      xhr.open("HEAD", this.url, true);

      xhr.onload = function () {
        if (!(xhr.status >= 200 && xhr.status < 300)) {
          if (_this3.options.resume) {
            // Remove stored fingerprint and corresponding endpoint,
            // since the file can not be found
            Storage.removeItem(_this3._fingerprint);
          }

          // Try to create a new upload
          _this3.url = null;
          _this3._createUpload();
          return;
        }

        var offset = parseInt(xhr.getResponseHeader("Upload-Offset"), 10);
        if (isNaN(offset)) {
          _this3._emitXhrError(xhr, new Error("tus: invalid or missing offset value"));
          return;
        }

        var length = parseInt(xhr.getResponseHeader("Upload-Length"), 10);
        if (isNaN(length)) {
          _this3._emitXhrError(xhr, new Error("tus: invalid or missing length value"));
          return;
        }

        // Upload has already been completed and we do not need to send additional
        // data to the server
        if (offset === length) {
          _this3._emitProgress(length, length);
          _this3._emitSuccess();
          return;
        }

        _this3._offset = offset;
        _this3._startUpload();
      };

      xhr.onerror = function (err) {
        _this3._emitXhrError(xhr, new Error("tus: failed to resume upload"), err);
      };

      this._setupXHR(xhr);
      xhr.send(null);
    }

    /**
     * Start uploading the file using PATCH requests. The file will be divided
     * into chunks as specified in the chunkSize option. During the upload
     * the onProgress event handler may be invoked multiple times.
     *
     * @api private
     */

  }, {
    key: "_startUpload",
    value: function _startUpload() {
      var _this4 = this;

      var xhr = this._xhr = (0, _request.newRequest)();

      // Some browser and servers may not support the PATCH method. For those
      // cases, you can tell tus-js-client to use a POST request with the
      // X-HTTP-Method-Override header for simulating a PATCH request.
      if (this.options.overridePatchMethod) {
        xhr.open("POST", this.url, true);
        xhr.setRequestHeader("X-HTTP-Method-Override", "PATCH");
      } else {
        xhr.open("PATCH", this.url, true);
      }

      xhr.onload = function () {
        if (!(xhr.status >= 200 && xhr.status < 300)) {
          _this4._emitXhrError(xhr, new Error("tus: unexpected response while uploading chunk"));
          return;
        }

        var offset = parseInt(xhr.getResponseHeader("Upload-Offset"), 10);
        if (isNaN(offset)) {
          _this4._emitXhrError(xhr, new Error("tus: invalid or missing offset value"));
          return;
        }

        _this4._emitProgress(offset, _this4._size);
        _this4._emitChunkComplete(offset - _this4._offset, offset, _this4._size);

        _this4._offset = offset;

        if (offset == _this4._size) {
          // Yay, finally done :)
          _this4._emitSuccess();
          _this4._source.close();
          return;
        }

        _this4._startUpload();
      };

      xhr.onerror = function (err) {
        // Don't emit an error if the upload was aborted manually
        if (_this4._aborted) {
          return;
        }

        _this4._emitXhrError(xhr, new Error("tus: failed to upload chunk at offset " + _this4._offset), err);
      };

      // Test support for progress events before attaching an event listener
      if ("upload" in xhr) {
        xhr.upload.onprogress = function (e) {
          if (!e.lengthComputable) {
            return;
          }

          _this4._emitProgress(start + e.loaded, _this4._size);
        };
      }

      this._setupXHR(xhr);

      xhr.setRequestHeader("Upload-Offset", this._offset);
      xhr.setRequestHeader("Content-Type", "application/offset+octet-stream");

      var start = this._offset;
      var end = this._offset + this.options.chunkSize;

      // The specified chunkSize may be Infinity or the calcluated end position
      // may exceed the file's size. In both cases, we limit the end position to
      // the input's total size for simpler calculations and correctness.
      if (end === Infinity || end > this._size) {
        end = this._size;
      }

      xhr.send(this._source.slice(start, end));
    }
  }]);

  return Upload;
}();

function encodeMetadata(metadata) {
  if (!Base64.isSupported) {
    return "";
  }

  var encoded = [];

  for (var key in metadata) {
    encoded.push(key + " " + Base64.encode(metadata[key]));
  }

  return encoded.join(",");
}

Upload.defaultOptions = defaultOptions;

exports.default = Upload;
},{"./error":12,"./fingerprint":13,"./node/base64":8,"./node/request":9,"./node/source":10,"./node/storage":11,"extend":16}],16:[function(require,module,exports){
'use strict';

var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;

var isArray = function isArray(arr) {
	if (typeof Array.isArray === 'function') {
		return Array.isArray(arr);
	}

	return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
	if (!obj || toStr.call(obj) !== '[object Object]') {
		return false;
	}

	var hasOwnConstructor = hasOwn.call(obj, 'constructor');
	var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {/**/}

	return typeof key === 'undefined' || hasOwn.call(obj, key);
};

module.exports = function extend() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target !== copy) {
					// Recurse if we're merging plain objects or arrays
					if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
						if (copyIsArray) {
							copyIsArray = false;
							clone = src && isArray(src) ? src : [];
						} else {
							clone = src && isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[name] = extend(deep, clone, copy);

					// Don't bring in undefined values
					} else if (typeof copy !== 'undefined') {
						target[name] = copy;
					}
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],17:[function(require,module,exports){
// Copyright 2014 Simon Lydell
// X11 (“MIT”) Licensed. (See LICENSE.)

void (function(root, factory) {
  if (typeof define === "function" && define.amd) {
    define(factory)
  } else if (typeof exports === "object") {
    module.exports = factory()
  } else {
    root.resolveUrl = factory()
  }
}(this, function() {

  function resolveUrl(/* ...urls */) {
    var numUrls = arguments.length

    if (numUrls === 0) {
      throw new Error("resolveUrl requires at least one argument; got none.")
    }

    var base = document.createElement("base")
    base.href = arguments[0]

    if (numUrls === 1) {
      return base.href
    }

    var head = document.getElementsByTagName("head")[0]
    head.insertBefore(base, head.firstChild)

    var a = document.createElement("a")
    var resolved

    for (var index = 1; index < numUrls; index++) {
      a.href = arguments[index]
      resolved = a.href
      base.href = resolved
    }

    head.removeChild(base)

    return resolved
  }

  return resolveUrl

}));

},{}],18:[function(require,module,exports){
(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob()
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift()
        return {done: value === undefined, value: value}
      }
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)

    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var list = this.map[name]
    if (!list) {
      list = []
      this.map[name] = list
    }
    list.push(value)
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    var values = this.map[normalizeName(name)]
    return values ? values[0] : null
  }

  Headers.prototype.getAll = function(name) {
    return this.map[normalizeName(name)] || []
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = [normalizeValue(value)]
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    Object.getOwnPropertyNames(this.map).forEach(function(name) {
      this.map[name].forEach(function(value) {
        callback.call(thisArg, value, name, this)
      }, this)
    }, this)
  }

  Headers.prototype.keys = function() {
    var items = []
    this.forEach(function(value, name) { items.push(name) })
    return iteratorFor(items)
  }

  Headers.prototype.values = function() {
    var items = []
    this.forEach(function(value) { items.push(value) })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function() {
    var items = []
    this.forEach(function(value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    reader.readAsArrayBuffer(blob)
    return fileReaderReady(reader)
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    reader.readAsText(blob)
    return fileReaderReady(reader)
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function(body) {
      this._bodyInit = body
      if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (!body) {
        this._bodyText = ''
      } else if (support.arrayBuffer && ArrayBuffer.prototype.isPrototypeOf(body)) {
        // Only support ArrayBuffers for POST method.
        // Receiving ArrayBuffers happens via Blobs, instead.
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        return this.blob().then(readBlobAsArrayBuffer)
      }

      this.text = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return readBlobAsText(this._bodyBlob)
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as text')
        } else {
          return Promise.resolve(this._bodyText)
        }
      }
    } else {
      this.text = function() {
        var rejected = consumed(this)
        return rejected ? rejected : Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body
    if (Request.prototype.isPrototypeOf(input)) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = input
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this)
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function headers(xhr) {
    var head = new Headers()
    var pairs = (xhr.getAllResponseHeaders() || '').trim().split('\n')
    pairs.forEach(function(header) {
      var split = header.trim().split(':')
      var key = split.shift().trim()
      var value = split.join(':').trim()
      head.append(key, value)
    })
    return head
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = options.status
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = options.statusText
    this.headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers
  self.Request = Request
  self.Response = Response

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request
      if (Request.prototype.isPrototypeOf(input) && !init) {
        request = input
      } else {
        request = new Request(input, init)
      }

      var xhr = new XMLHttpRequest()

      function responseURL() {
        if ('responseURL' in xhr) {
          return xhr.responseURL
        }

        // Avoid security warnings on getResponseHeader when not allowed by CORS
        if (/^X-Request-URL:/m.test(xhr.getAllResponseHeaders())) {
          return xhr.getResponseHeader('X-Request-URL')
        }

        return
      }

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: headers(xhr),
          url: responseURL()
        }
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);

},{}],19:[function(require,module,exports){
var bel = require('bel') // turns template tag into DOM elements
var morphdom = require('morphdom') // efficiently diffs + morphs two DOM elements
var defaultEvents = require('./update-events.js') // default events to be copied when dom elements update

module.exports = bel

// TODO move this + defaultEvents to a new module once we receive more feedback
module.exports.update = function (fromNode, toNode, opts) {
  if (!opts) opts = {}
  if (opts.events !== false) {
    if (!opts.onBeforeElUpdated) opts.onBeforeElUpdated = copier
  }

  return morphdom(fromNode, toNode, opts)

  // morphdom only copies attributes. we decided we also wanted to copy events
  // that can be set via attributes
  function copier (f, t) {
    // copy events:
    var events = opts.events || defaultEvents
    for (var i = 0; i < events.length; i++) {
      var ev = events[i]
      if (t[ev]) { // if new element has a whitelisted attribute
        f[ev] = t[ev] // update existing element
      } else if (f[ev]) { // if existing element has it and new one doesnt
        f[ev] = undefined // remove it from existing element
      }
    }
    // copy values for form elements
    if ((f.nodeName === 'INPUT' && f.type !== 'file') || f.nodeName === 'SELECT') {
      if (t.getAttribute('value') === null) t.value = f.value
    } else if (f.nodeName === 'TEXTAREA') {
      if (t.getAttribute('value') === null) f.value = t.value
    }
  }
}

},{"./update-events.js":27,"bel":20,"morphdom":26}],20:[function(require,module,exports){
var document = require('global/document')
var hyperx = require('hyperx')
var onload = require('on-load')

var SVGNS = 'http://www.w3.org/2000/svg'
var XLINKNS = 'http://www.w3.org/1999/xlink'

var BOOL_PROPS = {
  autofocus: 1,
  checked: 1,
  defaultchecked: 1,
  disabled: 1,
  formnovalidate: 1,
  indeterminate: 1,
  readonly: 1,
  required: 1,
  selected: 1,
  willvalidate: 1
}
var SVG_TAGS = [
  'svg',
  'altGlyph', 'altGlyphDef', 'altGlyphItem', 'animate', 'animateColor',
  'animateMotion', 'animateTransform', 'circle', 'clipPath', 'color-profile',
  'cursor', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix',
  'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting',
  'feDisplacementMap', 'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB',
  'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode',
  'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting',
  'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'font', 'font-face',
  'font-face-format', 'font-face-name', 'font-face-src', 'font-face-uri',
  'foreignObject', 'g', 'glyph', 'glyphRef', 'hkern', 'image', 'line',
  'linearGradient', 'marker', 'mask', 'metadata', 'missing-glyph', 'mpath',
  'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect',
  'set', 'stop', 'switch', 'symbol', 'text', 'textPath', 'title', 'tref',
  'tspan', 'use', 'view', 'vkern'
]

function belCreateElement (tag, props, children) {
  var el

  // If an svg tag, it needs a namespace
  if (SVG_TAGS.indexOf(tag) !== -1) {
    props.namespace = SVGNS
  }

  // If we are using a namespace
  var ns = false
  if (props.namespace) {
    ns = props.namespace
    delete props.namespace
  }

  // Create the element
  if (ns) {
    el = document.createElementNS(ns, tag)
  } else {
    el = document.createElement(tag)
  }

  // If adding onload events
  if (props.onload || props.onunload) {
    var load = props.onload || function () {}
    var unload = props.onunload || function () {}
    onload(el, function belOnload () {
      load(el)
    }, function belOnunload () {
      unload(el)
    },
    // We have to use non-standard `caller` to find who invokes `belCreateElement`
    belCreateElement.caller.caller.caller)
    delete props.onload
    delete props.onunload
  }

  // Create the properties
  for (var p in props) {
    if (props.hasOwnProperty(p)) {
      var key = p.toLowerCase()
      var val = props[p]
      // Normalize className
      if (key === 'classname') {
        key = 'class'
        p = 'class'
      }
      // The for attribute gets transformed to htmlFor, but we just set as for
      if (p === 'htmlFor') {
        p = 'for'
      }
      // If a property is boolean, set itself to the key
      if (BOOL_PROPS[key]) {
        if (val === 'true') val = key
        else if (val === 'false') continue
      }
      // If a property prefers being set directly vs setAttribute
      if (key.slice(0, 2) === 'on') {
        el[p] = val
      } else {
        if (ns) {
          if (p === 'xlink:href') {
            el.setAttributeNS(XLINKNS, p, val)
          } else {
            el.setAttributeNS(null, p, val)
          }
        } else {
          el.setAttribute(p, val)
        }
      }
    }
  }

  function appendChild (childs) {
    if (!Array.isArray(childs)) return
    for (var i = 0; i < childs.length; i++) {
      var node = childs[i]
      if (Array.isArray(node)) {
        appendChild(node)
        continue
      }

      if (typeof node === 'number' ||
        typeof node === 'boolean' ||
        node instanceof Date ||
        node instanceof RegExp) {
        node = node.toString()
      }

      if (typeof node === 'string') {
        if (el.lastChild && el.lastChild.nodeName === '#text') {
          el.lastChild.nodeValue += node
          continue
        }
        node = document.createTextNode(node)
      }

      if (node && node.nodeType) {
        el.appendChild(node)
      }
    }
  }
  appendChild(children)

  return el
}

module.exports = hyperx(belCreateElement)
module.exports.createElement = belCreateElement

},{"global/document":21,"hyperx":23,"on-load":25}],21:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"min-document":67}],22:[function(require,module,exports){
(function (global){
if (typeof window !== "undefined") {
    module.exports = window;
} else if (typeof global !== "undefined") {
    module.exports = global;
} else if (typeof self !== "undefined"){
    module.exports = self;
} else {
    module.exports = {};
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],23:[function(require,module,exports){
var attrToProp = require('hyperscript-attribute-to-property')

var VAR = 0, TEXT = 1, OPEN = 2, CLOSE = 3, ATTR = 4
var ATTR_KEY = 5, ATTR_KEY_W = 6
var ATTR_VALUE_W = 7, ATTR_VALUE = 8
var ATTR_VALUE_SQ = 9, ATTR_VALUE_DQ = 10
var ATTR_EQ = 11, ATTR_BREAK = 12

module.exports = function (h, opts) {
  h = attrToProp(h)
  if (!opts) opts = {}
  var concat = opts.concat || function (a, b) {
    return String(a) + String(b)
  }

  return function (strings) {
    var state = TEXT, reg = ''
    var arglen = arguments.length
    var parts = []

    for (var i = 0; i < strings.length; i++) {
      if (i < arglen - 1) {
        var arg = arguments[i+1]
        var p = parse(strings[i])
        var xstate = state
        if (xstate === ATTR_VALUE_DQ) xstate = ATTR_VALUE
        if (xstate === ATTR_VALUE_SQ) xstate = ATTR_VALUE
        if (xstate === ATTR_VALUE_W) xstate = ATTR_VALUE
        if (xstate === ATTR) xstate = ATTR_KEY
        p.push([ VAR, xstate, arg ])
        parts.push.apply(parts, p)
      } else parts.push.apply(parts, parse(strings[i]))
    }

    var tree = [null,{},[]]
    var stack = [[tree,-1]]
    for (var i = 0; i < parts.length; i++) {
      var cur = stack[stack.length-1][0]
      var p = parts[i], s = p[0]
      if (s === OPEN && /^\//.test(p[1])) {
        var ix = stack[stack.length-1][1]
        if (stack.length > 1) {
          stack.pop()
          stack[stack.length-1][0][2][ix] = h(
            cur[0], cur[1], cur[2].length ? cur[2] : undefined
          )
        }
      } else if (s === OPEN) {
        var c = [p[1],{},[]]
        cur[2].push(c)
        stack.push([c,cur[2].length-1])
      } else if (s === ATTR_KEY || (s === VAR && p[1] === ATTR_KEY)) {
        var key = ''
        var copyKey
        for (; i < parts.length; i++) {
          if (parts[i][0] === ATTR_KEY) {
            key = concat(key, parts[i][1])
          } else if (parts[i][0] === VAR && parts[i][1] === ATTR_KEY) {
            if (typeof parts[i][2] === 'object' && !key) {
              for (copyKey in parts[i][2]) {
                if (parts[i][2].hasOwnProperty(copyKey) && !cur[1][copyKey]) {
                  cur[1][copyKey] = parts[i][2][copyKey]
                }
              }
            } else {
              key = concat(key, parts[i][2])
            }
          } else break
        }
        if (parts[i][0] === ATTR_EQ) i++
        var j = i
        for (; i < parts.length; i++) {
          if (parts[i][0] === ATTR_VALUE || parts[i][0] === ATTR_KEY) {
            if (!cur[1][key]) cur[1][key] = strfn(parts[i][1])
            else cur[1][key] = concat(cur[1][key], parts[i][1])
          } else if (parts[i][0] === VAR
          && (parts[i][1] === ATTR_VALUE || parts[i][1] === ATTR_KEY)) {
            if (!cur[1][key]) cur[1][key] = strfn(parts[i][2])
            else cur[1][key] = concat(cur[1][key], parts[i][2])
          } else {
            if (key.length && !cur[1][key] && i === j
            && (parts[i][0] === CLOSE || parts[i][0] === ATTR_BREAK)) {
              // https://html.spec.whatwg.org/multipage/infrastructure.html#boolean-attributes
              // empty string is falsy, not well behaved value in browser
              cur[1][key] = key.toLowerCase()
            }
            break
          }
        }
      } else if (s === ATTR_KEY) {
        cur[1][p[1]] = true
      } else if (s === VAR && p[1] === ATTR_KEY) {
        cur[1][p[2]] = true
      } else if (s === CLOSE) {
        if (selfClosing(cur[0]) && stack.length) {
          var ix = stack[stack.length-1][1]
          stack.pop()
          stack[stack.length-1][0][2][ix] = h(
            cur[0], cur[1], cur[2].length ? cur[2] : undefined
          )
        }
      } else if (s === VAR && p[1] === TEXT) {
        if (p[2] === undefined || p[2] === null) p[2] = ''
        else if (!p[2]) p[2] = concat('', p[2])
        if (Array.isArray(p[2][0])) {
          cur[2].push.apply(cur[2], p[2])
        } else {
          cur[2].push(p[2])
        }
      } else if (s === TEXT) {
        cur[2].push(p[1])
      } else if (s === ATTR_EQ || s === ATTR_BREAK) {
        // no-op
      } else {
        throw new Error('unhandled: ' + s)
      }
    }

    if (tree[2].length > 1 && /^\s*$/.test(tree[2][0])) {
      tree[2].shift()
    }

    if (tree[2].length > 2
    || (tree[2].length === 2 && /\S/.test(tree[2][1]))) {
      throw new Error(
        'multiple root elements must be wrapped in an enclosing tag'
      )
    }
    if (Array.isArray(tree[2][0]) && typeof tree[2][0][0] === 'string'
    && Array.isArray(tree[2][0][2])) {
      tree[2][0] = h(tree[2][0][0], tree[2][0][1], tree[2][0][2])
    }
    return tree[2][0]

    function parse (str) {
      var res = []
      if (state === ATTR_VALUE_W) state = ATTR
      for (var i = 0; i < str.length; i++) {
        var c = str.charAt(i)
        if (state === TEXT && c === '<') {
          if (reg.length) res.push([TEXT, reg])
          reg = ''
          state = OPEN
        } else if (c === '>' && !quot(state)) {
          if (state === OPEN) {
            res.push([OPEN,reg])
          } else if (state === ATTR_KEY) {
            res.push([ATTR_KEY,reg])
          } else if (state === ATTR_VALUE && reg.length) {
            res.push([ATTR_VALUE,reg])
          }
          res.push([CLOSE])
          reg = ''
          state = TEXT
        } else if (state === TEXT) {
          reg += c
        } else if (state === OPEN && /\s/.test(c)) {
          res.push([OPEN, reg])
          reg = ''
          state = ATTR
        } else if (state === OPEN) {
          reg += c
        } else if (state === ATTR && /[\w-]/.test(c)) {
          state = ATTR_KEY
          reg = c
        } else if (state === ATTR && /\s/.test(c)) {
          if (reg.length) res.push([ATTR_KEY,reg])
          res.push([ATTR_BREAK])
        } else if (state === ATTR_KEY && /\s/.test(c)) {
          res.push([ATTR_KEY,reg])
          reg = ''
          state = ATTR_KEY_W
        } else if (state === ATTR_KEY && c === '=') {
          res.push([ATTR_KEY,reg],[ATTR_EQ])
          reg = ''
          state = ATTR_VALUE_W
        } else if (state === ATTR_KEY) {
          reg += c
        } else if ((state === ATTR_KEY_W || state === ATTR) && c === '=') {
          res.push([ATTR_EQ])
          state = ATTR_VALUE_W
        } else if ((state === ATTR_KEY_W || state === ATTR) && !/\s/.test(c)) {
          res.push([ATTR_BREAK])
          if (/[\w-]/.test(c)) {
            reg += c
            state = ATTR_KEY
          } else state = ATTR
        } else if (state === ATTR_VALUE_W && c === '"') {
          state = ATTR_VALUE_DQ
        } else if (state === ATTR_VALUE_W && c === "'") {
          state = ATTR_VALUE_SQ
        } else if (state === ATTR_VALUE_DQ && c === '"') {
          res.push([ATTR_VALUE,reg],[ATTR_BREAK])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE_SQ && c === "'") {
          res.push([ATTR_VALUE,reg],[ATTR_BREAK])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE_W && !/\s/.test(c)) {
          state = ATTR_VALUE
          i--
        } else if (state === ATTR_VALUE && /\s/.test(c)) {
          res.push([ATTR_VALUE,reg],[ATTR_BREAK])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE || state === ATTR_VALUE_SQ
        || state === ATTR_VALUE_DQ) {
          reg += c
        }
      }
      if (state === TEXT && reg.length) {
        res.push([TEXT,reg])
        reg = ''
      } else if (state === ATTR_VALUE && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_VALUE_DQ && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_VALUE_SQ && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_KEY) {
        res.push([ATTR_KEY,reg])
        reg = ''
      }
      return res
    }
  }

  function strfn (x) {
    if (typeof x === 'function') return x
    else if (typeof x === 'string') return x
    else if (x && typeof x === 'object') return x
    else return concat('', x)
  }
}

function quot (state) {
  return state === ATTR_VALUE_SQ || state === ATTR_VALUE_DQ
}

var hasOwn = Object.prototype.hasOwnProperty
function has (obj, key) { return hasOwn.call(obj, key) }

var closeRE = RegExp('^(' + [
  'area', 'base', 'basefont', 'bgsound', 'br', 'col', 'command', 'embed',
  'frame', 'hr', 'img', 'input', 'isindex', 'keygen', 'link', 'meta', 'param',
  'source', 'track', 'wbr',
  // SVG TAGS
  'animate', 'animateTransform', 'circle', 'cursor', 'desc', 'ellipse',
  'feBlend', 'feColorMatrix', 'feComposite',
  'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap',
  'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR',
  'feGaussianBlur', 'feImage', 'feMergeNode', 'feMorphology',
  'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile',
  'feTurbulence', 'font-face-format', 'font-face-name', 'font-face-uri',
  'glyph', 'glyphRef', 'hkern', 'image', 'line', 'missing-glyph', 'mpath',
  'path', 'polygon', 'polyline', 'rect', 'set', 'stop', 'tref', 'use', 'view',
  'vkern'
].join('|') + ')(?:[\.#][a-zA-Z0-9\u007F-\uFFFF_:-]+)*$')
function selfClosing (tag) { return closeRE.test(tag) }

},{"hyperscript-attribute-to-property":24}],24:[function(require,module,exports){
module.exports = attributeToProperty

var transform = {
  'class': 'className',
  'for': 'htmlFor',
  'http-equiv': 'httpEquiv'
}

function attributeToProperty (h) {
  return function (tagName, attrs, children) {
    for (var attr in attrs) {
      if (attr in transform) {
        attrs[transform[attr]] = attrs[attr]
        delete attrs[attr]
      }
    }
    return h(tagName, attrs, children)
  }
}

},{}],25:[function(require,module,exports){
/* global MutationObserver */
var document = require('global/document')
var window = require('global/window')
var watch = Object.create(null)
var KEY_ID = 'onloadid' + (new Date() % 9e6).toString(36)
var KEY_ATTR = 'data-' + KEY_ID
var INDEX = 0

if (window && window.MutationObserver) {
  var observer = new MutationObserver(function (mutations) {
    if (Object.keys(watch).length < 1) return
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === KEY_ATTR) {
        eachAttr(mutations[i], turnon, turnoff)
        continue
      }
      eachMutation(mutations[i].removedNodes, turnoff)
      eachMutation(mutations[i].addedNodes, turnon)
    }
  })
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: [KEY_ATTR]
  })
}

module.exports = function onload (el, on, off, caller) {
  on = on || function () {}
  off = off || function () {}
  el.setAttribute(KEY_ATTR, 'o' + INDEX)
  watch['o' + INDEX] = [on, off, 0, caller || onload.caller]
  INDEX += 1
  return el
}

function turnon (index, el) {
  if (watch[index][0] && watch[index][2] === 0) {
    watch[index][0](el)
    watch[index][2] = 1
  }
}

function turnoff (index, el) {
  if (watch[index][1] && watch[index][2] === 1) {
    watch[index][1](el)
    watch[index][2] = 0
  }
}

function eachAttr (mutation, on, off) {
  var newValue = mutation.target.getAttribute(KEY_ATTR)
  if (sameOrigin(mutation.oldValue, newValue)) {
    watch[newValue] = watch[mutation.oldValue]
    return
  }
  if (watch[mutation.oldValue]) {
    off(mutation.oldValue, mutation.target)
  }
  if (watch[newValue]) {
    on(newValue, mutation.target)
  }
}

function sameOrigin (oldValue, newValue) {
  if (!oldValue || !newValue) return false
  return watch[oldValue][3] === watch[newValue][3]
}

function eachMutation (nodes, fn) {
  var keys = Object.keys(watch)
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i] && nodes[i].getAttribute && nodes[i].getAttribute(KEY_ATTR)) {
      var onloadid = nodes[i].getAttribute(KEY_ATTR)
      keys.forEach(function (k) {
        if (onloadid === k) {
          fn(k, nodes[i])
        }
      })
    }
    if (nodes[i].childNodes.length > 0) {
      eachMutation(nodes[i].childNodes, fn)
    }
  }
}

},{"global/document":21,"global/window":22}],26:[function(require,module,exports){
'use strict';
// Create a range object for efficently rendering strings to elements.
var range;

var doc = typeof document !== 'undefined' && document;

var testEl = doc ?
    doc.body || doc.createElement('div') :
    {};

var NS_XHTML = 'http://www.w3.org/1999/xhtml';

var ELEMENT_NODE = 1;
var TEXT_NODE = 3;
var COMMENT_NODE = 8;

// Fixes <https://github.com/patrick-steele-idem/morphdom/issues/32>
// (IE7+ support) <=IE7 does not support el.hasAttribute(name)
var hasAttributeNS;

if (testEl.hasAttributeNS) {
    hasAttributeNS = function(el, namespaceURI, name) {
        return el.hasAttributeNS(namespaceURI, name);
    };
} else if (testEl.hasAttribute) {
    hasAttributeNS = function(el, namespaceURI, name) {
        return el.hasAttribute(name);
    };
} else {
    hasAttributeNS = function(el, namespaceURI, name) {
        return !!el.getAttributeNode(name);
    };
}

function toElement(str) {
    if (!range && doc.createRange) {
        range = doc.createRange();
        range.selectNode(doc.body);
    }

    var fragment;
    if (range && range.createContextualFragment) {
        fragment = range.createContextualFragment(str);
    } else {
        fragment = doc.createElement('body');
        fragment.innerHTML = str;
    }
    return fragment.childNodes[0];
}

function syncBooleanAttrProp(fromEl, toEl, name) {
    if (fromEl[name] !== toEl[name]) {
        fromEl[name] = toEl[name];
        if (fromEl[name]) {
            fromEl.setAttribute(name, '');
        } else {
            fromEl.removeAttribute(name, '');
        }
    }
}

var specialElHandlers = {
    /**
     * Needed for IE. Apparently IE doesn't think that "selected" is an
     * attribute when reading over the attributes using selectEl.attributes
     */
    OPTION: function(fromEl, toEl) {
        syncBooleanAttrProp(fromEl, toEl, 'selected');
    },
    /**
     * The "value" attribute is special for the <input> element since it sets
     * the initial value. Changing the "value" attribute without changing the
     * "value" property will have no effect since it is only used to the set the
     * initial value.  Similar for the "checked" attribute, and "disabled".
     */
    INPUT: function(fromEl, toEl) {
        syncBooleanAttrProp(fromEl, toEl, 'checked');
        syncBooleanAttrProp(fromEl, toEl, 'disabled');

        if (fromEl.value !== toEl.value) {
            fromEl.value = toEl.value;
        }

        if (!hasAttributeNS(toEl, null, 'value')) {
            fromEl.removeAttribute('value');
        }
    },

    TEXTAREA: function(fromEl, toEl) {
        var newValue = toEl.value;
        if (fromEl.value !== newValue) {
            fromEl.value = newValue;
        }

        if (fromEl.firstChild) {
            fromEl.firstChild.nodeValue = newValue;
        }
    }
};

function noop() {}

/**
 * Returns true if two node's names are the same.
 *
 * NOTE: We don't bother checking `namespaceURI` because you will never find two HTML elements with the same
 *       nodeName and different namespace URIs.
 *
 * @param {Element} a
 * @param {Element} b The target element
 * @return {boolean}
 */
function compareNodeNames(fromEl, toEl) {
    var fromNodeName = fromEl.nodeName;
    var toNodeName = toEl.nodeName;

    if (fromNodeName === toNodeName) {
        return true;
    }

    if (toEl.actualize &&
        fromNodeName.charCodeAt(0) < 91 && /* from tag name is upper case */
        toNodeName.charCodeAt(0) > 90 /* target tag name is lower case */) {
        // If the target element is a virtual DOM node then we may need to normalize the tag name
        // before comparing. Normal HTML elements that are in the "http://www.w3.org/1999/xhtml"
        // are converted to upper case
        return fromNodeName === toNodeName.toUpperCase();
    } else {
        return false;
    }
}

/**
 * Create an element, optionally with a known namespace URI.
 *
 * @param {string} name the element name, e.g. 'div' or 'svg'
 * @param {string} [namespaceURI] the element's namespace URI, i.e. the value of
 * its `xmlns` attribute or its inferred namespace.
 *
 * @return {Element}
 */
function createElementNS(name, namespaceURI) {
    return !namespaceURI || namespaceURI === NS_XHTML ?
        doc.createElement(name) :
        doc.createElementNS(namespaceURI, name);
}

/**
 * Loop over all of the attributes on the target node and make sure the original
 * DOM node has the same attributes. If an attribute found on the original node
 * is not on the new node then remove it from the original node.
 *
 * @param  {Element} fromNode
 * @param  {Element} toNode
 */
function morphAttrs(fromNode, toNode) {
    var attrs = toNode.attributes;
    var i;
    var attr;
    var attrName;
    var attrNamespaceURI;
    var attrValue;
    var fromValue;

    if (toNode.assignAttributes) {
        toNode.assignAttributes(fromNode);
    } else {
        for (i = attrs.length - 1; i >= 0; --i) {
            attr = attrs[i];
            attrName = attr.name;
            attrNamespaceURI = attr.namespaceURI;
            attrValue = attr.value;

            if (attrNamespaceURI) {
                attrName = attr.localName || attrName;
                fromValue = fromNode.getAttributeNS(attrNamespaceURI, attrName);

                if (fromValue !== attrValue) {
                    fromNode.setAttributeNS(attrNamespaceURI, attrName, attrValue);
                }
            } else {
                fromValue = fromNode.getAttribute(attrName);

                if (fromValue !== attrValue) {
                    fromNode.setAttribute(attrName, attrValue);
                }
            }
        }
    }

    // Remove any extra attributes found on the original DOM element that
    // weren't found on the target element.
    attrs = fromNode.attributes;

    for (i = attrs.length - 1; i >= 0; --i) {
        attr = attrs[i];
        if (attr.specified !== false) {
            attrName = attr.name;
            attrNamespaceURI = attr.namespaceURI;

            if (attrNamespaceURI) {
                attrName = attr.localName || attrName;

                if (!hasAttributeNS(toNode, attrNamespaceURI, attrName)) {
                    fromNode.removeAttributeNS(attrNamespaceURI, attrName);
                }
            } else {
                if (!hasAttributeNS(toNode, null, attrName)) {
                    fromNode.removeAttribute(attrName);
                }
            }
        }
    }
}

/**
 * Copies the children of one DOM element to another DOM element
 */
function moveChildren(fromEl, toEl) {
    var curChild = fromEl.firstChild;
    while (curChild) {
        var nextChild = curChild.nextSibling;
        toEl.appendChild(curChild);
        curChild = nextChild;
    }
    return toEl;
}

function defaultGetNodeKey(node) {
    return node.id;
}

function morphdom(fromNode, toNode, options) {
    if (!options) {
        options = {};
    }

    if (typeof toNode === 'string') {
        if (fromNode.nodeName === '#document' || fromNode.nodeName === 'HTML') {
            var toNodeHtml = toNode;
            toNode = doc.createElement('html');
            toNode.innerHTML = toNodeHtml;
        } else {
            toNode = toElement(toNode);
        }
    }

    var getNodeKey = options.getNodeKey || defaultGetNodeKey;
    var onBeforeNodeAdded = options.onBeforeNodeAdded || noop;
    var onNodeAdded = options.onNodeAdded || noop;
    var onBeforeElUpdated = options.onBeforeElUpdated || noop;
    var onElUpdated = options.onElUpdated || noop;
    var onBeforeNodeDiscarded = options.onBeforeNodeDiscarded || noop;
    var onNodeDiscarded = options.onNodeDiscarded || noop;
    var onBeforeElChildrenUpdated = options.onBeforeElChildrenUpdated || noop;
    var childrenOnly = options.childrenOnly === true;

    // This object is used as a lookup to quickly find all keyed elements in the original DOM tree.
    var fromNodesLookup = {};
    var keyedRemovalList;

    function addKeyedRemoval(key) {
        if (keyedRemovalList) {
            keyedRemovalList.push(key);
        } else {
            keyedRemovalList = [key];
        }
    }

    function walkDiscardedChildNodes(node, skipKeyedNodes) {
        if (node.nodeType === ELEMENT_NODE) {
            var curChild = node.firstChild;
            while (curChild) {

                var key = undefined;

                if (skipKeyedNodes && (key = getNodeKey(curChild))) {
                    // If we are skipping keyed nodes then we add the key
                    // to a list so that it can be handled at the very end.
                    addKeyedRemoval(key);
                } else {
                    // Only report the node as discarded if it is not keyed. We do this because
                    // at the end we loop through all keyed elements that were unmatched
                    // and then discard them in one final pass.
                    onNodeDiscarded(curChild);
                    if (curChild.firstChild) {
                        walkDiscardedChildNodes(curChild, skipKeyedNodes);
                    }
                }

                curChild = curChild.nextSibling;
            }
        }
    }

    /**
     * Removes a DOM node out of the original DOM
     *
     * @param  {Node} node The node to remove
     * @param  {Node} parentNode The nodes parent
     * @param  {Boolean} skipKeyedNodes If true then elements with keys will be skipped and not discarded.
     * @return {undefined}
     */
    function removeNode(node, parentNode, skipKeyedNodes) {
        if (onBeforeNodeDiscarded(node) === false) {
            return;
        }

        if (parentNode) {
            parentNode.removeChild(node);
        }

        onNodeDiscarded(node);
        walkDiscardedChildNodes(node, skipKeyedNodes);
    }

    // // TreeWalker implementation is no faster, but keeping this around in case this changes in the future
    // function indexTree(root) {
    //     var treeWalker = document.createTreeWalker(
    //         root,
    //         NodeFilter.SHOW_ELEMENT);
    //
    //     var el;
    //     while((el = treeWalker.nextNode())) {
    //         var key = getNodeKey(el);
    //         if (key) {
    //             fromNodesLookup[key] = el;
    //         }
    //     }
    // }

    // // NodeIterator implementation is no faster, but keeping this around in case this changes in the future
    //
    // function indexTree(node) {
    //     var nodeIterator = document.createNodeIterator(node, NodeFilter.SHOW_ELEMENT);
    //     var el;
    //     while((el = nodeIterator.nextNode())) {
    //         var key = getNodeKey(el);
    //         if (key) {
    //             fromNodesLookup[key] = el;
    //         }
    //     }
    // }

    function indexTree(node) {
        if (node.nodeType === ELEMENT_NODE) {
            var curChild = node.firstChild;
            while (curChild) {
                var key = getNodeKey(curChild);
                if (key) {
                    fromNodesLookup[key] = curChild;
                }

                // Walk recursively
                indexTree(curChild);

                curChild = curChild.nextSibling;
            }
        }
    }

    indexTree(fromNode);

    function handleNodeAdded(el) {
        onNodeAdded(el);

        var curChild = el.firstChild;
        while (curChild) {
            var nextSibling = curChild.nextSibling;

            var key = getNodeKey(curChild);
            if (key) {
                var unmatchedFromEl = fromNodesLookup[key];
                if (unmatchedFromEl && compareNodeNames(curChild, unmatchedFromEl)) {
                    curChild.parentNode.replaceChild(unmatchedFromEl, curChild);
                    morphEl(unmatchedFromEl, curChild);
                }
            }

            handleNodeAdded(curChild);
            curChild = nextSibling;
        }
    }

    function morphEl(fromEl, toEl, childrenOnly) {
        var toElKey = getNodeKey(toEl);
        var curFromNodeKey;

        if (toElKey) {
            // If an element with an ID is being morphed then it is will be in the final
            // DOM so clear it out of the saved elements collection
            delete fromNodesLookup[toElKey];
        }

        if (toNode.isSameNode && toNode.isSameNode(fromNode)) {
            return;
        }

        if (!childrenOnly) {
            if (onBeforeElUpdated(fromEl, toEl) === false) {
                return;
            }

            morphAttrs(fromEl, toEl);
            onElUpdated(fromEl);

            if (onBeforeElChildrenUpdated(fromEl, toEl) === false) {
                return;
            }
        }

        if (fromEl.nodeName !== 'TEXTAREA') {
            var curToNodeChild = toEl.firstChild;
            var curFromNodeChild = fromEl.firstChild;
            var curToNodeKey;

            var fromNextSibling;
            var toNextSibling;
            var matchingFromEl;

            outer: while (curToNodeChild) {
                toNextSibling = curToNodeChild.nextSibling;
                curToNodeKey = getNodeKey(curToNodeChild);

                while (curFromNodeChild) {
                    fromNextSibling = curFromNodeChild.nextSibling;

                    if (curToNodeChild.isSameNode && curToNodeChild.isSameNode(curFromNodeChild)) {
                        curToNodeChild = toNextSibling;
                        curFromNodeChild = fromNextSibling;
                        continue outer;
                    }

                    curFromNodeKey = getNodeKey(curFromNodeChild);

                    var curFromNodeType = curFromNodeChild.nodeType;

                    var isCompatible = undefined;

                    if (curFromNodeType === curToNodeChild.nodeType) {
                        if (curFromNodeType === ELEMENT_NODE) {
                            // Both nodes being compared are Element nodes

                            if (curToNodeKey) {
                                // The target node has a key so we want to match it up with the correct element
                                // in the original DOM tree
                                if (curToNodeKey !== curFromNodeKey) {
                                    // The current element in the original DOM tree does not have a matching key so
                                    // let's check our lookup to see if there is a matching element in the original
                                    // DOM tree
                                    if ((matchingFromEl = fromNodesLookup[curToNodeKey])) {
                                        if (curFromNodeChild.nextSibling === matchingFromEl) {
                                            // Special case for single element removals. To avoid removing the original
                                            // DOM node out of the tree (since that can break CSS transitions, etc.),
                                            // we will instead discard the current node and wait until the next
                                            // iteration to properly match up the keyed target element with its matching
                                            // element in the original tree
                                            isCompatible = false;
                                        } else {
                                            // We found a matching keyed element somewhere in the original DOM tree.
                                            // Let's moving the original DOM node into the current position and morph
                                            // it.

                                            // NOTE: We use insertBefore instead of replaceChild because we want to go through
                                            // the `removeNode()` function for the node that is being discarded so that
                                            // all lifecycle hooks are correctly invoked
                                            fromEl.insertBefore(matchingFromEl, curFromNodeChild);

                                            if (curFromNodeKey) {
                                                // Since the node is keyed it might be matched up later so we defer
                                                // the actual removal to later
                                                addKeyedRemoval(curFromNodeKey);
                                            } else {
                                                // NOTE: we skip nested keyed nodes from being removed since there is
                                                //       still a chance they will be matched up later
                                                removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */);

                                            }
                                            fromNextSibling = curFromNodeChild.nextSibling;
                                            curFromNodeChild = matchingFromEl;
                                        }
                                    } else {
                                        // The nodes are not compatible since the "to" node has a key and there
                                        // is no matching keyed node in the source tree
                                        isCompatible = false;
                                    }
                                }
                            } else if (curFromNodeKey) {
                                // The original has a key
                                isCompatible = false;
                            }

                            isCompatible = isCompatible !== false && compareNodeNames(curFromNodeChild, curToNodeChild);
                            if (isCompatible) {
                                // We found compatible DOM elements so transform
                                // the current "from" node to match the current
                                // target DOM node.
                                morphEl(curFromNodeChild, curToNodeChild);
                            }

                        } else if (curFromNodeType === TEXT_NODE || curFromNodeType == COMMENT_NODE) {
                            // Both nodes being compared are Text or Comment nodes
                            isCompatible = true;
                            // Simply update nodeValue on the original node to
                            // change the text value
                            curFromNodeChild.nodeValue = curToNodeChild.nodeValue;
                        }
                    }

                    if (isCompatible) {
                        // Advance both the "to" child and the "from" child since we found a match
                        curToNodeChild = toNextSibling;
                        curFromNodeChild = fromNextSibling;
                        continue outer;
                    }

                    // No compatible match so remove the old node from the DOM and continue trying to find a
                    // match in the original DOM. However, we only do this if the from node is not keyed
                    // since it is possible that a keyed node might match up with a node somewhere else in the
                    // target tree and we don't want to discard it just yet since it still might find a
                    // home in the final DOM tree. After everything is done we will remove any keyed nodes
                    // that didn't find a home
                    if (curFromNodeKey) {
                        // Since the node is keyed it might be matched up later so we defer
                        // the actual removal to later
                        addKeyedRemoval(curFromNodeKey);
                    } else {
                        // NOTE: we skip nested keyed nodes from being removed since there is
                        //       still a chance they will be matched up later
                        removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */);
                    }

                    curFromNodeChild = fromNextSibling;
                }

                // If we got this far then we did not find a candidate match for
                // our "to node" and we exhausted all of the children "from"
                // nodes. Therefore, we will just append the current "to" node
                // to the end
                if (curToNodeKey && (matchingFromEl = fromNodesLookup[curToNodeKey]) && compareNodeNames(matchingFromEl, curToNodeChild)) {
                    fromEl.appendChild(matchingFromEl);
                    morphEl(matchingFromEl, curToNodeChild);
                } else {
                    var onBeforeNodeAddedResult = onBeforeNodeAdded(curToNodeChild);
                    if (onBeforeNodeAddedResult !== false) {
                        if (onBeforeNodeAddedResult) {
                            curToNodeChild = onBeforeNodeAddedResult;
                        }

                        if (curToNodeChild.actualize) {
                            curToNodeChild = curToNodeChild.actualize(fromEl.ownerDocument || doc);
                        }
                        fromEl.appendChild(curToNodeChild);
                        handleNodeAdded(curToNodeChild);
                    }
                }

                curToNodeChild = toNextSibling;
                curFromNodeChild = fromNextSibling;
            }

            // We have processed all of the "to nodes". If curFromNodeChild is
            // non-null then we still have some from nodes left over that need
            // to be removed
            while (curFromNodeChild) {
                fromNextSibling = curFromNodeChild.nextSibling;
                if ((curFromNodeKey = getNodeKey(curFromNodeChild))) {
                    // Since the node is keyed it might be matched up later so we defer
                    // the actual removal to later
                    addKeyedRemoval(curFromNodeKey);
                } else {
                    // NOTE: we skip nested keyed nodes from being removed since there is
                    //       still a chance they will be matched up later
                    removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */);
                }
                curFromNodeChild = fromNextSibling;
            }
        }

        var specialElHandler = specialElHandlers[fromEl.nodeName];
        if (specialElHandler) {
            specialElHandler(fromEl, toEl);
        }
    } // END: morphEl(...)

    var morphedNode = fromNode;
    var morphedNodeType = morphedNode.nodeType;
    var toNodeType = toNode.nodeType;

    if (!childrenOnly) {
        // Handle the case where we are given two DOM nodes that are not
        // compatible (e.g. <div> --> <span> or <div> --> TEXT)
        if (morphedNodeType === ELEMENT_NODE) {
            if (toNodeType === ELEMENT_NODE) {
                if (!compareNodeNames(fromNode, toNode)) {
                    onNodeDiscarded(fromNode);
                    morphedNode = moveChildren(fromNode, createElementNS(toNode.nodeName, toNode.namespaceURI));
                }
            } else {
                // Going from an element node to a text node
                morphedNode = toNode;
            }
        } else if (morphedNodeType === TEXT_NODE || morphedNodeType === COMMENT_NODE) { // Text or comment node
            if (toNodeType === morphedNodeType) {
                morphedNode.nodeValue = toNode.nodeValue;
                return morphedNode;
            } else {
                // Text node to something else
                morphedNode = toNode;
            }
        }
    }

    if (morphedNode === toNode) {
        // The "to node" was not compatible with the "from node" so we had to
        // toss out the "from node" and use the "to node"
        onNodeDiscarded(fromNode);
    } else {
        morphEl(morphedNode, toNode, childrenOnly);

        // We now need to loop over any keyed nodes that might need to be
        // removed. We only do the removal if we know that the keyed node
        // never found a match. When a keyed node is matched up we remove
        // it out of fromNodesLookup and we use fromNodesLookup to determine
        // if a keyed node has been matched up or not
        if (keyedRemovalList) {
            for (var i=0, len=keyedRemovalList.length; i<len; i++) {
                var elToRemove = fromNodesLookup[keyedRemovalList[i]];
                if (elToRemove) {
                    removeNode(elToRemove, elToRemove.parentNode, false);
                }
            }
        }
    }

    if (!childrenOnly && morphedNode !== fromNode && fromNode.parentNode) {
        if (morphedNode.actualize) {
            morphedNode = morphedNode.actualize(fromNode.ownerDocument || doc);
        }
        // If we had to swap out the from node with a new node because the old
        // node was not compatible with the target node then we need to
        // replace the old DOM node in the original DOM tree. This is only
        // possible if the original DOM node was part of a DOM tree which
        // we know is the case if it has a parent node.
        fromNode.parentNode.replaceChild(morphedNode, fromNode);
    }

    return morphedNode;
}

module.exports = morphdom;

},{}],27:[function(require,module,exports){
module.exports = [
  // attribute events (can be set with attributes)
  'onclick',
  'ondblclick',
  'onmousedown',
  'onmouseup',
  'onmouseover',
  'onmousemove',
  'onmouseout',
  'ondragstart',
  'ondrag',
  'ondragenter',
  'ondragleave',
  'ondragover',
  'ondrop',
  'ondragend',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'onunload',
  'onabort',
  'onerror',
  'onresize',
  'onscroll',
  'onselect',
  'onchange',
  'onsubmit',
  'onreset',
  'onfocus',
  'onblur',
  'oninput',
  // other common events
  'oncontextmenu',
  'onfocusin',
  'onfocusout'
]

},{}],28:[function(require,module,exports){
(function (global){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.default = function (opts) {
  if (!(this instanceof Uppy)) {
    return new Uppy(opts);
  }
};

var _Utils = require('../core/Utils');

var _Utils2 = _interopRequireDefault(_Utils);

var _Translator = require('../core/Translator');

var _Translator2 = _interopRequireDefault(_Translator);

var _namespaceEmitter = require('namespace-emitter');

var _namespaceEmitter2 = _interopRequireDefault(_namespaceEmitter);

var _UppySocket = require('./UppySocket');

var _UppySocket2 = _interopRequireDefault(_UppySocket);

var _en_US = require('../locales/en_US');

var _en_US2 = _interopRequireDefault(_en_US);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// import deepFreeze from 'deep-freeze-strict'

/**
 * Main Uppy core
 *
 * @param {object} opts general options, like locales, to show modal or not to show
 */
var Uppy = function () {
  function Uppy(opts) {
    _classCallCheck(this, Uppy);

    // set default options
    var defaultOptions = {
      // load English as the default locale
      locale: _en_US2.default,
      autoProceed: true,
      debug: false
    };

    // Merge default options with the ones set by user
    this.opts = _extends({}, defaultOptions, opts);

    // // Dictates in what order different plugin types are ran:
    // this.types = [ 'presetter', 'orchestrator', 'progressindicator',
    //                 'acquirer', 'modifier', 'uploader', 'presenter', 'debugger']

    // Container for different types of plugins
    this.plugins = {};

    this.translator = new _Translator2.default({ locale: this.opts.locale });
    this.i18n = this.translator.translate.bind(this.translator);
    this.getState = this.getState.bind(this);
    this.updateMeta = this.updateMeta.bind(this);
    this.initSocket = this.initSocket.bind(this);
    this.log = this.log.bind(this);
    this.addFile = this.addFile.bind(this);

    this.bus = this.emitter = (0, _namespaceEmitter2.default)();
    this.on = this.bus.on.bind(this.bus);
    this.emit = this.bus.emit.bind(this.bus);

    this.state = {
      files: {},
      capabilities: {
        resumableUploads: false
      },
      totalProgress: 0
    };

    // for debugging and testing
    if (this.opts.debug) {
      global.UppyState = this.state;
      global.uppyLog = '';
      global.UppyAddFile = this.addFile.bind(this);
      global._Uppy = this;
    }
  }

  /**
   * Iterate on all plugins and run `update` on them. Called each time state changes
   *
   */


  Uppy.prototype.updateAll = function updateAll(state) {
    var _this = this;

    Object.keys(this.plugins).forEach(function (pluginType) {
      _this.plugins[pluginType].forEach(function (plugin) {
        plugin.update(state);
      });
    });
  };

  /**
   * Updates state
   *
   * @param {newState} object
   */


  Uppy.prototype.setState = function setState(stateUpdate) {
    var newState = _extends({}, this.state, stateUpdate);
    this.emit('core:state-update', this.state, newState, stateUpdate);

    this.state = newState;
    this.updateAll(this.state);
  };

  /**
   * Returns current state
   *
   */


  Uppy.prototype.getState = function getState() {
    // use deepFreeze for debugging
    // return deepFreeze(this.state)
    return this.state;
  };

  Uppy.prototype.updateMeta = function updateMeta(data, fileID) {
    var updatedFiles = _extends({}, this.getState().files);
    var newMeta = _extends({}, updatedFiles[fileID].meta, data);
    updatedFiles[fileID] = _extends({}, updatedFiles[fileID], {
      meta: newMeta
    });
    this.setState({ files: updatedFiles });
  };

  Uppy.prototype.addFile = function addFile(file) {
    var updatedFiles = _extends({}, this.state.files);

    var fileName = file.name || 'noname';
    var fileType = _Utils2.default.getFileType(file) ? _Utils2.default.getFileType(file).split('/') : ['', ''];
    var fileTypeGeneral = fileType[0];
    var fileTypeSpecific = fileType[1];
    var fileExtension = _Utils2.default.getFileNameAndExtension(fileName)[1];
    var isRemote = file.isRemote || false;

    var fileID = _Utils2.default.generateFileID(fileName);

    var newFile = {
      source: file.source || '',
      id: fileID,
      name: fileName,
      extension: fileExtension || '',
      meta: {
        name: fileName
      },
      type: {
        general: fileTypeGeneral,
        specific: fileTypeSpecific
      },
      data: file.data,
      progress: {
        percentage: 0,
        uploadComplete: false,
        uploadStarted: false
      },
      size: file.data.size || 0,
      isRemote: isRemote,
      remote: file.remote || ''
    };

    updatedFiles[fileID] = newFile;
    this.setState({ files: updatedFiles });

    this.bus.emit('file-added', fileID);
    this.log('Added file: ' + fileName + ', ' + fileID);

    if (fileTypeGeneral === 'image' && !isRemote) {
      this.addThumbnail(newFile.id);
    }

    if (this.opts.autoProceed) {
      this.bus.emit('core:upload');
    }
  };

  Uppy.prototype.removeFile = function removeFile(fileID) {
    var updatedFiles = _extends({}, this.getState().files);
    delete updatedFiles[fileID];
    this.setState({ files: updatedFiles });
    this.log('Removed file: ' + fileID);
  };

  Uppy.prototype.addThumbnail = function addThumbnail(fileID) {
    var _this2 = this;

    var file = this.getState().files[fileID];

    _Utils2.default.readFile(file.data).then(function (imgDataURI) {
      return _Utils2.default.createImageThumbnail(imgDataURI, 200);
    }).then(function (thumbnail) {
      var updatedFiles = _extends({}, _this2.getState().files);
      var updatedFile = _extends({}, updatedFiles[fileID], {
        preview: thumbnail
      });
      updatedFiles[fileID] = updatedFile;
      _this2.setState({ files: updatedFiles });
    });
  };

  Uppy.prototype.startUpload = function startUpload() {
    this.emit('core:upload');
  };

  Uppy.prototype.calculateProgress = function calculateProgress(data) {
    var fileID = data.id;
    var updatedFiles = _extends({}, this.getState().files);
    if (!updatedFiles[fileID]) {
      console.error('Trying to set progress for a file that’s not with us anymore: ', fileID);
      return;
    }

    var updatedFile = _extends({}, updatedFiles[fileID], _extends({}, {
      progress: _extends({}, updatedFiles[fileID].progress, {
        bytesUploaded: data.bytesUploaded,
        bytesTotal: data.bytesTotal,
        percentage: Math.round((data.bytesUploaded / data.bytesTotal * 100).toFixed(2))
      })
    }));
    updatedFiles[data.id] = updatedFile;

    // calculate total progress, using the number of files currently uploading,
    // multiplied by 100 and the summ of individual progress of each file
    var inProgress = Object.keys(updatedFiles).filter(function (file) {
      return updatedFiles[file].progress.uploadStarted;
    });
    var progressMax = inProgress.length * 100;
    var progressAll = 0;
    inProgress.forEach(function (file) {
      progressAll = progressAll + updatedFiles[file].progress.percentage;
    });

    var totalProgress = Math.round((progressAll * 100 / progressMax).toFixed(2));

    // if (totalProgress === 100) {
    //   const completeFiles = Object.keys(updatedFiles).filter((file) => {
    //     // this should be `uploadComplete`
    //     return updatedFiles[file].progress.percentage === 100
    //   })
    //   this.emit('core:success', completeFiles.length)
    // }

    this.setState({
      totalProgress: totalProgress,
      files: updatedFiles
    });
  };

  /**
   * Registers listeners for all global actions, like:
   * `file-add`, `file-remove`, `upload-progress`, `reset`
   *
   */


  Uppy.prototype.actions = function actions() {
    var _this3 = this;

    // this.bus.on('*', (payload) => {
    //   console.log('emitted: ', this.event)
    //   console.log('with payload: ', payload)
    // })

    // const bus = this.bus

    this.on('core:file-add', function (data) {
      _this3.addFile(data);
    });

    // `remove-file` removes a file from `state.files`, for example when
    // a user decides not to upload particular file and clicks a button to remove it
    this.on('core:file-remove', function (fileID) {
      _this3.removeFile(fileID);
    });

    this.on('core:cancel-all', function () {
      var files = _this3.getState().files;
      Object.keys(files).forEach(function (file) {
        _this3.removeFile(files[file].id);
      });
    });

    this.on('core:upload-started', function (fileID, upload) {
      var updatedFiles = _extends({}, _this3.getState().files);
      var updatedFile = _extends({}, updatedFiles[fileID], _extends({}, {
        progress: _extends({}, updatedFiles[fileID].progress, {
          uploadStarted: Date.now()
        })
      }));
      updatedFiles[fileID] = updatedFile;

      _this3.setState({ files: updatedFiles });
    });

    // const throttledCalculateProgress = throttle(1000, (data) => this.calculateProgress(data))

    this.on('core:upload-progress', function (data) {
      _this3.calculateProgress(data);
      // throttledCalculateProgress(data)
    });

    this.on('core:upload-success', function (fileID, uploadURL) {
      var updatedFiles = _extends({}, _this3.getState().files);
      var updatedFile = _extends({}, updatedFiles[fileID], {
        progress: _extends({}, updatedFiles[fileID].progress, {
          uploadComplete: true
        }),
        uploadURL: uploadURL
      });
      updatedFiles[fileID] = updatedFile;

      // console.log(this.getState().totalProgress)

      if (_this3.getState().totalProgress === 100) {
        var completeFiles = Object.keys(updatedFiles).filter(function (file) {
          // this should be `uploadComplete`
          return updatedFiles[file].progress.uploadComplete;
        });
        _this3.emit('core:success', completeFiles.length);
      }

      _this3.setState({
        files: updatedFiles
      });
    });

    this.on('core:update-meta', function (data, fileID) {
      _this3.updateMeta(data, fileID);
    });

    // show informer if offline
    if (typeof window !== 'undefined') {
      window.addEventListener('online', function () {
        return _this3.isOnline(true);
      });
      window.addEventListener('offline', function () {
        return _this3.isOnline(false);
      });
      setTimeout(function () {
        return _this3.isOnline();
      }, 3000);
    }
  };

  Uppy.prototype.isOnline = function isOnline(status) {
    var online = status || window.navigator.onLine;
    if (!online) {
      this.emit('is-offline');
      this.emit('informer', 'No internet connection', 'error', 0);
      this.wasOffline = true;
    } else {
      this.emit('is-online');
      if (this.wasOffline) {
        this.emit('informer', 'Connected!', 'success', 3000);
        this.wasOffline = false;
      }
    }
  };

  /**
   * Registers a plugin with Core
   *
   * @param {Class} Plugin object
   * @param {Object} options object that will be passed to Plugin later
   * @return {Object} self for chaining
   */


  Uppy.prototype.use = function use(Plugin, opts) {
    // Prepare props to pass to plugins
    // const props = {
    //   getState: this.getState.bind(this),
    //   setState: this.setState.bind(this),
    //   updateMeta: this.updateMeta.bind(this),
    //   addFile: this.addFile.bind(this),
    //   i18n: this.i18n.bind(this),
    //   bus: this.ee,
    //   log: this.log.bind(this)
    // }

    // Instantiate
    var plugin = new Plugin(this, opts);
    var pluginName = plugin.id;
    this.plugins[plugin.type] = this.plugins[plugin.type] || [];

    if (!pluginName) {
      throw new Error('Your plugin must have a name');
    }

    if (!plugin.type) {
      throw new Error('Your plugin must have a type');
    }

    var existsPluginAlready = this.getPlugin(pluginName);
    if (existsPluginAlready) {
      var msg = 'Already found a plugin named \'' + existsPluginAlready.name + '\'.\n        Tried to use: \'' + pluginName + '\'.\n        Uppy is currently limited to running one of every plugin.\n        Share your use case with us over at\n        https://github.com/transloadit/uppy/issues/\n        if you want us to reconsider.';
      throw new Error(msg);
    }

    this.plugins[plugin.type].push(plugin);
    plugin.install();

    return this;
  };

  /**
   * Find one Plugin by name
   *
   * @param string name description
   */


  Uppy.prototype.getPlugin = function getPlugin(name) {
    var foundPlugin = false;
    this.iteratePlugins(function (plugin) {
      var pluginName = plugin.id;
      if (pluginName === name) {
        foundPlugin = plugin;
        return false;
      }
    });
    return foundPlugin;
  };

  /**
   * Iterate through all `use`d plugins
   *
   * @param function method description
   */


  Uppy.prototype.iteratePlugins = function iteratePlugins(method) {
    var _this4 = this;

    Object.keys(this.plugins).forEach(function (pluginType) {
      _this4.plugins[pluginType].forEach(method);
    });
  };

  /**
   * Logs stuff to console, only if `debug` is set to true. Silent in production.
   *
   * @return {String|Object} to log
   */


  Uppy.prototype.log = function log(msg, type) {
    if (!this.opts.debug) {
      return;
    }
    if (msg === '' + msg) {
      console.log('LOG: ' + msg);
    } else {
      console.dir(msg);
    }

    if (type === 'error') {
      console.error('LOG: ' + msg);
    }

    global.uppyLog = global.uppyLog + '\n' + 'DEBUG LOG: ' + msg;
  };

  Uppy.prototype.initSocket = function initSocket(opts) {
    if (!this.socket) {
      this.socket = new _UppySocket2.default(opts);
    }

    return this.socket;
  };

  // installAll () {
  //   Object.keys(this.plugins).forEach((pluginType) => {
  //     this.plugins[pluginType].forEach((plugin) => {
  //       plugin.install(this)
  //     })
  //   })
  // }

  /**
   * Initializes actions, installs all plugins (by iterating on them and calling `install`), sets options
   *
   */


  Uppy.prototype.run = function run() {
    this.log('Core is run, initializing actions...');

    this.actions();

    // Forse set `autoProceed` option to false if there are multiple selector Plugins active
    // if (this.plugins.acquirer && this.plugins.acquirer.length > 1) {
    //   this.opts.autoProceed = false
    // }

    // Install all plugins
    // this.installAll()

    return;
  };

  return Uppy;
}();

// module.exports = function (opts) {
//   if (!(this instanceof Uppy)) {
//     return new Uppy(opts)
//   }
// }

module.exports = exports['default'];

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../core/Translator":29,"../core/Utils":31,"../locales/en_US":34,"./UppySocket":30,"namespace-emitter":5}],29:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _en_US = require('../locales/en_US');

var _en_US2 = _interopRequireDefault(_en_US);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Translates strings with interpolation & pluralization support.Extensible with custom dictionaries
 * and pluralization functions.
 *
 * Borrows heavily from and inspired by Polyglot https://github.com/airbnb/polyglot.js,
 * basically a stripped-down version of it. Differences: pluralization functions are not hardcoded
 * and can be easily added among with dictionaries, nested objects are used for pluralization
 * as opposed to `||||` delimeter
 *
 * Usage example: `translator.translate('files_chosen', {smart_count: 3})`
 *
 * @param {object} opts
 */
var Translator = function () {
  function Translator(opts) {
    _classCallCheck(this, Translator);

    var defaultOptions = {
      locale: _en_US2.default
    };
    this.opts = _extends({}, defaultOptions, opts);
    this.locale = this.opts.locale;
    this.locale.strings = _extends({}, _en_US2.default.strings, this.opts.locale.strings);
  }

  /**
   * Takes a string with placeholder variables like `%{smart_count} file selected`
   * and replaces it with values from options `{smart_count: 5}`
   *
   * @license https://github.com/airbnb/polyglot.js/blob/master/LICENSE
   * taken from https://github.com/airbnb/polyglot.js/blob/master/lib/polyglot.js#L299
   *
   * @param {string} phrase that needs interpolation, with placeholders
   * @param {object} options with values that will be used to replace placeholders
   * @return {string} interpolated
   */


  Translator.prototype.interpolate = function interpolate(phrase, options) {
    var replace = String.prototype.replace;
    var dollarRegex = /\$/g;
    var dollarBillsYall = '$$$$';

    for (var arg in options) {
      if (arg !== '_' && options.hasOwnProperty(arg)) {
        // Ensure replacement value is escaped to prevent special $-prefixed
        // regex replace tokens. the "$$$$" is needed because each "$" needs to
        // be escaped with "$" itself, and we need two in the resulting output.
        var replacement = options[arg];
        if (typeof replacement === 'string') {
          replacement = replace.call(options[arg], dollarRegex, dollarBillsYall);
        }
        // We create a new `RegExp` each time instead of using a more-efficient
        // string replace so that the same argument can be replaced multiple times
        // in the same phrase.
        phrase = replace.call(phrase, new RegExp('%\\{' + arg + '\\}', 'g'), replacement);
      }
    }
    return phrase;
  };

  /**
   * Public translate method
   *
   * @param {string} key
   * @param {object} options with values that will be used later to replace placeholders in string
   * @return {string} translated (and interpolated)
   */


  Translator.prototype.translate = function translate(key, options) {
    if (options && options.smart_count) {
      var plural = this.locale.pluralize(options.smart_count);
      return this.interpolate(this.opts.locale.strings[key][plural], options);
    }

    return this.interpolate(this.opts.locale.strings[key], options);
  };

  return Translator;
}();

exports.default = Translator;
module.exports = exports['default'];

},{"../locales/en_US":34}],30:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _namespaceEmitter = require('namespace-emitter');

var _namespaceEmitter2 = _interopRequireDefault(_namespaceEmitter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var UppySocket = function () {
  function UppySocket(opts) {
    var _this = this;

    _classCallCheck(this, UppySocket);

    this.queued = [];
    this.isOpen = false;
    this.socket = new WebSocket(opts.target);
    this.emitter = (0, _namespaceEmitter2.default)();

    this.socket.onopen = function (e) {
      _this.isOpen = true;

      while (_this.queued.length > 0 && _this.isOpen) {
        var first = _this.queued[0];
        _this.send(first.action, first.payload);
        _this.queued = _this.queued.slice(1);
      }
    };

    this.socket.onclose = function (e) {
      _this.isOpen = false;
    };

    this._handleMessage = this._handleMessage.bind(this);

    this.socket.onmessage = this._handleMessage;

    this.close = this.close.bind(this);
    this.emit = this.emit.bind(this);
    this.on = this.on.bind(this);
    this.once = this.once.bind(this);
    this.send = this.send.bind(this);
  }

  UppySocket.prototype.close = function close() {
    return this.socket.close();
  };

  UppySocket.prototype.send = function send(action, payload) {
    // attach uuid

    if (!this.isOpen) {
      this.queued.push({ action: action, payload: payload });
      return;
    }

    this.socket.send(JSON.stringify({
      action: action,
      payload: payload
    }));
  };

  UppySocket.prototype.on = function on(action, handler) {
    this.emitter.on(action, handler);
  };

  UppySocket.prototype.emit = function emit(action, payload) {
    this.emitter.emit(action, payload);
  };

  UppySocket.prototype.once = function once(action, handler) {
    this.emitter.once(action, handler);
  };

  UppySocket.prototype._handleMessage = function _handleMessage(e) {
    try {
      var message = JSON.parse(e.data);
      this.emit(message.action, message.payload);
    } catch (err) {
      console.log(err);
    }
  };

  return UppySocket;
}();

exports.default = UppySocket;
module.exports = exports['default'];

},{"namespace-emitter":5}],31:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.flatten = flatten;
exports.isTouchDevice = isTouchDevice;
exports.$ = $;
exports.$$ = $$;
exports.truncateString = truncateString;
exports.secondsToTime = secondsToTime;
exports.groupBy = groupBy;
exports.every = every;
exports.toArray = toArray;
exports.generateFileID = generateFileID;
exports.extend = extend;
exports.getProportionalImageHeight = getProportionalImageHeight;
exports.getFileType = getFileType;
exports.getFileNameAndExtension = getFileNameAndExtension;
exports.readFile = readFile;
exports.createImageThumbnail = createImageThumbnail;
exports.dataURItoBlob = dataURItoBlob;
exports.dataURItoFile = dataURItoFile;
exports.copyToClipboard = copyToClipboard;
exports.makeWorker = makeWorker;
exports.getSpeed = getSpeed;
exports.getETA = getETA;
exports.prettyETA = prettyETA;
exports.makeCachingFunction = makeCachingFunction;

var _Promise = typeof Promise === 'undefined' ? require('es6-promise').Promise : Promise;

// import mime from 'mime-types'
// import pica from 'pica'

/**
 * A collection of small utility functions that help with dom manipulation, adding listeners,
 * promises and other good things.
 *
 * @module Utils
 */

/**
 * Shallow flatten nested arrays.
 */
function flatten(arr) {
  return [].concat.apply([], arr);
}

function isTouchDevice() {
  return 'ontouchstart' in window || // works on most browsers
  navigator.maxTouchPoints; // works on IE10/11 and Surface
}

/**
 * Shorter and fast way to select a single node in the DOM
 * @param   { String } selector - unique dom selector
 * @param   { Object } ctx - DOM node where the target of our search will is located
 * @returns { Object } dom node found
 */
function $(selector, ctx) {
  return (ctx || document).querySelector(selector);
}

/**
 * Shorter and fast way to select multiple nodes in the DOM
 * @param   { String|Array } selector - DOM selector or nodes list
 * @param   { Object } ctx - DOM node where the targets of our search will is located
 * @returns { Object } dom nodes found
 */
function $$(selector, ctx) {
  var els;
  if (typeof selector === 'string') {
    els = (ctx || document).querySelectorAll(selector);
  } else {
    els = selector;
    return Array.prototype.slice.call(els);
  }
}

function truncateString(str, length) {
  if (str.length > length) {
    return str.substr(0, length / 2) + '...' + str.substr(str.length - length / 4, str.length);
  }
  return str;

  // more precise version if needed
  // http://stackoverflow.com/a/831583
}

function secondsToTime(rawSeconds) {
  var hours = Math.floor(rawSeconds / 3600) % 24;
  var minutes = Math.floor(rawSeconds / 60) % 60;
  var seconds = Math.floor(rawSeconds % 60);

  return { hours: hours, minutes: minutes, seconds: seconds };
}

/**
 * Partition array by a grouping function.
 * @param  {[type]} array      Input array
 * @param  {[type]} groupingFn Grouping function
 * @return {[type]}            Array of arrays
 */
function groupBy(array, groupingFn) {
  return array.reduce(function (result, item) {
    var key = groupingFn(item);
    var xs = result.get(key) || [];
    xs.push(item);
    result.set(key, xs);
    return result;
  }, new Map());
}

/**
 * Tests if every array element passes predicate
 * @param  {Array}  array       Input array
 * @param  {Object} predicateFn Predicate
 * @return {bool}               Every element pass
 */
function every(array, predicateFn) {
  return array.reduce(function (result, item) {
    if (!result) {
      return false;
    }

    return predicateFn(item);
  }, true);
}

/**
 * Converts list into array
*/
function toArray(list) {
  return Array.prototype.slice.call(list || [], 0);
}

/**
 * Takes a fileName and turns it into fileID, by converting to lowercase,
 * removing extra characters and adding unix timestamp
 *
 * @param {String} fileName
 *
 */
function generateFileID(fileName) {
  var fileID = fileName.toLowerCase();
  fileID = fileID.replace(/[^A-Z0-9]/ig, '');
  fileID = fileID + Date.now();
  return fileID;
}

function extend() {
  for (var _len = arguments.length, objs = Array(_len), _key = 0; _key < _len; _key++) {
    objs[_key] = arguments[_key];
  }

  return Object.assign.apply(this, [{}].concat(objs));
}

/**
 * Takes function or class, returns its name.
 * Because IE doesn’t support `constructor.name`.
 * https://gist.github.com/dfkaye/6384439, http://stackoverflow.com/a/15714445
 *
 * @param {Object} fn — function
 *
 */
// function getFnName (fn) {
//   var f = typeof fn === 'function'
//   var s = f && ((fn.name && ['', fn.name]) || fn.toString().match(/function ([^\(]+)/))
//   return (!f && 'not a function') || (s && s[1] || 'anonymous')
// }

function getProportionalImageHeight(img, newWidth) {
  var aspect = img.width / img.height;
  var newHeight = Math.round(newWidth / aspect);
  return newHeight;
}

function getFileType(file) {
  if (file.type) {
    return file.type;
  }
  return '';
  // return mime.lookup(file.name)
}

// returns [fileName, fileExt]
function getFileNameAndExtension(fullFileName) {
  var re = /(?:\.([^.]+))?$/;
  var fileExt = re.exec(fullFileName)[1];
  var fileName = fullFileName.replace('.' + fileExt, '');
  return [fileName, fileExt];
}

/**
 * Reads file as data URI from file object,
 * the one you get from input[type=file] or drag & drop.
 *
 * @param {Object} file object
 * @return {Promise} dataURL of the file
 *
 */
function readFile(fileObj) {
  return new _Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.addEventListener('load', function (ev) {
      return resolve(ev.target.result);
    });
    reader.readAsDataURL(fileObj);

    // function workerScript () {
    //   self.addEventListener('message', (e) => {
    //     const file = e.data.file
    //     try {
    //       const reader = new FileReaderSync()
    //       postMessage({
    //         file: reader.readAsDataURL(file)
    //       })
    //     } catch (err) {
    //       console.log(err)
    //     }
    //   })
    // }
    //
    // const worker = makeWorker(workerScript)
    // worker.postMessage({file: fileObj})
    // worker.addEventListener('message', (e) => {
    //   const fileDataURL = e.data.file
    //   console.log('FILE _ DATA _ URL')
    //   return resolve(fileDataURL)
    // })
  });
}

/**
 * Resizes an image to specified width and proportional height, using canvas
 * See https://davidwalsh.name/resize-image-canvas,
 * http://babalan.com/resizing-images-with-javascript/
 * @TODO see if we need https://github.com/stomita/ios-imagefile-megapixel for iOS
 *
 * @param {String} Data URI of the original image
 * @param {String} width of the resulting image
 * @return {String} Data URI of the resized image
 */
function createImageThumbnail(imgDataURI, newWidth) {
  return new _Promise(function (resolve, reject) {
    var img = new Image();
    img.addEventListener('load', function () {
      var newImageWidth = newWidth;
      var newImageHeight = getProportionalImageHeight(img, newImageWidth);

      // create an off-screen canvas
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');

      // set its dimension to target size
      canvas.width = newImageWidth;
      canvas.height = newImageHeight;

      // draw source image into the off-screen canvas:
      // ctx.clearRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, newImageWidth, newImageHeight);

      // pica.resizeCanvas(img, canvas, (err) => {
      //   if (err) console.log(err)
      //   const thumbnail = canvas.toDataURL('image/png')
      //   return resolve(thumbnail)
      // })

      // encode image to data-uri with base64 version of compressed image
      // canvas.toDataURL('image/jpeg', quality);  // quality = [0.0, 1.0]
      var thumbnail = canvas.toDataURL('image/png');
      return resolve(thumbnail);
    });
    img.src = imgDataURI;
  });
}

function dataURItoBlob(dataURI, opts, toFile) {
  // get the base64 data
  var data = dataURI.split(',')[1];

  // user may provide mime type, if not get it from data URI
  var mimeType = opts.mimeType || dataURI.split(',')[0].split(':')[1].split(';')[0];

  // default to plain/text if data URI has no mimeType
  if (mimeType == null) {
    mimeType = 'plain/text';
  }

  var binary = atob(data);
  var array = [];
  for (var i = 0; i < binary.length; i++) {
    array.push(binary.charCodeAt(i));
  }

  // Convert to a File?
  if (toFile) {
    return new File([new Uint8Array(array)], opts.name || '', { type: mimeType });
  }

  return new Blob([new Uint8Array(array)], { type: mimeType });
}

function dataURItoFile(dataURI, opts) {
  return dataURItoBlob(dataURI, opts, true);
}

/**
 * Copies text to clipboard by creating an almost invisible textarea,
 * adding text there, then running execCommand('copy').
 * Falls back to prompt() when the easy way fails (hello, Safari!)
 * From http://stackoverflow.com/a/30810322
 *
 * @param {String} textToCopy
 * @param {String} fallbackString
 * @return {Promise}
 */
function copyToClipboard(textToCopy, fallbackString) {
  fallbackString = fallbackString || 'Copy the URL below';

  return new _Promise(function (resolve, reject) {
    var textArea = document.createElement('textarea');
    textArea.setAttribute('style', {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '2em',
      height: '2em',
      padding: 0,
      border: 'none',
      outline: 'none',
      boxShadow: 'none',
      background: 'transparent'
    });

    textArea.value = textToCopy;
    document.body.appendChild(textArea);
    textArea.select();

    var magicCopyFailed = function magicCopyFailed(err) {
      document.body.removeChild(textArea);
      window.prompt(fallbackString, textToCopy);
      return reject('Oops, unable to copy displayed fallback prompt: ' + err);
    };

    try {
      var successful = document.execCommand('copy');
      if (!successful) {
        return magicCopyFailed('copy command unavailable');
      }
      document.body.removeChild(textArea);
      return resolve();
    } catch (err) {
      document.body.removeChild(textArea);
      return magicCopyFailed(err);
    }
  });
}

// export function createInlineWorker (workerFunction) {
//   let code = workerFunction.toString()
//   code = code.substring(code.indexOf('{') + 1, code.lastIndexOf('}'))
//
//   const blob = new Blob([code], {type: 'application/javascript'})
//   const worker = new Worker(URL.createObjectURL(blob))
//
//   return worker
// }

function makeWorker(script) {
  var URL = window.URL || window.webkitURL;
  var Blob = window.Blob;
  var Worker = window.Worker;

  if (!URL || !Blob || !Worker || !script) {
    return null;
  }

  var code = script.toString();
  code = code.substring(code.indexOf('{') + 1, code.lastIndexOf('}'));

  var blob = new Blob([code]);
  var worker = new Worker(URL.createObjectURL(blob));
  return worker;
}

function getSpeed(fileProgress) {
  if (!fileProgress.bytesUploaded) return 0;

  var timeElapsed = new Date() - fileProgress.uploadStarted;
  var uploadSpeed = fileProgress.bytesUploaded / (timeElapsed / 1000);
  return uploadSpeed;
}

function getETA(fileProgress) {
  if (!fileProgress.bytesUploaded) return 0;

  var uploadSpeed = getSpeed(fileProgress);
  var bytesRemaining = fileProgress.bytesTotal - fileProgress.bytesUploaded;
  var secondsRemaining = Math.round(bytesRemaining / uploadSpeed * 10) / 10;

  return secondsRemaining;
}

function prettyETA(seconds) {
  var time = secondsToTime(seconds);

  // Only display hours and minutes if they are greater than 0 but always
  // display minutes if hours is being displayed
  var hoursStr = time.hours ? time.hours + 'h' : '';
  var minutesStr = time.hours || time.minutes ? time.minutes + 'm' : '';
  var secondsStr = time.seconds + 's';

  return hoursStr + ' ' + minutesStr + ' ' + secondsStr;
}

function makeCachingFunction() {
  var cachedEl = null;
  var lastUpdate = Date.now();

  return function cacheElement(el, time) {
    if (Date.now() - lastUpdate < time) {
      return cachedEl;
    }

    cachedEl = el;
    lastUpdate = Date.now();

    return el;
  };
}

exports.default = {
  generateFileID: generateFileID,
  toArray: toArray,
  every: every,
  flatten: flatten,
  groupBy: groupBy,
  $: $,
  $$: $$,
  extend: extend,
  readFile: readFile,
  createImageThumbnail: createImageThumbnail,
  getProportionalImageHeight: getProportionalImageHeight,
  isTouchDevice: isTouchDevice,
  getFileNameAndExtension: getFileNameAndExtension,
  truncateString: truncateString,
  getFileType: getFileType,
  secondsToTime: secondsToTime,
  dataURItoBlob: dataURItoBlob,
  dataURItoFile: dataURItoFile,
  getSpeed: getSpeed,
  getETA: getETA,
  makeWorker: makeWorker,
  makeCachingFunction: makeCachingFunction
};

},{"es6-promise":4}],32:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _yoYo = require('yo-yo');

var _yoYo2 = _interopRequireDefault(_yoYo);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _yoYo2.default;
module.exports = exports['default'];

},{"yo-yo":19}],33:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _Core = require('./Core');

var _Core2 = _interopRequireDefault(_Core);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _Core2.default;
module.exports = exports['default'];

},{"./Core":28}],34:[function(require,module,exports){
'use strict';

exports.__esModule = true;
var en_US = {};

en_US.strings = {
  chooseFile: 'Choose a file',
  youHaveChosen: 'You have chosen: %{fileName}',
  orDragDrop: 'or drag it here',
  filesChosen: {
    0: '%{smart_count} file selected',
    1: '%{smart_count} files selected'
  },
  filesUploaded: {
    0: '%{smart_count} file uploaded',
    1: '%{smart_count} files uploaded'
  },
  files: {
    0: '%{smart_count} file',
    1: '%{smart_count} files'
  },
  uploadFiles: {
    0: 'Upload %{smart_count} file',
    1: 'Upload %{smart_count} files'
  },
  selectToUpload: 'Select files to upload',
  closeModal: 'Close Modal',
  upload: 'Upload',
  importFrom: 'Import files from',
  dashboardWindowTitle: 'Uppy Dashboard Window (Press escape to close)',
  dashboardTitle: 'Uppy Dashboard',
  copyLinkToClipboardSuccess: 'Link copied to clipboard.',
  copyLinkToClipboardFallback: 'Copy the URL below',
  done: 'Done',
  localDisk: 'Local Disk',
  dropPasteImport: 'Drop files here, paste, import from one of the locations above or',
  dropPaste: 'Drop files here, paste or',
  browse: 'browse',
  fileProgress: 'File progress: upload speed and ETA',
  numberOfSelectedFiles: 'Number of selected files',
  uploadAllNewFiles: 'Upload all new files'
};

en_US.pluralize = function (n) {
  if (n === 1) {
    return 0;
  }
  return 1;
};

if (typeof window !== 'undefined' && typeof window.Uppy !== 'undefined') {
  window.Uppy.locales.en_US = en_US;
}

exports.default = en_US;
module.exports = exports['default'];

},{}],35:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['\n    <span>\n      ', '\n      <button type="button"\n              class="UppyDashboard-browse"\n              onclick=', '>', '</button>\n      <input class="UppyDashboard-input" type="file" name="files[]" multiple="true"\n             onchange=', ' />\n    </span>\n  '], ['\n    <span>\n      ', '\n      <button type="button"\n              class="UppyDashboard-browse"\n              onclick=', '>', '</button>\n      <input class="UppyDashboard-input" type="file" name="files[]" multiple="true"\n             onchange=', ' />\n    </span>\n  ']);

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  return (0, _html2.default)(_templateObject, props.acquirers.length === 0 ? props.i18n('dropPaste') : props.i18n('dropPasteImport'), function (ev) {
    var input = document.querySelector(props.container + ' .UppyDashboard-input');
    input.click();
  }, props.i18n('browse'), props.handleInputChange);
};

module.exports = exports['default'];

},{"../../core/html":32}],36:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['\n    <div class="Uppy UppyTheme--default UppyDashboard\n                          ', '\n                          ', '\n                          ', '"\n          aria-hidden="', '"\n          aria-label="', '"\n          role="dialog"\n          onpaste=', '>\n\n    <button class="UppyDashboard-close"\n            aria-label="', '"\n            title="', '"\n            onclick=', '>', '</button>\n\n    <div class="UppyDashboard-overlay"\n         onclick=', '>\n    </div>\n\n    <div class="UppyDashboard-inner" tabindex="0">\n      <div class="UppyDashboard-innerWrap">\n\n        ', '\n\n        ', '\n\n        <div class="UppyDashboard-filesContainer">\n\n          ', '\n\n          <div class="UppyDashboard-actions">\n            ', '\n          </div>\n\n        </div>\n\n        <div class="UppyDashboardContent-panel"\n             role="tabpanel"\n             aria-hidden="', '">\n          <div class="UppyDashboardContent-bar">\n            <h2 class="UppyDashboardContent-title">\n              ', ' ', '\n            </h2>\n            <button class="UppyDashboardContent-back"\n                    onclick=', '>', '</button>\n          </div>\n          ', '\n        </div>\n\n        <div class="UppyDashboard-progressindicators">\n          ', '\n\n          ', '\n        </div>\n\n      </div>\n    </div>\n  </div>\n  '], ['\n    <div class="Uppy UppyTheme--default UppyDashboard\n                          ', '\n                          ', '\n                          ', '"\n          aria-hidden="', '"\n          aria-label="', '"\n          role="dialog"\n          onpaste=', '>\n\n    <button class="UppyDashboard-close"\n            aria-label="', '"\n            title="', '"\n            onclick=', '>', '</button>\n\n    <div class="UppyDashboard-overlay"\n         onclick=', '>\n    </div>\n\n    <div class="UppyDashboard-inner" tabindex="0">\n      <div class="UppyDashboard-innerWrap">\n\n        ', '\n\n        ', '\n\n        <div class="UppyDashboard-filesContainer">\n\n          ', '\n\n          <div class="UppyDashboard-actions">\n            ', '\n          </div>\n\n        </div>\n\n        <div class="UppyDashboardContent-panel"\n             role="tabpanel"\n             aria-hidden="', '">\n          <div class="UppyDashboardContent-bar">\n            <h2 class="UppyDashboardContent-title">\n              ', ' ', '\n            </h2>\n            <button class="UppyDashboardContent-back"\n                    onclick=', '>', '</button>\n          </div>\n          ', '\n        </div>\n\n        <div class="UppyDashboard-progressindicators">\n          ', '\n\n          ', '\n        </div>\n\n      </div>\n    </div>\n  </div>\n  ']);

exports.default = Dashboard;

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

var _FileList = require('./FileList');

var _FileList2 = _interopRequireDefault(_FileList);

var _Tabs = require('./Tabs');

var _Tabs2 = _interopRequireDefault(_Tabs);

var _FileCard = require('./FileCard');

var _FileCard2 = _interopRequireDefault(_FileCard);

var _UploadBtn = require('./UploadBtn');

var _UploadBtn2 = _interopRequireDefault(_UploadBtn);

var _StatusBar = require('./StatusBar');

var _StatusBar2 = _interopRequireDefault(_StatusBar);

var _Utils = require('../../core/Utils');

var _icons = require('./icons');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }
// import ProgressCircle from './ProgressCircle'


// http://dev.edenspiekermann.com/2016/02/11/introducing-accessible-modal-dialog

function Dashboard(props) {
  var handleInputChange = function handleInputChange(ev) {
    ev.preventDefault();
    var files = (0, _Utils.toArray)(ev.target.files);

    files.forEach(function (file) {
      props.addFile({
        source: props.id,
        name: file.name,
        type: file.type,
        data: file
      });
    });
  };

  // @TODO Exprimental, work in progress
  // no names, weird API, Chrome-only http://stackoverflow.com/a/22940020
  var handlePaste = function handlePaste(ev) {
    ev.preventDefault();

    var files = (0, _Utils.toArray)(ev.clipboardData.items);
    files.forEach(function (file) {
      if (file.kind !== 'file') return;

      var blob = file.getAsFile();
      props.log('File pasted');
      props.addFile({
        source: props.id,
        name: file.name,
        type: file.type,
        data: blob
      });
    });
  };

  return (0, _html2.default)(_templateObject, (0, _Utils.isTouchDevice)() ? 'Uppy--isTouchDevice' : '', props.semiTransparent ? 'UppyDashboard--semiTransparent' : '', !props.inline ? 'UppyDashboard--modal' : '', props.inline ? 'false' : props.modal.isHidden, !props.inline ? props.i18n('dashboardWindowTitle') : props.i18n('dashboardTitle'), handlePaste, props.i18n('closeModal'), props.i18n('closeModal'), props.hideModal, (0, _icons.closeIcon)(), props.hideModal, (0, _Tabs2.default)({
    files: props.files,
    handleInputChange: handleInputChange,
    acquirers: props.acquirers,
    container: props.container,
    panelSelectorPrefix: props.panelSelectorPrefix,
    showPanel: props.showPanel,
    i18n: props.i18n
  }), (0, _FileCard2.default)({
    files: props.files,
    fileCardFor: props.fileCardFor,
    done: props.fileCardDone,
    metaFields: props.metaFields,
    log: props.log,
    i18n: props.i18n
  }), (0, _FileList2.default)({
    acquirers: props.acquirers,
    files: props.files,
    handleInputChange: handleInputChange,
    container: props.container,
    showFileCard: props.showFileCard,
    showProgressDetails: props.showProgressDetails,
    totalProgress: props.totalProgress,
    totalFileCount: props.totalFileCount,
    info: props.info,
    i18n: props.i18n,
    log: props.log,
    removeFile: props.removeFile,
    pauseAll: props.pauseAll,
    resumeAll: props.resumeAll,
    pauseUpload: props.pauseUpload,
    startUpload: props.startUpload,
    cancelUpload: props.cancelUpload,
    resumableUploads: props.resumableUploads
  }), !props.autoProceed && props.newFiles.length > 0 ? (0, _UploadBtn2.default)({
    i18n: props.i18n,
    startUpload: props.startUpload,
    newFileCount: props.newFiles.length
  }) : null, props.activePanel ? 'false' : 'true', props.i18n('importFrom'), props.activePanel ? props.activePanel.name : null, props.hideAllPanels, props.i18n('done'), props.activePanel ? props.activePanel.render(props.state) : '', (0, _StatusBar2.default)({
    totalProgress: props.totalProgress,
    totalFileCount: props.totalFileCount,
    uploadStartedFiles: props.uploadStartedFiles,
    isAllComplete: props.isAllComplete,
    isAllPaused: props.isAllPaused,
    isUploadStarted: props.isUploadStarted,
    pauseAll: props.pauseAll,
    resumeAll: props.resumeAll,
    cancelAll: props.cancelAll,
    complete: props.completeFiles.length,
    inProgress: props.inProgress,
    totalSpeed: props.totalSpeed,
    totalETA: props.totalETA,
    startUpload: props.startUpload,
    newFileCount: props.newFiles.length,
    i18n: props.i18n,
    resumableUploads: props.resumableUploads
  }), props.progressindicators.map(function (target) {
    return target.render(props.state);
  }));
}
module.exports = exports['default'];

},{"../../core/Utils":31,"../../core/html":32,"./FileCard":37,"./FileList":40,"./StatusBar":41,"./Tabs":42,"./UploadBtn":43,"./icons":44}],37:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['<fieldset class="UppyDashboardFileCard-fieldset">\n        <label class="UppyDashboardFileCard-label">', '</label>\n        <input class="UppyDashboardFileCard-input"\n                         name="', '"\n                         type="text"\n                         value="', '"\n                         placeholder="', '"\n                         onkeyup=', ' /></fieldset>'], ['<fieldset class="UppyDashboardFileCard-fieldset">\n        <label class="UppyDashboardFileCard-label">', '</label>\n        <input class="UppyDashboardFileCard-input"\n                         name="', '"\n                         type="text"\n                         value="', '"\n                         placeholder="', '"\n                         onkeyup=', ' /></fieldset>']),
    _templateObject2 = _taggedTemplateLiteralLoose(['<div class="UppyDashboardFileCard" aria-hidden="', '">\n    <div class="UppyDashboardContent-bar">\n      <h2 class="UppyDashboardContent-title">Editing <span class="UppyDashboardContent-titleFile">', '</span></h2>\n      <button class="UppyDashboardContent-back" title="Finish editing file"\n              onclick=', '>Done</button>\n    </div>\n    ', '\n    <div class="UppyDashboard-actions">\n      <button class="UppyButton--circular UppyButton--blue UppyButton--sizeM UppyDashboardFileCard-done"\n              type="button"\n              title="Finish editing file"\n              onclick=', '>', '</button>\n    </div>\n    </div>'], ['<div class="UppyDashboardFileCard" aria-hidden="', '">\n    <div class="UppyDashboardContent-bar">\n      <h2 class="UppyDashboardContent-title">Editing <span class="UppyDashboardContent-titleFile">', '</span></h2>\n      <button class="UppyDashboardContent-back" title="Finish editing file"\n              onclick=', '>Done</button>\n    </div>\n    ', '\n    <div class="UppyDashboard-actions">\n      <button class="UppyButton--circular UppyButton--blue UppyButton--sizeM UppyDashboardFileCard-done"\n              type="button"\n              title="Finish editing file"\n              onclick=', '>', '</button>\n    </div>\n    </div>']),
    _templateObject3 = _taggedTemplateLiteralLoose(['<div class="UppyDashboardFileCard-inner">\n          <div class="UppyDashboardFileCard-preview">\n            ', '\n          </div>\n          <div class="UppyDashboardFileCard-info">\n            <fieldset class="UppyDashboardFileCard-fieldset">\n              <label class="UppyDashboardFileCard-label">Name</label>\n              <input class="UppyDashboardFileCard-input" name="name" type="text" value="', '"\n                     onkeyup=', ' />\n            </fieldset>\n            ', '\n          </div>\n        </div>'], ['<div class="UppyDashboardFileCard-inner">\n          <div class="UppyDashboardFileCard-preview">\n            ', '\n          </div>\n          <div class="UppyDashboardFileCard-info">\n            <fieldset class="UppyDashboardFileCard-fieldset">\n              <label class="UppyDashboardFileCard-label">Name</label>\n              <input class="UppyDashboardFileCard-input" name="name" type="text" value="', '"\n                     onkeyup=', ' />\n            </fieldset>\n            ', '\n          </div>\n        </div>']),
    _templateObject4 = _taggedTemplateLiteralLoose(['<img alt="', '" src="', '">'], ['<img alt="', '" src="', '">']),
    _templateObject5 = _taggedTemplateLiteralLoose(['<div class="UppyDashboardItem-previewIcon">', '</div>'], ['<div class="UppyDashboardItem-previewIcon">', '</div>']);

exports.default = fileCard;

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

var _icons = require('./icons');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

function getIconByMime(fileTypeGeneral) {
  switch (fileTypeGeneral) {
    case 'text':
      return (0, _icons.iconText)();
    case 'audio':
      return (0, _icons.iconAudio)();
    default:
      return (0, _icons.iconFile)();
  }
}

function fileCard(props) {
  var file = props.fileCardFor ? props.files[props.fileCardFor] : false;
  var meta = {};

  function tempStoreMeta(ev) {
    var value = ev.target.value;
    var name = ev.target.attributes.name.value;
    meta[name] = value;
  }

  function renderMetaFields(file) {
    var metaFields = props.metaFields || [];
    return metaFields.map(function (field) {
      return (0, _html2.default)(_templateObject, field.name, field.id, file.meta[field.id], field.placeholder || '', tempStoreMeta);
    });
  }

  return (0, _html2.default)(_templateObject2, !props.fileCardFor, file.meta ? file.meta.name : file.name, function () {
    return props.done(meta, file.id);
  }, props.fileCardFor ? (0, _html2.default)(_templateObject3, file.preview ? (0, _html2.default)(_templateObject4, file.name, file.preview) : (0, _html2.default)(_templateObject5, getIconByMime(file.type.general)), file.meta.name, tempStoreMeta, renderMetaFields(file)) : null, function () {
    return props.done(meta, file.id);
  }, (0, _icons.checkIcon)());
}
module.exports = exports['default'];

},{"../../core/html":32,"./icons":44}],38:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['<li class="UppyDashboardItem\n                        ', '\n                        ', '\n                        ', '\n                        ', '"\n                  id="uppy_', '"\n                  title="', '">\n      <div class="UppyDashboardItem-preview">\n        ', '\n        <div class="UppyDashboardItem-progress">\n          <button class="UppyDashboardItem-progressBtn"\n                  title="', '"\n                  onclick=', '>\n            ', '\n          </button>\n          ', '\n        </div>\n      </div>\n    <div class="UppyDashboardItem-info">\n      <h4 class="UppyDashboardItem-name" title="', '">\n        ', '\n      </h4>\n      <div class="UppyDashboardItem-status">\n        <span class="UppyDashboardItem-statusSize">', '</span>\n      </div>\n      ', '\n      ', '\n    </div>\n    <div class="UppyDashboardItem-action">\n      ', '\n    </div>\n  </li>'], ['<li class="UppyDashboardItem\n                        ', '\n                        ', '\n                        ', '\n                        ', '"\n                  id="uppy_', '"\n                  title="', '">\n      <div class="UppyDashboardItem-preview">\n        ', '\n        <div class="UppyDashboardItem-progress">\n          <button class="UppyDashboardItem-progressBtn"\n                  title="', '"\n                  onclick=', '>\n            ', '\n          </button>\n          ', '\n        </div>\n      </div>\n    <div class="UppyDashboardItem-info">\n      <h4 class="UppyDashboardItem-name" title="', '">\n        ', '\n      </h4>\n      <div class="UppyDashboardItem-status">\n        <span class="UppyDashboardItem-statusSize">', '</span>\n      </div>\n      ', '\n      ', '\n    </div>\n    <div class="UppyDashboardItem-action">\n      ', '\n    </div>\n  </li>']),
    _templateObject2 = _taggedTemplateLiteralLoose(['<img alt="', '" src="', '">'], ['<img alt="', '" src="', '">']),
    _templateObject3 = _taggedTemplateLiteralLoose(['<div class="UppyDashboardItem-progressInfo"\n                        title="', '"\n                        aria-label="', '">\n                ', '\n              </div>'], ['<div class="UppyDashboardItem-progressInfo"\n                        title="', '"\n                        aria-label="', '">\n                ', '\n              </div>']),
    _templateObject4 = _taggedTemplateLiteralLoose(['<span>', ' \u30FB \u2191 ', '/s</span>'], ['<span>', ' \u30FB \u2191 ', '/s</span>']),
    _templateObject5 = _taggedTemplateLiteralLoose(['<a href="', '" target="_blank">\n              ', '\n            </a>'], ['<a href="', '" target="_blank">\n              ', '\n            </a>']),
    _templateObject6 = _taggedTemplateLiteralLoose(['<button class="UppyDashboardItem-edit"\n                       aria-label="Edit file"\n                       title="Edit file"\n                       onclick=', '>\n                        ', '</button>'], ['<button class="UppyDashboardItem-edit"\n                       aria-label="Edit file"\n                       title="Edit file"\n                       onclick=', '>\n                        ', '</button>']),
    _templateObject7 = _taggedTemplateLiteralLoose(['<button class="UppyDashboardItem-copyLink"\n                       aria-label="Copy link"\n                       title="Copy link"\n                       onclick=', '>', '</button>'], ['<button class="UppyDashboardItem-copyLink"\n                       aria-label="Copy link"\n                       title="Copy link"\n                       onclick=', '>', '</button>']),
    _templateObject8 = _taggedTemplateLiteralLoose(['<button class="UppyDashboardItem-remove"\n                       aria-label="Remove file"\n                       title="Remove file"\n                       onclick=', '>\n                 <svg class="UppyIcon" width="22" height="21" viewBox="0 0 18 17">\n                   <ellipse fill="#424242" cx="8.62" cy="8.383" rx="8.62" ry="8.383"/>\n                   <path stroke="#FFF" fill="#FFF" d="M11 6.147L10.85 6 8.5 8.284 6.15 6 6 6.147 8.35 8.43 6 10.717l.15.146L8.5 8.578l2.35 2.284.15-.146L8.65 8.43z"/>\n                 </svg>\n               </button>'], ['<button class="UppyDashboardItem-remove"\n                       aria-label="Remove file"\n                       title="Remove file"\n                       onclick=', '>\n                 <svg class="UppyIcon" width="22" height="21" viewBox="0 0 18 17">\n                   <ellipse fill="#424242" cx="8.62" cy="8.383" rx="8.62" ry="8.383"/>\n                   <path stroke="#FFF" fill="#FFF" d="M11 6.147L10.85 6 8.5 8.284 6.15 6 6 6.147 8.35 8.43 6 10.717l.15.146L8.5 8.578l2.35 2.284.15-.146L8.65 8.43z"/>\n                 </svg>\n               </button>']);

exports.default = fileItem;

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

var _Utils = require('../../core/Utils');

var _prettyBytes = require('pretty-bytes');

var _prettyBytes2 = _interopRequireDefault(_prettyBytes);

var _FileItemProgress = require('./FileItemProgress');

var _FileItemProgress2 = _interopRequireDefault(_FileItemProgress);

var _icons = require('./icons');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

function getIconByMime(fileTypeGeneral) {
  switch (fileTypeGeneral) {
    case 'text':
      return (0, _icons.iconText)();
    case 'audio':
      return (0, _icons.iconAudio)();
    default:
      return (0, _icons.iconFile)();
  }
}

function fileItem(props) {
  var file = props.file;

  var isUploaded = file.progress.uploadComplete;
  var uploadInProgressOrComplete = file.progress.uploadStarted;
  var uploadInProgress = file.progress.uploadStarted && !file.progress.uploadComplete;
  var isPaused = file.isPaused || false;

  var fileName = (0, _Utils.getFileNameAndExtension)(file.meta.name)[0];
  var truncatedFileName = (0, _Utils.truncateString)(fileName, 15);

  return (0, _html2.default)(_templateObject, uploadInProgress ? 'is-inprogress' : '', isUploaded ? 'is-complete' : '', isPaused ? 'is-paused' : '', props.resumableUploads ? 'is-resumable' : '', file.id, file.meta.name, file.preview ? (0, _html2.default)(_templateObject2, file.name, file.preview) : getIconByMime(file.type.general), isUploaded ? 'upload complete' : props.resumableUploads ? file.isPaused ? 'resume upload' : 'pause upload' : 'cancel upload', function (ev) {
    if (isUploaded) return;
    if (props.resumableUploads) {
      props.pauseUpload(file.id);
    } else {
      props.cancelUpload(file.id);
    }
  }, (0, _FileItemProgress2.default)({
    progress: file.progress.percentage,
    fileID: file.id
  }), props.showProgressDetails ? (0, _html2.default)(_templateObject3, props.i18n('fileProgress'), props.i18n('fileProgress'), !file.isPaused && !isUploaded ? (0, _html2.default)(_templateObject4, (0, _Utils.prettyETA)((0, _Utils.getETA)(file.progress)), (0, _prettyBytes2.default)((0, _Utils.getSpeed)(file.progress))) : null) : null, fileName, file.uploadURL ? (0, _html2.default)(_templateObject5, file.uploadURL, file.extension ? truncatedFileName + '.' + file.extension : truncatedFileName) : file.extension ? truncatedFileName + '.' + file.extension : truncatedFileName, file.data.size ? (0, _prettyBytes2.default)(file.data.size) : '?', !uploadInProgressOrComplete ? (0, _html2.default)(_templateObject6, function (e) {
    return props.showFileCard(file.id);
  }, (0, _icons.iconEdit)()) : null, file.uploadURL ? (0, _html2.default)(_templateObject7, function () {
    (0, _Utils.copyToClipboard)(file.uploadURL, props.i18n('copyLinkToClipboardFallback')).then(function () {
      props.log('Link copied to clipboard.');
      props.info(props.i18n('copyLinkToClipboardSuccess'), 'info', 3000);
    }).catch(props.log);
  }, (0, _icons.iconCopy)()) : null, !isUploaded ? (0, _html2.default)(_templateObject8, function () {
    return props.removeFile(file.id);
  }) : null);
}
module.exports = exports['default'];

},{"../../core/Utils":31,"../../core/html":32,"./FileItemProgress":39,"./icons":44,"pretty-bytes":6}],39:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['\n    <svg width="70" height="70" viewBox="0 0 36 36" class="UppyIcon UppyIcon-progressCircle">\n      <g class="progress-group">\n        <circle r="15" cx="18" cy="18" stroke-width="2" fill="none" class="bg"/>\n        <circle r="15" cx="18" cy="18" transform="rotate(-90, 18, 18)" stroke-width="2" fill="none" stroke-dasharray="100" stroke-dashoffset="', '" class="progress"/>\n      </g>\n      <polygon transform="translate(3, 3)" points="12 20 12 10 20 15" class="play"/>\n      <g transform="translate(14.5, 13)" class="pause">\n        <rect x="0" y="0" width="2" height="10" rx="0" />\n        <rect x="5" y="0" width="2" height="10" rx="0" />\n      </g>\n      <polygon transform="translate(2, 3)" points="14 22.5 7 15.2457065 8.99985857 13.1732815 14 18.3547104 22.9729883 9 25 11.1005634" class="check"/>\n      <polygon class="cancel" transform="translate(2, 2)" points="19.8856516 11.0625 16 14.9481516 12.1019737 11.0625 11.0625 12.1143484 14.9481516 16 11.0625 19.8980263 12.1019737 20.9375 16 17.0518484 19.8856516 20.9375 20.9375 19.8980263 17.0518484 16 20.9375 12"></polygon>\n  </svg>'], ['\n    <svg width="70" height="70" viewBox="0 0 36 36" class="UppyIcon UppyIcon-progressCircle">\n      <g class="progress-group">\n        <circle r="15" cx="18" cy="18" stroke-width="2" fill="none" class="bg"/>\n        <circle r="15" cx="18" cy="18" transform="rotate(-90, 18, 18)" stroke-width="2" fill="none" stroke-dasharray="100" stroke-dashoffset="', '" class="progress"/>\n      </g>\n      <polygon transform="translate(3, 3)" points="12 20 12 10 20 15" class="play"/>\n      <g transform="translate(14.5, 13)" class="pause">\n        <rect x="0" y="0" width="2" height="10" rx="0" />\n        <rect x="5" y="0" width="2" height="10" rx="0" />\n      </g>\n      <polygon transform="translate(2, 3)" points="14 22.5 7 15.2457065 8.99985857 13.1732815 14 18.3547104 22.9729883 9 25 11.1005634" class="check"/>\n      <polygon class="cancel" transform="translate(2, 2)" points="19.8856516 11.0625 16 14.9481516 12.1019737 11.0625 11.0625 12.1143484 14.9481516 16 11.0625 19.8980263 12.1019737 20.9375 16 17.0518484 19.8856516 20.9375 20.9375 19.8980263 17.0518484 16 20.9375 12"></polygon>\n  </svg>']);

exports.default = function (props) {
  return (0, _html2.default)(_templateObject, 100 - props.progress);
};

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

// http://codepen.io/Harkko/pen/rVxvNM
// https://gist.github.com/eswak/ad4ea57bcd5ff7aa5d42

module.exports = exports['default'];

},{"../../core/html":32}],40:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['<ul class="UppyDashboard-files\n                         ', '">\n      ', '\n      ', '\n    </ul>'], ['<ul class="UppyDashboard-files\n                         ', '">\n      ', '\n      ', '\n    </ul>']),
    _templateObject2 = _taggedTemplateLiteralLoose(['<div class="UppyDashboard-bgIcon">\n          ', '\n          <h3 class="UppyDashboard-dropFilesTitle">\n            ', '\n          </h3>\n          <input class="UppyDashboard-input" type="file" name="files[]" multiple="true"\n                 onchange=', ' />\n         </div>'], ['<div class="UppyDashboard-bgIcon">\n          ', '\n          <h3 class="UppyDashboard-dropFilesTitle">\n            ', '\n          </h3>\n          <input class="UppyDashboard-input" type="file" name="files[]" multiple="true"\n                 onchange=', ' />\n         </div>']);

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

var _FileItem = require('./FileItem');

var _FileItem2 = _interopRequireDefault(_FileItem);

var _ActionBrowseTagline = require('./ActionBrowseTagline');

var _ActionBrowseTagline2 = _interopRequireDefault(_ActionBrowseTagline);

var _icons = require('./icons');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  return (0, _html2.default)(_templateObject, props.totalFileCount === 0 ? 'UppyDashboard-files--noFiles' : '', props.totalFileCount === 0 ? (0, _html2.default)(_templateObject2, (0, _icons.dashboardBgIcon)(), (0, _ActionBrowseTagline2.default)({
    acquirers: props.acquirers,
    container: props.container,
    handleInputChange: props.handleInputChange,
    i18n: props.i18n
  }), props.handleInputChange) : null, Object.keys(props.files).map(function (fileID) {
    return (0, _FileItem2.default)({
      file: props.files[fileID],
      showFileCard: props.showFileCard,
      showProgressDetails: props.showProgressDetails,
      info: props.info,
      log: props.log,
      i18n: props.i18n,
      removeFile: props.removeFile,
      pauseUpload: props.pauseUpload,
      cancelUpload: props.cancelUpload,
      resumableUploads: props.resumableUploads
    });
  }));
};

module.exports = exports['default'];

},{"../../core/html":32,"./ActionBrowseTagline":35,"./FileItem":38,"./icons":44}],41:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['\n    <div class="UppyDashboard-statusBar\n                ', '"\n                aria-hidden="', '">\n\n      <div class="UppyDashboard-statusBarProgress" style="width: ', '%"></div>\n      <div class="UppyDashboard-statusBarContent">\n        ', '\n        ', '\n      </div>\n    </div>\n  '], ['\n    <div class="UppyDashboard-statusBar\n                ', '"\n                aria-hidden="', '">\n\n      <div class="UppyDashboard-statusBarProgress" style="width: ', '%"></div>\n      <div class="UppyDashboard-statusBarContent">\n        ', '\n        ', '\n      </div>\n    </div>\n  ']),
    _templateObject2 = _taggedTemplateLiteralLoose(['<span>', ' Uploading... ', ' / ', '\u30FB', '%\u30FB', '\u30FB\u2191 ', '/s</span>'], ['<span>', ' Uploading... ', ' / ', '\u30FB', '%\u30FB', '\u30FB\u2191 ', '/s</span>']),
    _templateObject3 = _taggedTemplateLiteralLoose(['<span>', ' Paused\u30FB', '%</span>'], ['<span>', ' Paused\u30FB', '%</span>']),
    _templateObject4 = _taggedTemplateLiteralLoose(['<span><svg class="UppyIcon" width="18" height="17" viewBox="0 0 23 17">\n              <path d="M8.944 17L0 7.865l2.555-2.61 6.39 6.525L20.41 0 23 2.645z" />\n            </svg>Upload complete\u30FB', '%</span>'], ['<span><svg class="UppyIcon" width="18" height="17" viewBox="0 0 23 17">\n              <path d="M8.944 17L0 7.865l2.555-2.61 6.39 6.525L20.41 0 23 2.645z" />\n            </svg>Upload complete\u30FB', '%</span>']),
    _templateObject5 = _taggedTemplateLiteralLoose(['<button class="UppyDashboard-statusBarAction" type="button" onclick=', '>\n    ', '\n  </button>'], ['<button class="UppyDashboard-statusBarAction" type="button" onclick=', '>\n    ', '\n  </button>']),
    _templateObject6 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="15" height="17" viewBox="0 0 11 13">\n          <path d="M1.26 12.534a.67.67 0 0 1-.674.012.67.67 0 0 1-.336-.583v-11C.25.724.38.5.586.382a.658.658 0 0 1 .673.012l9.165 5.5a.66.66 0 0 1 .325.57.66.66 0 0 1-.325.573l-9.166 5.5z" />\n        </svg>'], ['<svg class="UppyIcon" width="15" height="17" viewBox="0 0 11 13">\n          <path d="M1.26 12.534a.67.67 0 0 1-.674.012.67.67 0 0 1-.336-.583v-11C.25.724.38.5.586.382a.658.658 0 0 1 .673.012l9.165 5.5a.66.66 0 0 1 .325.57.66.66 0 0 1-.325.573l-9.166 5.5z" />\n        </svg>']),
    _templateObject7 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="16" height="17" viewBox="0 0 12 13">\n          <path d="M4.888.81v11.38c0 .446-.324.81-.722.81H2.722C2.324 13 2 12.636 2 12.19V.81c0-.446.324-.81.722-.81h1.444c.398 0 .722.364.722.81zM9.888.81v11.38c0 .446-.324.81-.722.81H7.722C7.324 13 7 12.636 7 12.19V.81c0-.446.324-.81.722-.81h1.444c.398 0 .722.364.722.81z"/>\n        </svg>'], ['<svg class="UppyIcon" width="16" height="17" viewBox="0 0 12 13">\n          <path d="M4.888.81v11.38c0 .446-.324.81-.722.81H2.722C2.324 13 2 12.636 2 12.19V.81c0-.446.324-.81.722-.81h1.444c.398 0 .722.364.722.81zM9.888.81v11.38c0 .446-.324.81-.722.81H7.722C7.324 13 7 12.636 7 12.19V.81c0-.446.324-.81.722-.81h1.444c.398 0 .722.364.722.81z"/>\n        </svg>']),
    _templateObject8 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="16px" height="16px" viewBox="0 0 19 19">\n        <path d="M17.318 17.232L9.94 9.854 9.586 9.5l-.354.354-7.378 7.378h.707l-.62-.62v.706L9.318 9.94l.354-.354-.354-.354L1.94 1.854v.707l.62-.62h-.706l7.378 7.378.354.354.354-.354 7.378-7.378h-.707l.622.62v-.706L9.854 9.232l-.354.354.354.354 7.378 7.378.708-.707-7.38-7.378v.708l7.38-7.38.353-.353-.353-.353-.622-.622-.353-.353-.354.352-7.378 7.38h.708L2.56 1.23 2.208.88l-.353.353-.622.62-.353.355.352.353 7.38 7.38v-.708l-7.38 7.38-.353.353.352.353.622.622.353.353.354-.353 7.38-7.38h-.708l7.38 7.38z"/>\n      </svg>'], ['<svg class="UppyIcon" width="16px" height="16px" viewBox="0 0 19 19">\n        <path d="M17.318 17.232L9.94 9.854 9.586 9.5l-.354.354-7.378 7.378h.707l-.62-.62v.706L9.318 9.94l.354-.354-.354-.354L1.94 1.854v.707l.62-.62h-.706l7.378 7.378.354.354.354-.354 7.378-7.378h-.707l.622.62v-.706L9.854 9.232l-.354.354.354.354 7.378 7.378.708-.707-7.38-7.378v.708l7.38-7.38.353-.353-.353-.353-.622-.622-.353-.353-.354.352-7.378 7.38h.708L2.56 1.23 2.208.88l-.353.353-.622.62-.353.355.352.353 7.38 7.38v-.708l-7.38 7.38-.353.353.352.353.622.622.353.353.354-.353 7.38-7.38h-.708l7.38 7.38z"/>\n      </svg>']);

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  props = props || {};

  var isHidden = props.totalFileCount === 0 || !props.isUploadStarted;

  return (0, _html2.default)(_templateObject, props.isAllComplete ? 'is-complete' : '', isHidden, props.totalProgress, props.isUploadStarted && !props.isAllComplete ? !props.isAllPaused ? (0, _html2.default)(_templateObject2, pauseResumeButtons(props), props.complete, props.inProgress, props.totalProgress || 0, props.totalETA, props.totalSpeed) : (0, _html2.default)(_templateObject3, pauseResumeButtons(props), props.totalProgress) : null, props.isAllComplete ? (0, _html2.default)(_templateObject4, props.totalProgress) : null);
};

// ${!props.autoProceed && props.newFileCount > 0
//   ? startUpload(props)
//   : null
// }

// const startUpload = (props) => {
//   return html`<button type="button" onclick=${props.startUpload}>
//     Upload
//     <sup class="UppyDashboard-uploadCountf"
//          title="${props.i18n('numberOfSelectedFiles')}"
//          aria-label="${props.i18n('numberOfSelectedFiles')}">
//       ${props.newFileCount}
//     </sup>
//   </button>`
// }

var pauseResumeButtons = function pauseResumeButtons(props) {
  console.log(props.resumableUploads);
  return (0, _html2.default)(_templateObject5, function () {
    return togglePauseResume(props);
  }, props.resumableUploads ? props.isAllPaused ? (0, _html2.default)(_templateObject6) : (0, _html2.default)(_templateObject7) : (0, _html2.default)(_templateObject8));
};

var togglePauseResume = function togglePauseResume(props) {
  if (props.isAllComplete) return;

  if (!props.resumableUploads) {
    return props.cancelAll();
  }

  if (props.isAllPaused) {
    return props.resumeAll();
  }

  return props.pauseAll();
};
module.exports = exports['default'];

},{"../../core/html":32}],42:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['\n      <div class="UppyDashboardTabs" aria-hidden="', '">\n        <h3 class="UppyDashboardTabs-title">\n        ', '\n        </h3>\n      </div>\n    '], ['\n      <div class="UppyDashboardTabs" aria-hidden="', '">\n        <h3 class="UppyDashboardTabs-title">\n        ', '\n        </h3>\n      </div>\n    ']),
    _templateObject2 = _taggedTemplateLiteralLoose(['<div class="UppyDashboardTabs">\n    <nav>\n      <ul class="UppyDashboardTabs-list" role="tablist">\n        <li class="UppyDashboardTab">\n          <button type="button" class="UppyDashboardTab-btn UppyDashboard-focus"\n                  role="tab"\n                  tabindex="0"\n                  onclick=', '>\n            ', '\n            <h5 class="UppyDashboardTab-name">', '</h5>\n          </button>\n          <input class="UppyDashboard-input" type="file" name="files[]" multiple="true"\n                 onchange=', ' />\n        </li>\n        ', '\n      </ul>\n    </nav>\n  </div>'], ['<div class="UppyDashboardTabs">\n    <nav>\n      <ul class="UppyDashboardTabs-list" role="tablist">\n        <li class="UppyDashboardTab">\n          <button type="button" class="UppyDashboardTab-btn UppyDashboard-focus"\n                  role="tab"\n                  tabindex="0"\n                  onclick=', '>\n            ', '\n            <h5 class="UppyDashboardTab-name">', '</h5>\n          </button>\n          <input class="UppyDashboard-input" type="file" name="files[]" multiple="true"\n                 onchange=', ' />\n        </li>\n        ', '\n      </ul>\n    </nav>\n  </div>']),
    _templateObject3 = _taggedTemplateLiteralLoose(['<li class="UppyDashboardTab">\n            <button class="UppyDashboardTab-btn"\n                    role="tab"\n                    tabindex="0"\n                    aria-controls="', '--', '"\n                    aria-selected="', '"\n                    onclick=', '>\n              ', '\n              <h5 class="UppyDashboardTab-name">', '</h5>\n            </button>\n          </li>'], ['<li class="UppyDashboardTab">\n            <button class="UppyDashboardTab-btn"\n                    role="tab"\n                    tabindex="0"\n                    aria-controls="', '--', '"\n                    aria-selected="', '"\n                    onclick=', '>\n              ', '\n              <h5 class="UppyDashboardTab-name">', '</h5>\n            </button>\n          </li>']);

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

var _ActionBrowseTagline = require('./ActionBrowseTagline');

var _ActionBrowseTagline2 = _interopRequireDefault(_ActionBrowseTagline);

var _icons = require('./icons');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  var isHidden = Object.keys(props.files).length === 0;

  if (props.acquirers.length === 0) {
    return (0, _html2.default)(_templateObject, isHidden, (0, _ActionBrowseTagline2.default)({
      acquirers: props.acquirers,
      container: props.container,
      handleInputChange: props.handleInputChange,
      i18n: props.i18n
    }));
  }

  return (0, _html2.default)(_templateObject2, function (ev) {
    var input = document.querySelector(props.container + ' .UppyDashboard-input');
    input.click();
  }, (0, _icons.localIcon)(), props.i18n('localDisk'), props.handleInputChange, props.acquirers.map(function (target) {
    return (0, _html2.default)(_templateObject3, props.panelSelectorPrefix, target.id, target.isHidden ? 'false' : 'true', function () {
      return props.showPanel(target.id);
    }, target.icon, target.name);
  }));
};

module.exports = exports['default'];

},{"../../core/html":32,"./ActionBrowseTagline":35,"./icons":44}],43:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['<button class="UppyButton--circular\n                   UppyButton--blue\n                   UppyButton--sizeM\n                   UppyDashboard-upload"\n                 type="button"\n                 title="', '"\n                 aria-label="', '"\n                 onclick=', '>\n            ', '\n            <sup class="UppyDashboard-uploadCount"\n                 title="', '"\n                 aria-label="', '">\n                  ', '</sup>\n    </button>\n  '], ['<button class="UppyButton--circular\n                   UppyButton--blue\n                   UppyButton--sizeM\n                   UppyDashboard-upload"\n                 type="button"\n                 title="', '"\n                 aria-label="', '"\n                 onclick=', '>\n            ', '\n            <sup class="UppyDashboard-uploadCount"\n                 title="', '"\n                 aria-label="', '">\n                  ', '</sup>\n    </button>\n  ']);

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

var _icons = require('./icons');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  props = props || {};

  return (0, _html2.default)(_templateObject, props.i18n('uploadAllNewFiles'), props.i18n('uploadAllNewFiles'), props.startUpload, (0, _icons.uploadIcon)(), props.i18n('numberOfSelectedFiles'), props.i18n('numberOfSelectedFiles'), props.newFileCount);
};

module.exports = exports['default'];

},{"../../core/html":32,"./icons":44}],44:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="30" height="30" viewBox="0 0 30 30">\n    <path d="M15 30c8.284 0 15-6.716 15-15 0-8.284-6.716-15-15-15C6.716 0 0 6.716 0 15c0 8.284 6.716 15 15 15zm4.258-12.676v6.846h-8.426v-6.846H5.204l9.82-12.364 9.82 12.364H19.26z" />\n  </svg>'], ['<svg class="UppyIcon" width="30" height="30" viewBox="0 0 30 30">\n    <path d="M15 30c8.284 0 15-6.716 15-15 0-8.284-6.716-15-15-15C6.716 0 0 6.716 0 15c0 8.284 6.716 15 15 15zm4.258-12.676v6.846h-8.426v-6.846H5.204l9.82-12.364 9.82 12.364H19.26z" />\n  </svg>']),
    _templateObject2 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="51" height="51" viewBox="0 0 51 51">\n    <path d="M17.21 45.765a5.394 5.394 0 0 1-7.62 0l-4.12-4.122a5.393 5.393 0 0 1 0-7.618l6.774-6.775-2.404-2.404-6.775 6.776c-3.424 3.427-3.424 9 0 12.426l4.12 4.123a8.766 8.766 0 0 0 6.216 2.57c2.25 0 4.5-.858 6.214-2.57l13.55-13.552a8.72 8.72 0 0 0 2.575-6.213 8.73 8.73 0 0 0-2.575-6.213l-4.123-4.12-2.404 2.404 4.123 4.12a5.352 5.352 0 0 1 1.58 3.81c0 1.438-.562 2.79-1.58 3.808l-13.55 13.55z"/>\n    <path d="M44.256 2.858A8.728 8.728 0 0 0 38.043.283h-.002a8.73 8.73 0 0 0-6.212 2.574l-13.55 13.55a8.725 8.725 0 0 0-2.575 6.214 8.73 8.73 0 0 0 2.574 6.216l4.12 4.12 2.405-2.403-4.12-4.12a5.357 5.357 0 0 1-1.58-3.812c0-1.437.562-2.79 1.58-3.808l13.55-13.55a5.348 5.348 0 0 1 3.81-1.58c1.44 0 2.792.562 3.81 1.58l4.12 4.12c2.1 2.1 2.1 5.518 0 7.617L39.2 23.775l2.404 2.404 6.775-6.777c3.426-3.427 3.426-9 0-12.426l-4.12-4.12z"/>\n  </svg>'], ['<svg class="UppyIcon" width="51" height="51" viewBox="0 0 51 51">\n    <path d="M17.21 45.765a5.394 5.394 0 0 1-7.62 0l-4.12-4.122a5.393 5.393 0 0 1 0-7.618l6.774-6.775-2.404-2.404-6.775 6.776c-3.424 3.427-3.424 9 0 12.426l4.12 4.123a8.766 8.766 0 0 0 6.216 2.57c2.25 0 4.5-.858 6.214-2.57l13.55-13.552a8.72 8.72 0 0 0 2.575-6.213 8.73 8.73 0 0 0-2.575-6.213l-4.123-4.12-2.404 2.404 4.123 4.12a5.352 5.352 0 0 1 1.58 3.81c0 1.438-.562 2.79-1.58 3.808l-13.55 13.55z"/>\n    <path d="M44.256 2.858A8.728 8.728 0 0 0 38.043.283h-.002a8.73 8.73 0 0 0-6.212 2.574l-13.55 13.55a8.725 8.725 0 0 0-2.575 6.214 8.73 8.73 0 0 0 2.574 6.216l4.12 4.12 2.405-2.403-4.12-4.12a5.357 5.357 0 0 1-1.58-3.812c0-1.437.562-2.79 1.58-3.808l13.55-13.55a5.348 5.348 0 0 1 3.81-1.58c1.44 0 2.792.562 3.81 1.58l4.12 4.12c2.1 2.1 2.1 5.518 0 7.617L39.2 23.775l2.404 2.404 6.775-6.777c3.426-3.427 3.426-9 0-12.426l-4.12-4.12z"/>\n  </svg>']),
    _templateObject3 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="25" height="25" viewBox="0 0 44 44">\n    <polygon class="play" transform="translate(6, 5.5)" points="13 21.6666667 13 11 21 16.3333333" />\n  </svg>'], ['<svg class="UppyIcon" width="25" height="25" viewBox="0 0 44 44">\n    <polygon class="play" transform="translate(6, 5.5)" points="13 21.6666667 13 11 21 16.3333333" />\n  </svg>']),
    _templateObject4 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="25px" height="25px" viewBox="0 0 44 44">\n    <g transform="translate(18, 17)" class="pause">\n      <rect x="0" y="0" width="2" height="10" rx="0" />\n      <rect x="6" y="0" width="2" height="10" rx="0" />\n    </g>\n  </svg>'], ['<svg class="UppyIcon" width="25px" height="25px" viewBox="0 0 44 44">\n    <g transform="translate(18, 17)" class="pause">\n      <rect x="0" y="0" width="2" height="10" rx="0" />\n      <rect x="6" y="0" width="2" height="10" rx="0" />\n    </g>\n  </svg>']),
    _templateObject5 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="28" height="28" viewBox="0 0 28 28">\n    <path d="M25.436 2.566a7.98 7.98 0 0 0-2.078-1.51C22.638.703 21.906.5 21.198.5a3 3 0 0 0-1.023.17 2.436 2.436 0 0 0-.893.562L2.292 18.217.5 27.5l9.28-1.796 16.99-16.99c.255-.254.444-.56.562-.888a3 3 0 0 0 .17-1.023c0-.708-.205-1.44-.555-2.16a8 8 0 0 0-1.51-2.077zM9.01 24.252l-4.313.834c0-.03.008-.06.012-.09.007-.944-.74-1.715-1.67-1.723-.04 0-.078.007-.118.01l.83-4.29L17.72 5.024l5.264 5.264L9.01 24.252zm16.84-16.96a.818.818 0 0 1-.194.31l-1.57 1.57-5.26-5.26 1.57-1.57a.82.82 0 0 1 .31-.194 1.45 1.45 0 0 1 .492-.074c.397 0 .917.126 1.468.397.55.27 1.13.678 1.656 1.21.53.53.94 1.11 1.208 1.655.272.55.397 1.07.393 1.468.004.193-.027.358-.074.488z" />\n  </svg>'], ['<svg class="UppyIcon" width="28" height="28" viewBox="0 0 28 28">\n    <path d="M25.436 2.566a7.98 7.98 0 0 0-2.078-1.51C22.638.703 21.906.5 21.198.5a3 3 0 0 0-1.023.17 2.436 2.436 0 0 0-.893.562L2.292 18.217.5 27.5l9.28-1.796 16.99-16.99c.255-.254.444-.56.562-.888a3 3 0 0 0 .17-1.023c0-.708-.205-1.44-.555-2.16a8 8 0 0 0-1.51-2.077zM9.01 24.252l-4.313.834c0-.03.008-.06.012-.09.007-.944-.74-1.715-1.67-1.723-.04 0-.078.007-.118.01l.83-4.29L17.72 5.024l5.264 5.264L9.01 24.252zm16.84-16.96a.818.818 0 0 1-.194.31l-1.57 1.57-5.26-5.26 1.57-1.57a.82.82 0 0 1 .31-.194 1.45 1.45 0 0 1 .492-.074c.397 0 .917.126 1.468.397.55.27 1.13.678 1.656 1.21.53.53.94 1.11 1.208 1.655.272.55.397 1.07.393 1.468.004.193-.027.358-.074.488z" />\n  </svg>']),
    _templateObject6 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="27" height="25" viewBox="0 0 27 25">\n    <path d="M5.586 9.288a.313.313 0 0 0 .282.176h4.84v3.922c0 1.514 1.25 2.24 2.792 2.24 1.54 0 2.79-.726 2.79-2.24V9.464h4.84c.122 0 .23-.068.284-.176a.304.304 0 0 0-.046-.324L13.735.106a.316.316 0 0 0-.472 0l-7.63 8.857a.302.302 0 0 0-.047.325z"/>\n    <path d="M24.3 5.093c-.218-.76-.54-1.187-1.208-1.187h-4.856l1.018 1.18h3.948l2.043 11.038h-7.193v2.728H9.114v-2.725h-7.36l2.66-11.04h3.33l1.018-1.18H3.907c-.668 0-1.06.46-1.21 1.186L0 16.456v7.062C0 24.338.676 25 1.51 25h23.98c.833 0 1.51-.663 1.51-1.482v-7.062L24.3 5.093z"/>\n  </svg>'], ['<svg class="UppyIcon" width="27" height="25" viewBox="0 0 27 25">\n    <path d="M5.586 9.288a.313.313 0 0 0 .282.176h4.84v3.922c0 1.514 1.25 2.24 2.792 2.24 1.54 0 2.79-.726 2.79-2.24V9.464h4.84c.122 0 .23-.068.284-.176a.304.304 0 0 0-.046-.324L13.735.106a.316.316 0 0 0-.472 0l-7.63 8.857a.302.302 0 0 0-.047.325z"/>\n    <path d="M24.3 5.093c-.218-.76-.54-1.187-1.208-1.187h-4.856l1.018 1.18h3.948l2.043 11.038h-7.193v2.728H9.114v-2.725h-7.36l2.66-11.04h3.33l1.018-1.18H3.907c-.668 0-1.06.46-1.21 1.186L0 16.456v7.062C0 24.338.676 25 1.51 25h23.98c.833 0 1.51-.663 1.51-1.482v-7.062L24.3 5.093z"/>\n  </svg>']),
    _templateObject7 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="14px" height="14px" viewBox="0 0 19 19">\n    <path d="M17.318 17.232L9.94 9.854 9.586 9.5l-.354.354-7.378 7.378h.707l-.62-.62v.706L9.318 9.94l.354-.354-.354-.354L1.94 1.854v.707l.62-.62h-.706l7.378 7.378.354.354.354-.354 7.378-7.378h-.707l.622.62v-.706L9.854 9.232l-.354.354.354.354 7.378 7.378.708-.707-7.38-7.378v.708l7.38-7.38.353-.353-.353-.353-.622-.622-.353-.353-.354.352-7.378 7.38h.708L2.56 1.23 2.208.88l-.353.353-.622.62-.353.355.352.353 7.38 7.38v-.708l-7.38 7.38-.353.353.352.353.622.622.353.353.354-.353 7.38-7.38h-.708l7.38 7.38z"/>\n  </svg>'], ['<svg class="UppyIcon" width="14px" height="14px" viewBox="0 0 19 19">\n    <path d="M17.318 17.232L9.94 9.854 9.586 9.5l-.354.354-7.378 7.378h.707l-.62-.62v.706L9.318 9.94l.354-.354-.354-.354L1.94 1.854v.707l.62-.62h-.706l7.378 7.378.354.354.354-.354 7.378-7.378h-.707l.622.62v-.706L9.854 9.232l-.354.354.354.354 7.378 7.378.708-.707-7.38-7.378v.708l7.38-7.38.353-.353-.353-.353-.622-.622-.353-.353-.354.352-7.378 7.38h.708L2.56 1.23 2.208.88l-.353.353-.622.62-.353.355.352.353 7.38 7.38v-.708l-7.38 7.38-.353.353.352.353.622.622.353.353.354-.353 7.38-7.38h-.708l7.38 7.38z"/>\n  </svg>']),
    _templateObject8 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="16px" height="16px" viewBox="0 0 32 30">\n      <path d="M6.6209894,11.1451162 C6.6823051,11.2751669 6.81374248,11.3572188 6.95463813,11.3572188 L12.6925482,11.3572188 L12.6925482,16.0630427 C12.6925482,17.880509 14.1726048,18.75 16.0000083,18.75 C17.8261072,18.75 19.3074684,17.8801847 19.3074684,16.0630427 L19.3074684,11.3572188 L25.0437478,11.3572188 C25.1875787,11.3572188 25.3164069,11.2751669 25.3790272,11.1451162 C25.4370814,11.0173358 25.4171865,10.8642587 25.3252129,10.7562615 L16.278212,0.127131837 C16.2093949,0.0463771751 16.1069846,0 15.9996822,0 C15.8910751,0 15.7886648,0.0463771751 15.718217,0.127131837 L6.6761083,10.7559371 C6.58250402,10.8642587 6.56293518,11.0173358 6.6209894,11.1451162 L6.6209894,11.1451162 Z"/>\n      <path d="M28.8008722,6.11142645 C28.5417891,5.19831555 28.1583331,4.6875 27.3684848,4.6875 L21.6124454,4.6875 L22.8190234,6.10307874 L27.4986725,6.10307874 L29.9195817,19.3486449 L21.3943891,19.3502502 L21.3943891,22.622552 L10.8023461,22.622552 L10.8023461,19.3524977 L2.07815702,19.3534609 L5.22979699,6.10307874 L9.17871529,6.10307874 L10.3840011,4.6875 L4.6308691,4.6875 C3.83940559,4.6875 3.37421888,5.2390909 3.19815864,6.11142645 L0,19.7470874 L0,28.2212959 C0,29.2043992 0.801477937,30 1.78870751,30 L30.2096773,30 C31.198199,30 32,29.2043992 32,28.2212959 L32,19.7470874 L28.8008722,6.11142645 L28.8008722,6.11142645 Z"/>\n    </svg>'], ['<svg class="UppyIcon" width="16px" height="16px" viewBox="0 0 32 30">\n      <path d="M6.6209894,11.1451162 C6.6823051,11.2751669 6.81374248,11.3572188 6.95463813,11.3572188 L12.6925482,11.3572188 L12.6925482,16.0630427 C12.6925482,17.880509 14.1726048,18.75 16.0000083,18.75 C17.8261072,18.75 19.3074684,17.8801847 19.3074684,16.0630427 L19.3074684,11.3572188 L25.0437478,11.3572188 C25.1875787,11.3572188 25.3164069,11.2751669 25.3790272,11.1451162 C25.4370814,11.0173358 25.4171865,10.8642587 25.3252129,10.7562615 L16.278212,0.127131837 C16.2093949,0.0463771751 16.1069846,0 15.9996822,0 C15.8910751,0 15.7886648,0.0463771751 15.718217,0.127131837 L6.6761083,10.7559371 C6.58250402,10.8642587 6.56293518,11.0173358 6.6209894,11.1451162 L6.6209894,11.1451162 Z"/>\n      <path d="M28.8008722,6.11142645 C28.5417891,5.19831555 28.1583331,4.6875 27.3684848,4.6875 L21.6124454,4.6875 L22.8190234,6.10307874 L27.4986725,6.10307874 L29.9195817,19.3486449 L21.3943891,19.3502502 L21.3943891,22.622552 L10.8023461,22.622552 L10.8023461,19.3524977 L2.07815702,19.3534609 L5.22979699,6.10307874 L9.17871529,6.10307874 L10.3840011,4.6875 L4.6308691,4.6875 C3.83940559,4.6875 3.37421888,5.2390909 3.19815864,6.11142645 L0,19.7470874 L0,28.2212959 C0,29.2043992 0.801477937,30 1.78870751,30 L30.2096773,30 C31.198199,30 32,29.2043992 32,28.2212959 L32,19.7470874 L28.8008722,6.11142645 L28.8008722,6.11142645 Z"/>\n    </svg>']),
    _templateObject9 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon UppyIcon-check" width="13px" height="9px" viewBox="0 0 13 9">\n    <polygon points="5 7.293 1.354 3.647 0.646 4.354 5 8.707 12.354 1.354 11.646 0.647"></polygon>\n  </svg>'], ['<svg class="UppyIcon UppyIcon-check" width="13px" height="9px" viewBox="0 0 13 9">\n    <polygon points="5 7.293 1.354 3.647 0.646 4.354 5 8.707 12.354 1.354 11.646 0.647"></polygon>\n  </svg>']),
    _templateObject10 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="34" height="91" viewBox="0 0 34 91">\n    <path d="M22.366 43.134V29.33c5.892-6.588 10.986-14.507 10.986-22.183 0-4.114-2.986-7.1-7.1-7.1-3.914 0-7.1 3.186-7.1 7.1v20.936a92.562 92.562 0 0 1-5.728 5.677l-.384.348C4.643 41.762.428 45.604.428 54.802c0 8.866 7.214 16.08 16.08 16.08.902 0 1.784-.074 2.644-.216v11.26c0 2.702-2.198 4.9-4.9 4.9a4.855 4.855 0 0 1-2.95-1.015c2.364-.24 4.222-2.218 4.222-4.643a4.698 4.698 0 0 0-4.692-4.692 4.738 4.738 0 0 0-4.213 2.628c-.923 1.874-.56 4.386.277 6.228a7.82 7.82 0 0 0 .9 1.502 8.178 8.178 0 0 0 4.23 2.896c.723.207 1.474.31 2.226.31 4.474 0 8.113-3.64 8.113-8.113V69.78c5.98-2.345 10.225-8.176 10.225-14.977 0-5.975-4.464-10.876-10.224-11.67zm0-35.987a3.89 3.89 0 0 1 3.887-3.885c1.933 0 3.885 1.202 3.885 3.885 0 4.95-2.702 10.862-7.772 17.204V7.148zM16.51 67.67c-7.096 0-12.867-5.77-12.867-12.867 0-7.78 3.385-10.865 11.563-18.32l.384-.35c1.166-1.064 2.365-2.2 3.562-3.402v10.404c-5.758.793-10.223 5.695-10.223 11.67 0 3.935 1.948 7.603 5.212 9.81a1.605 1.605 0 1 0 1.8-2.66 8.622 8.622 0 0 1-3.8-7.15c0-4.2 3.025-7.7 7.01-8.456v21.05c-.853.178-1.736.272-2.642.272zm5.856-1.412v-19.91c3.985.756 7.01 4.253 7.01 8.455 0 4.987-2.85 9.32-7.01 11.455z" />\n  </svg>'], ['<svg class="UppyIcon" width="34" height="91" viewBox="0 0 34 91">\n    <path d="M22.366 43.134V29.33c5.892-6.588 10.986-14.507 10.986-22.183 0-4.114-2.986-7.1-7.1-7.1-3.914 0-7.1 3.186-7.1 7.1v20.936a92.562 92.562 0 0 1-5.728 5.677l-.384.348C4.643 41.762.428 45.604.428 54.802c0 8.866 7.214 16.08 16.08 16.08.902 0 1.784-.074 2.644-.216v11.26c0 2.702-2.198 4.9-4.9 4.9a4.855 4.855 0 0 1-2.95-1.015c2.364-.24 4.222-2.218 4.222-4.643a4.698 4.698 0 0 0-4.692-4.692 4.738 4.738 0 0 0-4.213 2.628c-.923 1.874-.56 4.386.277 6.228a7.82 7.82 0 0 0 .9 1.502 8.178 8.178 0 0 0 4.23 2.896c.723.207 1.474.31 2.226.31 4.474 0 8.113-3.64 8.113-8.113V69.78c5.98-2.345 10.225-8.176 10.225-14.977 0-5.975-4.464-10.876-10.224-11.67zm0-35.987a3.89 3.89 0 0 1 3.887-3.885c1.933 0 3.885 1.202 3.885 3.885 0 4.95-2.702 10.862-7.772 17.204V7.148zM16.51 67.67c-7.096 0-12.867-5.77-12.867-12.867 0-7.78 3.385-10.865 11.563-18.32l.384-.35c1.166-1.064 2.365-2.2 3.562-3.402v10.404c-5.758.793-10.223 5.695-10.223 11.67 0 3.935 1.948 7.603 5.212 9.81a1.605 1.605 0 1 0 1.8-2.66 8.622 8.622 0 0 1-3.8-7.15c0-4.2 3.025-7.7 7.01-8.456v21.05c-.853.178-1.736.272-2.642.272zm5.856-1.412v-19.91c3.985.756 7.01 4.253 7.01 8.455 0 4.987-2.85 9.32-7.01 11.455z" />\n  </svg>']),
    _templateObject11 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="44" height="58" viewBox="0 0 44 58">\n    <path d="M27.437.517a1 1 0 0 0-.094.03H4.25C2.037.548.217 2.368.217 4.58v48.405c0 2.212 1.82 4.03 4.03 4.03H39.03c2.21 0 4.03-1.818 4.03-4.03V15.61a1 1 0 0 0-.03-.28 1 1 0 0 0 0-.093 1 1 0 0 0-.03-.032 1 1 0 0 0 0-.03 1 1 0 0 0-.032-.063 1 1 0 0 0-.03-.063 1 1 0 0 0-.032 0 1 1 0 0 0-.03-.063 1 1 0 0 0-.032-.03 1 1 0 0 0-.03-.063 1 1 0 0 0-.063-.062l-14.593-14a1 1 0 0 0-.062-.062A1 1 0 0 0 28 .708a1 1 0 0 0-.374-.157 1 1 0 0 0-.156 0 1 1 0 0 0-.03-.03l-.003-.003zM4.25 2.547h22.218v9.97c0 2.21 1.82 4.03 4.03 4.03h10.564v36.438a2.02 2.02 0 0 1-2.032 2.032H4.25c-1.13 0-2.032-.9-2.032-2.032V4.58c0-1.13.902-2.032 2.03-2.032zm24.218 1.345l10.375 9.937.75.718H30.5c-1.13 0-2.032-.9-2.032-2.03V3.89z" />\n  </svg>'], ['<svg class="UppyIcon" width="44" height="58" viewBox="0 0 44 58">\n    <path d="M27.437.517a1 1 0 0 0-.094.03H4.25C2.037.548.217 2.368.217 4.58v48.405c0 2.212 1.82 4.03 4.03 4.03H39.03c2.21 0 4.03-1.818 4.03-4.03V15.61a1 1 0 0 0-.03-.28 1 1 0 0 0 0-.093 1 1 0 0 0-.03-.032 1 1 0 0 0 0-.03 1 1 0 0 0-.032-.063 1 1 0 0 0-.03-.063 1 1 0 0 0-.032 0 1 1 0 0 0-.03-.063 1 1 0 0 0-.032-.03 1 1 0 0 0-.03-.063 1 1 0 0 0-.063-.062l-14.593-14a1 1 0 0 0-.062-.062A1 1 0 0 0 28 .708a1 1 0 0 0-.374-.157 1 1 0 0 0-.156 0 1 1 0 0 0-.03-.03l-.003-.003zM4.25 2.547h22.218v9.97c0 2.21 1.82 4.03 4.03 4.03h10.564v36.438a2.02 2.02 0 0 1-2.032 2.032H4.25c-1.13 0-2.032-.9-2.032-2.032V4.58c0-1.13.902-2.032 2.03-2.032zm24.218 1.345l10.375 9.937.75.718H30.5c-1.13 0-2.032-.9-2.032-2.03V3.89z" />\n  </svg>']),
    _templateObject12 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="50" height="63" viewBox="0 0 50 63">\n    <path d="M0 .5v15.617h6.25l1.7-5.1a6.242 6.242 0 0 1 5.933-4.267h8V50.5c0 3.45-2.8 6.25-6.25 6.25H12.5V63h25v-6.25h-3.133c-3.45 0-6.25-2.8-6.25-6.25V6.75h8a6.257 6.257 0 0 1 5.933 4.267l1.7 5.1H50V.5H0z" />\n  </svg>'], ['<svg class="UppyIcon" width="50" height="63" viewBox="0 0 50 63">\n    <path d="M0 .5v15.617h6.25l1.7-5.1a6.242 6.242 0 0 1 5.933-4.267h8V50.5c0 3.45-2.8 6.25-6.25 6.25H12.5V63h25v-6.25h-3.133c-3.45 0-6.25-2.8-6.25-6.25V6.75h8a6.257 6.257 0 0 1 5.933 4.267l1.7 5.1H50V.5H0z" />\n  </svg>']),
    _templateObject13 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="37" height="33" viewBox="0 0 37 33">\n    <path d="M29.107 24.5c4.07 0 7.393-3.355 7.393-7.442 0-3.994-3.105-7.307-7.012-7.502l.468.415C29.02 4.52 24.34.5 18.886.5c-4.348 0-8.27 2.522-10.138 6.506l.446-.288C4.394 6.782.5 10.758.5 15.608c0 4.924 3.906 8.892 8.76 8.892h4.872c.635 0 1.095-.467 1.095-1.104 0-.636-.46-1.103-1.095-1.103H9.26c-3.644 0-6.63-3.035-6.63-6.744 0-3.71 2.926-6.685 6.57-6.685h.964l.14-.28.177-.362c1.477-3.4 4.744-5.576 8.347-5.576 4.58 0 8.45 3.452 9.01 8.072l.06.536.05.446h1.101c2.87 0 5.204 2.37 5.204 5.295s-2.333 5.296-5.204 5.296h-6.062c-.634 0-1.094.467-1.094 1.103 0 .637.46 1.104 1.094 1.104h6.12z"/>\n    <path d="M23.196 18.92l-4.828-5.258-.366-.4-.368.398-4.828 5.196a1.13 1.13 0 0 0 0 1.546c.428.46 1.11.46 1.537 0l3.45-3.71-.868-.34v15.03c0 .64.445 1.118 1.075 1.118.63 0 1.075-.48 1.075-1.12V16.35l-.867.34 3.45 3.712a1 1 0 0 0 .767.345 1 1 0 0 0 .77-.345c.416-.33.416-1.036 0-1.485v.003z"/>\n  </svg>'], ['<svg class="UppyIcon" width="37" height="33" viewBox="0 0 37 33">\n    <path d="M29.107 24.5c4.07 0 7.393-3.355 7.393-7.442 0-3.994-3.105-7.307-7.012-7.502l.468.415C29.02 4.52 24.34.5 18.886.5c-4.348 0-8.27 2.522-10.138 6.506l.446-.288C4.394 6.782.5 10.758.5 15.608c0 4.924 3.906 8.892 8.76 8.892h4.872c.635 0 1.095-.467 1.095-1.104 0-.636-.46-1.103-1.095-1.103H9.26c-3.644 0-6.63-3.035-6.63-6.744 0-3.71 2.926-6.685 6.57-6.685h.964l.14-.28.177-.362c1.477-3.4 4.744-5.576 8.347-5.576 4.58 0 8.45 3.452 9.01 8.072l.06.536.05.446h1.101c2.87 0 5.204 2.37 5.204 5.295s-2.333 5.296-5.204 5.296h-6.062c-.634 0-1.094.467-1.094 1.103 0 .637.46 1.104 1.094 1.104h6.12z"/>\n    <path d="M23.196 18.92l-4.828-5.258-.366-.4-.368.398-4.828 5.196a1.13 1.13 0 0 0 0 1.546c.428.46 1.11.46 1.537 0l3.45-3.71-.868-.34v15.03c0 .64.445 1.118 1.075 1.118.63 0 1.075-.48 1.075-1.12V16.35l-.867.34 3.45 3.712a1 1 0 0 0 .767.345 1 1 0 0 0 .77-.345c.416-.33.416-1.036 0-1.485v.003z"/>\n  </svg>']),
    _templateObject14 = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="48" height="69" viewBox="0 0 48 69">\n    <path d="M.5 1.5h5zM10.5 1.5h5zM20.5 1.5h5zM30.504 1.5h5zM45.5 11.5v5zM45.5 21.5v5zM45.5 31.5v5zM45.5 41.502v5zM45.5 51.502v5zM45.5 61.5v5zM45.5 66.502h-4.998zM35.503 66.502h-5zM25.5 66.502h-5zM15.5 66.502h-5zM5.5 66.502h-5zM.5 66.502v-5zM.5 56.502v-5zM.5 46.503V41.5zM.5 36.5v-5zM.5 26.5v-5zM.5 16.5v-5zM.5 6.5V1.498zM44.807 11H36V2.195z"/>\n  </svg>'], ['<svg class="UppyIcon" width="48" height="69" viewBox="0 0 48 69">\n    <path d="M.5 1.5h5zM10.5 1.5h5zM20.5 1.5h5zM30.504 1.5h5zM45.5 11.5v5zM45.5 21.5v5zM45.5 31.5v5zM45.5 41.502v5zM45.5 51.502v5zM45.5 61.5v5zM45.5 66.502h-4.998zM35.503 66.502h-5zM25.5 66.502h-5zM15.5 66.502h-5zM5.5 66.502h-5zM.5 66.502v-5zM.5 56.502v-5zM.5 46.503V41.5zM.5 36.5v-5zM.5 26.5v-5zM.5 16.5v-5zM.5 6.5V1.498zM44.807 11H36V2.195z"/>\n  </svg>']);

exports.defaultTabIcon = defaultTabIcon;
exports.iconCopy = iconCopy;
exports.iconResume = iconResume;
exports.iconPause = iconPause;
exports.iconEdit = iconEdit;
exports.localIcon = localIcon;
exports.closeIcon = closeIcon;
exports.pluginIcon = pluginIcon;
exports.checkIcon = checkIcon;
exports.iconAudio = iconAudio;
exports.iconFile = iconFile;
exports.iconText = iconText;
exports.uploadIcon = uploadIcon;
exports.dashboardBgIcon = dashboardBgIcon;

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

// https://css-tricks.com/creating-svg-icon-system-react/

function defaultTabIcon() {
  return (0, _html2.default)(_templateObject);
}

function iconCopy() {
  return (0, _html2.default)(_templateObject2);
}

function iconResume() {
  return (0, _html2.default)(_templateObject3);
}

function iconPause() {
  return (0, _html2.default)(_templateObject4);
}

function iconEdit() {
  return (0, _html2.default)(_templateObject5);
}

function localIcon() {
  return (0, _html2.default)(_templateObject6);
}

function closeIcon() {
  return (0, _html2.default)(_templateObject7);
}

function pluginIcon() {
  return (0, _html2.default)(_templateObject8);
}

function checkIcon() {
  return (0, _html2.default)(_templateObject9);
}

function iconAudio() {
  return (0, _html2.default)(_templateObject10);
}

function iconFile() {
  return (0, _html2.default)(_templateObject11);
}

function iconText() {
  return (0, _html2.default)(_templateObject12);
}

// export function removeIcon () {
//   return html `<svg class="UppyIcon" width="22" height="21" viewBox="0 0 18 17">
//     <ellipse cx="8.62" cy="8.383" rx="8.62" ry="8.383"/>
//     <path stroke="#FFF" fill="#FFF" d="M11 6.147L10.85 6 8.5 8.284 6.15 6 6 6.147 8.35 8.43 6 10.717l.15.146L8.5 8.578l2.35 2.284.15-.146L8.65 8.43z"/>
//   </svg>`
// }

function uploadIcon() {
  return (0, _html2.default)(_templateObject13);
}

function dashboardBgIcon() {
  return (0, _html2.default)(_templateObject14);
}

},{"../../core/html":32}],45:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _Plugin2 = require('../Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

var _dragDrop = require('drag-drop');

var _dragDrop2 = _interopRequireDefault(_dragDrop);

var _Dashboard = require('./Dashboard');

var _Dashboard2 = _interopRequireDefault(_Dashboard);

var _Utils = require('../../core/Utils');

var _prettyBytes = require('pretty-bytes');

var _prettyBytes2 = _interopRequireDefault(_prettyBytes);

var _icons = require('./icons');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Modal Dialog & Dashboard
 */
var DashboardUI = function (_Plugin) {
  _inherits(DashboardUI, _Plugin);

  function DashboardUI(core, opts) {
    _classCallCheck(this, DashboardUI);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.id = 'DashboardUI';
    _this.title = 'Dashboard UI';
    _this.type = 'orchestrator';

    // set default options
    var defaultOptions = {
      target: 'body',
      inline: false,
      semiTransparent: false,
      defaultTabIcon: (0, _icons.defaultTabIcon)(),
      panelSelectorPrefix: 'UppyDashboardContent-panel',
      showProgressDetails: true
    };

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);

    _this.hideModal = _this.hideModal.bind(_this);
    _this.showModal = _this.showModal.bind(_this);

    _this.addTarget = _this.addTarget.bind(_this);
    _this.actions = _this.actions.bind(_this);
    _this.hideAllPanels = _this.hideAllPanels.bind(_this);
    _this.showPanel = _this.showPanel.bind(_this);
    _this.initEvents = _this.initEvents.bind(_this);
    _this.handleDrop = _this.handleDrop.bind(_this);
    _this.pauseAll = _this.pauseAll.bind(_this);
    _this.resumeAll = _this.resumeAll.bind(_this);
    _this.cancelAll = _this.cancelAll.bind(_this);
    _this.render = _this.render.bind(_this);
    _this.install = _this.install.bind(_this);
    return _this;
  }

  DashboardUI.prototype.addTarget = function addTarget(plugin) {
    var callerPluginId = plugin.constructor.name;
    var callerPluginName = plugin.title || callerPluginId;
    var callerPluginIcon = plugin.icon || this.opts.defaultTabIcon;
    var callerPluginType = plugin.type;

    if (callerPluginType !== 'acquirer' && callerPluginType !== 'progressindicator' && callerPluginType !== 'presenter') {
      var msg = 'Error: Modal can only be used by plugins of types: acquirer, progressindicator, presenter';
      this.core.log(msg);
      return;
    }

    var target = {
      id: callerPluginId,
      name: callerPluginName,
      icon: callerPluginIcon,
      type: callerPluginType,
      focus: plugin.focus,
      render: plugin.render,
      isHidden: true
    };

    var modal = this.core.getState().modal;
    var newTargets = modal.targets.slice();
    newTargets.push(target);

    this.core.setState({
      modal: _extends({}, modal, {
        targets: newTargets
      })
    });

    return this.opts.target;
  };

  DashboardUI.prototype.hideAllPanels = function hideAllPanels() {
    var modal = this.core.getState().modal;

    this.core.setState({ modal: _extends({}, modal, {
        activePanel: false
      }) });
  };

  DashboardUI.prototype.showPanel = function showPanel(id) {
    var modal = this.core.getState().modal;

    var activePanel = modal.targets.filter(function (target) {
      return target.type === 'acquirer' && target.id === id;
    })[0];

    this.core.setState({ modal: _extends({}, modal, {
        activePanel: activePanel
      }) });
  };

  DashboardUI.prototype.hideModal = function hideModal() {
    var modal = this.core.getState().modal;

    this.core.setState({
      modal: _extends({}, modal, {
        isHidden: true
      })
    });

    document.body.classList.remove('is-UppyDashboard-open');
  };

  DashboardUI.prototype.showModal = function showModal() {
    var modal = this.core.getState().modal;

    this.core.setState({
      modal: _extends({}, modal, {
        isHidden: false
      })
    });

    // add class to body that sets position fixed
    document.body.classList.add('is-UppyDashboard-open');
    // focus on modal inner block
    document.querySelector('.UppyDashboard-inner').focus();
  };

  DashboardUI.prototype.initEvents = function initEvents() {
    var _this2 = this;

    // const dashboardEl = document.querySelector(`${this.opts.target} .UppyDashboard`)

    // Modal open button
    var showModalTrigger = document.querySelector(this.opts.trigger);
    if (!this.opts.inline && showModalTrigger) {
      showModalTrigger.addEventListener('click', this.showModal);
    } else {
      this.core.log('Modal trigger wasn’t found');
    }

    // Close the Modal on esc key press
    document.body.addEventListener('keyup', function (event) {
      if (event.keyCode === 27) {
        _this2.hideModal();
      }
    });

    // Drag Drop
    (0, _dragDrop2.default)(this.el, function (files) {
      _this2.handleDrop(files);
    });
  };

  DashboardUI.prototype.actions = function actions() {
    var _this3 = this;

    var bus = this.core.bus;

    bus.on('core:file-add', function () {
      _this3.hideAllPanels();
    });

    bus.on('dashboard:file-card', function (fileId) {
      var modal = _this3.core.getState().modal;

      _this3.core.setState({
        modal: _extends({}, modal, {
          fileCardFor: fileId || false
        })
      });
    });

    // bus.on('core:success', (uploadedCount) => {
    //   bus.emit(
    //     'informer',
    //     `${this.core.i18n('files', {'smart_count': uploadedCount})} successfully uploaded, Sir!`,
    //     'info',
    //     6000
    //   )
    // })
  };

  DashboardUI.prototype.handleDrop = function handleDrop(files) {
    var _this4 = this;

    this.core.log('All right, someone dropped something...');

    files.forEach(function (file) {
      _this4.core.bus.emit('core:file-add', {
        source: _this4.id,
        name: file.name,
        type: file.type,
        data: file
      });
    });
  };

  DashboardUI.prototype.cancelAll = function cancelAll() {
    this.core.bus.emit('core:cancel-all');
  };

  DashboardUI.prototype.pauseAll = function pauseAll() {
    this.core.bus.emit('core:pause-all');
  };

  DashboardUI.prototype.resumeAll = function resumeAll() {
    this.core.bus.emit('core:resume-all');
  };

  DashboardUI.prototype.getTotalSpeed = function getTotalSpeed(files) {
    var totalSpeed = 0;
    files.forEach(function (file) {
      totalSpeed = totalSpeed + (0, _Utils.getSpeed)(file.progress);
    });
    return totalSpeed;
  };

  DashboardUI.prototype.getTotalETA = function getTotalETA(files) {
    var totalSeconds = 0;

    files.forEach(function (file) {
      totalSeconds = totalSeconds + (0, _Utils.getETA)(file.progress);
    });

    return totalSeconds;
  };

  DashboardUI.prototype.render = function render(state) {
    var _this5 = this;

    var files = state.files;

    var newFiles = Object.keys(files).filter(function (file) {
      return !files[file].progress.uploadStarted;
    });
    var uploadStartedFiles = Object.keys(files).filter(function (file) {
      return files[file].progress.uploadStarted;
    });
    var completeFiles = Object.keys(files).filter(function (file) {
      return files[file].progress.uploadComplete;
    });
    var inProgressFiles = Object.keys(files).filter(function (file) {
      return !files[file].progress.uploadComplete && files[file].progress.uploadStarted && !files[file].isPaused;
    });

    var inProgressFilesArray = [];
    inProgressFiles.forEach(function (file) {
      inProgressFilesArray.push(files[file]);
    });

    var totalSpeed = (0, _prettyBytes2.default)(this.getTotalSpeed(inProgressFilesArray));
    var totalETA = (0, _Utils.prettyETA)(this.getTotalETA(inProgressFilesArray));

    var isAllComplete = state.totalProgress === 100;
    var isAllPaused = inProgressFiles.length === 0 && !isAllComplete && uploadStartedFiles.length > 0;
    var isUploadStarted = uploadStartedFiles.length > 0;

    var acquirers = state.modal.targets.filter(function (target) {
      return target.type === 'acquirer';
    });

    var progressindicators = state.modal.targets.filter(function (target) {
      return target.type === 'progressindicator';
    });

    var addFile = function addFile(file) {
      _this5.core.emitter.emit('core:file-add', file);
    };

    var removeFile = function removeFile(fileID) {
      _this5.core.emitter.emit('core:file-remove', fileID);
    };

    var startUpload = function startUpload(ev) {
      _this5.core.emitter.emit('core:upload');
    };

    var pauseUpload = function pauseUpload(fileID) {
      _this5.core.emitter.emit('core:upload-pause', fileID);
    };

    var cancelUpload = function cancelUpload(fileID) {
      _this5.core.emitter.emit('core:upload-cancel', fileID);
      _this5.core.emitter.emit('core:file-remove', fileID);
    };

    var showFileCard = function showFileCard(fileID) {
      _this5.core.emitter.emit('dashboard:file-card', fileID);
    };

    var fileCardDone = function fileCardDone(meta, fileID) {
      _this5.core.emitter.emit('core:update-meta', meta, fileID);
      _this5.core.emitter.emit('dashboard:file-card');
    };

    var info = function info(text, type, duration) {
      _this5.core.emitter.emit('informer', text, type, duration);
    };

    var resumableUploads = this.core.getState().capabilities.resumableUploads || false;

    return (0, _Dashboard2.default)({
      state: state,
      modal: state.modal,
      newFiles: newFiles,
      files: files,
      totalFileCount: Object.keys(files).length,
      isUploadStarted: isUploadStarted,
      inProgress: uploadStartedFiles.length,
      completeFiles: completeFiles,
      inProgressFiles: inProgressFiles,
      totalSpeed: totalSpeed,
      totalETA: totalETA,
      totalProgress: state.totalProgress,
      isAllComplete: isAllComplete,
      isAllPaused: isAllPaused,
      acquirers: acquirers,
      activePanel: state.modal.activePanel,
      progressindicators: progressindicators,
      autoProceed: this.core.opts.autoProceed,
      id: this.id,
      container: this.opts.target,
      hideModal: this.hideModal,
      panelSelectorPrefix: this.opts.panelSelectorPrefix,
      showProgressDetails: this.opts.showProgressDetails,
      inline: this.opts.inline,
      semiTransparent: this.opts.semiTransparent,
      onPaste: this.handlePaste,
      showPanel: this.showPanel,
      hideAllPanels: this.hideAllPanels,
      log: this.core.log,
      bus: this.core.emitter,
      i18n: this.core.i18n,
      pauseAll: this.pauseAll,
      resumeAll: this.resumeAll,
      cancelAll: this.cancelAll,
      addFile: addFile,
      removeFile: removeFile,
      info: info,
      metaFields: state.metaFields,
      resumableUploads: resumableUploads,
      startUpload: startUpload,
      pauseUpload: pauseUpload,
      cancelUpload: cancelUpload,
      fileCardFor: state.modal.fileCardFor,
      showFileCard: showFileCard,
      fileCardDone: fileCardDone
    });
  };

  DashboardUI.prototype.install = function install() {
    // Set default state for Modal
    this.core.setState({ modal: {
        isHidden: true,
        showFileCard: false,
        activePanel: false,
        targets: []
      } });

    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);

    this.initEvents();
    this.actions();
  };

  return DashboardUI;
}(_Plugin3.default);

exports.default = DashboardUI;
module.exports = exports['default'];

},{"../../core/Utils":31,"../Plugin":57,"./Dashboard":36,"./icons":44,"drag-drop":1,"pretty-bytes":6}],46:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['<a onclick=', '>Proceed with Demo Account</a>'], ['<a onclick=', '>Proceed with Demo Account</a>']),
    _templateObject2 = _taggedTemplateLiteralLoose(['\n    <div class="UppyGoogleDrive-authenticate">\n      <h1>You need to authenticate with Google before selecting files.</h1>\n      <a href=', '>Authenticate</a>\n      ', '\n    </div>\n  '], ['\n    <div class="UppyGoogleDrive-authenticate">\n      <h1>You need to authenticate with Google before selecting files.</h1>\n      <a href=', '>Authenticate</a>\n      ', '\n    </div>\n  ']);

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  var demoLink = props.demo ? (0, _html2.default)(_templateObject, props.handleDemoAuth) : null;
  return (0, _html2.default)(_templateObject2, props.link, demoLink);
};

module.exports = exports['default'];

},{"../../core/html":32}],47:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['\n    <div>\n      <span>\n        Something went wrong.  Probably our fault. ', '\n      </span>\n    </div>\n  '], ['\n    <div>\n      <span>\n        Something went wrong.  Probably our fault. ', '\n      </span>\n    </div>\n  ']);

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  return (0, _html2.default)(_templateObject, props.error);
};

module.exports = exports['default'];

},{"../../core/html":32}],48:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _templateObject = _taggedTemplateLiteralLoose(['\n      <svg class="UppyIcon UppyModalTab-icon" width="28" height="28" viewBox="0 0 16 16">\n        <path d="M2.955 14.93l2.667-4.62H16l-2.667 4.62H2.955zm2.378-4.62l-2.666 4.62L0 10.31l5.19-8.99 2.666 4.62-2.523 4.37zm10.523-.25h-5.333l-5.19-8.99h5.334l5.19 8.99z"/>\n      </svg>\n    '], ['\n      <svg class="UppyIcon UppyModalTab-icon" width="28" height="28" viewBox="0 0 16 16">\n        <path d="M2.955 14.93l2.667-4.62H16l-2.667 4.62H2.955zm2.378-4.62l-2.666 4.62L0 10.31l5.19-8.99 2.666 4.62-2.523 4.37zm10.523-.25h-5.333l-5.19-8.99h5.334l5.19 8.99z"/>\n      </svg>\n    ']);

var _Utils = require('../../core/Utils');

var _Utils2 = _interopRequireDefault(_Utils);

var _Plugin2 = require('../Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

require('whatwg-fetch');

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

var _Provider = require('../../uppy-base/src/plugins/Provider');

var _Provider2 = _interopRequireDefault(_Provider);

var _AuthView = require('./AuthView');

var _AuthView2 = _interopRequireDefault(_AuthView);

var _Browser = require('./new/Browser');

var _Browser2 = _interopRequireDefault(_Browser);

var _Error = require('./Error');

var _Error2 = _interopRequireDefault(_Error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Google = function (_Plugin) {
  _inherits(Google, _Plugin);

  function Google(core, opts) {
    _classCallCheck(this, Google);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'acquirer';
    _this.id = 'GoogleDrive';
    _this.title = 'Google Drive';
    _this.icon = (0, _html2.default)(_templateObject);

    _this.GoogleDrive = new _Provider2.default({
      host: _this.opts.host,
      provider: 'drive'
    });

    _this.files = [];

    // this.core.socket.on('')
    // Logic
    _this.addFile = _this.addFile.bind(_this);
    _this.filterItems = _this.filterItems.bind(_this);
    _this.filterQuery = _this.filterQuery.bind(_this);
    _this.getFolder = _this.getFolder.bind(_this);
    _this.getNextFolder = _this.getNextFolder.bind(_this);
    _this.handleRowClick = _this.handleRowClick.bind(_this);
    _this.logout = _this.logout.bind(_this);
    _this.handleDemoAuth = _this.handleDemoAuth.bind(_this);
    _this.sortByTitle = _this.sortByTitle.bind(_this);
    _this.sortByDate = _this.sortByDate.bind(_this);

    // Visual
    _this.render = _this.render.bind(_this);

    // set default options
    var defaultOptions = {};

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);
    return _this;
  }

  Google.prototype.install = function install() {
    var _this2 = this;

    // Set default state for Google Drive
    this.core.setState({
      googleDrive: {
        authenticated: false,
        files: [],
        folders: [],
        directories: [{
          title: 'My Drive',
          id: 'root'
        }],
        activeRow: -1,
        filterInput: ''
      }
    });

    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);

    this.checkAuthentication().then(function (authenticated) {
      _this2.updateState({ authenticated: authenticated });

      console.log('are we authenticated?');
      console.log(authenticated);

      if (authenticated) {
        return _this2.getFolder('root');
      }

      return authenticated;
    }).then(function (newState) {
      _this2.updateState(newState);
    });

    return;
  };

  Google.prototype.focus = function focus() {};

  /**
   * Little shorthand to update the state with my new state
   */


  Google.prototype.updateState = function updateState(newState) {
    var state = this.core.state;

    var googleDrive = _extends({}, state.googleDrive, newState);

    this.core.setState({ googleDrive: googleDrive });
  };

  /**
   * Check to see if the user is authenticated.
   * @return {Promise} authentication status
   */


  Google.prototype.checkAuthentication = function checkAuthentication() {
    var _this3 = this;

    return fetch(this.opts.host + '/drive/auth', {
      method: 'get',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }).then(function (res) {
      console.log(res.status);
      if (res.status < 200 || res.status > 300) {
        _this3.updateState({
          authenticated: false,
          error: true
        });
        var error = new Error(res.statusText);
        error.response = res;
        throw error;
      }

      return res.json();
    }).then(function (data) {
      return data.authenticated;
    }).catch(function (err) {
      return err;
    });
  };

  /**
   * Based on folder ID, fetch a new folder
   * @param  {String} id Folder id
   * @return {Promise}   Folders/files in folder
   */


  Google.prototype.getFolder = function getFolder() {
    var id = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'root';

    return this.GoogleDrive.list(id).then(function (res) {
      // let result = Utils.groupBy(data.items, (item) => item.mimeType)
      var folders = [];
      var files = [];
      res.items.forEach(function (item) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          folders.push(item);
        } else {
          files.push(item);
        }
      });
      return {
        folders: folders,
        files: files
      };
    }).catch(function (err) {
      return err;
    });
  };

  /**
   * Fetches new folder and adds to breadcrumb nav
   * @param  {String} id    Folder id
   * @param  {String} title Folder title
   */


  Google.prototype.getNextFolder = function getNextFolder(id, title) {
    var _this4 = this;

    this.getFolder(id).then(function (data) {
      var state = _this4.core.getState().googleDrive;

      var index = state.directories.findIndex(function (dir) {
        return id === dir.id;
      });
      var updatedDirectories = void 0;

      if (index !== -1) {
        updatedDirectories = state.directories.slice(0, index + 1);
      } else {
        updatedDirectories = state.directories.concat([{
          id: id,
          title: title
        }]);
      }

      _this4.updateState(_Utils2.default.extend(data, {
        directories: updatedDirectories
      }));
    });
  };

  Google.prototype.addFile = function addFile(file) {
    var tagFile = {
      source: this.id,
      data: file,
      name: file.title,
      type: file.mimeType,
      isRemote: true,
      body: {
        fileId: file.id
      },
      remote: {
        host: this.opts.host,
        url: this.opts.host + '/drive/get/' + file.id,
        body: {
          fileId: file.id
        }
      }
    };
    console.log('adding file');
    this.core.emitter.emit('core:file-add', tagFile);
  };

  Google.prototype.handleError = function handleError(response) {
    var _this5 = this;

    this.checkAuthentication().then(function (authenticated) {
      _this5.updateState({ authenticated: authenticated });
    });
  };

  /**
   * Removes session token on client side.
   */


  Google.prototype.logout = function logout() {
    var _this6 = this;

    this.GoogleDrive.logout(location.href).then(function (res) {
      return res.json();
    }).then(function (res) {
      if (res.ok) {
        console.log('ok');
        var newState = {
          authenticated: false,
          files: [],
          folders: [],
          directories: [{
            title: 'My Drive',
            id: 'root'
          }]
        };

        _this6.updateState(newState);
      }
    });
  };

  Google.prototype.getFileType = function getFileType(file) {
    var fileTypes = {
      'application/vnd.google-apps.folder': 'Folder',
      'application/vnd.google-apps.document': 'Google Docs',
      'application/vnd.google-apps.spreadsheet': 'Google Sheets',
      'application/vnd.google-apps.presentation': 'Google Slides',
      'image/jpeg': 'JPEG Image',
      'image/png': 'PNG Image'
    };

    return fileTypes[file.mimeType] ? fileTypes[file.mimeType] : file.fileExtension.toUpperCase();
  };

  /**
   * Used to set active file/folder.
   * @param  {Object} file   Active file/folder
   */


  Google.prototype.handleRowClick = function handleRowClick(fileId) {
    var state = this.core.getState().googleDrive;
    var newState = _extends({}, state, {
      activeRow: fileId
    });

    this.updateState(newState);
  };

  Google.prototype.filterQuery = function filterQuery(e) {
    var state = this.core.getState().googleDrive;
    this.updateState(_extends({}, state, {
      filterInput: e.target.value
    }));
  };

  Google.prototype.filterItems = function filterItems(items) {
    var state = this.core.getState().googleDrive;
    return items.filter(function (folder) {
      return folder.title.toLowerCase().indexOf(state.filterInput.toLowerCase()) !== -1;
    });
  };

  Google.prototype.sortByTitle = function sortByTitle() {
    var state = _extends({}, this.core.getState().googleDrive);
    var files = state.files;
    var folders = state.folders;
    var sorting = state.sorting;


    var sortedFiles = files.sort(function (fileA, fileB) {
      if (sorting === 'titleDescending') {
        return fileB.title.localeCompare(fileA.title);
      }
      return fileA.title.localeCompare(fileB.title);
    });

    var sortedFolders = folders.sort(function (folderA, folderB) {
      if (sorting === 'titleDescending') {
        return folderB.title.localeCompare(folderA.title);
      }
      return folderA.title.localeCompare(folderB.title);
    });

    this.updateState(_extends({}, state, {
      files: sortedFiles,
      folders: sortedFolders,
      sorting: sorting === 'titleDescending' ? 'titleAscending' : 'titleDescending'
    }));
  };

  Google.prototype.sortByDate = function sortByDate() {
    var state = _extends({}, this.core.getState().googleDrive);
    var files = state.files;
    var folders = state.folders;
    var sorting = state.sorting;


    var sortedFiles = files.sort(function (fileA, fileB) {
      var a = new Date(fileA.modifiedByMeDate);
      var b = new Date(fileB.modifiedByMeDate);

      if (sorting === 'dateDescending') {
        return a > b ? -1 : a < b ? 1 : 0;
      }
      return a > b ? 1 : a < b ? -1 : 0;
    });

    var sortedFolders = folders.sort(function (folderA, folderB) {
      var a = new Date(folderA.modifiedByMeDate);
      var b = new Date(folderB.modifiedByMeDate);

      if (sorting === 'dateDescending') {
        return a > b ? -1 : a < b ? 1 : 0;
      }

      return a > b ? 1 : a < b ? -1 : 0;
    });

    this.updateState(_extends({}, state, {
      files: sortedFiles,
      folders: sortedFolders,
      sorting: sorting === 'dateDescending' ? 'dateAscending' : 'dateDescending'
    }));
  };

  Google.prototype.handleDemoAuth = function handleDemoAuth() {
    var state = this.core.getState().googleDrive;
    this.updateState({}, state, {
      authenticated: true
    });
  };

  Google.prototype.render = function render(state) {
    var _state$googleDrive = state.googleDrive;
    var authenticated = _state$googleDrive.authenticated;
    var error = _state$googleDrive.error;


    if (error) {
      return (0, _Error2.default)({ error: error });
    }

    if (!authenticated) {
      var authState = btoa(JSON.stringify({
        redirect: location.href.split('#')[0]
      }));

      var link = this.opts.host + '/connect/google?state=' + authState;

      return (0, _AuthView2.default)({
        link: link,
        demo: this.opts.demo,
        handleDemoAuth: this.handleDemoAuth
      });
    }

    var browserProps = _extends({}, state.googleDrive, {
      getNextFolder: this.getNextFolder,
      getFolder: this.getFolder,
      addFile: this.addFile,
      filterItems: this.filterItems,
      filterQuery: this.filterQuery,
      handleRowClick: this.handleRowClick,
      sortByTitle: this.sortByTitle,
      sortByDate: this.sortByDate,
      logout: this.logout,
      demo: this.opts.demo
    });

    return (0, _Browser2.default)(browserProps);
  };

  return Google;
}(_Plugin3.default);

exports.default = Google;
module.exports = exports['default'];

},{"../../core/Utils":31,"../../core/html":32,"../../uppy-base/src/plugins/Provider":64,"../Plugin":57,"./AuthView":46,"./Error":47,"./new/Browser":51,"whatwg-fetch":18}],49:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['\n    <li>\n      <button onclick=', '>', '</button>\n    </li>\n  '], ['\n    <li>\n      <button onclick=', '>', '</button>\n    </li>\n  ']);

var _html = require('../../../core/html');

var _html2 = _interopRequireDefault(_html);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  return (0, _html2.default)(_templateObject, props.getNextFolder, props.title);
};

module.exports = exports['default'];

},{"../../../core/html":32}],50:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['\n    <ul class="UppyGoogleDrive-breadcrumbs">\n      ', '\n    </ul>\n  '], ['\n    <ul class="UppyGoogleDrive-breadcrumbs">\n      ', '\n    </ul>\n  ']);

var _html = require('../../../core/html');

var _html2 = _interopRequireDefault(_html);

var _Breadcrumb = require('./Breadcrumb');

var _Breadcrumb2 = _interopRequireDefault(_Breadcrumb);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  return (0, _html2.default)(_templateObject, props.directories.map(function (directory) {
    return (0, _Breadcrumb2.default)({
      getNextFolder: function getNextFolder() {
        return props.getNextFolder(directory.id, directory.title);
      },
      title: directory.title
    });
  }));
};

module.exports = exports['default'];

},{"../../../core/html":32,"./Breadcrumb":49}],51:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['\n    <div class="Browser">\n      <header>\n        <input\n          type="text"\n          class="Browser-search"\n          placeholder="Search Drive"\n          onkeyup=', '\n          value=', '/>\n      </header>\n      <div class="Browser-subHeader">\n        ', '\n      </div>\n      <div class="Browser-body">\n        <main class="Browser-content">\n          ', '\n        </main>\n      </div>\n    </div>\n  '], ['\n    <div class="Browser">\n      <header>\n        <input\n          type="text"\n          class="Browser-search"\n          placeholder="Search Drive"\n          onkeyup=', '\n          value=', '/>\n      </header>\n      <div class="Browser-subHeader">\n        ', '\n      </div>\n      <div class="Browser-body">\n        <main class="Browser-content">\n          ', '\n        </main>\n      </div>\n    </div>\n  ']);

var _html = require('../../../core/html');

var _html2 = _interopRequireDefault(_html);

var _Breadcrumbs = require('./Breadcrumbs');

var _Breadcrumbs2 = _interopRequireDefault(_Breadcrumbs);

var _Table = require('./Table');

var _Table2 = _interopRequireDefault(_Table);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  var filteredFolders = props.folders;
  var filteredFiles = props.files;

  if (props.filterInput !== '') {
    filteredFolders = props.filterItems(props.folders);
    filteredFiles = props.filterItems(props.files);
  }

  return (0, _html2.default)(_templateObject, props.filterQuery, props.filterInput, (0, _Breadcrumbs2.default)({
    getNextFolder: props.getNextFolder,
    directories: props.directories
  }), (0, _Table2.default)({
    columns: [{
      name: 'Name',
      key: 'title'
    }],
    folders: filteredFolders,
    files: filteredFiles,
    activeRow: props.activeRow,
    sortByTitle: props.sortByTitle,
    sortByDate: props.sortByDate,
    handleRowClick: props.handleRowClick,
    handleFileDoubleClick: props.addFile,
    handleFolderDoubleClick: props.getNextFolder
  }));
};

module.exports = exports['default'];

},{"../../../core/html":32,"./Breadcrumbs":50,"./Table":52}],52:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['\n      <th class="BrowserTable-headerColumn BrowserTable-column" onclick=', '>\n        ', '\n      </th>\n    '], ['\n      <th class="BrowserTable-headerColumn BrowserTable-column" onclick=', '>\n        ', '\n      </th>\n    ']),
    _templateObject2 = _taggedTemplateLiteralLoose(['\n    <table class="BrowserTable">\n      <thead class="BrowserTable-header">\n        <tr>\n          ', '\n        </tr>\n      </thead>\n      <tbody>\n        ', '\n        ', '\n      </tbody>\n    </table>\n  '], ['\n    <table class="BrowserTable">\n      <thead class="BrowserTable-header">\n        <tr>\n          ', '\n        </tr>\n      </thead>\n      <tbody>\n        ', '\n        ', '\n      </tbody>\n    </table>\n  ']);

var _html = require('../../../core/html');

var _html2 = _interopRequireDefault(_html);

var _TableRow = require('./TableRow');

var _TableRow2 = _interopRequireDefault(_TableRow);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  var headers = props.columns.map(function (column) {
    return (0, _html2.default)(_templateObject, props.sortByTitle, column.name);
  });

  return (0, _html2.default)(_templateObject2, headers, props.folders.map(function (folder) {
    return (0, _TableRow2.default)({
      title: folder.title,
      active: props.activeRow === folder.id,
      iconLink: folder.iconLink,
      modifiedByMeDate: folder.modifiedByMeDate,
      handleClick: function handleClick() {
        return props.handleRowClick(folder.id);
      },
      handleDoubleClick: function handleDoubleClick() {
        return props.handleFolderDoubleClick(folder.id, folder.title);
      },
      columns: props.columns
    });
  }), props.files.map(function (file) {
    return (0, _TableRow2.default)({
      title: file.title,
      active: props.activeRow === file.id,
      iconLink: file.iconLink,
      modifiedByMeDate: file.modifiedByMeDate,
      handleClick: function handleClick() {
        return props.handleRowClick(file.id);
      },
      handleDoubleClick: function handleDoubleClick() {
        return props.handleFileDoubleClick(file);
      },
      columns: props.columns,
      owner: 'Joe Mama'
    });
  }));
};

module.exports = exports['default'];

},{"../../../core/html":32,"./TableRow":54}],53:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['\n    <td class="BrowserTable-rowColumn BrowserTable-column">\n      <img src=', '/> ', '\n    </td>\n  '], ['\n    <td class="BrowserTable-rowColumn BrowserTable-column">\n      <img src=', '/> ', '\n    </td>\n  ']);

var _html = require('../../../core/html');

var _html2 = _interopRequireDefault(_html);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  return (0, _html2.default)(_templateObject, props.iconLink, props.value);
};

module.exports = exports['default'];

},{"../../../core/html":32}],54:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['\n    <tr onclick=', ' ondblclick=', ' class=', '>\n      ', '\n    </tr>\n  '], ['\n    <tr onclick=', ' ondblclick=', ' class=', '>\n      ', '\n    </tr>\n  ']);

var _html = require('../../../core/html');

var _html2 = _interopRequireDefault(_html);

var _TableColumn = require('./TableColumn');

var _TableColumn2 = _interopRequireDefault(_TableColumn);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  var classes = props.active ? 'BrowserTable-row is-active' : 'BrowserTable-row';
  return (0, _html2.default)(_templateObject, props.handleClick, props.handleDoubleClick, classes, (0, _TableColumn2.default)({
    iconLink: props.iconLink,
    value: props.title || ''
  }));
};

module.exports = exports['default'];

},{"../../../core/html":32,"./TableColumn":53}],55:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _templateObject = _taggedTemplateLiteralLoose(['<div class="UppyInformer" aria-hidden="', '">\n      <p>', '</p>\n    </div>'], ['<div class="UppyInformer" aria-hidden="', '">\n      <p>', '</p>\n    </div>']);

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

var _html = require('../core/html');

var _html2 = _interopRequireDefault(_html);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Informer
 * Shows rad message bubbles
 * used like this: `bus.emit('informer', 'hello world', 'info', 5000)`
 * or for errors: `bus.emit('informer', 'Error uploading img.jpg', 'error', 5000)`
 *
 */
var Informer = function (_Plugin) {
  _inherits(Informer, _Plugin);

  function Informer(core, opts) {
    _classCallCheck(this, Informer);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'progressindicator';
    _this.id = 'Informer';
    _this.title = 'Informer';

    // set default options
    var defaultOptions = {};

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);
    return _this;
  }

  Informer.prototype.showInformer = function showInformer(msg, type, duration) {
    var _this2 = this;

    this.core.setState({
      informer: {
        isHidden: false,
        msg: msg
      }
    });

    if (duration === 0) return;

    // hide the informer after `duration` milliseconds
    setTimeout(function () {
      var newInformer = _extends({}, _this2.core.getState().informer, {
        isHidden: true
      });
      _this2.core.setState({
        informer: newInformer
      });
    }, duration);
  };

  Informer.prototype.hideInformer = function hideInformer() {
    var newInformer = _extends({}, this.core.getState().informer, {
      isHidden: true
    });
    this.core.setState({
      informer: newInformer
    });
  };

  Informer.prototype.render = function render(state) {
    var msg = state.informer.msg;
    var isHidden = state.informer.isHidden;

    // @TODO add aria-live for screen-readers
    return (0, _html2.default)(_templateObject, isHidden, msg);
  };

  Informer.prototype.install = function install() {
    var _this3 = this;

    // Set default state for Google Drive
    this.core.setState({
      informer: {
        isHidden: true,
        msg: ''
      }
    });

    var bus = this.core.bus;

    bus.on('informer', function (msg, type, duration) {
      _this3.showInformer(msg, type, duration);
    });

    bus.on('informer-hide', function () {
      _this3.hideInformer();
    });

    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);
  };

  return Informer;
}(_Plugin3.default);

exports.default = Informer;
module.exports = exports['default'];

},{"../core/html":32,"./Plugin":57}],56:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Meta Data
 * Adds metadata fields to Uppy
 *
 */
var MetaData = function (_Plugin) {
  _inherits(MetaData, _Plugin);

  function MetaData(core, opts) {
    _classCallCheck(this, MetaData);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'modifier';
    _this.id = 'MetaData';
    _this.title = 'Meta Data';

    // set default options
    var defaultOptions = {};

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);
    return _this;
  }

  MetaData.prototype.addInitialMeta = function addInitialMeta() {
    var _this2 = this;

    var metaFields = this.opts.fields;

    this.core.setState({
      metaFields: metaFields
    });

    this.core.emitter.on('file-added', function (fileID) {
      metaFields.forEach(function (item) {
        var obj = {};
        obj[item.id] = item.value;
        _this2.core.updateMeta(obj, fileID);
      });
    });
  };

  MetaData.prototype.install = function install() {
    this.addInitialMeta();
  };

  return MetaData;
}(_Plugin3.default);

exports.default = MetaData;
module.exports = exports['default'];

},{"./Plugin":57}],57:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _yoYo = require('yo-yo');

var _yoYo2 = _interopRequireDefault(_yoYo);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Boilerplate that all Plugins share - and should not be used
 * directly. It also shows which methods final plugins should implement/override,
 * this deciding on structure.
 *
 * @param {object} main Uppy core object
 * @param {object} object with plugin options
 * @return {array | string} files or success/fail message
 */
var Plugin = function () {
  function Plugin(core, opts) {
    _classCallCheck(this, Plugin);

    this.core = core;
    this.opts = opts || {};
    this.type = 'none';

    // clear everything inside the target selector
    this.opts.replaceTargetContent === this.opts.replaceTargetContent || true;

    this.update = this.update.bind(this);
    this.mount = this.mount.bind(this);
    this.focus = this.focus.bind(this);
    this.install = this.install.bind(this);
  }

  Plugin.prototype.update = function update(state) {
    if (typeof this.el === 'undefined') {
      return;
    }

    var newEl = this.render(state);
    _yoYo2.default.update(this.el, newEl);

    // optimizes performance?
    // requestAnimationFrame(() => {
    //   const newEl = this.render(state)
    //   yo.update(this.el, newEl)
    // })
  };

  /**
   * Check if supplied `target` is a `string` or an `object`.
   * If it’s an object — target is a plugin, and we search `plugins`
   * for a plugin with same name and return its target.
   *
   * @param {String|Object} target
   *
   */


  Plugin.prototype.mount = function mount(target, plugin) {
    var callerPluginName = plugin.id;

    if (typeof target === 'string') {
      this.core.log('Installing ' + callerPluginName + ' to ' + target);

      // clear everything inside the target container
      if (this.opts.replaceTargetContent) {
        document.querySelector(target).innerHTML = '';
      }

      this.el = plugin.render(this.core.state);
      document.querySelector(target).appendChild(this.el);

      return target;
    } else {
      // TODO: is instantiating the plugin really the way to roll
      // just to get the plugin name?
      var Target = target;
      var targetPluginName = new Target().id;

      this.core.log('Installing ' + callerPluginName + ' to ' + targetPluginName);

      var targetPlugin = this.core.getPlugin(targetPluginName);
      var selectorTarget = targetPlugin.addTarget(plugin);

      return selectorTarget;
    }
  };

  Plugin.prototype.focus = function focus() {
    return;
  };

  Plugin.prototype.install = function install() {
    return;
  };

  return Plugin;
}();

exports.default = Plugin;
module.exports = exports['default'];

},{"yo-yo":19}],58:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _Plugin2 = require('./Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

var _tusJsClient = require('tus-js-client');

var _tusJsClient2 = _interopRequireDefault(_tusJsClient);

var _UppySocket = require('../core/UppySocket');

var _UppySocket2 = _interopRequireDefault(_UppySocket);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _Promise = typeof Promise === 'undefined' ? require('es6-promise').Promise : Promise;

/**
 * Tus resumable file uploader
 *
 */
var Tus10 = function (_Plugin) {
  _inherits(Tus10, _Plugin);

  function Tus10(core, opts) {
    _classCallCheck(this, Tus10);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.type = 'uploader';
    _this.id = 'Tus';
    _this.title = 'Tus';

    // set default options
    var defaultOptions = {
      resume: true,
      allowPause: true
    };

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);
    return _this;
  }

  Tus10.prototype.pauseResume = function pauseResume(action, fileID) {
    var updatedFiles = _extends({}, this.core.getState().files);
    var inProgressUpdatedFiles = Object.keys(updatedFiles).filter(function (file) {
      return !updatedFiles[file].progress.uploadComplete && updatedFiles[file].progress.uploadStarted;
    });

    switch (action) {
      case 'toggle':
        if (updatedFiles[fileID].uploadComplete) return;

        var wasPaused = updatedFiles[fileID].isPaused || false;
        var isPaused = !wasPaused;
        var updatedFile = void 0;
        if (wasPaused) {
          updatedFile = _extends({}, updatedFiles[fileID], {
            isPaused: false
          });
        } else {
          updatedFile = _extends({}, updatedFiles[fileID], {
            isPaused: true
          });
        }
        updatedFiles[fileID] = updatedFile;
        this.core.setState({ files: updatedFiles });
        return isPaused;
      case 'pauseAll':
        inProgressUpdatedFiles.forEach(function (file) {
          var updatedFile = _extends({}, updatedFiles[file], {
            isPaused: true
          });
          updatedFiles[file] = updatedFile;
        });
        this.core.setState({ files: updatedFiles });
        return;
      case 'resumeAll':
        inProgressUpdatedFiles.forEach(function (file) {
          var updatedFile = _extends({}, updatedFiles[file], {
            isPaused: false
          });
          updatedFiles[file] = updatedFile;
        });
        this.core.setState({ files: updatedFiles });
        return;
    }
  };

  /**
   * Create a new Tus upload
   *
   * @param {object} file for use with upload
   * @param {integer} current file in a queue
   * @param {integer} total number of files in a queue
   * @returns {Promise}
   */


  Tus10.prototype.upload = function upload(file, current, total) {
    var _this2 = this;

    this.core.log('uploading ' + current + ' of ' + total);

    // Create a new tus upload
    return new _Promise(function (resolve, reject) {
      var upload = new _tusJsClient2.default.Upload(file.data, {

        // TODO merge this.opts or this.opts.tus here
        metadata: file.meta,
        resume: _this2.opts.resume,
        endpoint: _this2.opts.endpoint,

        onError: function onError(err) {
          _this2.core.log(err);
          _this2.core.emitter.emit('core:upload-error', file.id);
          reject('Failed because: ' + err);
        },
        onProgress: function onProgress(bytesUploaded, bytesTotal) {
          // Dispatch progress event
          console.log(bytesUploaded, bytesTotal);
          _this2.core.emitter.emit('core:upload-progress', {
            uploader: _this2,
            id: file.id,
            bytesUploaded: bytesUploaded,
            bytesTotal: bytesTotal
          });
        },
        onSuccess: function onSuccess() {
          _this2.core.emitter.emit('core:upload-success', file.id, upload.url);

          _this2.core.log('Download ' + upload.file.name + ' from ' + upload.url);
          resolve(upload);
        }
      });

      _this2.core.emitter.on('core:file-remove', function (fileID) {
        if (fileID === file.id) {
          console.log('removing file: ', fileID);
          upload.abort();
          resolve('upload ' + fileID + ' was removed');
        }
      });

      _this2.core.emitter.on('core:upload-pause', function (fileID) {
        if (fileID === file.id) {
          var isPaused = _this2.pauseResume('toggle', fileID);
          isPaused ? upload.abort() : upload.start();
        }
      });

      _this2.core.emitter.on('core:pause-all', function () {
        var files = _this2.core.getState().files;
        if (!files[file.id]) return;
        upload.abort();
      });

      _this2.core.emitter.on('core:resume-all', function () {
        var files = _this2.core.getState().files;
        if (!files[file.id]) return;
        upload.start();
      });

      upload.start();
      _this2.core.emitter.emit('core:upload-started', file.id, upload);
    });
  };

  Tus10.prototype.uploadRemote = function uploadRemote(file, current, total) {
    var _this3 = this;

    return new _Promise(function (resolve, reject) {
      _this3.core.log(file.remote.url);
      fetch(file.remote.url, {
        method: 'post',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(_extends({}, file.remote.body, {
          endpoint: _this3.opts.endpoint,
          protocol: 'tus'
        }))
      }).then(function (res) {
        if (res.status < 200 && res.status > 300) {
          return reject(res.statusText);
        }

        res.json().then(function (data) {
          // get the host domain
          var regex = /^(?:https?:\/\/|\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^\/\n]+)/;
          var host = regex.exec(file.remote.host)[1];
          var socketProtocol = location.protocol === 'https:' ? 'wss' : 'ws';

          var token = data.token;
          var socket = new _UppySocket2.default({
            target: socketProtocol + ('://' + host + '/api/' + token)
          });

          socket.on('progress', function (progressData) {
            var progress = progressData.progress;
            var bytesUploaded = progressData.bytesUploaded;
            var bytesTotal = progressData.bytesTotal;


            if (progress) {
              _this3.core.log('Upload progress: ' + progress);

              // Dispatch progress event
              _this3.core.emitter.emit('core:upload-progress', {
                uploader: _this3,
                id: file.id,
                bytesUploaded: bytesUploaded,
                bytesTotal: bytesTotal
              });

              if (progress === '100.00') {
                _this3.core.emitter.emit('core:upload-success', file.id);
                socket.close();
                return resolve();
              }
            }
          });
        });
      });
    });
  };

  Tus10.prototype.uploadFiles = function uploadFiles(files) {
    var _this4 = this;

    if (Object.keys(files).length === 0) {
      this.core.log('no files to upload!');
      return;
    }

    var uploaders = [];
    files.forEach(function (file, index) {
      var current = parseInt(index, 10) + 1;
      var total = files.length;

      if (!file.isRemote) {
        uploaders.push(_this4.upload(file, current, total));
      } else {
        uploaders.push(_this4.uploadRemote(file, current, total));
      }
    });

    return Promise.all(uploaders).then(function () {
      _this4.core.log('All files uploaded');
      return { uploadedCount: files.length };
    }).catch(function (err) {
      _this4.core.log('Upload error: ' + err);
    });
  };

  Tus10.prototype.selectForUpload = function selectForUpload(files) {
    // TODO: replace files[file].isRemote with some logic
    //
    // filter files that are now yet being uploaded / haven’t been uploaded
    // and remote too
    var filesForUpload = Object.keys(files).filter(function (file) {
      if (!files[file].progress.uploadStarted || files[file].isRemote) {
        return true;
      }
      return false;
    }).map(function (file) {
      return files[file];
    });

    this.uploadFiles(filesForUpload);
  };

  Tus10.prototype.actions = function actions() {
    var _this5 = this;

    this.core.emitter.on('core:pause-all', function () {
      _this5.pauseResume('pauseAll');
    });

    this.core.emitter.on('core:resume-all', function () {
      _this5.pauseResume('resumeAll');
    });

    this.core.emitter.on('core:upload', function () {
      _this5.core.log('Tus is uploading...');
      var files = _this5.core.getState().files;
      _this5.selectForUpload(files);
    });
  };

  Tus10.prototype.addResumableUploadsCapabilityFlag = function addResumableUploadsCapabilityFlag() {
    var newCapabilities = _extends({}, this.core.getState().capabilities);
    newCapabilities.resumableUploads = true;
    this.core.setState({
      capabilities: newCapabilities
    });
  };

  Tus10.prototype.install = function install() {
    this.addResumableUploadsCapabilityFlag();
    this.actions();
  };

  return Tus10;
}(_Plugin3.default);

exports.default = Tus10;
module.exports = exports['default'];

},{"../core/UppySocket":30,"./Plugin":57,"es6-promise":4,"tus-js-client":14}],59:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['<svg class="UppyIcon" width="100" height="77" viewBox="0 0 100 77">\n    <g>\n      <path d="M50 32c-7.168 0-13 5.832-13 13s5.832 13 13 13 13-5.832 13-13-5.832-13-13-13z"/>\n      <path d="M87 13H72c0-7.18-5.82-13-13-13H41c-7.18 0-13 5.82-13 13H13C5.82 13 0 18.82 0 26v38c0 7.18 5.82 13 13 13h74c7.18 0 13-5.82 13-13V26c0-7.18-5.82-13-13-13zM50 68c-12.683 0-23-10.318-23-23s10.317-23 23-23 23 10.318 23 23-10.317 23-23 23z"/>\n    <g>\n  </svg>'], ['<svg class="UppyIcon" width="100" height="77" viewBox="0 0 100 77">\n    <g>\n      <path d="M50 32c-7.168 0-13 5.832-13 13s5.832 13 13 13 13-5.832 13-13-5.832-13-13-13z"/>\n      <path d="M87 13H72c0-7.18-5.82-13-13-13H41c-7.18 0-13 5.82-13 13H13C5.82 13 0 18.82 0 26v38c0 7.18 5.82 13 13 13h74c7.18 0 13-5.82 13-13V26c0-7.18-5.82-13-13-13zM50 68c-12.683 0-23-10.318-23-23s10.317-23 23-23 23 10.318 23 23-10.317 23-23 23z"/>\n    <g>\n  </svg>']);

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  return (0, _html2.default)(_templateObject);
};

module.exports = exports['default'];

},{"../../core/html":32}],60:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['<video class="UppyWebcam-video" autoplay src="', '"></video>'], ['<video class="UppyWebcam-video" autoplay src="', '"></video>']),
    _templateObject2 = _taggedTemplateLiteralLoose(['\n    <div class="UppyWebcam-container" onload=', ' onunload=', '>\n      <div class=\'UppyWebcam-videoContainer\'>\n        ', '\n      </div>\n      <div class=\'UppyWebcam-buttonContainer\'>\n        <button class="UppyButton--circular UppyButton--red UppyButton--sizeM UppyWebcam-stopRecordBtn"\n          type="button"\n          title="Take a snapshot"\n          aria-label="Take a snapshot"\n          onclick=', '>\n          ', '\n        </button>\n      </div>\n      <canvas class="UppyWebcam-canvas" style="display: none;"></canvas>\n    </div>\n  '], ['\n    <div class="UppyWebcam-container" onload=', ' onunload=', '>\n      <div class=\'UppyWebcam-videoContainer\'>\n        ', '\n      </div>\n      <div class=\'UppyWebcam-buttonContainer\'>\n        <button class="UppyButton--circular UppyButton--red UppyButton--sizeM UppyWebcam-stopRecordBtn"\n          type="button"\n          title="Take a snapshot"\n          aria-label="Take a snapshot"\n          onclick=', '>\n          ', '\n        </button>\n      </div>\n      <canvas class="UppyWebcam-canvas" style="display: none;"></canvas>\n    </div>\n  ']);

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

var _CameraIcon = require('./CameraIcon');

var _CameraIcon2 = _interopRequireDefault(_CameraIcon);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  var src = props.src || '';
  var video = void 0;

  if (props.useTheFlash) {
    video = props.getSWFHTML();
  } else {
    video = (0, _html2.default)(_templateObject, src);
  }

  return (0, _html2.default)(_templateObject2, function (el) {
    props.onFocus();
    document.querySelector('.UppyWebcam-stopRecordBtn').focus();
  }, function (el) {
    props.onStop();
  }, video, props.onSnapshot, (0, _CameraIcon2.default)());
};

module.exports = exports['default'];

},{"../../core/html":32,"./CameraIcon":59}],61:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['\n    <div>\n      <h1>Please allow access to your camera</h1>\n      <span>You have been prompted to allow camera access from this site. In order to take pictures with your camera you must approve this request.</span>\n    </div>\n  '], ['\n    <div>\n      <h1>Please allow access to your camera</h1>\n      <span>You have been prompted to allow camera access from this site. In order to take pictures with your camera you must approve this request.</span>\n    </div>\n  ']);

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  return (0, _html2.default)(_templateObject);
};

module.exports = exports['default'];

},{"../../core/html":32}],62:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _templateObject = _taggedTemplateLiteralLoose(['\n    <svg class="UppyIcon UppyModalTab-icon" width="18" height="21" viewBox="0 0 18 21">\n      <g>\n        <path d="M14.8 16.9c1.9-1.7 3.2-4.1 3.2-6.9 0-5-4-9-9-9s-9 4-9 9c0 2.8 1.2 5.2 3.2 6.9C1.9 17.9.5 19.4 0 21h3c1-1.9 11-1.9 12 0h3c-.5-1.6-1.9-3.1-3.2-4.1zM9 4c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6 2.7-6 6-6z"/>\n        <path d="M9 14c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zM8 8c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1c0-.5.4-1 1-1z"/>\n      </g>\n    </svg>\n  '], ['\n    <svg class="UppyIcon UppyModalTab-icon" width="18" height="21" viewBox="0 0 18 21">\n      <g>\n        <path d="M14.8 16.9c1.9-1.7 3.2-4.1 3.2-6.9 0-5-4-9-9-9s-9 4-9 9c0 2.8 1.2 5.2 3.2 6.9C1.9 17.9.5 19.4 0 21h3c1-1.9 11-1.9 12 0h3c-.5-1.6-1.9-3.1-3.2-4.1zM9 4c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6 2.7-6 6-6z"/>\n        <path d="M9 14c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zM8 8c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1c0-.5.4-1 1-1z"/>\n      </g>\n    </svg>\n  ']);

var _html = require('../../core/html');

var _html2 = _interopRequireDefault(_html);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _taggedTemplateLiteralLoose(strings, raw) { strings.raw = raw; return strings; }

exports.default = function (props) {
  return (0, _html2.default)(_templateObject);
};

module.exports = exports['default'];

},{"../../core/html":32}],63:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _Plugin2 = require('../Plugin');

var _Plugin3 = _interopRequireDefault(_Plugin2);

var _Webcam = require('../../uppy-base/src/plugins/Webcam');

var _Webcam2 = _interopRequireDefault(_Webcam);

var _Utils = require('../../core/Utils');

var _WebcamIcon = require('./WebcamIcon');

var _WebcamIcon2 = _interopRequireDefault(_WebcamIcon);

var _CameraScreen = require('./CameraScreen');

var _CameraScreen2 = _interopRequireDefault(_CameraScreen);

var _PermissionsScreen = require('./PermissionsScreen');

var _PermissionsScreen2 = _interopRequireDefault(_PermissionsScreen);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Webcam
 */
var Webcam = function (_Plugin) {
  _inherits(Webcam, _Plugin);

  function Webcam(core, opts) {
    _classCallCheck(this, Webcam);

    var _this = _possibleConstructorReturn(this, _Plugin.call(this, core, opts));

    _this.userMedia = true;
    _this.protocol = location.protocol.match(/https/i) ? 'https' : 'http';
    _this.type = 'acquirer';
    _this.id = 'Webcam';
    _this.title = 'Webcam';
    _this.icon = (0, _WebcamIcon2.default)();

    // set default options
    var defaultOptions = {
      enableFlash: true
    };

    _this.params = {
      swfURL: 'webcam.swf',
      width: 400,
      height: 300,
      dest_width: 800, // size of captured image
      dest_height: 600, // these default to width/height
      image_format: 'jpeg', // image format (may be jpeg or png)
      jpeg_quality: 90, // jpeg image quality from 0 (worst) to 100 (best)
      enable_flash: true, // enable flash fallback,
      force_flash: false, // force flash mode,
      flip_horiz: false, // flip image horiz (mirror mode)
      fps: 30, // camera frames per second
      upload_name: 'webcam', // name of file in upload post data
      constraints: null, // custom user media constraints,
      flashNotDetectedText: 'ERROR: No Adobe Flash Player detected.  Webcam.js relies on Flash for browsers that do not support getUserMedia (like yours).',
      noInterfaceFoundText: 'No supported webcam interface found.',
      unfreeze_snap: true // Whether to unfreeze the camera after snap (defaults to true)
    };

    // merge default options with the ones set by user
    _this.opts = _extends({}, defaultOptions, opts);

    _this.install = _this.install.bind(_this);
    _this.updateState = _this.updateState.bind(_this);

    _this.render = _this.render.bind(_this);

    // Camera controls
    _this.start = _this.start.bind(_this);
    _this.stop = _this.stop.bind(_this);
    _this.takeSnapshot = _this.takeSnapshot.bind(_this);

    _this.webcam = new _Webcam2.default(_this.opts, _this.params);
    _this.webcamActive = false;
    return _this;
  }

  Webcam.prototype.start = function start() {
    var _this2 = this;

    this.webcamActive = true;

    this.webcam.start().then(function (stream) {
      _this2.stream = stream;
      _this2.updateState({
        // videoStream: stream,
        cameraReady: true
      });
    }).catch(function (err) {
      _this2.updateState({
        cameraError: err
      });
    });
  };

  Webcam.prototype.stop = function stop() {
    this.stream.getVideoTracks()[0].stop();
    this.webcamActive = false;
    this.stream = null;
    this.streamSrc = null;
  };

  Webcam.prototype.takeSnapshot = function takeSnapshot() {
    var opts = {
      name: 'webcam-' + Date.now() + '.jpg',
      mimeType: 'image/jpeg'
    };

    var video = document.querySelector('.UppyWebcam-video');

    var image = this.webcam.getImage(video, opts);

    var tagFile = {
      source: this.id,
      name: opts.name,
      data: image.data,
      type: opts.mimeType
    };

    this.core.emitter.emit('core:file-add', tagFile);
  };

  Webcam.prototype.render = function render(state) {
    if (!this.webcamActive) {
      this.start();
    }

    if (!state.webcam.cameraReady && !state.webcam.useTheFlash) {
      return (0, _PermissionsScreen2.default)(state.webcam);
    }

    if (!this.streamSrc) {
      this.streamSrc = this.stream ? URL.createObjectURL(this.stream) : null;
    }

    return (0, _CameraScreen2.default)((0, _Utils.extend)(state.webcam, {
      onSnapshot: this.takeSnapshot,
      onFocus: this.focus,
      onStop: this.stop,
      getSWFHTML: this.webcam.getSWFHTML,
      src: this.streamSrc
    }));
  };

  Webcam.prototype.focus = function focus() {
    var _this3 = this;

    setTimeout(function () {
      _this3.core.emitter.emit('informer', 'Smile!', 'info', 2000);
    }, 1000);
  };

  Webcam.prototype.install = function install() {
    this.webcam.init();
    this.core.setState({
      webcam: {
        cameraReady: false
      }
    });

    var target = this.opts.target;
    var plugin = this;
    this.target = this.mount(target, plugin);
  };

  /**
   * Little shorthand to update the state with my new state
   */


  Webcam.prototype.updateState = function updateState(newState) {
    var state = this.core.state;

    var webcam = _extends({}, state.webcam, newState);

    this.core.setState({ webcam: webcam });
  };

  return Webcam;
}(_Plugin3.default);

exports.default = Webcam;
module.exports = exports['default'];

},{"../../core/Utils":31,"../../uppy-base/src/plugins/Webcam":65,"../Plugin":57,"./CameraScreen":60,"./PermissionsScreen":61,"./WebcamIcon":62}],64:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _getName = function _getName(id) {
  return id.split('-').map(function (s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }).join(' ');
};

var Provider = function () {
  function Provider(opts) {
    _classCallCheck(this, Provider);

    this.opts = opts;
    this.provider = opts.provider;
    this.id = this.provider;
    this.name = this.opts.name || _getName(this.id);
  }

  _createClass(Provider, [{
    key: 'auth',
    value: function auth() {
      return fetch(this.opts.host + '/' + this.provider + '/authorize', {
        method: 'get',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application.json'
        }
      }).then(function (res) {
        return res.json().then(function (payload) {
          return payload.isAuthenticated;
        });
      });
    }
  }, {
    key: 'list',
    value: function list() {
      var directory = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'root';

      return fetch(this.opts.host + '/' + this.provider + '/list/' + directory, {
        method: 'get',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(function (res) {
        return res.json();
      });
    }
  }, {
    key: 'logout',
    value: function logout() {
      var redirect = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : location.href;

      return fetch(this.opts.host + '/' + this.provider + '/logout?redirect=' + redirect, {
        method: 'get',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
    }
  }]);

  return Provider;
}();

exports.default = Provider;

},{}],65:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _dataURItoFile = require('../utils/dataURItoFile');

var _dataURItoFile2 = _interopRequireDefault(_dataURItoFile);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Webcam Plugin
 */
var Webcam = function () {
  function Webcam() {
    var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, Webcam);

    this._userMedia;
    this.userMedia = true;
    this.protocol = location.protocol.match(/https/i) ? 'https' : 'http';

    // set default options
    var defaultOptions = {
      enableFlash: true
    };

    var defaultParams = {
      swfURL: 'webcam.swf',
      width: 400,
      height: 300,
      dest_width: 800, // size of captured image
      dest_height: 600, // these default to width/height
      image_format: 'jpeg', // image format (may be jpeg or png)
      jpeg_quality: 90, // jpeg image quality from 0 (worst) to 100 (best)
      enable_flash: true, // enable flash fallback,
      force_flash: false, // force flash mode,
      flip_horiz: false, // flip image horiz (mirror mode)
      fps: 30, // camera frames per second
      upload_name: 'webcam', // name of file in upload post data
      constraints: null, // custom user media constraints,
      flashNotDetectedText: 'ERROR: No Adobe Flash Player detected.  Webcam.js relies on Flash for browsers that do not support getUserMedia (like yours).',
      noInterfaceFoundText: 'No supported webcam interface found.',
      unfreeze_snap: true // Whether to unfreeze the camera after snap (defaults to true)
    };

    this.params = Object.assign({}, defaultParams, params);

    // merge default options with the ones set by user
    this.opts = Object.assign({}, defaultOptions, opts);

    // Camera controls
    this.start = this.start.bind(this);
    this.init = this.init.bind(this);
    this.stop = this.stop.bind(this);
    // this.startRecording = this.startRecording.bind(this)
    // this.stopRecording = this.stopRecording.bind(this)
    this.takeSnapshot = this.takeSnapshot.bind(this);
    this.getImage = this.getImage.bind(this);
    this.getSWFHTML = this.getSWFHTML.bind(this);
    this.detectFlash = this.detectFlash.bind(this);
    this.getUserMedia = this.getUserMedia.bind(this);
    this.getMediaDevices = this.getMediaDevices.bind(this);
  }

  /**
   * Checks for getUserMedia support
   */


  _createClass(Webcam, [{
    key: 'init',
    value: function init() {
      var _this = this;

      // initialize, check for getUserMedia support
      this.mediaDevices = this.getMediaDevices();

      this.userMedia = this.getUserMedia(this.mediaDevices);

      // Make sure media stream is closed when navigating away from page
      if (this.userMedia) {
        window.addEventListener('beforeunload', function (event) {
          _this.reset();
        });
      }

      return {
        mediaDevices: this.mediaDevices,
        userMedia: this.userMedia
      };
    }

    // Setup getUserMedia, with polyfill for older browsers
    // Adapted from: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

  }, {
    key: 'getMediaDevices',
    value: function getMediaDevices() {
      return navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? navigator.mediaDevices : navigator.mozGetUserMedia || navigator.webkitGetUserMedia ? {
        getUserMedia: function getUserMedia(opts) {
          return new Promise(function (resolve, reject) {
            (navigator.mozGetUserMedia || navigator.webkitGetUserMedia).call(navigator, opts, resolve, reject);
          });
        }
      } : null;
    }
  }, {
    key: 'getUserMedia',
    value: function getUserMedia(mediaDevices) {
      var userMedia = true;
      // Older versions of firefox (< 21) apparently claim support but user media does not actually work
      if (navigator.userAgent.match(/Firefox\D+(\d+)/)) {
        if (parseInt(RegExp.$1, 10) < 21) {
          return null;
        }
      }

      window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
      return userMedia && !!mediaDevices && !!window.URL;
    }
  }, {
    key: 'start',
    value: function start() {
      var _this2 = this;

      this.userMedia = this._userMedia === undefined ? this.userMedia : this._userMedia;
      return new Promise(function (resolve, reject) {
        if (_this2.userMedia) {
          // ask user for access to their camera
          _this2.mediaDevices.getUserMedia({
            audio: false,
            video: true
          }).then(function (stream) {
            return resolve(stream);
          }).catch(function (err) {
            return reject(err);
          });
        }
      });
    }

    /**
     * Detects if browser supports flash
     * Code snippet borrowed from: https://github.com/swfobject/swfobject
     *
     * @return {bool} flash supported
     */

  }, {
    key: 'detectFlash',
    value: function detectFlash() {
      var SHOCKWAVE_FLASH = 'Shockwave Flash';
      var SHOCKWAVE_FLASH_AX = 'ShockwaveFlash.ShockwaveFlash';
      var FLASH_MIME_TYPE = 'application/x-shockwave-flash';
      var win = window;
      var nav = navigator;
      var hasFlash = false;

      if (typeof nav.plugins !== 'undefined' && _typeof(nav.plugins[SHOCKWAVE_FLASH]) === 'object') {
        var desc = nav.plugins[SHOCKWAVE_FLASH].description;
        if (desc && typeof nav.mimeTypes !== 'undefined' && nav.mimeTypes[FLASH_MIME_TYPE] && nav.mimeTypes[FLASH_MIME_TYPE].enabledPlugin) {
          hasFlash = true;
        }
      } else if (typeof win.ActiveXObject !== 'undefined') {
        try {
          var ax = new win.ActiveXObject(SHOCKWAVE_FLASH_AX);
          if (ax) {
            var ver = ax.GetVariable('$version');
            if (ver) hasFlash = true;
          }
        } catch (e) {}
      }

      return hasFlash;
    }
  }, {
    key: 'reset',
    value: function reset() {
      // shutdown camera, reset to potentially attach again
      if (this.preview_active) this.unfreeze();

      if (this.userMedia) {
        if (this.stream) {
          if (this.stream.getVideoTracks) {
            // get video track to call stop on it
            var tracks = this.stream.getVideoTracks();
            if (tracks && tracks[0] && tracks[0].stop) tracks[0].stop();
          } else if (this.stream.stop) {
            // deprecated, may be removed in future
            this.stream.stop();
          }
        }
        delete this.stream;
        delete this.video;
      }

      if (this.userMedia !== true) {
        // call for turn off camera in flash
        this.getMovie()._releaseCamera();
      }
    }
  }, {
    key: 'getSWFHTML',
    value: function getSWFHTML() {
      // Return HTML for embedding flash based webcam capture movie
      var swfURL = this.params.swfURL;

      // make sure we aren't running locally (flash doesn't work)
      if (location.protocol.match(/file/)) {
        return '<h3 style="color:red">ERROR: the Webcam.js Flash fallback does not work from local disk.  Please run it from a web server.</h3>';
      }

      // make sure we have flash
      if (!this.detectFlash()) {
        return '<h3 style="color:red">No flash</h3>';
      }

      // set default swfURL if not explicitly set
      if (!swfURL) {
        // find our script tag, and use that base URL
        var base_url = '';
        var scpts = document.getElementsByTagName('script');
        for (var idx = 0, len = scpts.length; idx < len; idx++) {
          var src = scpts[idx].getAttribute('src');
          if (src && src.match(/\/webcam(\.min)?\.js/)) {
            base_url = src.replace(/\/webcam(\.min)?\.js.*$/, '');
            idx = len;
          }
        }
        if (base_url) swfURL = base_url + '/webcam.swf';else swfURL = 'webcam.swf';
      }

      // // if this is the user's first visit, set flashvar so flash privacy settings panel is shown first
      // if (window.localStorage && !localStorage.getItem('visited')) {
      //   // this.params.new_user = 1
      //   localStorage.setItem('visited', 1)
      // }
      // this.params.new_user = 1
      // construct flashvars string
      var flashvars = '';
      for (var key in this.params) {
        if (flashvars) flashvars += '&';
        flashvars += key + '=' + escape(this.params[key]);
      }

      // construct object/embed tag

      return '<object classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000" type="application/x-shockwave-flash" codebase="' + this.protocol + '://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=9,0,0,0" width="' + this.params.width + '" height="' + this.params.height + '" id="webcam_movie_obj" align="middle"><param name="wmode" value="opaque" /><param name="allowScriptAccess" value="always" /><param name="allowFullScreen" value="false" /><param name="movie" value="' + swfURL + '" /><param name="loop" value="false" /><param name="menu" value="false" /><param name="quality" value="best" /><param name="bgcolor" value="#ffffff" /><param name="flashvars" value="' + flashvars + '"/><embed id="webcam_movie_embed" src="' + swfURL + '" wmode="opaque" loop="false" menu="false" quality="best" bgcolor="#ffffff" width="' + this.params.width + '" height="' + this.params.height + '" name="webcam_movie_embed" align="middle" allowScriptAccess="always" allowFullScreen="false" type="application/x-shockwave-flash" pluginspage="http://www.macromedia.com/go/getflashplayer" flashvars="' + flashvars + '"></embed></object>';
    }
  }, {
    key: 'getMovie',
    value: function getMovie() {
      // get reference to movie object/embed in DOM
      var movie = document.getElementById('webcam_movie_obj');
      if (!movie || !movie._snap) movie = document.getElementById('webcam_movie_embed');
      if (!movie) console.log('getMovie error');
      return movie;
    }

    /**
     * Stops the webcam capture and video playback.
     */

  }, {
    key: 'stop',
    value: function stop() {
      var video = this.video;
      var videoStream = this.videoStream;


      this.updateState({
        cameraReady: false
      });

      if (videoStream) {
        if (videoStream.stop) {
          videoStream.stop();
        } else if (videoStream.msStop) {
          videoStream.msStop();
        }

        videoStream.onended = null;
        videoStream = null;
      }

      if (video) {
        video.onerror = null;
        video.pause();

        if (video.mozSrcObject) {
          video.mozSrcObject = null;
        }

        video.src = '';
      }

      this.video = document.querySelector('.UppyWebcam-video');
      this.canvas = document.querySelector('.UppyWebcam-canvas');
    }
  }, {
    key: 'flashNotify',
    value: function flashNotify(type, msg) {
      // receive notification from flash about event
      switch (type) {
        case 'flashLoadComplete':
          // movie loaded successfully
          break;

        case 'cameraLive':
          // camera is live and ready to snap
          this.live = true;
          break;

        case 'error':
          // Flash error
          console.log('There was a flash error', msg);
          break;

        default:
          // catch-all event, just in case
          console.log('webcam flash_notify: ' + type + ': ' + msg);
          break;
      }
    }
  }, {
    key: 'configure',
    value: function configure(panel) {
      // open flash configuration panel -- specify tab name:
      // 'camera', 'privacy', 'default', 'localStorage', 'microphone', 'settingsManager'
      if (!panel) panel = 'camera';
      this.getMovie()._configure(panel);
    }

    /**
     * Takes a snapshot and displays it in a canvas.
     */

  }, {
    key: 'getImage',
    value: function getImage(video, opts) {
      var canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);

      var dataUrl = canvas.toDataURL(opts.mimeType);

      var file = (0, _dataURItoFile2.default)(dataUrl, {
        name: opts.name
      });

      return {
        dataUrl: dataUrl,
        data: file,
        type: opts.mimeType
      };
    }
  }, {
    key: 'takeSnapshot',
    value: function takeSnapshot(video, canvas) {
      var opts = {
        name: 'webcam-' + Date.now() + '.jpg',
        mimeType: 'image/jpeg'
      };

      var image = this.getImage(video, canvas, opts);

      var tagFile = {
        source: this.id,
        name: opts.name,
        data: image.data,
        type: opts.type
      };

      return tagFile;
    }
  }]);

  return Webcam;
}();

exports.default = Webcam;

},{"../utils/dataURItoFile":66}],66:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (dataURI, opts) {
  return dataURItoBlob(dataURI, opts, true);
};

function dataURItoBlob(dataURI, opts, toFile) {
  // get the base64 data
  var data = dataURI.split(',')[1];

  // user may provide mime type, if not get it from data URI
  var mimeType = opts.mimeType || dataURI.split(',')[0].split(':')[1].split(';')[0];

  // default to plain/text if data URI has no mimeType
  if (mimeType == null) {
    mimeType = 'plain/text';
  }

  var binary = atob(data);
  var array = [];
  for (var i = 0; i < binary.length; i++) {
    array.push(binary.charCodeAt(i));
  }

  // Convert to a File?
  if (toFile) {
    return new File([new Uint8Array(array)], opts.name || '', { type: mimeType });
  }

  return new Blob([new Uint8Array(array)], { type: mimeType });
}

},{}],67:[function(require,module,exports){

},{}],68:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],69:[function(require,module,exports){
'use strict';

var _core = require('../../../../src/core');

var _core2 = _interopRequireDefault(_core);

var _Dashboard = require('../../../../src/plugins/Dashboard');

var _Dashboard2 = _interopRequireDefault(_Dashboard);

var _GoogleDrive = require('../../../../src/plugins/GoogleDrive');

var _GoogleDrive2 = _interopRequireDefault(_GoogleDrive);

var _Webcam = require('../../../../src/plugins/Webcam');

var _Webcam2 = _interopRequireDefault(_Webcam);

var _Tus = require('../../../../src/plugins/Tus10');

var _Tus2 = _interopRequireDefault(_Tus);

var _MetaData = require('../../../../src/plugins/MetaData');

var _MetaData2 = _interopRequireDefault(_MetaData);

var _Informer = require('../../../../src/plugins/Informer');

var _Informer2 = _interopRequireDefault(_Informer);

var _env = require('../env');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var PROTOCOL = location.protocol === 'https:' ? 'https' : 'http';
var TUS_ENDPOINT = PROTOCOL + '://master.tus.io/files/';

function uppyInit() {
  var opts = window.uppyOptions;
  var dashboardEl = document.querySelector('.UppyDashboard');
  if (dashboardEl) {
    var dashboardElParent = dashboardEl.parentNode;
    dashboardElParent.removeChild(dashboardEl);
  }

  var uppy = (0, _core2.default)({ debug: true, autoProceed: opts.autoProceed });
  uppy.use(_Dashboard2.default, {
    trigger: '.UppyModalOpenerBtn',
    inline: opts.DashboardInline,
    target: opts.DashboardInline ? '.DashboardContainer' : 'body'
  });

  if (opts.GoogleDrive) {
    uppy.use(_GoogleDrive2.default, { target: _Dashboard2.default, host: _env.UPPY_SERVER });
  }

  if (opts.Webcam) {
    uppy.use(_Webcam2.default, { target: _Dashboard2.default });
  }

  uppy.use(_Tus2.default, { endpoint: TUS_ENDPOINT, resume: true });
  uppy.use(_Informer2.default, { target: _Dashboard2.default });
  uppy.use(_MetaData2.default, {
    fields: [{ id: 'resizeTo', name: 'Resize to', value: 1200, placeholder: 'specify future image size' }, { id: 'description', name: 'Description', value: 'none', placeholder: 'describe what the file is for' }]
  });
  uppy.run();

  uppy.on('core:success', function (fileCount) {
    console.log('Yo, uploaded: ' + fileCount);
  });
}

uppyInit();
window.uppyInit = uppyInit;

},{"../../../../src/core":33,"../../../../src/plugins/Dashboard":45,"../../../../src/plugins/GoogleDrive":48,"../../../../src/plugins/Informer":55,"../../../../src/plugins/MetaData":56,"../../../../src/plugins/Tus10":58,"../../../../src/plugins/Webcam":63,"../env":70}],70:[function(require,module,exports){
'use strict';

exports.__esModule = true;
var uppyServerEndpoint = 'http://localhost:3020';

if (location.hostname === 'uppy.io') {
  uppyServerEndpoint = '//server.uppy.io';
}

// uppyServerEndpoint = 'http://server.uppy.io:3020'
var UPPY_SERVER = exports.UPPY_SERVER = uppyServerEndpoint;

},{}]},{},[69])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuLi9ub2RlX21vZHVsZXMvZHJhZy1kcm9wL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2RyYWctZHJvcC9ub2RlX21vZHVsZXMvZmxhdHRlbi9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kcmFnLWRyb3Avbm9kZV9tb2R1bGVzL3J1bi1wYXJhbGxlbC9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2VzNi1wcm9taXNlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL25hbWVzcGFjZS1lbWl0dGVyL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3ByZXR0eS1ieXRlcy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9wcmV0dHktYnl0ZXMvbm9kZV9tb2R1bGVzL251bWJlci1pcy1uYW4vaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvdHVzLWpzLWNsaWVudC9saWIuZXM1L2Jyb3dzZXIvYmFzZTY0LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3R1cy1qcy1jbGllbnQvbGliLmVzNS9icm93c2VyL3JlcXVlc3QuanMiLCIuLi9ub2RlX21vZHVsZXMvdHVzLWpzLWNsaWVudC9saWIuZXM1L2Jyb3dzZXIvc291cmNlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3R1cy1qcy1jbGllbnQvbGliLmVzNS9icm93c2VyL3N0b3JhZ2UuanMiLCIuLi9ub2RlX21vZHVsZXMvdHVzLWpzLWNsaWVudC9saWIuZXM1L2Vycm9yLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3R1cy1qcy1jbGllbnQvbGliLmVzNS9maW5nZXJwcmludC5qcyIsIi4uL25vZGVfbW9kdWxlcy90dXMtanMtY2xpZW50L2xpYi5lczUvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvdHVzLWpzLWNsaWVudC9saWIuZXM1L3VwbG9hZC5qcyIsIi4uL25vZGVfbW9kdWxlcy90dXMtanMtY2xpZW50L25vZGVfbW9kdWxlcy9leHRlbmQvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvdHVzLWpzLWNsaWVudC9ub2RlX21vZHVsZXMvcmVzb2x2ZS11cmwvcmVzb2x2ZS11cmwuanMiLCIuLi9ub2RlX21vZHVsZXMvd2hhdHdnLWZldGNoL2ZldGNoLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvL25vZGVfbW9kdWxlcy9iZWwvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMveW8teW8vbm9kZV9tb2R1bGVzL2JlbC9ub2RlX21vZHVsZXMvZ2xvYmFsL2RvY3VtZW50LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvL25vZGVfbW9kdWxlcy9iZWwvbm9kZV9tb2R1bGVzL2dsb2JhbC93aW5kb3cuanMiLCIuLi9ub2RlX21vZHVsZXMveW8teW8vbm9kZV9tb2R1bGVzL2JlbC9ub2RlX21vZHVsZXMvaHlwZXJ4L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvL25vZGVfbW9kdWxlcy9iZWwvbm9kZV9tb2R1bGVzL2h5cGVyeC9ub2RlX21vZHVsZXMvaHlwZXJzY3JpcHQtYXR0cmlidXRlLXRvLXByb3BlcnR5L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3lvLXlvL25vZGVfbW9kdWxlcy9iZWwvbm9kZV9tb2R1bGVzL29uLWxvYWQvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMveW8teW8vbm9kZV9tb2R1bGVzL21vcnBoZG9tL3NyYy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy95by15by91cGRhdGUtZXZlbnRzLmpzIiwiLi4vc3JjL2NvcmUvQ29yZS5qcyIsIi4uL3NyYy9jb3JlL1RyYW5zbGF0b3IuanMiLCIuLi9zcmMvY29yZS9VcHB5U29ja2V0LmpzIiwiLi4vc3JjL2NvcmUvVXRpbHMuanMiLCIuLi9zcmMvY29yZS9odG1sLmpzIiwiLi4vc3JjL2NvcmUvaW5kZXguanMiLCIuLi9zcmMvbG9jYWxlcy9lbl9VUy5qcyIsIi4uL3NyYy9wbHVnaW5zL0Rhc2hib2FyZC9BY3Rpb25Ccm93c2VUYWdsaW5lLmpzIiwiLi4vc3JjL3BsdWdpbnMvRGFzaGJvYXJkL0Rhc2hib2FyZC5qcyIsIi4uL3NyYy9wbHVnaW5zL0Rhc2hib2FyZC9GaWxlQ2FyZC5qcyIsIi4uL3NyYy9wbHVnaW5zL0Rhc2hib2FyZC9GaWxlSXRlbS5qcyIsIi4uL3NyYy9wbHVnaW5zL0Rhc2hib2FyZC9GaWxlSXRlbVByb2dyZXNzLmpzIiwiLi4vc3JjL3BsdWdpbnMvRGFzaGJvYXJkL0ZpbGVMaXN0LmpzIiwiLi4vc3JjL3BsdWdpbnMvRGFzaGJvYXJkL1N0YXR1c0Jhci5qcyIsIi4uL3NyYy9wbHVnaW5zL0Rhc2hib2FyZC9UYWJzLmpzIiwiLi4vc3JjL3BsdWdpbnMvRGFzaGJvYXJkL1VwbG9hZEJ0bi5qcyIsIi4uL3NyYy9wbHVnaW5zL0Rhc2hib2FyZC9pY29ucy5qcyIsIi4uL3NyYy9wbHVnaW5zL0Rhc2hib2FyZC9pbmRleC5qcyIsIi4uL3NyYy9wbHVnaW5zL0dvb2dsZURyaXZlL0F1dGhWaWV3LmpzIiwiLi4vc3JjL3BsdWdpbnMvR29vZ2xlRHJpdmUvRXJyb3IuanMiLCIuLi9zcmMvcGx1Z2lucy9Hb29nbGVEcml2ZS9pbmRleC5qcyIsIi4uL3NyYy9wbHVnaW5zL0dvb2dsZURyaXZlL25ldy9CcmVhZGNydW1iLmpzIiwiLi4vc3JjL3BsdWdpbnMvR29vZ2xlRHJpdmUvbmV3L0JyZWFkY3J1bWJzLmpzIiwiLi4vc3JjL3BsdWdpbnMvR29vZ2xlRHJpdmUvbmV3L0Jyb3dzZXIuanMiLCIuLi9zcmMvcGx1Z2lucy9Hb29nbGVEcml2ZS9uZXcvVGFibGUuanMiLCIuLi9zcmMvcGx1Z2lucy9Hb29nbGVEcml2ZS9uZXcvVGFibGVDb2x1bW4uanMiLCIuLi9zcmMvcGx1Z2lucy9Hb29nbGVEcml2ZS9uZXcvVGFibGVSb3cuanMiLCIuLi9zcmMvcGx1Z2lucy9JbmZvcm1lci5qcyIsIi4uL3NyYy9wbHVnaW5zL01ldGFEYXRhLmpzIiwiLi4vc3JjL3BsdWdpbnMvUGx1Z2luLmpzIiwiLi4vc3JjL3BsdWdpbnMvVHVzMTAuanMiLCIuLi9zcmMvcGx1Z2lucy9XZWJjYW0vQ2FtZXJhSWNvbi5qcyIsIi4uL3NyYy9wbHVnaW5zL1dlYmNhbS9DYW1lcmFTY3JlZW4uanMiLCIuLi9zcmMvcGx1Z2lucy9XZWJjYW0vUGVybWlzc2lvbnNTY3JlZW4uanMiLCIuLi9zcmMvcGx1Z2lucy9XZWJjYW0vV2ViY2FtSWNvbi5qcyIsIi4uL3NyYy9wbHVnaW5zL1dlYmNhbS9pbmRleC5qcyIsIi4uL3NyYy91cHB5LWJhc2Uvc3JjL3BsdWdpbnMvUHJvdmlkZXIuanMiLCIuLi9zcmMvdXBweS1iYXNlL3NyYy9wbHVnaW5zL1dlYmNhbS5qcyIsIi4uL3NyYy91cHB5LWJhc2Uvc3JjL3V0aWxzL2RhdGFVUkl0b0ZpbGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1yZXNvbHZlL2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsInNyYy9leGFtcGxlcy9kYXNoYm9hcmQvYXBwLmVzNiIsInNyYy9leGFtcGxlcy9lbnYuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDLzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxZ0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2piQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNsSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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QkFBekI7O0FBRUEsSUFBSSxTQUFTLFFBQVQsS0FBc0IsU0FBMUIsRUFBcUM7QUFDbkMsdUJBQXFCLGtCQUFyQjtBQUNEOztBQUVEO0FBQ08sSUFBTSxvQ0FBYyxrQkFBcEIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBkcmFnRHJvcFxuXG52YXIgZmxhdHRlbiA9IHJlcXVpcmUoJ2ZsYXR0ZW4nKVxudmFyIHBhcmFsbGVsID0gcmVxdWlyZSgncnVuLXBhcmFsbGVsJylcblxuZnVuY3Rpb24gZHJhZ0Ryb3AgKGVsZW0sIGxpc3RlbmVycykge1xuICBpZiAodHlwZW9mIGVsZW0gPT09ICdzdHJpbmcnKSB7XG4gICAgZWxlbSA9IHdpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsZW0pXG4gIH1cblxuICBpZiAodHlwZW9mIGxpc3RlbmVycyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGxpc3RlbmVycyA9IHsgb25Ecm9wOiBsaXN0ZW5lcnMgfVxuICB9XG5cbiAgdmFyIHRpbWVvdXRcblxuICBlbGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbnRlcicsIHN0b3BFdmVudCwgZmFsc2UpXG4gIGVsZW0uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ292ZXInLCBvbkRyYWdPdmVyLCBmYWxzZSlcbiAgZWxlbS5hZGRFdmVudExpc3RlbmVyKCdkcmFnbGVhdmUnLCBvbkRyYWdMZWF2ZSwgZmFsc2UpXG4gIGVsZW0uYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIG9uRHJvcCwgZmFsc2UpXG5cbiAgLy8gRnVuY3Rpb24gdG8gcmVtb3ZlIGRyYWctZHJvcCBsaXN0ZW5lcnNcbiAgcmV0dXJuIGZ1bmN0aW9uIHJlbW92ZSAoKSB7XG4gICAgcmVtb3ZlRHJhZ0NsYXNzKClcbiAgICBlbGVtLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RyYWdlbnRlcicsIHN0b3BFdmVudCwgZmFsc2UpXG4gICAgZWxlbS5yZW1vdmVFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsIG9uRHJhZ092ZXIsIGZhbHNlKVxuICAgIGVsZW0ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgb25EcmFnTGVhdmUsIGZhbHNlKVxuICAgIGVsZW0ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHJvcCcsIG9uRHJvcCwgZmFsc2UpXG4gIH1cblxuICBmdW5jdGlvbiBvbkRyYWdPdmVyIChlKSB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGlmIChlLmRhdGFUcmFuc2Zlci5pdGVtcykge1xuICAgICAgLy8gT25seSBhZGQgXCJkcmFnXCIgY2xhc3Mgd2hlbiBgaXRlbXNgIGNvbnRhaW5zIGEgZmlsZVxuICAgICAgdmFyIGl0ZW1zID0gdG9BcnJheShlLmRhdGFUcmFuc2Zlci5pdGVtcykuZmlsdGVyKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtLmtpbmQgPT09ICdmaWxlJ1xuICAgICAgfSlcbiAgICAgIGlmIChpdGVtcy5sZW5ndGggPT09IDApIHJldHVyblxuICAgIH1cblxuICAgIGVsZW0uY2xhc3NMaXN0LmFkZCgnZHJhZycpXG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpXG5cbiAgICBpZiAobGlzdGVuZXJzLm9uRHJhZ092ZXIpIHtcbiAgICAgIGxpc3RlbmVycy5vbkRyYWdPdmVyKGUpXG4gICAgfVxuXG4gICAgZS5kYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9ICdjb3B5J1xuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgZnVuY3Rpb24gb25EcmFnTGVhdmUgKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICBpZiAobGlzdGVuZXJzLm9uRHJhZ0xlYXZlKSB7XG4gICAgICBsaXN0ZW5lcnMub25EcmFnTGVhdmUoZSlcbiAgICB9XG5cbiAgICBjbGVhclRpbWVvdXQodGltZW91dClcbiAgICB0aW1lb3V0ID0gc2V0VGltZW91dChyZW1vdmVEcmFnQ2xhc3MsIDUwKVxuXG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICBmdW5jdGlvbiBvbkRyb3AgKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICBpZiAobGlzdGVuZXJzLm9uRHJhZ0xlYXZlKSB7XG4gICAgICBsaXN0ZW5lcnMub25EcmFnTGVhdmUoZSlcbiAgICB9XG5cbiAgICBjbGVhclRpbWVvdXQodGltZW91dClcbiAgICByZW1vdmVEcmFnQ2xhc3MoKVxuXG4gICAgdmFyIHBvcyA9IHtcbiAgICAgIHg6IGUuY2xpZW50WCxcbiAgICAgIHk6IGUuY2xpZW50WVxuICAgIH1cblxuICAgIGlmIChlLmRhdGFUcmFuc2Zlci5pdGVtcykge1xuICAgICAgLy8gSGFuZGxlIGRpcmVjdG9yaWVzIGluIENocm9tZSB1c2luZyB0aGUgcHJvcHJpZXRhcnkgRmlsZVN5c3RlbSBBUElcbiAgICAgIHZhciBpdGVtcyA9IHRvQXJyYXkoZS5kYXRhVHJhbnNmZXIuaXRlbXMpLmZpbHRlcihmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbS5raW5kID09PSAnZmlsZSdcbiAgICAgIH0pXG5cbiAgICAgIGlmIChpdGVtcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gICAgICBwYXJhbGxlbChpdGVtcy5tYXAoZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgIHByb2Nlc3NFbnRyeShpdGVtLndlYmtpdEdldEFzRW50cnkoKSwgY2IpXG4gICAgICAgIH1cbiAgICAgIH0pLCBmdW5jdGlvbiAoZXJyLCByZXN1bHRzKSB7XG4gICAgICAgIC8vIFRoaXMgY2F0Y2hlcyBwZXJtaXNzaW9uIGVycm9ycyB3aXRoIGZpbGU6Ly8gaW4gQ2hyb21lLiBUaGlzIHNob3VsZCBuZXZlclxuICAgICAgICAvLyB0aHJvdyBpbiBwcm9kdWN0aW9uIGNvZGUsIHNvIHRoZSB1c2VyIGRvZXMgbm90IG5lZWQgdG8gdXNlIHRyeS1jYXRjaC5cbiAgICAgICAgaWYgKGVycikgdGhyb3cgZXJyXG4gICAgICAgIGlmIChsaXN0ZW5lcnMub25Ecm9wKSB7XG4gICAgICAgICAgbGlzdGVuZXJzLm9uRHJvcChmbGF0dGVuKHJlc3VsdHMpLCBwb3MpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBmaWxlcyA9IHRvQXJyYXkoZS5kYXRhVHJhbnNmZXIuZmlsZXMpXG5cbiAgICAgIGlmIChmaWxlcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gICAgICBmaWxlcy5mb3JFYWNoKGZ1bmN0aW9uIChmaWxlKSB7XG4gICAgICAgIGZpbGUuZnVsbFBhdGggPSAnLycgKyBmaWxlLm5hbWVcbiAgICAgIH0pXG5cbiAgICAgIGlmIChsaXN0ZW5lcnMub25Ecm9wKSB7XG4gICAgICAgIGxpc3RlbmVycy5vbkRyb3AoZmlsZXMsIHBvcylcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZURyYWdDbGFzcyAoKSB7XG4gICAgZWxlbS5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnJylcbiAgfVxufVxuXG5mdW5jdGlvbiBzdG9wRXZlbnQgKGUpIHtcbiAgZS5zdG9wUHJvcGFnYXRpb24oKVxuICBlLnByZXZlbnREZWZhdWx0KClcbiAgcmV0dXJuIGZhbHNlXG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NFbnRyeSAoZW50cnksIGNiKSB7XG4gIHZhciBlbnRyaWVzID0gW11cblxuICBpZiAoZW50cnkuaXNGaWxlKSB7XG4gICAgZW50cnkuZmlsZShmdW5jdGlvbiAoZmlsZSkge1xuICAgICAgZmlsZS5mdWxsUGF0aCA9IGVudHJ5LmZ1bGxQYXRoICAvLyBwcmVzZXJ2ZSBwYXRoaW5nIGZvciBjb25zdW1lclxuICAgICAgY2IobnVsbCwgZmlsZSlcbiAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICBjYihlcnIpXG4gICAgfSlcbiAgfSBlbHNlIGlmIChlbnRyeS5pc0RpcmVjdG9yeSkge1xuICAgIHZhciByZWFkZXIgPSBlbnRyeS5jcmVhdGVSZWFkZXIoKVxuICAgIHJlYWRFbnRyaWVzKClcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRFbnRyaWVzICgpIHtcbiAgICByZWFkZXIucmVhZEVudHJpZXMoZnVuY3Rpb24gKGVudHJpZXNfKSB7XG4gICAgICBpZiAoZW50cmllc18ubGVuZ3RoID4gMCkge1xuICAgICAgICBlbnRyaWVzID0gZW50cmllcy5jb25jYXQodG9BcnJheShlbnRyaWVzXykpXG4gICAgICAgIHJlYWRFbnRyaWVzKCkgLy8gY29udGludWUgcmVhZGluZyBlbnRyaWVzIHVudGlsIGByZWFkRW50cmllc2AgcmV0dXJucyBubyBtb3JlXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkb25lRW50cmllcygpXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGRvbmVFbnRyaWVzICgpIHtcbiAgICBwYXJhbGxlbChlbnRyaWVzLm1hcChmdW5jdGlvbiAoZW50cnkpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgcHJvY2Vzc0VudHJ5KGVudHJ5LCBjYilcbiAgICAgIH1cbiAgICB9KSwgY2IpXG4gIH1cbn1cblxuZnVuY3Rpb24gdG9BcnJheSAobGlzdCkge1xuICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwobGlzdCB8fCBbXSwgMClcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZmxhdHRlbihsaXN0LCBkZXB0aCkge1xuICBkZXB0aCA9ICh0eXBlb2YgZGVwdGggPT0gJ251bWJlcicpID8gZGVwdGggOiBJbmZpbml0eTtcblxuICBpZiAoIWRlcHRoKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkobGlzdCkpIHtcbiAgICAgIHJldHVybiBsaXN0Lm1hcChmdW5jdGlvbihpKSB7IHJldHVybiBpOyB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGxpc3Q7XG4gIH1cblxuICByZXR1cm4gX2ZsYXR0ZW4obGlzdCwgMSk7XG5cbiAgZnVuY3Rpb24gX2ZsYXR0ZW4obGlzdCwgZCkge1xuICAgIHJldHVybiBsaXN0LnJlZHVjZShmdW5jdGlvbiAoYWNjLCBpdGVtKSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShpdGVtKSAmJiBkIDwgZGVwdGgpIHtcbiAgICAgICAgcmV0dXJuIGFjYy5jb25jYXQoX2ZsYXR0ZW4oaXRlbSwgZCArIDEpKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gYWNjLmNvbmNhdChpdGVtKTtcbiAgICAgIH1cbiAgICB9LCBbXSk7XG4gIH1cbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICh0YXNrcywgY2IpIHtcbiAgdmFyIHJlc3VsdHMsIHBlbmRpbmcsIGtleXNcbiAgdmFyIGlzU3luYyA9IHRydWVcblxuICBpZiAoQXJyYXkuaXNBcnJheSh0YXNrcykpIHtcbiAgICByZXN1bHRzID0gW11cbiAgICBwZW5kaW5nID0gdGFza3MubGVuZ3RoXG4gIH0gZWxzZSB7XG4gICAga2V5cyA9IE9iamVjdC5rZXlzKHRhc2tzKVxuICAgIHJlc3VsdHMgPSB7fVxuICAgIHBlbmRpbmcgPSBrZXlzLmxlbmd0aFxuICB9XG5cbiAgZnVuY3Rpb24gZG9uZSAoZXJyKSB7XG4gICAgZnVuY3Rpb24gZW5kICgpIHtcbiAgICAgIGlmIChjYikgY2IoZXJyLCByZXN1bHRzKVxuICAgICAgY2IgPSBudWxsXG4gICAgfVxuICAgIGlmIChpc1N5bmMpIHByb2Nlc3MubmV4dFRpY2soZW5kKVxuICAgIGVsc2UgZW5kKClcbiAgfVxuXG4gIGZ1bmN0aW9uIGVhY2ggKGksIGVyciwgcmVzdWx0KSB7XG4gICAgcmVzdWx0c1tpXSA9IHJlc3VsdFxuICAgIGlmICgtLXBlbmRpbmcgPT09IDAgfHwgZXJyKSB7XG4gICAgICBkb25lKGVycilcbiAgICB9XG4gIH1cblxuICBpZiAoIXBlbmRpbmcpIHtcbiAgICAvLyBlbXB0eVxuICAgIGRvbmUobnVsbClcbiAgfSBlbHNlIGlmIChrZXlzKSB7XG4gICAgLy8gb2JqZWN0XG4gICAga2V5cy5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgIHRhc2tzW2tleV0oZnVuY3Rpb24gKGVyciwgcmVzdWx0KSB7IGVhY2goa2V5LCBlcnIsIHJlc3VsdCkgfSlcbiAgICB9KVxuICB9IGVsc2Uge1xuICAgIC8vIGFycmF5XG4gICAgdGFza3MuZm9yRWFjaChmdW5jdGlvbiAodGFzaywgaSkge1xuICAgICAgdGFzayhmdW5jdGlvbiAoZXJyLCByZXN1bHQpIHsgZWFjaChpLCBlcnIsIHJlc3VsdCkgfSlcbiAgICB9KVxuICB9XG5cbiAgaXNTeW5jID0gZmFsc2Vcbn1cbiIsIi8qIVxuICogQG92ZXJ2aWV3IGVzNi1wcm9taXNlIC0gYSB0aW55IGltcGxlbWVudGF0aW9uIG9mIFByb21pc2VzL0ErLlxuICogQGNvcHlyaWdodCBDb3B5cmlnaHQgKGMpIDIwMTQgWWVodWRhIEthdHosIFRvbSBEYWxlLCBTdGVmYW4gUGVubmVyIGFuZCBjb250cmlidXRvcnMgKENvbnZlcnNpb24gdG8gRVM2IEFQSSBieSBKYWtlIEFyY2hpYmFsZClcbiAqIEBsaWNlbnNlICAgTGljZW5zZWQgdW5kZXIgTUlUIGxpY2Vuc2VcbiAqICAgICAgICAgICAgU2VlIGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9qYWtlYXJjaGliYWxkL2VzNi1wcm9taXNlL21hc3Rlci9MSUNFTlNFXG4gKiBAdmVyc2lvbiAgIDMuMi4xXG4gKi9cblxuKGZ1bmN0aW9uKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkb2JqZWN0T3JGdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4gdHlwZW9mIHggPT09ICdmdW5jdGlvbicgfHwgKHR5cGVvZiB4ID09PSAnb2JqZWN0JyAmJiB4ICE9PSBudWxsKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzRnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNNYXliZVRoZW5hYmxlKHgpIHtcbiAgICAgIHJldHVybiB0eXBlb2YgeCA9PT0gJ29iamVjdCcgJiYgeCAhPT0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHV0aWxzJCRfaXNBcnJheTtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkX2lzQXJyYXkgPSBmdW5jdGlvbiAoeCkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHgpID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGliJGVzNiRwcm9taXNlJHV0aWxzJCRfaXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNBcnJheSA9IGxpYiRlczYkcHJvbWlzZSR1dGlscyQkX2lzQXJyYXk7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gPSAwO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkdmVydHhOZXh0O1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkY3VzdG9tU2NoZWR1bGVyRm47XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAgPSBmdW5jdGlvbiBhc2FwKGNhbGxiYWNrLCBhcmcpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuXSA9IGNhbGxiYWNrO1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2xpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gKyAxXSA9IGFyZztcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gKz0gMjtcbiAgICAgIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuID09PSAyKSB7XG4gICAgICAgIC8vIElmIGxlbiBpcyAyLCB0aGF0IG1lYW5zIHRoYXQgd2UgbmVlZCB0byBzY2hlZHVsZSBhbiBhc3luYyBmbHVzaC5cbiAgICAgICAgLy8gSWYgYWRkaXRpb25hbCBjYWxsYmFja3MgYXJlIHF1ZXVlZCBiZWZvcmUgdGhlIHF1ZXVlIGlzIGZsdXNoZWQsIHRoZXlcbiAgICAgICAgLy8gd2lsbCBiZSBwcm9jZXNzZWQgYnkgdGhpcyBmbHVzaCB0aGF0IHdlIGFyZSBzY2hlZHVsaW5nLlxuICAgICAgICBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGN1c3RvbVNjaGVkdWxlckZuKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGN1c3RvbVNjaGVkdWxlckZuKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2goKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzZXRTY2hlZHVsZXIoc2NoZWR1bGVGbikge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGN1c3RvbVNjaGVkdWxlckZuID0gc2NoZWR1bGVGbjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2V0QXNhcChhc2FwRm4pIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwID0gYXNhcEZuO1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3NlcldpbmRvdyA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykgPyB3aW5kb3cgOiB1bmRlZmluZWQ7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyR2xvYmFsID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJXaW5kb3cgfHwge307XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRCcm93c2VyTXV0YXRpb25PYnNlcnZlciA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyR2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJHbG9iYWwuV2ViS2l0TXV0YXRpb25PYnNlcnZlcjtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGlzTm9kZSA9IHR5cGVvZiBzZWxmID09PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYge30udG9TdHJpbmcuY2FsbChwcm9jZXNzKSA9PT0gJ1tvYmplY3QgcHJvY2Vzc10nO1xuXG4gICAgLy8gdGVzdCBmb3Igd2ViIHdvcmtlciBidXQgbm90IGluIElFMTBcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGlzV29ya2VyID0gdHlwZW9mIFVpbnQ4Q2xhbXBlZEFycmF5ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgdHlwZW9mIGltcG9ydFNjcmlwdHMgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICB0eXBlb2YgTWVzc2FnZUNoYW5uZWwgIT09ICd1bmRlZmluZWQnO1xuXG4gICAgLy8gbm9kZVxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VOZXh0VGljaygpIHtcbiAgICAgIC8vIG5vZGUgdmVyc2lvbiAwLjEwLnggZGlzcGxheXMgYSBkZXByZWNhdGlvbiB3YXJuaW5nIHdoZW4gbmV4dFRpY2sgaXMgdXNlZCByZWN1cnNpdmVseVxuICAgICAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9jdWpvanMvd2hlbi9pc3N1ZXMvNDEwIGZvciBkZXRhaWxzXG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIHByb2Nlc3MubmV4dFRpY2sobGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gdmVydHhcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlVmVydHhUaW1lcigpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHZlcnR4TmV4dChsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2gpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTXV0YXRpb25PYnNlcnZlcigpIHtcbiAgICAgIHZhciBpdGVyYXRpb25zID0gMDtcbiAgICAgIHZhciBvYnNlcnZlciA9IG5ldyBsaWIkZXM2JHByb21pc2UkYXNhcCQkQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIobGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKTtcbiAgICAgIHZhciBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZShub2RlLCB7IGNoYXJhY3RlckRhdGE6IHRydWUgfSk7XG5cbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgbm9kZS5kYXRhID0gKGl0ZXJhdGlvbnMgPSArK2l0ZXJhdGlvbnMgJSAyKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gd2ViIHdvcmtlclxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VNZXNzYWdlQ2hhbm5lbCgpIHtcbiAgICAgIHZhciBjaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsKCk7XG4gICAgICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaDtcbiAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNoYW5uZWwucG9ydDIucG9zdE1lc3NhZ2UoMCk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VTZXRUaW1lb3V0KCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICBzZXRUaW1lb3V0KGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCwgMSk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWUgPSBuZXcgQXJyYXkoMTAwMCk7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuOyBpKz0yKSB7XG4gICAgICAgIHZhciBjYWxsYmFjayA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtpXTtcbiAgICAgICAgdmFyIGFyZyA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtpKzFdO1xuXG4gICAgICAgIGNhbGxiYWNrKGFyZyk7XG5cbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2ldID0gdW5kZWZpbmVkO1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbaSsxXSA9IHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiA9IDA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJGF0dGVtcHRWZXJ0eCgpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciByID0gcmVxdWlyZTtcbiAgICAgICAgdmFyIHZlcnR4ID0gcigndmVydHgnKTtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHZlcnR4TmV4dCA9IHZlcnR4LnJ1bk9uTG9vcCB8fCB2ZXJ0eC5ydW5PbkNvbnRleHQ7XG4gICAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlVmVydHhUaW1lcigpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlU2V0VGltZW91dCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaDtcbiAgICAvLyBEZWNpZGUgd2hhdCBhc3luYyBtZXRob2QgdG8gdXNlIHRvIHRyaWdnZXJpbmcgcHJvY2Vzc2luZyBvZiBxdWV1ZWQgY2FsbGJhY2tzOlxuICAgIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkaXNOb2RlKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VOZXh0VGljaygpO1xuICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VNdXRhdGlvbk9ic2VydmVyKCk7XG4gICAgfSBlbHNlIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkaXNXb3JrZXIpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU1lc3NhZ2VDaGFubmVsKCk7XG4gICAgfSBlbHNlIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3NlcldpbmRvdyA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiByZXF1aXJlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhdHRlbXB0VmVydHgoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlU2V0VGltZW91dCgpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkdGhlbiQkdGhlbihvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuICAgICAgdmFyIHBhcmVudCA9IHRoaXM7XG5cbiAgICAgIHZhciBjaGlsZCA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuXG4gICAgICBpZiAoY2hpbGRbbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUFJPTUlTRV9JRF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRtYWtlUHJvbWlzZShjaGlsZCk7XG4gICAgICB9XG5cbiAgICAgIHZhciBzdGF0ZSA9IHBhcmVudC5fc3RhdGU7XG5cbiAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICB2YXIgY2FsbGJhY2sgPSBhcmd1bWVudHNbc3RhdGUgLSAxXTtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAoZnVuY3Rpb24oKXtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpbnZva2VDYWxsYmFjayhzdGF0ZSwgY2hpbGQsIGNhbGxiYWNrLCBwYXJlbnQuX3Jlc3VsdCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKHBhcmVudCwgY2hpbGQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGNoaWxkO1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHRoZW4kJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkdGhlbiQkdGhlbjtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZXNvbHZlJCRyZXNvbHZlKG9iamVjdCkge1xuICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICAgIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cbiAgICAgIGlmIChvYmplY3QgJiYgdHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCcgJiYgb2JqZWN0LmNvbnN0cnVjdG9yID09PSBDb25zdHJ1Y3Rvcikge1xuICAgICAgICByZXR1cm4gb2JqZWN0O1xuICAgICAgfVxuXG4gICAgICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgb2JqZWN0KTtcbiAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVzb2x2ZSQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJHJlc29sdmU7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBST01JU0VfSUQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoMTYpO1xuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCgpIHt9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORyAgID0gdm9pZCAwO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQgPSAxO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCAgPSAyO1xuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SID0gbmV3IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEVycm9yT2JqZWN0KCk7XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzZWxmRnVsZmlsbG1lbnQoKSB7XG4gICAgICByZXR1cm4gbmV3IFR5cGVFcnJvcihcIllvdSBjYW5ub3QgcmVzb2x2ZSBhIHByb21pc2Ugd2l0aCBpdHNlbGZcIik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkY2Fubm90UmV0dXJuT3duKCkge1xuICAgICAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoJ0EgcHJvbWlzZXMgY2FsbGJhY2sgY2Fubm90IHJldHVybiB0aGF0IHNhbWUgcHJvbWlzZS4nKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRnZXRUaGVuKHByb21pc2UpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlLnRoZW47XG4gICAgICB9IGNhdGNoKGVycm9yKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SLmVycm9yID0gZXJyb3I7XG4gICAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRHRVRfVEhFTl9FUlJPUjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCR0cnlUaGVuKHRoZW4sIHZhbHVlLCBmdWxmaWxsbWVudEhhbmRsZXIsIHJlamVjdGlvbkhhbmRsZXIpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoZW4uY2FsbCh2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVGb3JlaWduVGhlbmFibGUocHJvbWlzZSwgdGhlbmFibGUsIHRoZW4pIHtcbiAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcChmdW5jdGlvbihwcm9taXNlKSB7XG4gICAgICAgIHZhciBzZWFsZWQgPSBmYWxzZTtcbiAgICAgICAgdmFyIGVycm9yID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkdHJ5VGhlbih0aGVuLCB0aGVuYWJsZSwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICBpZiAoc2VhbGVkKSB7IHJldHVybjsgfVxuICAgICAgICAgIHNlYWxlZCA9IHRydWU7XG4gICAgICAgICAgaWYgKHRoZW5hYmxlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgaWYgKHNlYWxlZCkgeyByZXR1cm47IH1cbiAgICAgICAgICBzZWFsZWQgPSB0cnVlO1xuXG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICAgIH0sICdTZXR0bGU6ICcgKyAocHJvbWlzZS5fbGFiZWwgfHwgJyB1bmtub3duIHByb21pc2UnKSk7XG5cbiAgICAgICAgaWYgKCFzZWFsZWQgJiYgZXJyb3IpIHtcbiAgICAgICAgICBzZWFsZWQgPSB0cnVlO1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0sIHByb21pc2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlKSB7XG4gICAgICBpZiAodGhlbmFibGUuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB0aGVuYWJsZS5fcmVzdWx0KTtcbiAgICAgIH0gZWxzZSBpZiAodGhlbmFibGUuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzdWJzY3JpYmUodGhlbmFibGUsIHVuZGVmaW5lZCwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSwgdGhlbikge1xuICAgICAgaWYgKG1heWJlVGhlbmFibGUuY29uc3RydWN0b3IgPT09IHByb21pc2UuY29uc3RydWN0b3IgJiZcbiAgICAgICAgICB0aGVuID09PSBsaWIkZXM2JHByb21pc2UkdGhlbiQkZGVmYXVsdCAmJlxuICAgICAgICAgIGNvbnN0cnVjdG9yLnJlc29sdmUgPT09IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJGRlZmF1bHQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlT3duVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodGhlbiA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1IpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1IuZXJyb3IpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoZW4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gICAgICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0Z1bmN0aW9uKHRoZW4pKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUsIHRoZW4pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKSB7XG4gICAgICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHNlbGZGdWxmaWxsbWVudCgpKTtcbiAgICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJHV0aWxzJCRvYmplY3RPckZ1bmN0aW9uKHZhbHVlKSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIHZhbHVlLCBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRnZXRUaGVuKHZhbHVlKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoUmVqZWN0aW9uKHByb21pc2UpIHtcbiAgICAgIGlmIChwcm9taXNlLl9vbmVycm9yKSB7XG4gICAgICAgIHByb21pc2UuX29uZXJyb3IocHJvbWlzZS5fcmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaChwcm9taXNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHZhbHVlKSB7XG4gICAgICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHsgcmV0dXJuOyB9XG5cbiAgICAgIHByb21pc2UuX3Jlc3VsdCA9IHZhbHVlO1xuICAgICAgcHJvbWlzZS5fc3RhdGUgPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQ7XG5cbiAgICAgIGlmIChwcm9taXNlLl9zdWJzY3JpYmVycy5sZW5ndGggIT09IDApIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaCwgcHJvbWlzZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbikge1xuICAgICAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7IHJldHVybjsgfVxuICAgICAgcHJvbWlzZS5fc3RhdGUgPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRDtcbiAgICAgIHByb21pc2UuX3Jlc3VsdCA9IHJlYXNvbjtcblxuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaFJlamVjdGlvbiwgcHJvbWlzZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKHBhcmVudCwgY2hpbGQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG4gICAgICB2YXIgc3Vic2NyaWJlcnMgPSBwYXJlbnQuX3N1YnNjcmliZXJzO1xuICAgICAgdmFyIGxlbmd0aCA9IHN1YnNjcmliZXJzLmxlbmd0aDtcblxuICAgICAgcGFyZW50Ll9vbmVycm9yID0gbnVsbDtcblxuICAgICAgc3Vic2NyaWJlcnNbbGVuZ3RoXSA9IGNoaWxkO1xuICAgICAgc3Vic2NyaWJlcnNbbGVuZ3RoICsgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEXSA9IG9uRnVsZmlsbG1lbnQ7XG4gICAgICBzdWJzY3JpYmVyc1tsZW5ndGggKyBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRF0gID0gb25SZWplY3Rpb247XG5cbiAgICAgIGlmIChsZW5ndGggPT09IDAgJiYgcGFyZW50Ll9zdGF0ZSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoLCBwYXJlbnQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2gocHJvbWlzZSkge1xuICAgICAgdmFyIHN1YnNjcmliZXJzID0gcHJvbWlzZS5fc3Vic2NyaWJlcnM7XG4gICAgICB2YXIgc2V0dGxlZCA9IHByb21pc2UuX3N0YXRlO1xuXG4gICAgICBpZiAoc3Vic2NyaWJlcnMubGVuZ3RoID09PSAwKSB7IHJldHVybjsgfVxuXG4gICAgICB2YXIgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwgPSBwcm9taXNlLl9yZXN1bHQ7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3Vic2NyaWJlcnMubGVuZ3RoOyBpICs9IDMpIHtcbiAgICAgICAgY2hpbGQgPSBzdWJzY3JpYmVyc1tpXTtcbiAgICAgICAgY2FsbGJhY2sgPSBzdWJzY3JpYmVyc1tpICsgc2V0dGxlZF07XG5cbiAgICAgICAgaWYgKGNoaWxkKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNhbGxiYWNrKGRldGFpbCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcHJvbWlzZS5fc3Vic2NyaWJlcnMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRFcnJvck9iamVjdCgpIHtcbiAgICAgIHRoaXMuZXJyb3IgPSBudWxsO1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRUUllfQ0FUQ0hfRVJST1IgPSBuZXcgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRXJyb3JPYmplY3QoKTtcblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHRyeUNhdGNoKGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhkZXRhaWwpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFRSWV9DQVRDSF9FUlJPUi5lcnJvciA9IGU7XG4gICAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRUUllfQ0FUQ0hfRVJST1I7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgcHJvbWlzZSwgY2FsbGJhY2ssIGRldGFpbCkge1xuICAgICAgdmFyIGhhc0NhbGxiYWNrID0gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0Z1bmN0aW9uKGNhbGxiYWNrKSxcbiAgICAgICAgICB2YWx1ZSwgZXJyb3IsIHN1Y2NlZWRlZCwgZmFpbGVkO1xuXG4gICAgICBpZiAoaGFzQ2FsbGJhY2spIHtcbiAgICAgICAgdmFsdWUgPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCR0cnlDYXRjaChjYWxsYmFjaywgZGV0YWlsKTtcblxuICAgICAgICBpZiAodmFsdWUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFRSWV9DQVRDSF9FUlJPUikge1xuICAgICAgICAgIGZhaWxlZCA9IHRydWU7XG4gICAgICAgICAgZXJyb3IgPSB2YWx1ZS5lcnJvcjtcbiAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRjYW5ub3RSZXR1cm5Pd24oKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gZGV0YWlsO1xuICAgICAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHtcbiAgICAgICAgLy8gbm9vcFxuICAgICAgfSBlbHNlIGlmIChoYXNDYWxsYmFjayAmJiBzdWNjZWVkZWQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKGZhaWxlZCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW5pdGlhbGl6ZVByb21pc2UocHJvbWlzZSwgcmVzb2x2ZXIpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJlc29sdmVyKGZ1bmN0aW9uIHJlc29sdmVQcm9taXNlKHZhbHVlKXtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgfSwgZnVuY3Rpb24gcmVqZWN0UHJvbWlzZShyZWFzb24pIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpZCA9IDA7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbmV4dElkKCkge1xuICAgICAgcmV0dXJuIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGlkKys7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbWFrZVByb21pc2UocHJvbWlzZSkge1xuICAgICAgcHJvbWlzZVtsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQUk9NSVNFX0lEXSA9IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGlkKys7XG4gICAgICBwcm9taXNlLl9zdGF0ZSA9IHVuZGVmaW5lZDtcbiAgICAgIHByb21pc2UuX3Jlc3VsdCA9IHVuZGVmaW5lZDtcbiAgICAgIHByb21pc2UuX3N1YnNjcmliZXJzID0gW107XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkYWxsJCRhbGwoZW50cmllcykge1xuICAgICAgcmV0dXJuIG5ldyBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkZGVmYXVsdCh0aGlzLCBlbnRyaWVzKS5wcm9taXNlO1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkYWxsJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkYWxsJCRhbGw7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmFjZSQkcmFjZShlbnRyaWVzKSB7XG4gICAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgICAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcblxuICAgICAgaWYgKCFsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBDb25zdHJ1Y3RvcihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICByZWplY3QobmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhbiBhcnJheSB0byByYWNlLicpKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV3IENvbnN0cnVjdG9yKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHZhciBsZW5ndGggPSBlbnRyaWVzLmxlbmd0aDtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBDb25zdHJ1Y3Rvci5yZXNvbHZlKGVudHJpZXNbaV0pLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmFjZSQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJhY2UkJHJhY2U7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVqZWN0JCRyZWplY3QocmVhc29uKSB7XG4gICAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgICAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcbiAgICAgIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlamVjdCQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlamVjdCQkcmVqZWN0O1xuXG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkbmVlZHNSZXNvbHZlcigpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYSByZXNvbHZlciBmdW5jdGlvbiBhcyB0aGUgZmlyc3QgYXJndW1lbnQgdG8gdGhlIHByb21pc2UgY29uc3RydWN0b3InKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkbmVlZHNOZXcoKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRmFpbGVkIHRvIGNvbnN0cnVjdCAnUHJvbWlzZSc6IFBsZWFzZSB1c2UgdGhlICduZXcnIG9wZXJhdG9yLCB0aGlzIG9iamVjdCBjb25zdHJ1Y3RvciBjYW5ub3QgYmUgY2FsbGVkIGFzIGEgZnVuY3Rpb24uXCIpO1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlO1xuICAgIC8qKlxuICAgICAgUHJvbWlzZSBvYmplY3RzIHJlcHJlc2VudCB0aGUgZXZlbnR1YWwgcmVzdWx0IG9mIGFuIGFzeW5jaHJvbm91cyBvcGVyYXRpb24uIFRoZVxuICAgICAgcHJpbWFyeSB3YXkgb2YgaW50ZXJhY3Rpbmcgd2l0aCBhIHByb21pc2UgaXMgdGhyb3VnaCBpdHMgYHRoZW5gIG1ldGhvZCwgd2hpY2hcbiAgICAgIHJlZ2lzdGVycyBjYWxsYmFja3MgdG8gcmVjZWl2ZSBlaXRoZXIgYSBwcm9taXNlJ3MgZXZlbnR1YWwgdmFsdWUgb3IgdGhlIHJlYXNvblxuICAgICAgd2h5IHRoZSBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQuXG5cbiAgICAgIFRlcm1pbm9sb2d5XG4gICAgICAtLS0tLS0tLS0tLVxuXG4gICAgICAtIGBwcm9taXNlYCBpcyBhbiBvYmplY3Qgb3IgZnVuY3Rpb24gd2l0aCBhIGB0aGVuYCBtZXRob2Qgd2hvc2UgYmVoYXZpb3IgY29uZm9ybXMgdG8gdGhpcyBzcGVjaWZpY2F0aW9uLlxuICAgICAgLSBgdGhlbmFibGVgIGlzIGFuIG9iamVjdCBvciBmdW5jdGlvbiB0aGF0IGRlZmluZXMgYSBgdGhlbmAgbWV0aG9kLlxuICAgICAgLSBgdmFsdWVgIGlzIGFueSBsZWdhbCBKYXZhU2NyaXB0IHZhbHVlIChpbmNsdWRpbmcgdW5kZWZpbmVkLCBhIHRoZW5hYmxlLCBvciBhIHByb21pc2UpLlxuICAgICAgLSBgZXhjZXB0aW9uYCBpcyBhIHZhbHVlIHRoYXQgaXMgdGhyb3duIHVzaW5nIHRoZSB0aHJvdyBzdGF0ZW1lbnQuXG4gICAgICAtIGByZWFzb25gIGlzIGEgdmFsdWUgdGhhdCBpbmRpY2F0ZXMgd2h5IGEgcHJvbWlzZSB3YXMgcmVqZWN0ZWQuXG4gICAgICAtIGBzZXR0bGVkYCB0aGUgZmluYWwgcmVzdGluZyBzdGF0ZSBvZiBhIHByb21pc2UsIGZ1bGZpbGxlZCBvciByZWplY3RlZC5cblxuICAgICAgQSBwcm9taXNlIGNhbiBiZSBpbiBvbmUgb2YgdGhyZWUgc3RhdGVzOiBwZW5kaW5nLCBmdWxmaWxsZWQsIG9yIHJlamVjdGVkLlxuXG4gICAgICBQcm9taXNlcyB0aGF0IGFyZSBmdWxmaWxsZWQgaGF2ZSBhIGZ1bGZpbGxtZW50IHZhbHVlIGFuZCBhcmUgaW4gdGhlIGZ1bGZpbGxlZFxuICAgICAgc3RhdGUuICBQcm9taXNlcyB0aGF0IGFyZSByZWplY3RlZCBoYXZlIGEgcmVqZWN0aW9uIHJlYXNvbiBhbmQgYXJlIGluIHRoZVxuICAgICAgcmVqZWN0ZWQgc3RhdGUuICBBIGZ1bGZpbGxtZW50IHZhbHVlIGlzIG5ldmVyIGEgdGhlbmFibGUuXG5cbiAgICAgIFByb21pc2VzIGNhbiBhbHNvIGJlIHNhaWQgdG8gKnJlc29sdmUqIGEgdmFsdWUuICBJZiB0aGlzIHZhbHVlIGlzIGFsc28gYVxuICAgICAgcHJvbWlzZSwgdGhlbiB0aGUgb3JpZ2luYWwgcHJvbWlzZSdzIHNldHRsZWQgc3RhdGUgd2lsbCBtYXRjaCB0aGUgdmFsdWUnc1xuICAgICAgc2V0dGxlZCBzdGF0ZS4gIFNvIGEgcHJvbWlzZSB0aGF0ICpyZXNvbHZlcyogYSBwcm9taXNlIHRoYXQgcmVqZWN0cyB3aWxsXG4gICAgICBpdHNlbGYgcmVqZWN0LCBhbmQgYSBwcm9taXNlIHRoYXQgKnJlc29sdmVzKiBhIHByb21pc2UgdGhhdCBmdWxmaWxscyB3aWxsXG4gICAgICBpdHNlbGYgZnVsZmlsbC5cblxuXG4gICAgICBCYXNpYyBVc2FnZTpcbiAgICAgIC0tLS0tLS0tLS0tLVxuXG4gICAgICBgYGBqc1xuICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgLy8gb24gc3VjY2Vzc1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcblxuICAgICAgICAvLyBvbiBmYWlsdXJlXG4gICAgICAgIHJlamVjdChyZWFzb24pO1xuICAgICAgfSk7XG5cbiAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAvLyBvbiBmdWxmaWxsbWVudFxuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIC8vIG9uIHJlamVjdGlvblxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQWR2YW5jZWQgVXNhZ2U6XG4gICAgICAtLS0tLS0tLS0tLS0tLS1cblxuICAgICAgUHJvbWlzZXMgc2hpbmUgd2hlbiBhYnN0cmFjdGluZyBhd2F5IGFzeW5jaHJvbm91cyBpbnRlcmFjdGlvbnMgc3VjaCBhc1xuICAgICAgYFhNTEh0dHBSZXF1ZXN0YHMuXG5cbiAgICAgIGBgYGpzXG4gICAgICBmdW5jdGlvbiBnZXRKU09OKHVybCkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgICB4aHIub3BlbignR0VUJywgdXJsKTtcbiAgICAgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gaGFuZGxlcjtcbiAgICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2pzb24nO1xuICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgICAgIHhoci5zZW5kKCk7XG5cbiAgICAgICAgICBmdW5jdGlvbiBoYW5kbGVyKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PT0gdGhpcy5ET05FKSB7XG4gICAgICAgICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdnZXRKU09OOiBgJyArIHVybCArICdgIGZhaWxlZCB3aXRoIHN0YXR1czogWycgKyB0aGlzLnN0YXR1cyArICddJykpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGdldEpTT04oJy9wb3N0cy5qc29uJykudGhlbihmdW5jdGlvbihqc29uKSB7XG4gICAgICAgIC8vIG9uIGZ1bGZpbGxtZW50XG4gICAgICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgLy8gb24gcmVqZWN0aW9uXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBVbmxpa2UgY2FsbGJhY2tzLCBwcm9taXNlcyBhcmUgZ3JlYXQgY29tcG9zYWJsZSBwcmltaXRpdmVzLlxuXG4gICAgICBgYGBqc1xuICAgICAgUHJvbWlzZS5hbGwoW1xuICAgICAgICBnZXRKU09OKCcvcG9zdHMnKSxcbiAgICAgICAgZ2V0SlNPTignL2NvbW1lbnRzJylcbiAgICAgIF0pLnRoZW4oZnVuY3Rpb24odmFsdWVzKXtcbiAgICAgICAgdmFsdWVzWzBdIC8vID0+IHBvc3RzSlNPTlxuICAgICAgICB2YWx1ZXNbMV0gLy8gPT4gY29tbWVudHNKU09OXG5cbiAgICAgICAgcmV0dXJuIHZhbHVlcztcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEBjbGFzcyBQcm9taXNlXG4gICAgICBAcGFyYW0ge2Z1bmN0aW9ufSByZXNvbHZlclxuICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuICAgICAgQGNvbnN0cnVjdG9yXG4gICAgKi9cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZShyZXNvbHZlcikge1xuICAgICAgdGhpc1tsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQUk9NSVNFX0lEXSA9IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5leHRJZCgpO1xuICAgICAgdGhpcy5fcmVzdWx0ID0gdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLl9zdWJzY3JpYmVycyA9IFtdO1xuXG4gICAgICBpZiAobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCAhPT0gcmVzb2x2ZXIpIHtcbiAgICAgICAgdHlwZW9mIHJlc29sdmVyICE9PSAnZnVuY3Rpb24nICYmIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRuZWVkc1Jlc29sdmVyKCk7XG4gICAgICAgIHRoaXMgaW5zdGFuY2VvZiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZSA/IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGluaXRpYWxpemVQcm9taXNlKHRoaXMsIHJlc29sdmVyKSA6IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRuZWVkc05ldygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLmFsbCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkZGVmYXVsdDtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5yYWNlID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmFjZSQkZGVmYXVsdDtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5yZXNvbHZlID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVzb2x2ZSQkZGVmYXVsdDtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5yZWplY3QgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZWplY3QkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UuX3NldFNjaGVkdWxlciA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzZXRTY2hlZHVsZXI7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UuX3NldEFzYXAgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2V0QXNhcDtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5fYXNhcCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwO1xuXG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucHJvdG90eXBlID0ge1xuICAgICAgY29uc3RydWN0b3I6IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLFxuXG4gICAgLyoqXG4gICAgICBUaGUgcHJpbWFyeSB3YXkgb2YgaW50ZXJhY3Rpbmcgd2l0aCBhIHByb21pc2UgaXMgdGhyb3VnaCBpdHMgYHRoZW5gIG1ldGhvZCxcbiAgICAgIHdoaWNoIHJlZ2lzdGVycyBjYWxsYmFja3MgdG8gcmVjZWl2ZSBlaXRoZXIgYSBwcm9taXNlJ3MgZXZlbnR1YWwgdmFsdWUgb3IgdGhlXG4gICAgICByZWFzb24gd2h5IHRoZSBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQuXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24odXNlcil7XG4gICAgICAgIC8vIHVzZXIgaXMgYXZhaWxhYmxlXG4gICAgICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgICAgICAvLyB1c2VyIGlzIHVuYXZhaWxhYmxlLCBhbmQgeW91IGFyZSBnaXZlbiB0aGUgcmVhc29uIHdoeVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQ2hhaW5pbmdcbiAgICAgIC0tLS0tLS0tXG5cbiAgICAgIFRoZSByZXR1cm4gdmFsdWUgb2YgYHRoZW5gIGlzIGl0c2VsZiBhIHByb21pc2UuICBUaGlzIHNlY29uZCwgJ2Rvd25zdHJlYW0nXG4gICAgICBwcm9taXNlIGlzIHJlc29sdmVkIHdpdGggdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZmlyc3QgcHJvbWlzZSdzIGZ1bGZpbGxtZW50XG4gICAgICBvciByZWplY3Rpb24gaGFuZGxlciwgb3IgcmVqZWN0ZWQgaWYgdGhlIGhhbmRsZXIgdGhyb3dzIGFuIGV4Y2VwdGlvbi5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICByZXR1cm4gdXNlci5uYW1lO1xuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICByZXR1cm4gJ2RlZmF1bHQgbmFtZSc7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uICh1c2VyTmFtZSkge1xuICAgICAgICAvLyBJZiBgZmluZFVzZXJgIGZ1bGZpbGxlZCwgYHVzZXJOYW1lYCB3aWxsIGJlIHRoZSB1c2VyJ3MgbmFtZSwgb3RoZXJ3aXNlIGl0XG4gICAgICAgIC8vIHdpbGwgYmUgYCdkZWZhdWx0IG5hbWUnYFxuICAgICAgfSk7XG5cbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZvdW5kIHVzZXIsIGJ1dCBzdGlsbCB1bmhhcHB5Jyk7XG4gICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignYGZpbmRVc2VyYCByZWplY3RlZCBhbmQgd2UncmUgdW5oYXBweScpO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICAvLyBpZiBgZmluZFVzZXJgIGZ1bGZpbGxlZCwgYHJlYXNvbmAgd2lsbCBiZSAnRm91bmQgdXNlciwgYnV0IHN0aWxsIHVuaGFwcHknLlxuICAgICAgICAvLyBJZiBgZmluZFVzZXJgIHJlamVjdGVkLCBgcmVhc29uYCB3aWxsIGJlICdgZmluZFVzZXJgIHJlamVjdGVkIGFuZCB3ZSdyZSB1bmhhcHB5Jy5cbiAgICAgIH0pO1xuICAgICAgYGBgXG4gICAgICBJZiB0aGUgZG93bnN0cmVhbSBwcm9taXNlIGRvZXMgbm90IHNwZWNpZnkgYSByZWplY3Rpb24gaGFuZGxlciwgcmVqZWN0aW9uIHJlYXNvbnMgd2lsbCBiZSBwcm9wYWdhdGVkIGZ1cnRoZXIgZG93bnN0cmVhbS5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICB0aHJvdyBuZXcgUGVkYWdvZ2ljYWxFeGNlcHRpb24oJ1Vwc3RyZWFtIGVycm9yJyk7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAvLyBuZXZlciByZWFjaGVkXG4gICAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAvLyBuZXZlciByZWFjaGVkXG4gICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIC8vIFRoZSBgUGVkZ2Fnb2NpYWxFeGNlcHRpb25gIGlzIHByb3BhZ2F0ZWQgYWxsIHRoZSB3YXkgZG93biB0byBoZXJlXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBBc3NpbWlsYXRpb25cbiAgICAgIC0tLS0tLS0tLS0tLVxuXG4gICAgICBTb21ldGltZXMgdGhlIHZhbHVlIHlvdSB3YW50IHRvIHByb3BhZ2F0ZSB0byBhIGRvd25zdHJlYW0gcHJvbWlzZSBjYW4gb25seSBiZVxuICAgICAgcmV0cmlldmVkIGFzeW5jaHJvbm91c2x5LiBUaGlzIGNhbiBiZSBhY2hpZXZlZCBieSByZXR1cm5pbmcgYSBwcm9taXNlIGluIHRoZVxuICAgICAgZnVsZmlsbG1lbnQgb3IgcmVqZWN0aW9uIGhhbmRsZXIuIFRoZSBkb3duc3RyZWFtIHByb21pc2Ugd2lsbCB0aGVuIGJlIHBlbmRpbmdcbiAgICAgIHVudGlsIHRoZSByZXR1cm5lZCBwcm9taXNlIGlzIHNldHRsZWQuIFRoaXMgaXMgY2FsbGVkICphc3NpbWlsYXRpb24qLlxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgIHJldHVybiBmaW5kQ29tbWVudHNCeUF1dGhvcih1c2VyKTtcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKGNvbW1lbnRzKSB7XG4gICAgICAgIC8vIFRoZSB1c2VyJ3MgY29tbWVudHMgYXJlIG5vdyBhdmFpbGFibGVcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIElmIHRoZSBhc3NpbWxpYXRlZCBwcm9taXNlIHJlamVjdHMsIHRoZW4gdGhlIGRvd25zdHJlYW0gcHJvbWlzZSB3aWxsIGFsc28gcmVqZWN0LlxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgIHJldHVybiBmaW5kQ29tbWVudHNCeUF1dGhvcih1c2VyKTtcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKGNvbW1lbnRzKSB7XG4gICAgICAgIC8vIElmIGBmaW5kQ29tbWVudHNCeUF1dGhvcmAgZnVsZmlsbHMsIHdlJ2xsIGhhdmUgdGhlIHZhbHVlIGhlcmVcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgLy8gSWYgYGZpbmRDb21tZW50c0J5QXV0aG9yYCByZWplY3RzLCB3ZSdsbCBoYXZlIHRoZSByZWFzb24gaGVyZVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgU2ltcGxlIEV4YW1wbGVcbiAgICAgIC0tLS0tLS0tLS0tLS0tXG5cbiAgICAgIFN5bmNocm9ub3VzIEV4YW1wbGVcblxuICAgICAgYGBgamF2YXNjcmlwdFxuICAgICAgdmFyIHJlc3VsdDtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgcmVzdWx0ID0gZmluZFJlc3VsdCgpO1xuICAgICAgICAvLyBzdWNjZXNzXG4gICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAvLyBmYWlsdXJlXG4gICAgICB9XG4gICAgICBgYGBcblxuICAgICAgRXJyYmFjayBFeGFtcGxlXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kUmVzdWx0KGZ1bmN0aW9uKHJlc3VsdCwgZXJyKXtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIC8vIGZhaWx1cmVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBzdWNjZXNzXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIFByb21pc2UgRXhhbXBsZTtcblxuICAgICAgYGBgamF2YXNjcmlwdFxuICAgICAgZmluZFJlc3VsdCgpLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcbiAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQWR2YW5jZWQgRXhhbXBsZVxuICAgICAgLS0tLS0tLS0tLS0tLS1cblxuICAgICAgU3luY2hyb25vdXMgRXhhbXBsZVxuXG4gICAgICBgYGBqYXZhc2NyaXB0XG4gICAgICB2YXIgYXV0aG9yLCBib29rcztcblxuICAgICAgdHJ5IHtcbiAgICAgICAgYXV0aG9yID0gZmluZEF1dGhvcigpO1xuICAgICAgICBib29rcyAgPSBmaW5kQm9va3NCeUF1dGhvcihhdXRob3IpO1xuICAgICAgICAvLyBzdWNjZXNzXG4gICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAvLyBmYWlsdXJlXG4gICAgICB9XG4gICAgICBgYGBcblxuICAgICAgRXJyYmFjayBFeGFtcGxlXG5cbiAgICAgIGBgYGpzXG5cbiAgICAgIGZ1bmN0aW9uIGZvdW5kQm9va3MoYm9va3MpIHtcblxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBmYWlsdXJlKHJlYXNvbikge1xuXG4gICAgICB9XG5cbiAgICAgIGZpbmRBdXRob3IoZnVuY3Rpb24oYXV0aG9yLCBlcnIpe1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgICAgIC8vIGZhaWx1cmVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgZmluZEJvb29rc0J5QXV0aG9yKGF1dGhvciwgZnVuY3Rpb24oYm9va3MsIGVycikge1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICBmb3VuZEJvb2tzKGJvb2tzKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAgICAgICAgICAgZmFpbHVyZShyZWFzb24pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBjYXRjaChlcnJvcikge1xuICAgICAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBzdWNjZXNzXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIFByb21pc2UgRXhhbXBsZTtcblxuICAgICAgYGBgamF2YXNjcmlwdFxuICAgICAgZmluZEF1dGhvcigpLlxuICAgICAgICB0aGVuKGZpbmRCb29rc0J5QXV0aG9yKS5cbiAgICAgICAgdGhlbihmdW5jdGlvbihib29rcyl7XG4gICAgICAgICAgLy8gZm91bmQgYm9va3NcbiAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBAbWV0aG9kIHRoZW5cbiAgICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uRnVsZmlsbGVkXG4gICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGVkXG4gICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gICAgICBAcmV0dXJuIHtQcm9taXNlfVxuICAgICovXG4gICAgICB0aGVuOiBsaWIkZXM2JHByb21pc2UkdGhlbiQkZGVmYXVsdCxcblxuICAgIC8qKlxuICAgICAgYGNhdGNoYCBpcyBzaW1wbHkgc3VnYXIgZm9yIGB0aGVuKHVuZGVmaW5lZCwgb25SZWplY3Rpb24pYCB3aGljaCBtYWtlcyBpdCB0aGUgc2FtZVxuICAgICAgYXMgdGhlIGNhdGNoIGJsb2NrIG9mIGEgdHJ5L2NhdGNoIHN0YXRlbWVudC5cblxuICAgICAgYGBganNcbiAgICAgIGZ1bmN0aW9uIGZpbmRBdXRob3IoKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb3VsZG4ndCBmaW5kIHRoYXQgYXV0aG9yJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIHN5bmNocm9ub3VzXG4gICAgICB0cnkge1xuICAgICAgICBmaW5kQXV0aG9yKCk7XG4gICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgICAgfVxuXG4gICAgICAvLyBhc3luYyB3aXRoIHByb21pc2VzXG4gICAgICBmaW5kQXV0aG9yKCkuY2F0Y2goZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEBtZXRob2QgY2F0Y2hcbiAgICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0aW9uXG4gICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gICAgICBAcmV0dXJuIHtQcm9taXNlfVxuICAgICovXG4gICAgICAnY2F0Y2gnOiBmdW5jdGlvbihvblJlamVjdGlvbikge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKG51bGwsIG9uUmVqZWN0aW9uKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yKENvbnN0cnVjdG9yLCBpbnB1dCkge1xuICAgICAgdGhpcy5faW5zdGFuY2VDb25zdHJ1Y3RvciA9IENvbnN0cnVjdG9yO1xuICAgICAgdGhpcy5wcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuXG4gICAgICBpZiAoIXRoaXMucHJvbWlzZVtsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQUk9NSVNFX0lEXSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRtYWtlUHJvbWlzZSh0aGlzLnByb21pc2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAobGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0FycmF5KGlucHV0KSkge1xuICAgICAgICB0aGlzLl9pbnB1dCAgICAgPSBpbnB1dDtcbiAgICAgICAgdGhpcy5sZW5ndGggICAgID0gaW5wdXQubGVuZ3RoO1xuICAgICAgICB0aGlzLl9yZW1haW5pbmcgPSBpbnB1dC5sZW5ndGg7XG5cbiAgICAgICAgdGhpcy5fcmVzdWx0ID0gbmV3IEFycmF5KHRoaXMubGVuZ3RoKTtcblxuICAgICAgICBpZiAodGhpcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHRoaXMucHJvbWlzZSwgdGhpcy5fcmVzdWx0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmxlbmd0aCA9IHRoaXMubGVuZ3RoIHx8IDA7XG4gICAgICAgICAgdGhpcy5fZW51bWVyYXRlKCk7XG4gICAgICAgICAgaWYgKHRoaXMuX3JlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbCh0aGlzLnByb21pc2UsIHRoaXMuX3Jlc3VsdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QodGhpcy5wcm9taXNlLCBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkdmFsaWRhdGlvbkVycm9yKCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCR2YWxpZGF0aW9uRXJyb3IoKSB7XG4gICAgICByZXR1cm4gbmV3IEVycm9yKCdBcnJheSBNZXRob2RzIG11c3QgYmUgcHJvdmlkZWQgYW4gQXJyYXknKTtcbiAgICB9XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX2VudW1lcmF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGxlbmd0aCAgPSB0aGlzLmxlbmd0aDtcbiAgICAgIHZhciBpbnB1dCAgID0gdGhpcy5faW5wdXQ7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyB0aGlzLl9zdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORyAmJiBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGhpcy5fZWFjaEVudHJ5KGlucHV0W2ldLCBpKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl9lYWNoRW50cnkgPSBmdW5jdGlvbihlbnRyeSwgaSkge1xuICAgICAgdmFyIGMgPSB0aGlzLl9pbnN0YW5jZUNvbnN0cnVjdG9yO1xuICAgICAgdmFyIHJlc29sdmUgPSBjLnJlc29sdmU7XG5cbiAgICAgIGlmIChyZXNvbHZlID09PSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZXNvbHZlJCRkZWZhdWx0KSB7XG4gICAgICAgIHZhciB0aGVuID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZ2V0VGhlbihlbnRyeSk7XG5cbiAgICAgICAgaWYgKHRoZW4gPT09IGxpYiRlczYkcHJvbWlzZSR0aGVuJCRkZWZhdWx0ICYmXG4gICAgICAgICAgICBlbnRyeS5fc3RhdGUgIT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHtcbiAgICAgICAgICB0aGlzLl9zZXR0bGVkQXQoZW50cnkuX3N0YXRlLCBpLCBlbnRyeS5fcmVzdWx0KTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdGhlbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRoaXMuX3JlbWFpbmluZy0tO1xuICAgICAgICAgIHRoaXMuX3Jlc3VsdFtpXSA9IGVudHJ5O1xuICAgICAgICB9IGVsc2UgaWYgKGMgPT09IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRkZWZhdWx0KSB7XG4gICAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgYyhsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIGVudHJ5LCB0aGVuKTtcbiAgICAgICAgICB0aGlzLl93aWxsU2V0dGxlQXQocHJvbWlzZSwgaSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fd2lsbFNldHRsZUF0KG5ldyBjKGZ1bmN0aW9uKHJlc29sdmUpIHsgcmVzb2x2ZShlbnRyeSk7IH0pLCBpKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fd2lsbFNldHRsZUF0KHJlc29sdmUoZW50cnkpLCBpKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl9zZXR0bGVkQXQgPSBmdW5jdGlvbihzdGF0ZSwgaSwgdmFsdWUpIHtcbiAgICAgIHZhciBwcm9taXNlID0gdGhpcy5wcm9taXNlO1xuXG4gICAgICBpZiAocHJvbWlzZS5fc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHtcbiAgICAgICAgdGhpcy5fcmVtYWluaW5nLS07XG5cbiAgICAgICAgaWYgKHN0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fcmVzdWx0W2ldID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX3JlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHRoaXMuX3Jlc3VsdCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fd2lsbFNldHRsZUF0ID0gZnVuY3Rpb24ocHJvbWlzZSwgaSkge1xuICAgICAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuXG4gICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzdWJzY3JpYmUocHJvbWlzZSwgdW5kZWZpbmVkLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICBlbnVtZXJhdG9yLl9zZXR0bGVkQXQobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVELCBpLCB2YWx1ZSk7XG4gICAgICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgZW51bWVyYXRvci5fc2V0dGxlZEF0KGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVELCBpLCByZWFzb24pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJHBvbHlmaWxsKCkge1xuICAgICAgdmFyIGxvY2FsO1xuXG4gICAgICBpZiAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBsb2NhbCA9IGdsb2JhbDtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgbG9jYWwgPSBzZWxmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBsb2NhbCA9IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvbHlmaWxsIGZhaWxlZCBiZWNhdXNlIGdsb2JhbCBvYmplY3QgaXMgdW5hdmFpbGFibGUgaW4gdGhpcyBlbnZpcm9ubWVudCcpO1xuICAgICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFyIFAgPSBsb2NhbC5Qcm9taXNlO1xuXG4gICAgICBpZiAoUCAmJiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoUC5yZXNvbHZlKCkpID09PSAnW29iamVjdCBQcm9taXNlXScgJiYgIVAuY2FzdCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGxvY2FsLlByb21pc2UgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkZGVmYXVsdDtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkcG9seWZpbGw7XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHVtZCQkRVM2UHJvbWlzZSA9IHtcbiAgICAgICdQcm9taXNlJzogbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGRlZmF1bHQsXG4gICAgICAncG9seWZpbGwnOiBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJGRlZmF1bHRcbiAgICB9O1xuXG4gICAgLyogZ2xvYmFsIGRlZmluZTp0cnVlIG1vZHVsZTp0cnVlIHdpbmRvdzogdHJ1ZSAqL1xuICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZVsnYW1kJ10pIHtcbiAgICAgIGRlZmluZShmdW5jdGlvbigpIHsgcmV0dXJuIGxpYiRlczYkcHJvbWlzZSR1bWQkJEVTNlByb21pc2U7IH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlWydleHBvcnRzJ10pIHtcbiAgICAgIG1vZHVsZVsnZXhwb3J0cyddID0gbGliJGVzNiRwcm9taXNlJHVtZCQkRVM2UHJvbWlzZTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB0aGlzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhpc1snRVM2UHJvbWlzZSddID0gbGliJGVzNiRwcm9taXNlJHVtZCQkRVM2UHJvbWlzZTtcbiAgICB9XG5cbiAgICBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJGRlZmF1bHQoKTtcbn0pLmNhbGwodGhpcyk7XG5cbiIsIi8qKlxuKiBDcmVhdGUgYW4gZXZlbnQgZW1pdHRlciB3aXRoIG5hbWVzcGFjZXNcbiogQG5hbWUgY3JlYXRlTmFtZXNwYWNlRW1pdHRlclxuKiBAZXhhbXBsZVxuKiB2YXIgZW1pdHRlciA9IHJlcXVpcmUoJy4vaW5kZXgnKSgpXG4qXG4qIGVtaXR0ZXIub24oJyonLCBmdW5jdGlvbiAoKSB7XG4qICAgY29uc29sZS5sb2coJ2FsbCBldmVudHMgZW1pdHRlZCcsIHRoaXMuZXZlbnQpXG4qIH0pXG4qXG4qIGVtaXR0ZXIub24oJ2V4YW1wbGUnLCBmdW5jdGlvbiAoKSB7XG4qICAgY29uc29sZS5sb2coJ2V4YW1wbGUgZXZlbnQgZW1pdHRlZCcpXG4qIH0pXG4qL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjcmVhdGVOYW1lc3BhY2VFbWl0dGVyICgpIHtcbiAgdmFyIGVtaXR0ZXIgPSB7IF9mbnM6IHt9IH1cblxuICAvKipcbiAgKiBFbWl0IGFuIGV2ZW50LiBPcHRpb25hbGx5IG5hbWVzcGFjZSB0aGUgZXZlbnQuIFNlcGFyYXRlIHRoZSBuYW1lc3BhY2UgYW5kIGV2ZW50IHdpdGggYSBgOmBcbiAgKiBAbmFtZSBlbWl0XG4gICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IOKAkyB0aGUgbmFtZSBvZiB0aGUgZXZlbnQsIHdpdGggb3B0aW9uYWwgbmFtZXNwYWNlXG4gICogQHBhcmFtIHsuLi4qfSBkYXRhIOKAkyBkYXRhIHZhcmlhYmxlcyB0aGF0IHdpbGwgYmUgcGFzc2VkIGFzIGFyZ3VtZW50cyB0byB0aGUgZXZlbnQgbGlzdGVuZXJcbiAgKiBAZXhhbXBsZVxuICAqIGVtaXR0ZXIuZW1pdCgnZXhhbXBsZScpXG4gICogZW1pdHRlci5lbWl0KCdkZW1vOnRlc3QnKVxuICAqIGVtaXR0ZXIuZW1pdCgnZGF0YScsIHsgZXhhbXBsZTogdHJ1ZX0sICdhIHN0cmluZycsIDEpXG4gICovXG4gIGVtaXR0ZXIuZW1pdCA9IGZ1bmN0aW9uIGVtaXQgKGV2ZW50KSB7XG4gICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSlcbiAgICB2YXIgbmFtZXNwYWNlZCA9IG5hbWVzcGFjZXMoZXZlbnQpXG4gICAgaWYgKHRoaXMuX2Zuc1tldmVudF0pIGVtaXRBbGwoZXZlbnQsIHRoaXMuX2Zuc1tldmVudF0sIGFyZ3MpXG4gICAgaWYgKG5hbWVzcGFjZWQpIGVtaXRBbGwoZXZlbnQsIG5hbWVzcGFjZWQsIGFyZ3MpXG4gIH1cblxuICAvKipcbiAgKiBDcmVhdGUgZW4gZXZlbnQgbGlzdGVuZXIuXG4gICogQG5hbWUgb25cbiAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICAqIEBleGFtcGxlXG4gICogZW1pdHRlci5vbignZXhhbXBsZScsIGZ1bmN0aW9uICgpIHt9KVxuICAqIGVtaXR0ZXIub24oJ2RlbW8nLCBmdW5jdGlvbiAoKSB7fSlcbiAgKi9cbiAgZW1pdHRlci5vbiA9IGZ1bmN0aW9uIG9uIChldmVudCwgZm4pIHtcbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7IHRocm93IG5ldyBFcnJvcignY2FsbGJhY2sgcmVxdWlyZWQnKSB9XG4gICAgKHRoaXMuX2Zuc1tldmVudF0gPSB0aGlzLl9mbnNbZXZlbnRdIHx8IFtdKS5wdXNoKGZuKVxuICB9XG5cbiAgLyoqXG4gICogQ3JlYXRlIGVuIGV2ZW50IGxpc3RlbmVyIHRoYXQgZmlyZXMgb25jZS5cbiAgKiBAbmFtZSBvbmNlXG4gICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAgKiBAZXhhbXBsZVxuICAqIGVtaXR0ZXIub25jZSgnZXhhbXBsZScsIGZ1bmN0aW9uICgpIHt9KVxuICAqIGVtaXR0ZXIub25jZSgnZGVtbycsIGZ1bmN0aW9uICgpIHt9KVxuICAqL1xuICBlbWl0dGVyLm9uY2UgPSBmdW5jdGlvbiBvbmNlIChldmVudCwgZm4pIHtcbiAgICBmdW5jdGlvbiBvbmUgKCkge1xuICAgICAgZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKVxuICAgICAgZW1pdHRlci5vZmYoZXZlbnQsIG9uZSlcbiAgICB9XG4gICAgdGhpcy5vbihldmVudCwgb25lKVxuICB9XG5cbiAgLyoqXG4gICogU3RvcCBsaXN0ZW5pbmcgdG8gYW4gZXZlbnQuIFN0b3AgYWxsIGxpc3RlbmVycyBvbiBhbiBldmVudCBieSBvbmx5IHBhc3NpbmcgdGhlIGV2ZW50IG5hbWUuIFN0b3AgYSBzaW5nbGUgbGlzdGVuZXIgYnkgcGFzc2luZyB0aGF0IGV2ZW50IGhhbmRsZXIgYXMgYSBjYWxsYmFjay5cbiAgKiBZb3UgbXVzdCBiZSBleHBsaWNpdCBhYm91dCB3aGF0IHdpbGwgYmUgdW5zdWJzY3JpYmVkOiBgZW1pdHRlci5vZmYoJ2RlbW8nKWAgd2lsbCB1bnN1YnNjcmliZSBhbiBgZW1pdHRlci5vbignZGVtbycpYCBsaXN0ZW5lciwgXG4gICogYGVtaXR0ZXIub2ZmKCdkZW1vOmV4YW1wbGUnKWAgd2lsbCB1bnN1YnNjcmliZSBhbiBgZW1pdHRlci5vbignZGVtbzpleGFtcGxlJylgIGxpc3RlbmVyXG4gICogQG5hbWUgb2ZmXG4gICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gICogQHBhcmFtIHtGdW5jdGlvbn0gW2ZuXSDigJMgdGhlIHNwZWNpZmljIGhhbmRsZXJcbiAgKiBAZXhhbXBsZVxuICAqIGVtaXR0ZXIub2ZmKCdleGFtcGxlJylcbiAgKiBlbWl0dGVyLm9mZignZGVtbycsIGZ1bmN0aW9uICgpIHt9KVxuICAqL1xuICBlbWl0dGVyLm9mZiA9IGZ1bmN0aW9uIG9mZiAoZXZlbnQsIGZuKSB7XG4gICAgdmFyIGtlZXAgPSBbXVxuXG4gICAgaWYgKGV2ZW50ICYmIGZuKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX2Zucy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAodGhpcy5fZm5zW2ldICE9PSBmbikge1xuICAgICAgICAgIGtlZXAucHVzaCh0aGlzLl9mbnNbaV0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBrZWVwLmxlbmd0aCA/IHRoaXMuX2Zuc1tldmVudF0gPSBrZWVwIDogZGVsZXRlIHRoaXMuX2Zuc1tldmVudF1cbiAgfVxuXG4gIGZ1bmN0aW9uIG5hbWVzcGFjZXMgKGUpIHtcbiAgICB2YXIgb3V0ID0gW11cbiAgICB2YXIgYXJncyA9IGUuc3BsaXQoJzonKVxuICAgIHZhciBmbnMgPSBlbWl0dGVyLl9mbnNcbiAgICBPYmplY3Qua2V5cyhmbnMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgaWYgKGtleSA9PT0gJyonKSBvdXQgPSBvdXQuY29uY2F0KGZuc1trZXldKVxuICAgICAgaWYgKGFyZ3MubGVuZ3RoID09PSAyICYmIGFyZ3NbMF0gPT09IGtleSkgb3V0ID0gb3V0LmNvbmNhdChmbnNba2V5XSlcbiAgICB9KVxuICAgIHJldHVybiBvdXRcbiAgfVxuXG4gIGZ1bmN0aW9uIGVtaXRBbGwgKGUsIGZucywgYXJncykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZm5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIWZuc1tpXSkgYnJlYWtcbiAgICAgIGZuc1tpXS5ldmVudCA9IGVcbiAgICAgIGZuc1tpXS5hcHBseShmbnNbaV0sIGFyZ3MpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGVtaXR0ZXJcbn1cbiIsIid1c2Ugc3RyaWN0JztcbnZhciBudW1iZXJJc05hbiA9IHJlcXVpcmUoJ251bWJlci1pcy1uYW4nKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAobnVtKSB7XG5cdGlmICh0eXBlb2YgbnVtICE9PSAnbnVtYmVyJyB8fCBudW1iZXJJc05hbihudW0pKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignRXhwZWN0ZWQgYSBudW1iZXIsIGdvdCAnICsgdHlwZW9mIG51bSk7XG5cdH1cblxuXHR2YXIgZXhwb25lbnQ7XG5cdHZhciB1bml0O1xuXHR2YXIgbmVnID0gbnVtIDwgMDtcblx0dmFyIHVuaXRzID0gWydCJywgJ2tCJywgJ01CJywgJ0dCJywgJ1RCJywgJ1BCJywgJ0VCJywgJ1pCJywgJ1lCJ107XG5cblx0aWYgKG5lZykge1xuXHRcdG51bSA9IC1udW07XG5cdH1cblxuXHRpZiAobnVtIDwgMSkge1xuXHRcdHJldHVybiAobmVnID8gJy0nIDogJycpICsgbnVtICsgJyBCJztcblx0fVxuXG5cdGV4cG9uZW50ID0gTWF0aC5taW4oTWF0aC5mbG9vcihNYXRoLmxvZyhudW0pIC8gTWF0aC5sb2coMTAwMCkpLCB1bml0cy5sZW5ndGggLSAxKTtcblx0bnVtID0gTnVtYmVyKChudW0gLyBNYXRoLnBvdygxMDAwLCBleHBvbmVudCkpLnRvRml4ZWQoMikpO1xuXHR1bml0ID0gdW5pdHNbZXhwb25lbnRdO1xuXG5cdHJldHVybiAobmVnID8gJy0nIDogJycpICsgbnVtICsgJyAnICsgdW5pdDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5tb2R1bGUuZXhwb3J0cyA9IE51bWJlci5pc05hTiB8fCBmdW5jdGlvbiAoeCkge1xuXHRyZXR1cm4geCAhPT0geDtcbn07XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQmFiZWxcblwidXNlIHN0cmljdFwiO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuZXhwb3J0cy5lbmNvZGUgPSBlbmNvZGU7XG4vKiBnbG9iYWw6IHdpbmRvdyAqL1xuXG52YXIgX3dpbmRvdyA9IHdpbmRvdztcbnZhciBidG9hID0gX3dpbmRvdy5idG9hO1xuZnVuY3Rpb24gZW5jb2RlKGRhdGEpIHtcbiAgcmV0dXJuIGJ0b2EodW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KGRhdGEpKSk7XG59XG5cbnZhciBpc1N1cHBvcnRlZCA9IGV4cG9ydHMuaXNTdXBwb3J0ZWQgPSBcImJ0b2FcIiBpbiB3aW5kb3c7IiwiLy8gR2VuZXJhdGVkIGJ5IEJhYmVsXG5cInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMubmV3UmVxdWVzdCA9IG5ld1JlcXVlc3Q7XG5leHBvcnRzLnJlc29sdmVVcmwgPSByZXNvbHZlVXJsO1xuXG52YXIgX3Jlc29sdmVVcmwgPSByZXF1aXJlKFwicmVzb2x2ZS11cmxcIik7XG5cbnZhciBfcmVzb2x2ZVVybDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9yZXNvbHZlVXJsKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxuZnVuY3Rpb24gbmV3UmVxdWVzdCgpIHtcbiAgcmV0dXJuIG5ldyB3aW5kb3cuWE1MSHR0cFJlcXVlc3QoKTtcbn0gLyogZ2xvYmFsIHdpbmRvdyAqL1xuXG5cbmZ1bmN0aW9uIHJlc29sdmVVcmwob3JpZ2luLCBsaW5rKSB7XG4gIHJldHVybiAoMCwgX3Jlc29sdmVVcmwyLmRlZmF1bHQpKG9yaWdpbiwgbGluayk7XG59IiwiLy8gR2VuZXJhdGVkIGJ5IEJhYmVsXG5cInVzZSBzdHJpY3RcIjtcblxudmFyIF9jcmVhdGVDbGFzcyA9IGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHsgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTsgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlOyBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7IGlmIChcInZhbHVlXCIgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGRlc2NyaXB0b3Iua2V5LCBkZXNjcmlwdG9yKTsgfSB9IHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7IGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpOyByZXR1cm4gQ29uc3RydWN0b3I7IH07IH0oKTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMuZ2V0U291cmNlID0gZ2V0U291cmNlO1xuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb25cIik7IH0gfVxuXG52YXIgRmlsZVNvdXJjZSA9IGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gRmlsZVNvdXJjZShmaWxlKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEZpbGVTb3VyY2UpO1xuXG4gICAgdGhpcy5fZmlsZSA9IGZpbGU7XG4gICAgdGhpcy5zaXplID0gZmlsZS5zaXplO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKEZpbGVTb3VyY2UsIFt7XG4gICAga2V5OiBcInNsaWNlXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHNsaWNlKHN0YXJ0LCBlbmQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9maWxlLnNsaWNlKHN0YXJ0LCBlbmQpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJjbG9zZVwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBjbG9zZSgpIHt9XG4gIH1dKTtcblxuICByZXR1cm4gRmlsZVNvdXJjZTtcbn0oKTtcblxuZnVuY3Rpb24gZ2V0U291cmNlKGlucHV0KSB7XG4gIC8vIFNpbmNlIHdlIGVtdWxhdGUgdGhlIEJsb2IgdHlwZSBpbiBvdXIgdGVzdHMgKG5vdCBhbGwgdGFyZ2V0IGJyb3dzZXJzXG4gIC8vIHN1cHBvcnQgaXQpLCB3ZSBjYW5ub3QgdXNlIGBpbnN0YW5jZW9mYCBmb3IgdGVzdGluZyB3aGV0aGVyIHRoZSBpbnB1dCB2YWx1ZVxuICAvLyBjYW4gYmUgaGFuZGxlZC4gSW5zdGVhZCwgd2Ugc2ltcGx5IGNoZWNrIGlzIHRoZSBzbGljZSgpIGZ1bmN0aW9uIGFuZCB0aGVcbiAgLy8gc2l6ZSBwcm9wZXJ0eSBhcmUgYXZhaWxhYmxlLlxuICBpZiAodHlwZW9mIGlucHV0LnNsaWNlID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGlucHV0LnNpemUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICByZXR1cm4gbmV3IEZpbGVTb3VyY2UoaW5wdXQpO1xuICB9XG5cbiAgdGhyb3cgbmV3IEVycm9yKFwic291cmNlIG9iamVjdCBtYXkgb25seSBiZSBhbiBpbnN0YW5jZSBvZiBGaWxlIG9yIEJsb2IgaW4gdGhpcyBlbnZpcm9ubWVudFwiKTtcbn0iLCIvLyBHZW5lcmF0ZWQgYnkgQmFiZWxcblwidXNlIHN0cmljdFwiO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuZXhwb3J0cy5zZXRJdGVtID0gc2V0SXRlbTtcbmV4cG9ydHMuZ2V0SXRlbSA9IGdldEl0ZW07XG5leHBvcnRzLnJlbW92ZUl0ZW0gPSByZW1vdmVJdGVtO1xuLyogZ2xvYmFsIHdpbmRvdywgbG9jYWxTdG9yYWdlICovXG5cbnZhciBoYXNTdG9yYWdlID0gZmFsc2U7XG50cnkge1xuICBoYXNTdG9yYWdlID0gXCJsb2NhbFN0b3JhZ2VcIiBpbiB3aW5kb3c7XG4gIC8vIEF0dGVtcHQgdG8gYWNjZXNzIGxvY2FsU3RvcmFnZVxuICBsb2NhbFN0b3JhZ2UubGVuZ3RoO1xufSBjYXRjaCAoZSkge1xuICAvLyBJZiB3ZSB0cnkgdG8gYWNjZXNzIGxvY2FsU3RvcmFnZSBpbnNpZGUgYSBzYW5kYm94ZWQgaWZyYW1lLCBhIFNlY3VyaXR5RXJyb3JcbiAgLy8gaXMgdGhyb3duLlxuICBpZiAoZS5jb2RlID09PSBlLlNFQ1VSSVRZX0VSUikge1xuICAgIGhhc1N0b3JhZ2UgPSBmYWxzZTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBlO1xuICB9XG59XG5cbnZhciBjYW5TdG9yZVVSTHMgPSBleHBvcnRzLmNhblN0b3JlVVJMcyA9IGhhc1N0b3JhZ2U7XG5cbmZ1bmN0aW9uIHNldEl0ZW0oa2V5LCB2YWx1ZSkge1xuICBpZiAoIWhhc1N0b3JhZ2UpIHJldHVybjtcbiAgcmV0dXJuIGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgdmFsdWUpO1xufVxuXG5mdW5jdGlvbiBnZXRJdGVtKGtleSkge1xuICBpZiAoIWhhc1N0b3JhZ2UpIHJldHVybjtcbiAgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUl0ZW0oa2V5KSB7XG4gIGlmICghaGFzU3RvcmFnZSkgcmV0dXJuO1xuICByZXR1cm4gbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oa2V5KTtcbn0iLCIvLyBHZW5lcmF0ZWQgYnkgQmFiZWxcblwidXNlIHN0cmljdFwiO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb25cIik7IH0gfVxuXG5mdW5jdGlvbiBfcG9zc2libGVDb25zdHJ1Y3RvclJldHVybihzZWxmLCBjYWxsKSB7IGlmICghc2VsZikgeyB0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoXCJ0aGlzIGhhc24ndCBiZWVuIGluaXRpYWxpc2VkIC0gc3VwZXIoKSBoYXNuJ3QgYmVlbiBjYWxsZWRcIik7IH0gcmV0dXJuIGNhbGwgJiYgKHR5cGVvZiBjYWxsID09PSBcIm9iamVjdFwiIHx8IHR5cGVvZiBjYWxsID09PSBcImZ1bmN0aW9uXCIpID8gY2FsbCA6IHNlbGY7IH1cblxuZnVuY3Rpb24gX2luaGVyaXRzKHN1YkNsYXNzLCBzdXBlckNsYXNzKSB7IGlmICh0eXBlb2Ygc3VwZXJDbGFzcyAhPT0gXCJmdW5jdGlvblwiICYmIHN1cGVyQ2xhc3MgIT09IG51bGwpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgXCIgKyB0eXBlb2Ygc3VwZXJDbGFzcyk7IH0gc3ViQ2xhc3MucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckNsYXNzICYmIHN1cGVyQ2xhc3MucHJvdG90eXBlLCB7IGNvbnN0cnVjdG9yOiB7IHZhbHVlOiBzdWJDbGFzcywgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlLCBjb25maWd1cmFibGU6IHRydWUgfSB9KTsgaWYgKHN1cGVyQ2xhc3MpIE9iamVjdC5zZXRQcm90b3R5cGVPZiA/IE9iamVjdC5zZXRQcm90b3R5cGVPZihzdWJDbGFzcywgc3VwZXJDbGFzcykgOiBzdWJDbGFzcy5fX3Byb3RvX18gPSBzdXBlckNsYXNzOyB9XG5cbnZhciBEZXRhaWxlZEVycm9yID0gZnVuY3Rpb24gKF9FcnJvcikge1xuICBfaW5oZXJpdHMoRGV0YWlsZWRFcnJvciwgX0Vycm9yKTtcblxuICBmdW5jdGlvbiBEZXRhaWxlZEVycm9yKGVycm9yKSB7XG4gICAgdmFyIGNhdXNpbmdFcnIgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDEgfHwgYXJndW1lbnRzWzFdID09PSB1bmRlZmluZWQgPyBudWxsIDogYXJndW1lbnRzWzFdO1xuICAgIHZhciB4aHIgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDIgfHwgYXJndW1lbnRzWzJdID09PSB1bmRlZmluZWQgPyBudWxsIDogYXJndW1lbnRzWzJdO1xuXG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIERldGFpbGVkRXJyb3IpO1xuXG4gICAgdmFyIF90aGlzID0gX3Bvc3NpYmxlQ29uc3RydWN0b3JSZXR1cm4odGhpcywgT2JqZWN0LmdldFByb3RvdHlwZU9mKERldGFpbGVkRXJyb3IpLmNhbGwodGhpcywgZXJyb3IubWVzc2FnZSkpO1xuXG4gICAgX3RoaXMub3JpZ2luYWxSZXF1ZXN0ID0geGhyO1xuICAgIF90aGlzLmNhdXNpbmdFcnJvciA9IGNhdXNpbmdFcnI7XG5cbiAgICB2YXIgbWVzc2FnZSA9IGVycm9yLm1lc3NhZ2U7XG4gICAgaWYgKGNhdXNpbmdFcnIgIT0gbnVsbCkge1xuICAgICAgbWVzc2FnZSArPSBcIiwgY2F1c2VkIGJ5IFwiICsgY2F1c2luZ0Vyci50b1N0cmluZygpO1xuICAgIH1cbiAgICBpZiAoeGhyICE9IG51bGwpIHtcbiAgICAgIG1lc3NhZ2UgKz0gXCIsIG9yaWdpbmF0ZWQgZnJvbSByZXF1ZXN0IChyZXNwb25zZSBjb2RlOiBcIiArIHhoci5zdGF0dXMgKyBcIiwgcmVzcG9uc2UgdGV4dDogXCIgKyB4aHIucmVzcG9uc2VUZXh0ICsgXCIpXCI7XG4gICAgfVxuICAgIF90aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgIHJldHVybiBfdGhpcztcbiAgfVxuXG4gIHJldHVybiBEZXRhaWxlZEVycm9yO1xufShFcnJvcik7XG5cbmV4cG9ydHMuZGVmYXVsdCA9IERldGFpbGVkRXJyb3I7IiwiLy8gR2VuZXJhdGVkIGJ5IEJhYmVsXG5cInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMuZGVmYXVsdCA9IGZpbmdlcnByaW50O1xuLyoqXG4gKiBHZW5lcmF0ZSBhIGZpbmdlcnByaW50IGZvciBhIGZpbGUgd2hpY2ggd2lsbCBiZSB1c2VkIHRoZSBzdG9yZSB0aGUgZW5kcG9pbnRcbiAqXG4gKiBAcGFyYW0ge0ZpbGV9IGZpbGVcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuZnVuY3Rpb24gZmluZ2VycHJpbnQoZmlsZSkge1xuICByZXR1cm4gW1widHVzXCIsIGZpbGUubmFtZSwgZmlsZS50eXBlLCBmaWxlLnNpemUsIGZpbGUubGFzdE1vZGlmaWVkXS5qb2luKFwiLVwiKTtcbn0iLCIvLyBHZW5lcmF0ZWQgYnkgQmFiZWxcblwidXNlIHN0cmljdFwiO1xuXG52YXIgX3VwbG9hZCA9IHJlcXVpcmUoXCIuL3VwbG9hZFwiKTtcblxudmFyIF91cGxvYWQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfdXBsb2FkKTtcblxudmFyIF9zdG9yYWdlID0gcmVxdWlyZShcIi4vbm9kZS9zdG9yYWdlXCIpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG4vKiBnbG9iYWwgd2luZG93ICovXG52YXIgZGVmYXVsdE9wdGlvbnMgPSBfdXBsb2FkMi5kZWZhdWx0LmRlZmF1bHRPcHRpb25zO1xuXG5cbmlmICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gIC8vIEJyb3dzZXIgZW52aXJvbm1lbnQgdXNpbmcgWE1MSHR0cFJlcXVlc3RcbiAgdmFyIF93aW5kb3cgPSB3aW5kb3c7XG4gIHZhciBYTUxIdHRwUmVxdWVzdCA9IF93aW5kb3cuWE1MSHR0cFJlcXVlc3Q7XG4gIHZhciBCbG9iID0gX3dpbmRvdy5CbG9iO1xuXG5cbiAgdmFyIGlzU3VwcG9ydGVkID0gWE1MSHR0cFJlcXVlc3QgJiYgQmxvYiAmJiB0eXBlb2YgQmxvYi5wcm90b3R5cGUuc2xpY2UgPT09IFwiZnVuY3Rpb25cIjtcbn0gZWxzZSB7XG4gIC8vIE5vZGUuanMgZW52aXJvbm1lbnQgdXNpbmcgaHR0cCBtb2R1bGVcbiAgdmFyIGlzU3VwcG9ydGVkID0gdHJ1ZTtcbn1cblxuLy8gVGhlIHVzYWdlIG9mIHRoZSBjb21tb25qcyBleHBvcnRpbmcgc3ludGF4IGluc3RlYWQgb2YgdGhlIG5ldyBFQ01BU2NyaXB0XG4vLyBvbmUgaXMgYWN0dWFsbHkgaW50ZWRlZCBhbmQgcHJldmVudHMgd2VpcmQgYmVoYXZpb3VyIGlmIHdlIGFyZSB0cnlpbmcgdG9cbi8vIGltcG9ydCB0aGlzIG1vZHVsZSBpbiBhbm90aGVyIG1vZHVsZSB1c2luZyBCYWJlbC5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBVcGxvYWQ6IF91cGxvYWQyLmRlZmF1bHQsXG4gIGlzU3VwcG9ydGVkOiBpc1N1cHBvcnRlZCxcbiAgY2FuU3RvcmVVUkxzOiBfc3RvcmFnZS5jYW5TdG9yZVVSTHMsXG4gIGRlZmF1bHRPcHRpb25zOiBkZWZhdWx0T3B0aW9uc1xufTsiLCIvLyBHZW5lcmF0ZWQgYnkgQmFiZWxcblwidXNlIHN0cmljdFwiO1xuXG52YXIgX2NyZWF0ZUNsYXNzID0gZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBkZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgcHJvcHMpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykgeyB2YXIgZGVzY3JpcHRvciA9IHByb3BzW2ldOyBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7IGRlc2NyaXB0b3IuY29uZmlndXJhYmxlID0gdHJ1ZTsgaWYgKFwidmFsdWVcIiBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTsgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpOyB9IH0gcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHsgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTsgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfTsgfSgpOyAvKiBnbG9iYWwgd2luZG93ICovXG5cblxuLy8gV2UgaW1wb3J0IHRoZSBmaWxlcyB1c2VkIGluc2lkZSB0aGUgTm9kZSBlbnZpcm9ubWVudCB3aGljaCBhcmUgcmV3cml0dGVuXG4vLyBmb3IgYnJvd3NlcnMgdXNpbmcgdGhlIHJ1bGVzIGRlZmluZWQgaW4gdGhlIHBhY2thZ2UuanNvblxuXG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG5cbnZhciBfZmluZ2VycHJpbnQgPSByZXF1aXJlKFwiLi9maW5nZXJwcmludFwiKTtcblxudmFyIF9maW5nZXJwcmludDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9maW5nZXJwcmludCk7XG5cbnZhciBfZXJyb3IgPSByZXF1aXJlKFwiLi9lcnJvclwiKTtcblxudmFyIF9lcnJvcjIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9lcnJvcik7XG5cbnZhciBfZXh0ZW5kID0gcmVxdWlyZShcImV4dGVuZFwiKTtcblxudmFyIF9leHRlbmQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZXh0ZW5kKTtcblxudmFyIF9yZXF1ZXN0ID0gcmVxdWlyZShcIi4vbm9kZS9yZXF1ZXN0XCIpO1xuXG52YXIgX3NvdXJjZSA9IHJlcXVpcmUoXCIuL25vZGUvc291cmNlXCIpO1xuXG52YXIgX2Jhc2UgPSByZXF1aXJlKFwiLi9ub2RlL2Jhc2U2NFwiKTtcblxudmFyIEJhc2U2NCA9IF9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkKF9iYXNlKTtcblxudmFyIF9zdG9yYWdlID0gcmVxdWlyZShcIi4vbm9kZS9zdG9yYWdlXCIpO1xuXG52YXIgU3RvcmFnZSA9IF9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkKF9zdG9yYWdlKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQob2JqKSB7IGlmIChvYmogJiYgb2JqLl9fZXNNb2R1bGUpIHsgcmV0dXJuIG9iajsgfSBlbHNlIHsgdmFyIG5ld09iaiA9IHt9OyBpZiAob2JqICE9IG51bGwpIHsgZm9yICh2YXIga2V5IGluIG9iaikgeyBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSkgbmV3T2JqW2tleV0gPSBvYmpba2V5XTsgfSB9IG5ld09iai5kZWZhdWx0ID0gb2JqOyByZXR1cm4gbmV3T2JqOyB9IH1cblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpOyB9IH1cblxudmFyIGRlZmF1bHRPcHRpb25zID0ge1xuICBlbmRwb2ludDogXCJcIixcbiAgZmluZ2VycHJpbnQ6IF9maW5nZXJwcmludDIuZGVmYXVsdCxcbiAgcmVzdW1lOiB0cnVlLFxuICBvblByb2dyZXNzOiBudWxsLFxuICBvbkNodW5rQ29tcGxldGU6IG51bGwsXG4gIG9uU3VjY2VzczogbnVsbCxcbiAgb25FcnJvcjogbnVsbCxcbiAgaGVhZGVyczoge30sXG4gIGNodW5rU2l6ZTogSW5maW5pdHksXG4gIHdpdGhDcmVkZW50aWFsczogZmFsc2UsXG4gIHVwbG9hZFVybDogbnVsbCxcbiAgdXBsb2FkU2l6ZTogbnVsbCxcbiAgb3ZlcnJpZGVQYXRjaE1ldGhvZDogZmFsc2UsXG4gIHJldHJ5RGVsYXlzOiBudWxsXG59O1xuXG52YXIgVXBsb2FkID0gZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBVcGxvYWQoZmlsZSwgb3B0aW9ucykge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBVcGxvYWQpO1xuXG4gICAgdGhpcy5vcHRpb25zID0gKDAsIF9leHRlbmQyLmRlZmF1bHQpKHRydWUsIHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0aW9ucyk7XG5cbiAgICAvLyBUaGUgdW5kZXJseWluZyBGaWxlL0Jsb2Igb2JqZWN0XG4gICAgdGhpcy5maWxlID0gZmlsZTtcblxuICAgIC8vIFRoZSBVUkwgYWdhaW5zdCB3aGljaCB0aGUgZmlsZSB3aWxsIGJlIHVwbG9hZGVkXG4gICAgdGhpcy51cmwgPSBudWxsO1xuXG4gICAgLy8gVGhlIHVuZGVybHlpbmcgWEhSIG9iamVjdCBmb3IgdGhlIGN1cnJlbnQgUEFUQ0ggcmVxdWVzdFxuICAgIHRoaXMuX3hociA9IG51bGw7XG5cbiAgICAvLyBUaGUgZmluZ2VycGlucnQgZm9yIHRoZSBjdXJyZW50IGZpbGUgKHNldCBhZnRlciBzdGFydCgpKVxuICAgIHRoaXMuX2ZpbmdlcnByaW50ID0gbnVsbDtcblxuICAgIC8vIFRoZSBvZmZzZXQgdXNlZCBpbiB0aGUgY3VycmVudCBQQVRDSCByZXF1ZXN0XG4gICAgdGhpcy5fb2Zmc2V0ID0gbnVsbDtcblxuICAgIC8vIFRydWUgaWYgdGhlIGN1cnJlbnQgUEFUQ0ggcmVxdWVzdCBoYXMgYmVlbiBhYm9ydGVkXG4gICAgdGhpcy5fYWJvcnRlZCA9IGZhbHNlO1xuXG4gICAgLy8gVGhlIGZpbGUncyBzaXplIGluIGJ5dGVzXG4gICAgdGhpcy5fc2l6ZSA9IG51bGw7XG5cbiAgICAvLyBUaGUgU291cmNlIG9iamVjdCB3aGljaCB3aWxsIHdyYXAgYXJvdW5kIHRoZSBnaXZlbiBmaWxlIGFuZCBwcm92aWRlcyB1c1xuICAgIC8vIHdpdGggYSB1bmlmaWVkIGludGVyZmFjZSBmb3IgZ2V0dGluZyBpdHMgc2l6ZSBhbmQgc2xpY2UgY2h1bmtzIGZyb20gaXRzXG4gICAgLy8gY29udGVudCBhbGxvd2luZyB1cyB0byBlYXNpbHkgaGFuZGxlIEZpbGVzLCBCbG9icywgQnVmZmVycyBhbmQgU3RyZWFtcy5cbiAgICB0aGlzLl9zb3VyY2UgPSBudWxsO1xuXG4gICAgLy8gVGhlIGN1cnJlbnQgY291bnQgb2YgYXR0ZW1wdHMgd2hpY2ggaGF2ZSBiZWVuIG1hZGUuIE51bGwgaW5kaWNhdGVzIG5vbmUuXG4gICAgdGhpcy5fcmV0cnlBdHRlbXB0ID0gMDtcblxuICAgIC8vIFRoZSB0aW1lb3V0J3MgSUQgd2hpY2ggaXMgdXNlZCB0byBkZWxheSB0aGUgbmV4dCByZXRyeVxuICAgIHRoaXMuX3JldHJ5VGltZW91dCA9IG51bGw7XG5cbiAgICAvLyBUaGUgb2Zmc2V0IG9mIHRoZSByZW1vdGUgdXBsb2FkIGJlZm9yZSB0aGUgbGF0ZXN0IGF0dGVtcHQgd2FzIHN0YXJ0ZWQuXG4gICAgdGhpcy5fb2Zmc2V0QmVmb3JlUmV0cnkgPSAwO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKFVwbG9hZCwgW3tcbiAgICBrZXk6IFwic3RhcnRcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gc3RhcnQoKSB7XG4gICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgICB2YXIgZmlsZSA9IHRoaXMuZmlsZTtcblxuICAgICAgaWYgKCFmaWxlKSB7XG4gICAgICAgIHRoaXMuX2VtaXRFcnJvcihuZXcgRXJyb3IoXCJ0dXM6IG5vIGZpbGUgb3Igc3RyZWFtIHRvIHVwbG9hZCBwcm92aWRlZFwiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuZW5kcG9pbnQpIHtcbiAgICAgICAgdGhpcy5fZW1pdEVycm9yKG5ldyBFcnJvcihcInR1czogbm8gZW5kcG9pbnQgcHJvdmlkZWRcIikpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhciBzb3VyY2UgPSB0aGlzLl9zb3VyY2UgPSAoMCwgX3NvdXJjZS5nZXRTb3VyY2UpKGZpbGUsIHRoaXMub3B0aW9ucy5jaHVua1NpemUpO1xuXG4gICAgICAvLyBGaXJzdGx5LCBjaGVjayBpZiB0aGUgY2FsbGVyIGhhcyBzdXBwbGllZCBhIG1hbnVhbCB1cGxvYWQgc2l6ZSBvciBlbHNlXG4gICAgICAvLyB3ZSB3aWxsIHVzZSB0aGUgY2FsY3VsYXRlZCBzaXplIGJ5IHRoZSBzb3VyY2Ugb2JqZWN0LlxuICAgICAgaWYgKHRoaXMub3B0aW9ucy51cGxvYWRTaXplICE9IG51bGwpIHtcbiAgICAgICAgdmFyIHNpemUgPSArdGhpcy5vcHRpb25zLnVwbG9hZFNpemU7XG4gICAgICAgIGlmIChpc05hTihzaXplKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInR1czogY2Fubm90IGNvbnZlcnQgYHVwbG9hZFNpemVgIG9wdGlvbiBpbnRvIGEgbnVtYmVyXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2l6ZSA9IHNpemU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgc2l6ZSA9IHNvdXJjZS5zaXplO1xuXG4gICAgICAgIC8vIFRoZSBzaXplIHByb3BlcnR5IHdpbGwgYmUgbnVsbCBpZiB3ZSBjYW5ub3QgY2FsY3VsYXRlIHRoZSBmaWxlJ3Mgc2l6ZSxcbiAgICAgICAgLy8gZm9yIGV4YW1wbGUgaWYgeW91IGhhbmRsZSBhIHN0cmVhbS5cbiAgICAgICAgaWYgKHNpemUgPT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInR1czogY2Fubm90IGF1dG9tYXRpY2FsbHkgZGVyaXZlIHVwbG9hZCdzIHNpemUgZnJvbSBpbnB1dCBhbmQgbXVzdCBiZSBzcGVjaWZpZWQgbWFudWFsbHkgdXNpbmcgdGhlIGB1cGxvYWRTaXplYCBvcHRpb25cIik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zaXplID0gc2l6ZTtcbiAgICAgIH1cblxuICAgICAgdmFyIHJldHJ5RGVsYXlzID0gdGhpcy5vcHRpb25zLnJldHJ5RGVsYXlzO1xuICAgICAgaWYgKHJldHJ5RGVsYXlzICE9IG51bGwpIHtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChyZXRyeURlbGF5cykgIT09IFwiW29iamVjdCBBcnJheV1cIikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInR1czogdGhlIGByZXRyeURlbGF5c2Agb3B0aW9uIG11c3QgZWl0aGVyIGJlIGFuIGFycmF5IG9yIG51bGxcIik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBlcnJvckNhbGxiYWNrID0gX3RoaXMub3B0aW9ucy5vbkVycm9yO1xuICAgICAgICAgICAgX3RoaXMub3B0aW9ucy5vbkVycm9yID0gZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAvLyBSZXN0b3JlIHRoZSBvcmlnaW5hbCBlcnJvciBjYWxsYmFjayB3aGljaCBtYXkgaGF2ZSBiZWVuIHNldC5cbiAgICAgICAgICAgICAgX3RoaXMub3B0aW9ucy5vbkVycm9yID0gZXJyb3JDYWxsYmFjaztcblxuICAgICAgICAgICAgICAvLyBXZSB3aWxsIHJlc2V0IHRoZSBhdHRlbXB0IGNvdW50ZXIgaWZcbiAgICAgICAgICAgICAgLy8gLSB3ZSB3ZXJlIGFscmVhZHkgYWJsZSB0byBjb25uZWN0IHRvIHRoZSBzZXJ2ZXIgKG9mZnNldCAhPSBudWxsKSBhbmRcbiAgICAgICAgICAgICAgLy8gLSB3ZSB3ZXJlIGFibGUgdG8gdXBsb2FkIGEgc21hbGwgY2h1bmsgb2YgZGF0YSB0byB0aGUgc2VydmVyXG4gICAgICAgICAgICAgIHZhciBzaG91bGRSZXNldERlbGF5cyA9IF90aGlzLl9vZmZzZXQgIT0gbnVsbCAmJiBfdGhpcy5fb2Zmc2V0ID4gX3RoaXMuX29mZnNldEJlZm9yZVJldHJ5O1xuICAgICAgICAgICAgICBpZiAoc2hvdWxkUmVzZXREZWxheXMpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5fcmV0cnlBdHRlbXB0ID0gMDtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHZhciBpc09ubGluZSA9IHRydWU7XG4gICAgICAgICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiICYmIFwibmF2aWdhdG9yXCIgaW4gd2luZG93ICYmIHdpbmRvdy5uYXZpZ2F0b3Iub25MaW5lID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIGlzT25saW5lID0gZmFsc2U7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBXZSBvbmx5IGF0dGVtcHQgYSByZXRyeSBpZlxuICAgICAgICAgICAgICAvLyAtIHdlIGRpZG4ndCBleGNlZWQgdGhlIG1heGl1bSBudW1iZXIgb2YgcmV0cmllcywgeWV0LCBhbmRcbiAgICAgICAgICAgICAgLy8gLSB0aGlzIGVycm9yIHdhcyBjYXVzZWQgYnkgYSByZXF1ZXN0IG9yIGl0J3MgcmVzcG9uc2UgYW5kXG4gICAgICAgICAgICAgIC8vIC0gdGhlIGJyb3dzZXIgZG9lcyBub3QgaW5kaWNhdGUgdGhhdCB3ZSBhcmUgb2ZmbGluZVxuICAgICAgICAgICAgICB2YXIgc2hvdWxkUmV0cnkgPSBfdGhpcy5fcmV0cnlBdHRlbXB0IDwgcmV0cnlEZWxheXMubGVuZ3RoICYmIGVyci5vcmlnaW5hbFJlcXVlc3QgIT0gbnVsbCAmJiBpc09ubGluZTtcblxuICAgICAgICAgICAgICBpZiAoIXNob3VsZFJldHJ5KSB7XG4gICAgICAgICAgICAgICAgX3RoaXMuX2VtaXRFcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHZhciBkZWxheSA9IHJldHJ5RGVsYXlzW190aGlzLl9yZXRyeUF0dGVtcHQrK107XG5cbiAgICAgICAgICAgICAgX3RoaXMuX29mZnNldEJlZm9yZVJldHJ5ID0gX3RoaXMuX29mZnNldDtcbiAgICAgICAgICAgICAgX3RoaXMub3B0aW9ucy51cGxvYWRVcmwgPSBfdGhpcy51cmw7XG5cbiAgICAgICAgICAgICAgX3RoaXMuX3JldHJ5VGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIF90aGlzLnN0YXJ0KCk7XG4gICAgICAgICAgICAgIH0sIGRlbGF5KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSkoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBBIFVSTCBoYXMgbWFudWFsbHkgYmVlbiBzcGVjaWZpZWQsIHNvIHdlIHRyeSB0byByZXN1bWVcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMudXBsb2FkVXJsICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy51cmwgPSB0aGlzLm9wdGlvbnMudXBsb2FkVXJsO1xuICAgICAgICB0aGlzLl9yZXN1bWVVcGxvYWQoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBUcnkgdG8gZmluZCB0aGUgZW5kcG9pbnQgZm9yIHRoZSBmaWxlIGluIHRoZSBzdG9yYWdlXG4gICAgICBpZiAodGhpcy5vcHRpb25zLnJlc3VtZSkge1xuICAgICAgICB0aGlzLl9maW5nZXJwcmludCA9IHRoaXMub3B0aW9ucy5maW5nZXJwcmludChmaWxlKTtcbiAgICAgICAgdmFyIHJlc3VtZWRVcmwgPSBTdG9yYWdlLmdldEl0ZW0odGhpcy5fZmluZ2VycHJpbnQpO1xuXG4gICAgICAgIGlmIChyZXN1bWVkVXJsICE9IG51bGwpIHtcbiAgICAgICAgICB0aGlzLnVybCA9IHJlc3VtZWRVcmw7XG4gICAgICAgICAgdGhpcy5fcmVzdW1lVXBsb2FkKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEFuIHVwbG9hZCBoYXMgbm90IHN0YXJ0ZWQgZm9yIHRoZSBmaWxlIHlldCwgc28gd2Ugc3RhcnQgYSBuZXcgb25lXG4gICAgICB0aGlzLl9jcmVhdGVVcGxvYWQoKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwiYWJvcnRcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gYWJvcnQoKSB7XG4gICAgICBpZiAodGhpcy5feGhyICE9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuX3hoci5hYm9ydCgpO1xuICAgICAgICB0aGlzLl9zb3VyY2UuY2xvc2UoKTtcbiAgICAgICAgdGhpcy5fYWJvcnRlZCA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9yZXRyeVRpbWVvdXQgIT0gbnVsbCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fcmV0cnlUaW1lb3V0KTtcbiAgICAgICAgdGhpcy5fcmV0cnlUaW1lb3V0ID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwiX2VtaXRYaHJFcnJvclwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfZW1pdFhockVycm9yKHhociwgZXJyLCBjYXVzaW5nRXJyKSB7XG4gICAgICB0aGlzLl9lbWl0RXJyb3IobmV3IF9lcnJvcjIuZGVmYXVsdChlcnIsIGNhdXNpbmdFcnIsIHhocikpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJfZW1pdEVycm9yXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9lbWl0RXJyb3IoZXJyKSB7XG4gICAgICBpZiAodHlwZW9mIHRoaXMub3B0aW9ucy5vbkVycm9yID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLm9uRXJyb3IoZXJyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwiX2VtaXRTdWNjZXNzXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9lbWl0U3VjY2VzcygpIHtcbiAgICAgIGlmICh0eXBlb2YgdGhpcy5vcHRpb25zLm9uU3VjY2VzcyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5vblN1Y2Nlc3MoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQdWJsaXNoZXMgbm90aWZpY2F0aW9uIHdoZW4gZGF0YSBoYXMgYmVlbiBzZW50IHRvIHRoZSBzZXJ2ZXIuIFRoaXNcbiAgICAgKiBkYXRhIG1heSBub3QgaGF2ZSBiZWVuIGFjY2VwdGVkIGJ5IHRoZSBzZXJ2ZXIgeWV0LlxuICAgICAqIEBwYXJhbSAge251bWJlcn0gYnl0ZXNTZW50ICBOdW1iZXIgb2YgYnl0ZXMgc2VudCB0byB0aGUgc2VydmVyLlxuICAgICAqIEBwYXJhbSAge251bWJlcn0gYnl0ZXNUb3RhbCBUb3RhbCBudW1iZXIgb2YgYnl0ZXMgdG8gYmUgc2VudCB0byB0aGUgc2VydmVyLlxuICAgICAqL1xuXG4gIH0sIHtcbiAgICBrZXk6IFwiX2VtaXRQcm9ncmVzc1wiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfZW1pdFByb2dyZXNzKGJ5dGVzU2VudCwgYnl0ZXNUb3RhbCkge1xuICAgICAgaWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMub25Qcm9ncmVzcyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5vblByb2dyZXNzKGJ5dGVzU2VudCwgYnl0ZXNUb3RhbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHVibGlzaGVzIG5vdGlmaWNhdGlvbiB3aGVuIGEgY2h1bmsgb2YgZGF0YSBoYXMgYmVlbiBzZW50IHRvIHRoZSBzZXJ2ZXJcbiAgICAgKiBhbmQgYWNjZXB0ZWQgYnkgdGhlIHNlcnZlci5cbiAgICAgKiBAcGFyYW0gIHtudW1iZXJ9IGNodW5rU2l6ZSAgU2l6ZSBvZiB0aGUgY2h1bmsgdGhhdCB3YXMgYWNjZXB0ZWQgYnkgdGhlXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlci5cbiAgICAgKiBAcGFyYW0gIHtudW1iZXJ9IGJ5dGVzQWNjZXB0ZWQgVG90YWwgbnVtYmVyIG9mIGJ5dGVzIHRoYXQgaGF2ZSBiZWVuXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjY2VwdGVkIGJ5IHRoZSBzZXJ2ZXIuXG4gICAgICogQHBhcmFtICB7bnVtYmVyfSBieXRlc1RvdGFsIFRvdGFsIG51bWJlciBvZiBieXRlcyB0byBiZSBzZW50IHRvIHRoZSBzZXJ2ZXIuXG4gICAgICovXG5cbiAgfSwge1xuICAgIGtleTogXCJfZW1pdENodW5rQ29tcGxldGVcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gX2VtaXRDaHVua0NvbXBsZXRlKGNodW5rU2l6ZSwgYnl0ZXNBY2NlcHRlZCwgYnl0ZXNUb3RhbCkge1xuICAgICAgaWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMub25DaHVua0NvbXBsZXRlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLm9uQ2h1bmtDb21wbGV0ZShjaHVua1NpemUsIGJ5dGVzQWNjZXB0ZWQsIGJ5dGVzVG90YWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgaGVhZGVycyB1c2VkIGluIHRoZSByZXF1ZXN0IGFuZCB0aGUgd2l0aENyZWRlbnRpYWxzIHByb3BlcnR5XG4gICAgICogYXMgZGVmaW5lZCBpbiB0aGUgb3B0aW9uc1xuICAgICAqXG4gICAgICogQHBhcmFtIHtYTUxIdHRwUmVxdWVzdH0geGhyXG4gICAgICovXG5cbiAgfSwge1xuICAgIGtleTogXCJfc2V0dXBYSFJcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gX3NldHVwWEhSKHhocikge1xuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoXCJUdXMtUmVzdW1hYmxlXCIsIFwiMS4wLjBcIik7XG4gICAgICB2YXIgaGVhZGVycyA9IHRoaXMub3B0aW9ucy5oZWFkZXJzO1xuXG4gICAgICBmb3IgKHZhciBuYW1lIGluIGhlYWRlcnMpIHtcbiAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIobmFtZSwgaGVhZGVyc1tuYW1lXSk7XG4gICAgICB9XG5cbiAgICAgIHhoci53aXRoQ3JlZGVudGlhbHMgPSB0aGlzLm9wdGlvbnMud2l0aENyZWRlbnRpYWxzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyB1cGxvYWQgdXNpbmcgdGhlIGNyZWF0aW9uIGV4dGVuc2lvbiBieSBzZW5kaW5nIGEgUE9TVFxuICAgICAqIHJlcXVlc3QgdG8gdGhlIGVuZHBvaW50LiBBZnRlciBzdWNjZXNzZnVsIGNyZWF0aW9uIHRoZSBmaWxlIHdpbGwgYmVcbiAgICAgKiB1cGxvYWRlZFxuICAgICAqXG4gICAgICogQGFwaSBwcml2YXRlXG4gICAgICovXG5cbiAgfSwge1xuICAgIGtleTogXCJfY3JlYXRlVXBsb2FkXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9jcmVhdGVVcGxvYWQoKSB7XG4gICAgICB2YXIgX3RoaXMyID0gdGhpcztcblxuICAgICAgdmFyIHhociA9ICgwLCBfcmVxdWVzdC5uZXdSZXF1ZXN0KSgpO1xuICAgICAgeGhyLm9wZW4oXCJQT1NUXCIsIHRoaXMub3B0aW9ucy5lbmRwb2ludCwgdHJ1ZSk7XG5cbiAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghKHhoci5zdGF0dXMgPj0gMjAwICYmIHhoci5zdGF0dXMgPCAzMDApKSB7XG4gICAgICAgICAgX3RoaXMyLl9lbWl0WGhyRXJyb3IoeGhyLCBuZXcgRXJyb3IoXCJ0dXM6IHVuZXhwZWN0ZWQgcmVzcG9uc2Ugd2hpbGUgY3JlYXRpbmcgdXBsb2FkXCIpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBfdGhpczIudXJsID0gKDAsIF9yZXF1ZXN0LnJlc29sdmVVcmwpKF90aGlzMi5vcHRpb25zLmVuZHBvaW50LCB4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoXCJMb2NhdGlvblwiKSk7XG5cbiAgICAgICAgaWYgKF90aGlzMi5vcHRpb25zLnJlc3VtZSkge1xuICAgICAgICAgIFN0b3JhZ2Uuc2V0SXRlbShfdGhpczIuX2ZpbmdlcnByaW50LCBfdGhpczIudXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIF90aGlzMi5fb2Zmc2V0ID0gMDtcbiAgICAgICAgX3RoaXMyLl9zdGFydFVwbG9hZCgpO1xuICAgICAgfTtcblxuICAgICAgeGhyLm9uZXJyb3IgPSBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgIF90aGlzMi5fZW1pdFhockVycm9yKHhociwgbmV3IEVycm9yKFwidHVzOiBmYWlsZWQgdG8gY3JlYXRlIHVwbG9hZFwiKSwgZXJyKTtcbiAgICAgIH07XG5cbiAgICAgIHRoaXMuX3NldHVwWEhSKHhocik7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihcIlVwbG9hZC1MZW5ndGhcIiwgdGhpcy5fc2l6ZSk7XG5cbiAgICAgIC8vIEFkZCBtZXRhZGF0YSBpZiB2YWx1ZXMgaGF2ZSBiZWVuIGFkZGVkXG4gICAgICB2YXIgbWV0YWRhdGEgPSBlbmNvZGVNZXRhZGF0YSh0aGlzLm9wdGlvbnMubWV0YWRhdGEpO1xuICAgICAgaWYgKG1ldGFkYXRhICE9PSBcIlwiKSB7XG4gICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKFwiVXBsb2FkLU1ldGFkYXRhXCIsIG1ldGFkYXRhKTtcbiAgICAgIH1cblxuICAgICAgeGhyLnNlbmQobnVsbCk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgKiBUcnkgdG8gcmVzdW1lIGFuIGV4aXN0aW5nIHVwbG9hZC4gRmlyc3QgYSBIRUFEIHJlcXVlc3Qgd2lsbCBiZSBzZW50XG4gICAgICogdG8gcmV0cmlldmUgdGhlIG9mZnNldC4gSWYgdGhlIHJlcXVlc3QgZmFpbHMgYSBuZXcgdXBsb2FkIHdpbGwgYmVcbiAgICAgKiBjcmVhdGVkLiBJbiB0aGUgY2FzZSBvZiBhIHN1Y2Nlc3NmdWwgcmVzcG9uc2UgdGhlIGZpbGUgd2lsbCBiZSB1cGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEBhcGkgcHJpdmF0ZVxuICAgICAqL1xuXG4gIH0sIHtcbiAgICBrZXk6IFwiX3Jlc3VtZVVwbG9hZFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfcmVzdW1lVXBsb2FkKCkge1xuICAgICAgdmFyIF90aGlzMyA9IHRoaXM7XG5cbiAgICAgIHZhciB4aHIgPSAoMCwgX3JlcXVlc3QubmV3UmVxdWVzdCkoKTtcbiAgICAgIHhoci5vcGVuKFwiSEVBRFwiLCB0aGlzLnVybCwgdHJ1ZSk7XG5cbiAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghKHhoci5zdGF0dXMgPj0gMjAwICYmIHhoci5zdGF0dXMgPCAzMDApKSB7XG4gICAgICAgICAgaWYgKF90aGlzMy5vcHRpb25zLnJlc3VtZSkge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIHN0b3JlZCBmaW5nZXJwcmludCBhbmQgY29ycmVzcG9uZGluZyBlbmRwb2ludCxcbiAgICAgICAgICAgIC8vIHNpbmNlIHRoZSBmaWxlIGNhbiBub3QgYmUgZm91bmRcbiAgICAgICAgICAgIFN0b3JhZ2UucmVtb3ZlSXRlbShfdGhpczMuX2ZpbmdlcnByaW50KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUcnkgdG8gY3JlYXRlIGEgbmV3IHVwbG9hZFxuICAgICAgICAgIF90aGlzMy51cmwgPSBudWxsO1xuICAgICAgICAgIF90aGlzMy5fY3JlYXRlVXBsb2FkKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG9mZnNldCA9IHBhcnNlSW50KHhoci5nZXRSZXNwb25zZUhlYWRlcihcIlVwbG9hZC1PZmZzZXRcIiksIDEwKTtcbiAgICAgICAgaWYgKGlzTmFOKG9mZnNldCkpIHtcbiAgICAgICAgICBfdGhpczMuX2VtaXRYaHJFcnJvcih4aHIsIG5ldyBFcnJvcihcInR1czogaW52YWxpZCBvciBtaXNzaW5nIG9mZnNldCB2YWx1ZVwiKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGxlbmd0aCA9IHBhcnNlSW50KHhoci5nZXRSZXNwb25zZUhlYWRlcihcIlVwbG9hZC1MZW5ndGhcIiksIDEwKTtcbiAgICAgICAgaWYgKGlzTmFOKGxlbmd0aCkpIHtcbiAgICAgICAgICBfdGhpczMuX2VtaXRYaHJFcnJvcih4aHIsIG5ldyBFcnJvcihcInR1czogaW52YWxpZCBvciBtaXNzaW5nIGxlbmd0aCB2YWx1ZVwiKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBsb2FkIGhhcyBhbHJlYWR5IGJlZW4gY29tcGxldGVkIGFuZCB3ZSBkbyBub3QgbmVlZCB0byBzZW5kIGFkZGl0aW9uYWxcbiAgICAgICAgLy8gZGF0YSB0byB0aGUgc2VydmVyXG4gICAgICAgIGlmIChvZmZzZXQgPT09IGxlbmd0aCkge1xuICAgICAgICAgIF90aGlzMy5fZW1pdFByb2dyZXNzKGxlbmd0aCwgbGVuZ3RoKTtcbiAgICAgICAgICBfdGhpczMuX2VtaXRTdWNjZXNzKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgX3RoaXMzLl9vZmZzZXQgPSBvZmZzZXQ7XG4gICAgICAgIF90aGlzMy5fc3RhcnRVcGxvYWQoKTtcbiAgICAgIH07XG5cbiAgICAgIHhoci5vbmVycm9yID0gZnVuY3Rpb24gKGVycikge1xuICAgICAgICBfdGhpczMuX2VtaXRYaHJFcnJvcih4aHIsIG5ldyBFcnJvcihcInR1czogZmFpbGVkIHRvIHJlc3VtZSB1cGxvYWRcIiksIGVycik7XG4gICAgICB9O1xuXG4gICAgICB0aGlzLl9zZXR1cFhIUih4aHIpO1xuICAgICAgeGhyLnNlbmQobnVsbCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgdXBsb2FkaW5nIHRoZSBmaWxlIHVzaW5nIFBBVENIIHJlcXVlc3RzLiBUaGUgZmlsZSB3aWxsIGJlIGRpdmlkZWRcbiAgICAgKiBpbnRvIGNodW5rcyBhcyBzcGVjaWZpZWQgaW4gdGhlIGNodW5rU2l6ZSBvcHRpb24uIER1cmluZyB0aGUgdXBsb2FkXG4gICAgICogdGhlIG9uUHJvZ3Jlc3MgZXZlbnQgaGFuZGxlciBtYXkgYmUgaW52b2tlZCBtdWx0aXBsZSB0aW1lcy5cbiAgICAgKlxuICAgICAqIEBhcGkgcHJpdmF0ZVxuICAgICAqL1xuXG4gIH0sIHtcbiAgICBrZXk6IFwiX3N0YXJ0VXBsb2FkXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9zdGFydFVwbG9hZCgpIHtcbiAgICAgIHZhciBfdGhpczQgPSB0aGlzO1xuXG4gICAgICB2YXIgeGhyID0gdGhpcy5feGhyID0gKDAsIF9yZXF1ZXN0Lm5ld1JlcXVlc3QpKCk7XG5cbiAgICAgIC8vIFNvbWUgYnJvd3NlciBhbmQgc2VydmVycyBtYXkgbm90IHN1cHBvcnQgdGhlIFBBVENIIG1ldGhvZC4gRm9yIHRob3NlXG4gICAgICAvLyBjYXNlcywgeW91IGNhbiB0ZWxsIHR1cy1qcy1jbGllbnQgdG8gdXNlIGEgUE9TVCByZXF1ZXN0IHdpdGggdGhlXG4gICAgICAvLyBYLUhUVFAtTWV0aG9kLU92ZXJyaWRlIGhlYWRlciBmb3Igc2ltdWxhdGluZyBhIFBBVENIIHJlcXVlc3QuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLm92ZXJyaWRlUGF0Y2hNZXRob2QpIHtcbiAgICAgICAgeGhyLm9wZW4oXCJQT1NUXCIsIHRoaXMudXJsLCB0cnVlKTtcbiAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoXCJYLUhUVFAtTWV0aG9kLU92ZXJyaWRlXCIsIFwiUEFUQ0hcIik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB4aHIub3BlbihcIlBBVENIXCIsIHRoaXMudXJsLCB0cnVlKTtcbiAgICAgIH1cblxuICAgICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCEoeGhyLnN0YXR1cyA+PSAyMDAgJiYgeGhyLnN0YXR1cyA8IDMwMCkpIHtcbiAgICAgICAgICBfdGhpczQuX2VtaXRYaHJFcnJvcih4aHIsIG5ldyBFcnJvcihcInR1czogdW5leHBlY3RlZCByZXNwb25zZSB3aGlsZSB1cGxvYWRpbmcgY2h1bmtcIikpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBvZmZzZXQgPSBwYXJzZUludCh4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoXCJVcGxvYWQtT2Zmc2V0XCIpLCAxMCk7XG4gICAgICAgIGlmIChpc05hTihvZmZzZXQpKSB7XG4gICAgICAgICAgX3RoaXM0Ll9lbWl0WGhyRXJyb3IoeGhyLCBuZXcgRXJyb3IoXCJ0dXM6IGludmFsaWQgb3IgbWlzc2luZyBvZmZzZXQgdmFsdWVcIikpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIF90aGlzNC5fZW1pdFByb2dyZXNzKG9mZnNldCwgX3RoaXM0Ll9zaXplKTtcbiAgICAgICAgX3RoaXM0Ll9lbWl0Q2h1bmtDb21wbGV0ZShvZmZzZXQgLSBfdGhpczQuX29mZnNldCwgb2Zmc2V0LCBfdGhpczQuX3NpemUpO1xuXG4gICAgICAgIF90aGlzNC5fb2Zmc2V0ID0gb2Zmc2V0O1xuXG4gICAgICAgIGlmIChvZmZzZXQgPT0gX3RoaXM0Ll9zaXplKSB7XG4gICAgICAgICAgLy8gWWF5LCBmaW5hbGx5IGRvbmUgOilcbiAgICAgICAgICBfdGhpczQuX2VtaXRTdWNjZXNzKCk7XG4gICAgICAgICAgX3RoaXM0Ll9zb3VyY2UuY2xvc2UoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBfdGhpczQuX3N0YXJ0VXBsb2FkKCk7XG4gICAgICB9O1xuXG4gICAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgLy8gRG9uJ3QgZW1pdCBhbiBlcnJvciBpZiB0aGUgdXBsb2FkIHdhcyBhYm9ydGVkIG1hbnVhbGx5XG4gICAgICAgIGlmIChfdGhpczQuX2Fib3J0ZWQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBfdGhpczQuX2VtaXRYaHJFcnJvcih4aHIsIG5ldyBFcnJvcihcInR1czogZmFpbGVkIHRvIHVwbG9hZCBjaHVuayBhdCBvZmZzZXQgXCIgKyBfdGhpczQuX29mZnNldCksIGVycik7XG4gICAgICB9O1xuXG4gICAgICAvLyBUZXN0IHN1cHBvcnQgZm9yIHByb2dyZXNzIGV2ZW50cyBiZWZvcmUgYXR0YWNoaW5nIGFuIGV2ZW50IGxpc3RlbmVyXG4gICAgICBpZiAoXCJ1cGxvYWRcIiBpbiB4aHIpIHtcbiAgICAgICAgeGhyLnVwbG9hZC5vbnByb2dyZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICBpZiAoIWUubGVuZ3RoQ29tcHV0YWJsZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIF90aGlzNC5fZW1pdFByb2dyZXNzKHN0YXJ0ICsgZS5sb2FkZWQsIF90aGlzNC5fc2l6ZSk7XG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX3NldHVwWEhSKHhocik7XG5cbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKFwiVXBsb2FkLU9mZnNldFwiLCB0aGlzLl9vZmZzZXQpO1xuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9vZmZzZXQrb2N0ZXQtc3RyZWFtXCIpO1xuXG4gICAgICB2YXIgc3RhcnQgPSB0aGlzLl9vZmZzZXQ7XG4gICAgICB2YXIgZW5kID0gdGhpcy5fb2Zmc2V0ICsgdGhpcy5vcHRpb25zLmNodW5rU2l6ZTtcblxuICAgICAgLy8gVGhlIHNwZWNpZmllZCBjaHVua1NpemUgbWF5IGJlIEluZmluaXR5IG9yIHRoZSBjYWxjbHVhdGVkIGVuZCBwb3NpdGlvblxuICAgICAgLy8gbWF5IGV4Y2VlZCB0aGUgZmlsZSdzIHNpemUuIEluIGJvdGggY2FzZXMsIHdlIGxpbWl0IHRoZSBlbmQgcG9zaXRpb24gdG9cbiAgICAgIC8vIHRoZSBpbnB1dCdzIHRvdGFsIHNpemUgZm9yIHNpbXBsZXIgY2FsY3VsYXRpb25zIGFuZCBjb3JyZWN0bmVzcy5cbiAgICAgIGlmIChlbmQgPT09IEluZmluaXR5IHx8IGVuZCA+IHRoaXMuX3NpemUpIHtcbiAgICAgICAgZW5kID0gdGhpcy5fc2l6ZTtcbiAgICAgIH1cblxuICAgICAgeGhyLnNlbmQodGhpcy5fc291cmNlLnNsaWNlKHN0YXJ0LCBlbmQpKTtcbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gVXBsb2FkO1xufSgpO1xuXG5mdW5jdGlvbiBlbmNvZGVNZXRhZGF0YShtZXRhZGF0YSkge1xuICBpZiAoIUJhc2U2NC5pc1N1cHBvcnRlZCkge1xuICAgIHJldHVybiBcIlwiO1xuICB9XG5cbiAgdmFyIGVuY29kZWQgPSBbXTtcblxuICBmb3IgKHZhciBrZXkgaW4gbWV0YWRhdGEpIHtcbiAgICBlbmNvZGVkLnB1c2goa2V5ICsgXCIgXCIgKyBCYXNlNjQuZW5jb2RlKG1ldGFkYXRhW2tleV0pKTtcbiAgfVxuXG4gIHJldHVybiBlbmNvZGVkLmpvaW4oXCIsXCIpO1xufVxuXG5VcGxvYWQuZGVmYXVsdE9wdGlvbnMgPSBkZWZhdWx0T3B0aW9ucztcblxuZXhwb3J0cy5kZWZhdWx0ID0gVXBsb2FkOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgdG9TdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG52YXIgaXNBcnJheSA9IGZ1bmN0aW9uIGlzQXJyYXkoYXJyKSB7XG5cdGlmICh0eXBlb2YgQXJyYXkuaXNBcnJheSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdHJldHVybiBBcnJheS5pc0FycmF5KGFycik7XG5cdH1cblxuXHRyZXR1cm4gdG9TdHIuY2FsbChhcnIpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcblxudmFyIGlzUGxhaW5PYmplY3QgPSBmdW5jdGlvbiBpc1BsYWluT2JqZWN0KG9iaikge1xuXHRpZiAoIW9iaiB8fCB0b1N0ci5jYWxsKG9iaikgIT09ICdbb2JqZWN0IE9iamVjdF0nKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0dmFyIGhhc093bkNvbnN0cnVjdG9yID0gaGFzT3duLmNhbGwob2JqLCAnY29uc3RydWN0b3InKTtcblx0dmFyIGhhc0lzUHJvdG90eXBlT2YgPSBvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSAmJiBoYXNPd24uY2FsbChvYmouY29uc3RydWN0b3IucHJvdG90eXBlLCAnaXNQcm90b3R5cGVPZicpO1xuXHQvLyBOb3Qgb3duIGNvbnN0cnVjdG9yIHByb3BlcnR5IG11c3QgYmUgT2JqZWN0XG5cdGlmIChvYmouY29uc3RydWN0b3IgJiYgIWhhc093bkNvbnN0cnVjdG9yICYmICFoYXNJc1Byb3RvdHlwZU9mKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Ly8gT3duIHByb3BlcnRpZXMgYXJlIGVudW1lcmF0ZWQgZmlyc3RseSwgc28gdG8gc3BlZWQgdXAsXG5cdC8vIGlmIGxhc3Qgb25lIGlzIG93biwgdGhlbiBhbGwgcHJvcGVydGllcyBhcmUgb3duLlxuXHR2YXIga2V5O1xuXHRmb3IgKGtleSBpbiBvYmopIHsvKiovfVxuXG5cdHJldHVybiB0eXBlb2Yga2V5ID09PSAndW5kZWZpbmVkJyB8fCBoYXNPd24uY2FsbChvYmosIGtleSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCgpIHtcblx0dmFyIG9wdGlvbnMsIG5hbWUsIHNyYywgY29weSwgY29weUlzQXJyYXksIGNsb25lLFxuXHRcdHRhcmdldCA9IGFyZ3VtZW50c1swXSxcblx0XHRpID0gMSxcblx0XHRsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLFxuXHRcdGRlZXAgPSBmYWxzZTtcblxuXHQvLyBIYW5kbGUgYSBkZWVwIGNvcHkgc2l0dWF0aW9uXG5cdGlmICh0eXBlb2YgdGFyZ2V0ID09PSAnYm9vbGVhbicpIHtcblx0XHRkZWVwID0gdGFyZ2V0O1xuXHRcdHRhcmdldCA9IGFyZ3VtZW50c1sxXSB8fCB7fTtcblx0XHQvLyBza2lwIHRoZSBib29sZWFuIGFuZCB0aGUgdGFyZ2V0XG5cdFx0aSA9IDI7XG5cdH0gZWxzZSBpZiAoKHR5cGVvZiB0YXJnZXQgIT09ICdvYmplY3QnICYmIHR5cGVvZiB0YXJnZXQgIT09ICdmdW5jdGlvbicpIHx8IHRhcmdldCA9PSBudWxsKSB7XG5cdFx0dGFyZ2V0ID0ge307XG5cdH1cblxuXHRmb3IgKDsgaSA8IGxlbmd0aDsgKytpKSB7XG5cdFx0b3B0aW9ucyA9IGFyZ3VtZW50c1tpXTtcblx0XHQvLyBPbmx5IGRlYWwgd2l0aCBub24tbnVsbC91bmRlZmluZWQgdmFsdWVzXG5cdFx0aWYgKG9wdGlvbnMgIT0gbnVsbCkge1xuXHRcdFx0Ly8gRXh0ZW5kIHRoZSBiYXNlIG9iamVjdFxuXHRcdFx0Zm9yIChuYW1lIGluIG9wdGlvbnMpIHtcblx0XHRcdFx0c3JjID0gdGFyZ2V0W25hbWVdO1xuXHRcdFx0XHRjb3B5ID0gb3B0aW9uc1tuYW1lXTtcblxuXHRcdFx0XHQvLyBQcmV2ZW50IG5ldmVyLWVuZGluZyBsb29wXG5cdFx0XHRcdGlmICh0YXJnZXQgIT09IGNvcHkpIHtcblx0XHRcdFx0XHQvLyBSZWN1cnNlIGlmIHdlJ3JlIG1lcmdpbmcgcGxhaW4gb2JqZWN0cyBvciBhcnJheXNcblx0XHRcdFx0XHRpZiAoZGVlcCAmJiBjb3B5ICYmIChpc1BsYWluT2JqZWN0KGNvcHkpIHx8IChjb3B5SXNBcnJheSA9IGlzQXJyYXkoY29weSkpKSkge1xuXHRcdFx0XHRcdFx0aWYgKGNvcHlJc0FycmF5KSB7XG5cdFx0XHRcdFx0XHRcdGNvcHlJc0FycmF5ID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdGNsb25lID0gc3JjICYmIGlzQXJyYXkoc3JjKSA/IHNyYyA6IFtdO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y2xvbmUgPSBzcmMgJiYgaXNQbGFpbk9iamVjdChzcmMpID8gc3JjIDoge307XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIE5ldmVyIG1vdmUgb3JpZ2luYWwgb2JqZWN0cywgY2xvbmUgdGhlbVxuXHRcdFx0XHRcdFx0dGFyZ2V0W25hbWVdID0gZXh0ZW5kKGRlZXAsIGNsb25lLCBjb3B5KTtcblxuXHRcdFx0XHRcdC8vIERvbid0IGJyaW5nIGluIHVuZGVmaW5lZCB2YWx1ZXNcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBjb3B5ICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0XHRcdFx0dGFyZ2V0W25hbWVdID0gY29weTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBSZXR1cm4gdGhlIG1vZGlmaWVkIG9iamVjdFxuXHRyZXR1cm4gdGFyZ2V0O1xufTtcblxuIiwiLy8gQ29weXJpZ2h0IDIwMTQgU2ltb24gTHlkZWxsXHJcbi8vIFgxMSAo4oCcTUlU4oCdKSBMaWNlbnNlZC4gKFNlZSBMSUNFTlNFLilcclxuXHJcbnZvaWQgKGZ1bmN0aW9uKHJvb3QsIGZhY3RvcnkpIHtcclxuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIHtcclxuICAgIGRlZmluZShmYWN0b3J5KVxyXG4gIH0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09IFwib2JqZWN0XCIpIHtcclxuICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpXHJcbiAgfSBlbHNlIHtcclxuICAgIHJvb3QucmVzb2x2ZVVybCA9IGZhY3RvcnkoKVxyXG4gIH1cclxufSh0aGlzLCBmdW5jdGlvbigpIHtcclxuXHJcbiAgZnVuY3Rpb24gcmVzb2x2ZVVybCgvKiAuLi51cmxzICovKSB7XHJcbiAgICB2YXIgbnVtVXJscyA9IGFyZ3VtZW50cy5sZW5ndGhcclxuXHJcbiAgICBpZiAobnVtVXJscyA9PT0gMCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJyZXNvbHZlVXJsIHJlcXVpcmVzIGF0IGxlYXN0IG9uZSBhcmd1bWVudDsgZ290IG5vbmUuXCIpXHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGJhc2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYmFzZVwiKVxyXG4gICAgYmFzZS5ocmVmID0gYXJndW1lbnRzWzBdXHJcblxyXG4gICAgaWYgKG51bVVybHMgPT09IDEpIHtcclxuICAgICAgcmV0dXJuIGJhc2UuaHJlZlxyXG4gICAgfVxyXG5cclxuICAgIHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJoZWFkXCIpWzBdXHJcbiAgICBoZWFkLmluc2VydEJlZm9yZShiYXNlLCBoZWFkLmZpcnN0Q2hpbGQpXHJcblxyXG4gICAgdmFyIGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKVxyXG4gICAgdmFyIHJlc29sdmVkXHJcblxyXG4gICAgZm9yICh2YXIgaW5kZXggPSAxOyBpbmRleCA8IG51bVVybHM7IGluZGV4KyspIHtcclxuICAgICAgYS5ocmVmID0gYXJndW1lbnRzW2luZGV4XVxyXG4gICAgICByZXNvbHZlZCA9IGEuaHJlZlxyXG4gICAgICBiYXNlLmhyZWYgPSByZXNvbHZlZFxyXG4gICAgfVxyXG5cclxuICAgIGhlYWQucmVtb3ZlQ2hpbGQoYmFzZSlcclxuXHJcbiAgICByZXR1cm4gcmVzb2x2ZWRcclxuICB9XHJcblxyXG4gIHJldHVybiByZXNvbHZlVXJsXHJcblxyXG59KSk7XHJcbiIsIihmdW5jdGlvbihzZWxmKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICBpZiAoc2VsZi5mZXRjaCkge1xuICAgIHJldHVyblxuICB9XG5cbiAgdmFyIHN1cHBvcnQgPSB7XG4gICAgc2VhcmNoUGFyYW1zOiAnVVJMU2VhcmNoUGFyYW1zJyBpbiBzZWxmLFxuICAgIGl0ZXJhYmxlOiAnU3ltYm9sJyBpbiBzZWxmICYmICdpdGVyYXRvcicgaW4gU3ltYm9sLFxuICAgIGJsb2I6ICdGaWxlUmVhZGVyJyBpbiBzZWxmICYmICdCbG9iJyBpbiBzZWxmICYmIChmdW5jdGlvbigpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIG5ldyBCbG9iKClcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICB9KSgpLFxuICAgIGZvcm1EYXRhOiAnRm9ybURhdGEnIGluIHNlbGYsXG4gICAgYXJyYXlCdWZmZXI6ICdBcnJheUJ1ZmZlcicgaW4gc2VsZlxuICB9XG5cbiAgZnVuY3Rpb24gbm9ybWFsaXplTmFtZShuYW1lKSB7XG4gICAgaWYgKHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgbmFtZSA9IFN0cmluZyhuYW1lKVxuICAgIH1cbiAgICBpZiAoL1teYS16MC05XFwtIyQlJicqKy5cXF5fYHx+XS9pLnRlc3QobmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgY2hhcmFjdGVyIGluIGhlYWRlciBmaWVsZCBuYW1lJylcbiAgICB9XG4gICAgcmV0dXJuIG5hbWUudG9Mb3dlckNhc2UoKVxuICB9XG5cbiAgZnVuY3Rpb24gbm9ybWFsaXplVmFsdWUodmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgdmFsdWUgPSBTdHJpbmcodmFsdWUpXG4gICAgfVxuICAgIHJldHVybiB2YWx1ZVxuICB9XG5cbiAgLy8gQnVpbGQgYSBkZXN0cnVjdGl2ZSBpdGVyYXRvciBmb3IgdGhlIHZhbHVlIGxpc3RcbiAgZnVuY3Rpb24gaXRlcmF0b3JGb3IoaXRlbXMpIHtcbiAgICB2YXIgaXRlcmF0b3IgPSB7XG4gICAgICBuZXh0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gaXRlbXMuc2hpZnQoKVxuICAgICAgICByZXR1cm4ge2RvbmU6IHZhbHVlID09PSB1bmRlZmluZWQsIHZhbHVlOiB2YWx1ZX1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3VwcG9ydC5pdGVyYWJsZSkge1xuICAgICAgaXRlcmF0b3JbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gaXRlcmF0b3JcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gaXRlcmF0b3JcbiAgfVxuXG4gIGZ1bmN0aW9uIEhlYWRlcnMoaGVhZGVycykge1xuICAgIHRoaXMubWFwID0ge31cblxuICAgIGlmIChoZWFkZXJzIGluc3RhbmNlb2YgSGVhZGVycykge1xuICAgICAgaGVhZGVycy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBuYW1lKSB7XG4gICAgICAgIHRoaXMuYXBwZW5kKG5hbWUsIHZhbHVlKVxuICAgICAgfSwgdGhpcylcblxuICAgIH0gZWxzZSBpZiAoaGVhZGVycykge1xuICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoaGVhZGVycykuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHRoaXMuYXBwZW5kKG5hbWUsIGhlYWRlcnNbbmFtZV0pXG4gICAgICB9LCB0aGlzKVxuICAgIH1cbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLmFwcGVuZCA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlKSB7XG4gICAgbmFtZSA9IG5vcm1hbGl6ZU5hbWUobmFtZSlcbiAgICB2YWx1ZSA9IG5vcm1hbGl6ZVZhbHVlKHZhbHVlKVxuICAgIHZhciBsaXN0ID0gdGhpcy5tYXBbbmFtZV1cbiAgICBpZiAoIWxpc3QpIHtcbiAgICAgIGxpc3QgPSBbXVxuICAgICAgdGhpcy5tYXBbbmFtZV0gPSBsaXN0XG4gICAgfVxuICAgIGxpc3QucHVzaCh2YWx1ZSlcbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlWydkZWxldGUnXSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBkZWxldGUgdGhpcy5tYXBbbm9ybWFsaXplTmFtZShuYW1lKV1cbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgdmFsdWVzID0gdGhpcy5tYXBbbm9ybWFsaXplTmFtZShuYW1lKV1cbiAgICByZXR1cm4gdmFsdWVzID8gdmFsdWVzWzBdIDogbnVsbFxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuZ2V0QWxsID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHJldHVybiB0aGlzLm1hcFtub3JtYWxpemVOYW1lKG5hbWUpXSB8fCBbXVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHJldHVybiB0aGlzLm1hcC5oYXNPd25Qcm9wZXJ0eShub3JtYWxpemVOYW1lKG5hbWUpKVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICB0aGlzLm1hcFtub3JtYWxpemVOYW1lKG5hbWUpXSA9IFtub3JtYWxpemVWYWx1ZSh2YWx1ZSldXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24oY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0aGlzLm1hcCkuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICB0aGlzLm1hcFtuYW1lXS5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdmFsdWUsIG5hbWUsIHRoaXMpXG4gICAgICB9LCB0aGlzKVxuICAgIH0sIHRoaXMpXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5rZXlzID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGl0ZW1zID0gW11cbiAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHsgaXRlbXMucHVzaChuYW1lKSB9KVxuICAgIHJldHVybiBpdGVyYXRvckZvcihpdGVtcylcbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLnZhbHVlcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpdGVtcyA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlKSB7IGl0ZW1zLnB1c2godmFsdWUpIH0pXG4gICAgcmV0dXJuIGl0ZXJhdG9yRm9yKGl0ZW1zKVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuZW50cmllcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpdGVtcyA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBuYW1lKSB7IGl0ZW1zLnB1c2goW25hbWUsIHZhbHVlXSkgfSlcbiAgICByZXR1cm4gaXRlcmF0b3JGb3IoaXRlbXMpXG4gIH1cblxuICBpZiAoc3VwcG9ydC5pdGVyYWJsZSkge1xuICAgIEhlYWRlcnMucHJvdG90eXBlW1N5bWJvbC5pdGVyYXRvcl0gPSBIZWFkZXJzLnByb3RvdHlwZS5lbnRyaWVzXG4gIH1cblxuICBmdW5jdGlvbiBjb25zdW1lZChib2R5KSB7XG4gICAgaWYgKGJvZHkuYm9keVVzZWQpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgVHlwZUVycm9yKCdBbHJlYWR5IHJlYWQnKSlcbiAgICB9XG4gICAgYm9keS5ib2R5VXNlZCA9IHRydWVcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbGVSZWFkZXJSZWFkeShyZWFkZXIpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICByZWFkZXIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdClcbiAgICAgIH1cbiAgICAgIHJlYWRlci5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChyZWFkZXIuZXJyb3IpXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRCbG9iQXNBcnJheUJ1ZmZlcihibG9iKSB7XG4gICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKClcbiAgICByZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIoYmxvYilcbiAgICByZXR1cm4gZmlsZVJlYWRlclJlYWR5KHJlYWRlcilcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRCbG9iQXNUZXh0KGJsb2IpIHtcbiAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKVxuICAgIHJlYWRlci5yZWFkQXNUZXh0KGJsb2IpXG4gICAgcmV0dXJuIGZpbGVSZWFkZXJSZWFkeShyZWFkZXIpXG4gIH1cblxuICBmdW5jdGlvbiBCb2R5KCkge1xuICAgIHRoaXMuYm9keVVzZWQgPSBmYWxzZVxuXG4gICAgdGhpcy5faW5pdEJvZHkgPSBmdW5jdGlvbihib2R5KSB7XG4gICAgICB0aGlzLl9ib2R5SW5pdCA9IGJvZHlcbiAgICAgIGlmICh0eXBlb2YgYm9keSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5fYm9keVRleHQgPSBib2R5XG4gICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuYmxvYiAmJiBCbG9iLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlCbG9iID0gYm9keVxuICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LmZvcm1EYXRhICYmIEZvcm1EYXRhLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlGb3JtRGF0YSA9IGJvZHlcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5zZWFyY2hQYXJhbXMgJiYgVVJMU2VhcmNoUGFyYW1zLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlUZXh0ID0gYm9keS50b1N0cmluZygpXG4gICAgICB9IGVsc2UgaWYgKCFib2R5KSB7XG4gICAgICAgIHRoaXMuX2JvZHlUZXh0ID0gJydcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5hcnJheUJ1ZmZlciAmJiBBcnJheUJ1ZmZlci5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICAvLyBPbmx5IHN1cHBvcnQgQXJyYXlCdWZmZXJzIGZvciBQT1NUIG1ldGhvZC5cbiAgICAgICAgLy8gUmVjZWl2aW5nIEFycmF5QnVmZmVycyBoYXBwZW5zIHZpYSBCbG9icywgaW5zdGVhZC5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigndW5zdXBwb3J0ZWQgQm9keUluaXQgdHlwZScpXG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5oZWFkZXJzLmdldCgnY29udGVudC10eXBlJykpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBib2R5ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRoaXMuaGVhZGVycy5zZXQoJ2NvbnRlbnQtdHlwZScsICd0ZXh0L3BsYWluO2NoYXJzZXQ9VVRGLTgnKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlCbG9iICYmIHRoaXMuX2JvZHlCbG9iLnR5cGUpIHtcbiAgICAgICAgICB0aGlzLmhlYWRlcnMuc2V0KCdjb250ZW50LXR5cGUnLCB0aGlzLl9ib2R5QmxvYi50eXBlKVxuICAgICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuc2VhcmNoUGFyYW1zICYmIFVSTFNlYXJjaFBhcmFtcy5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICAgIHRoaXMuaGVhZGVycy5zZXQoJ2NvbnRlbnQtdHlwZScsICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7Y2hhcnNldD1VVEYtOCcpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3VwcG9ydC5ibG9iKSB7XG4gICAgICB0aGlzLmJsb2IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJlamVjdGVkID0gY29uc3VtZWQodGhpcylcbiAgICAgICAgaWYgKHJlamVjdGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdGVkXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYm9keUJsb2IpIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2JvZHlCbG9iKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlGb3JtRGF0YSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignY291bGQgbm90IHJlYWQgRm9ybURhdGEgYm9keSBhcyBibG9iJylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG5ldyBCbG9iKFt0aGlzLl9ib2R5VGV4dF0pKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMuYXJyYXlCdWZmZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmxvYigpLnRoZW4ocmVhZEJsb2JBc0FycmF5QnVmZmVyKVxuICAgICAgfVxuXG4gICAgICB0aGlzLnRleHQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJlamVjdGVkID0gY29uc3VtZWQodGhpcylcbiAgICAgICAgaWYgKHJlamVjdGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdGVkXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYm9keUJsb2IpIHtcbiAgICAgICAgICByZXR1cm4gcmVhZEJsb2JBc1RleHQodGhpcy5fYm9keUJsb2IpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYm9keUZvcm1EYXRhKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb3VsZCBub3QgcmVhZCBGb3JtRGF0YSBib2R5IGFzIHRleHQnKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fYm9keVRleHQpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy50ZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByZWplY3RlZCA9IGNvbnN1bWVkKHRoaXMpXG4gICAgICAgIHJldHVybiByZWplY3RlZCA/IHJlamVjdGVkIDogUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2JvZHlUZXh0KVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdXBwb3J0LmZvcm1EYXRhKSB7XG4gICAgICB0aGlzLmZvcm1EYXRhID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRleHQoKS50aGVuKGRlY29kZSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmpzb24gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLnRleHQoKS50aGVuKEpTT04ucGFyc2UpXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8vIEhUVFAgbWV0aG9kcyB3aG9zZSBjYXBpdGFsaXphdGlvbiBzaG91bGQgYmUgbm9ybWFsaXplZFxuICB2YXIgbWV0aG9kcyA9IFsnREVMRVRFJywgJ0dFVCcsICdIRUFEJywgJ09QVElPTlMnLCAnUE9TVCcsICdQVVQnXVxuXG4gIGZ1bmN0aW9uIG5vcm1hbGl6ZU1ldGhvZChtZXRob2QpIHtcbiAgICB2YXIgdXBjYXNlZCA9IG1ldGhvZC50b1VwcGVyQ2FzZSgpXG4gICAgcmV0dXJuIChtZXRob2RzLmluZGV4T2YodXBjYXNlZCkgPiAtMSkgPyB1cGNhc2VkIDogbWV0aG9kXG4gIH1cblxuICBmdW5jdGlvbiBSZXF1ZXN0KGlucHV0LCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgICB2YXIgYm9keSA9IG9wdGlvbnMuYm9keVxuICAgIGlmIChSZXF1ZXN0LnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGlucHV0KSkge1xuICAgICAgaWYgKGlucHV0LmJvZHlVc2VkKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FscmVhZHkgcmVhZCcpXG4gICAgICB9XG4gICAgICB0aGlzLnVybCA9IGlucHV0LnVybFxuICAgICAgdGhpcy5jcmVkZW50aWFscyA9IGlucHV0LmNyZWRlbnRpYWxzXG4gICAgICBpZiAoIW9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICB0aGlzLmhlYWRlcnMgPSBuZXcgSGVhZGVycyhpbnB1dC5oZWFkZXJzKVxuICAgICAgfVxuICAgICAgdGhpcy5tZXRob2QgPSBpbnB1dC5tZXRob2RcbiAgICAgIHRoaXMubW9kZSA9IGlucHV0Lm1vZGVcbiAgICAgIGlmICghYm9keSkge1xuICAgICAgICBib2R5ID0gaW5wdXQuX2JvZHlJbml0XG4gICAgICAgIGlucHV0LmJvZHlVc2VkID0gdHJ1ZVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnVybCA9IGlucHV0XG4gICAgfVxuXG4gICAgdGhpcy5jcmVkZW50aWFscyA9IG9wdGlvbnMuY3JlZGVudGlhbHMgfHwgdGhpcy5jcmVkZW50aWFscyB8fCAnb21pdCdcbiAgICBpZiAob3B0aW9ucy5oZWFkZXJzIHx8ICF0aGlzLmhlYWRlcnMpIHtcbiAgICAgIHRoaXMuaGVhZGVycyA9IG5ldyBIZWFkZXJzKG9wdGlvbnMuaGVhZGVycylcbiAgICB9XG4gICAgdGhpcy5tZXRob2QgPSBub3JtYWxpemVNZXRob2Qob3B0aW9ucy5tZXRob2QgfHwgdGhpcy5tZXRob2QgfHwgJ0dFVCcpXG4gICAgdGhpcy5tb2RlID0gb3B0aW9ucy5tb2RlIHx8IHRoaXMubW9kZSB8fCBudWxsXG4gICAgdGhpcy5yZWZlcnJlciA9IG51bGxcblxuICAgIGlmICgodGhpcy5tZXRob2QgPT09ICdHRVQnIHx8IHRoaXMubWV0aG9kID09PSAnSEVBRCcpICYmIGJvZHkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0JvZHkgbm90IGFsbG93ZWQgZm9yIEdFVCBvciBIRUFEIHJlcXVlc3RzJylcbiAgICB9XG4gICAgdGhpcy5faW5pdEJvZHkoYm9keSlcbiAgfVxuXG4gIFJlcXVlc3QucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBSZXF1ZXN0KHRoaXMpXG4gIH1cblxuICBmdW5jdGlvbiBkZWNvZGUoYm9keSkge1xuICAgIHZhciBmb3JtID0gbmV3IEZvcm1EYXRhKClcbiAgICBib2R5LnRyaW0oKS5zcGxpdCgnJicpLmZvckVhY2goZnVuY3Rpb24oYnl0ZXMpIHtcbiAgICAgIGlmIChieXRlcykge1xuICAgICAgICB2YXIgc3BsaXQgPSBieXRlcy5zcGxpdCgnPScpXG4gICAgICAgIHZhciBuYW1lID0gc3BsaXQuc2hpZnQoKS5yZXBsYWNlKC9cXCsvZywgJyAnKVxuICAgICAgICB2YXIgdmFsdWUgPSBzcGxpdC5qb2luKCc9JykucmVwbGFjZSgvXFwrL2csICcgJylcbiAgICAgICAgZm9ybS5hcHBlbmQoZGVjb2RlVVJJQ29tcG9uZW50KG5hbWUpLCBkZWNvZGVVUklDb21wb25lbnQodmFsdWUpKVxuICAgICAgfVxuICAgIH0pXG4gICAgcmV0dXJuIGZvcm1cbiAgfVxuXG4gIGZ1bmN0aW9uIGhlYWRlcnMoeGhyKSB7XG4gICAgdmFyIGhlYWQgPSBuZXcgSGVhZGVycygpXG4gICAgdmFyIHBhaXJzID0gKHhoci5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKSB8fCAnJykudHJpbSgpLnNwbGl0KCdcXG4nKVxuICAgIHBhaXJzLmZvckVhY2goZnVuY3Rpb24oaGVhZGVyKSB7XG4gICAgICB2YXIgc3BsaXQgPSBoZWFkZXIudHJpbSgpLnNwbGl0KCc6JylcbiAgICAgIHZhciBrZXkgPSBzcGxpdC5zaGlmdCgpLnRyaW0oKVxuICAgICAgdmFyIHZhbHVlID0gc3BsaXQuam9pbignOicpLnRyaW0oKVxuICAgICAgaGVhZC5hcHBlbmQoa2V5LCB2YWx1ZSlcbiAgICB9KVxuICAgIHJldHVybiBoZWFkXG4gIH1cblxuICBCb2R5LmNhbGwoUmVxdWVzdC5wcm90b3R5cGUpXG5cbiAgZnVuY3Rpb24gUmVzcG9uc2UoYm9keUluaXQsIG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMpIHtcbiAgICAgIG9wdGlvbnMgPSB7fVxuICAgIH1cblxuICAgIHRoaXMudHlwZSA9ICdkZWZhdWx0J1xuICAgIHRoaXMuc3RhdHVzID0gb3B0aW9ucy5zdGF0dXNcbiAgICB0aGlzLm9rID0gdGhpcy5zdGF0dXMgPj0gMjAwICYmIHRoaXMuc3RhdHVzIDwgMzAwXG4gICAgdGhpcy5zdGF0dXNUZXh0ID0gb3B0aW9ucy5zdGF0dXNUZXh0XG4gICAgdGhpcy5oZWFkZXJzID0gb3B0aW9ucy5oZWFkZXJzIGluc3RhbmNlb2YgSGVhZGVycyA/IG9wdGlvbnMuaGVhZGVycyA6IG5ldyBIZWFkZXJzKG9wdGlvbnMuaGVhZGVycylcbiAgICB0aGlzLnVybCA9IG9wdGlvbnMudXJsIHx8ICcnXG4gICAgdGhpcy5faW5pdEJvZHkoYm9keUluaXQpXG4gIH1cblxuICBCb2R5LmNhbGwoUmVzcG9uc2UucHJvdG90eXBlKVxuXG4gIFJlc3BvbnNlLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UodGhpcy5fYm9keUluaXQsIHtcbiAgICAgIHN0YXR1czogdGhpcy5zdGF0dXMsXG4gICAgICBzdGF0dXNUZXh0OiB0aGlzLnN0YXR1c1RleHQsXG4gICAgICBoZWFkZXJzOiBuZXcgSGVhZGVycyh0aGlzLmhlYWRlcnMpLFxuICAgICAgdXJsOiB0aGlzLnVybFxuICAgIH0pXG4gIH1cblxuICBSZXNwb25zZS5lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZXNwb25zZSA9IG5ldyBSZXNwb25zZShudWxsLCB7c3RhdHVzOiAwLCBzdGF0dXNUZXh0OiAnJ30pXG4gICAgcmVzcG9uc2UudHlwZSA9ICdlcnJvcidcbiAgICByZXR1cm4gcmVzcG9uc2VcbiAgfVxuXG4gIHZhciByZWRpcmVjdFN0YXR1c2VzID0gWzMwMSwgMzAyLCAzMDMsIDMwNywgMzA4XVxuXG4gIFJlc3BvbnNlLnJlZGlyZWN0ID0gZnVuY3Rpb24odXJsLCBzdGF0dXMpIHtcbiAgICBpZiAocmVkaXJlY3RTdGF0dXNlcy5pbmRleE9mKHN0YXR1cykgPT09IC0xKSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW52YWxpZCBzdGF0dXMgY29kZScpXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShudWxsLCB7c3RhdHVzOiBzdGF0dXMsIGhlYWRlcnM6IHtsb2NhdGlvbjogdXJsfX0pXG4gIH1cblxuICBzZWxmLkhlYWRlcnMgPSBIZWFkZXJzXG4gIHNlbGYuUmVxdWVzdCA9IFJlcXVlc3RcbiAgc2VsZi5SZXNwb25zZSA9IFJlc3BvbnNlXG5cbiAgc2VsZi5mZXRjaCA9IGZ1bmN0aW9uKGlucHV0LCBpbml0KSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgdmFyIHJlcXVlc3RcbiAgICAgIGlmIChSZXF1ZXN0LnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGlucHV0KSAmJiAhaW5pdCkge1xuICAgICAgICByZXF1ZXN0ID0gaW5wdXRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlcXVlc3QgPSBuZXcgUmVxdWVzdChpbnB1dCwgaW5pdClcbiAgICAgIH1cblxuICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpXG5cbiAgICAgIGZ1bmN0aW9uIHJlc3BvbnNlVVJMKCkge1xuICAgICAgICBpZiAoJ3Jlc3BvbnNlVVJMJyBpbiB4aHIpIHtcbiAgICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlVVJMXG4gICAgICAgIH1cblxuICAgICAgICAvLyBBdm9pZCBzZWN1cml0eSB3YXJuaW5ncyBvbiBnZXRSZXNwb25zZUhlYWRlciB3aGVuIG5vdCBhbGxvd2VkIGJ5IENPUlNcbiAgICAgICAgaWYgKC9eWC1SZXF1ZXN0LVVSTDovbS50ZXN0KHhoci5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKSkpIHtcbiAgICAgICAgICByZXR1cm4geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdYLVJlcXVlc3QtVVJMJylcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICAgIHN0YXR1czogeGhyLnN0YXR1cyxcbiAgICAgICAgICBzdGF0dXNUZXh0OiB4aHIuc3RhdHVzVGV4dCxcbiAgICAgICAgICBoZWFkZXJzOiBoZWFkZXJzKHhociksXG4gICAgICAgICAgdXJsOiByZXNwb25zZVVSTCgpXG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJvZHkgPSAncmVzcG9uc2UnIGluIHhociA/IHhoci5yZXNwb25zZSA6IHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgcmVzb2x2ZShuZXcgUmVzcG9uc2UoYm9keSwgb3B0aW9ucykpXG4gICAgICB9XG5cbiAgICAgIHhoci5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChuZXcgVHlwZUVycm9yKCdOZXR3b3JrIHJlcXVlc3QgZmFpbGVkJykpXG4gICAgICB9XG5cbiAgICAgIHhoci5vbnRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ05ldHdvcmsgcmVxdWVzdCBmYWlsZWQnKSlcbiAgICAgIH1cblxuICAgICAgeGhyLm9wZW4ocmVxdWVzdC5tZXRob2QsIHJlcXVlc3QudXJsLCB0cnVlKVxuXG4gICAgICBpZiAocmVxdWVzdC5jcmVkZW50aWFscyA9PT0gJ2luY2x1ZGUnKSB7XG4gICAgICAgIHhoci53aXRoQ3JlZGVudGlhbHMgPSB0cnVlXG4gICAgICB9XG5cbiAgICAgIGlmICgncmVzcG9uc2VUeXBlJyBpbiB4aHIgJiYgc3VwcG9ydC5ibG9iKSB7XG4gICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYmxvYidcbiAgICAgIH1cblxuICAgICAgcmVxdWVzdC5oZWFkZXJzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHtcbiAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIobmFtZSwgdmFsdWUpXG4gICAgICB9KVxuXG4gICAgICB4aHIuc2VuZCh0eXBlb2YgcmVxdWVzdC5fYm9keUluaXQgPT09ICd1bmRlZmluZWQnID8gbnVsbCA6IHJlcXVlc3QuX2JvZHlJbml0KVxuICAgIH0pXG4gIH1cbiAgc2VsZi5mZXRjaC5wb2x5ZmlsbCA9IHRydWVcbn0pKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJyA/IHNlbGYgOiB0aGlzKTtcbiIsInZhciBiZWwgPSByZXF1aXJlKCdiZWwnKSAvLyB0dXJucyB0ZW1wbGF0ZSB0YWcgaW50byBET00gZWxlbWVudHNcbnZhciBtb3JwaGRvbSA9IHJlcXVpcmUoJ21vcnBoZG9tJykgLy8gZWZmaWNpZW50bHkgZGlmZnMgKyBtb3JwaHMgdHdvIERPTSBlbGVtZW50c1xudmFyIGRlZmF1bHRFdmVudHMgPSByZXF1aXJlKCcuL3VwZGF0ZS1ldmVudHMuanMnKSAvLyBkZWZhdWx0IGV2ZW50cyB0byBiZSBjb3BpZWQgd2hlbiBkb20gZWxlbWVudHMgdXBkYXRlXG5cbm1vZHVsZS5leHBvcnRzID0gYmVsXG5cbi8vIFRPRE8gbW92ZSB0aGlzICsgZGVmYXVsdEV2ZW50cyB0byBhIG5ldyBtb2R1bGUgb25jZSB3ZSByZWNlaXZlIG1vcmUgZmVlZGJhY2tcbm1vZHVsZS5leHBvcnRzLnVwZGF0ZSA9IGZ1bmN0aW9uIChmcm9tTm9kZSwgdG9Ob2RlLCBvcHRzKSB7XG4gIGlmICghb3B0cykgb3B0cyA9IHt9XG4gIGlmIChvcHRzLmV2ZW50cyAhPT0gZmFsc2UpIHtcbiAgICBpZiAoIW9wdHMub25CZWZvcmVFbFVwZGF0ZWQpIG9wdHMub25CZWZvcmVFbFVwZGF0ZWQgPSBjb3BpZXJcbiAgfVxuXG4gIHJldHVybiBtb3JwaGRvbShmcm9tTm9kZSwgdG9Ob2RlLCBvcHRzKVxuXG4gIC8vIG1vcnBoZG9tIG9ubHkgY29waWVzIGF0dHJpYnV0ZXMuIHdlIGRlY2lkZWQgd2UgYWxzbyB3YW50ZWQgdG8gY29weSBldmVudHNcbiAgLy8gdGhhdCBjYW4gYmUgc2V0IHZpYSBhdHRyaWJ1dGVzXG4gIGZ1bmN0aW9uIGNvcGllciAoZiwgdCkge1xuICAgIC8vIGNvcHkgZXZlbnRzOlxuICAgIHZhciBldmVudHMgPSBvcHRzLmV2ZW50cyB8fCBkZWZhdWx0RXZlbnRzXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBldmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBldiA9IGV2ZW50c1tpXVxuICAgICAgaWYgKHRbZXZdKSB7IC8vIGlmIG5ldyBlbGVtZW50IGhhcyBhIHdoaXRlbGlzdGVkIGF0dHJpYnV0ZVxuICAgICAgICBmW2V2XSA9IHRbZXZdIC8vIHVwZGF0ZSBleGlzdGluZyBlbGVtZW50XG4gICAgICB9IGVsc2UgaWYgKGZbZXZdKSB7IC8vIGlmIGV4aXN0aW5nIGVsZW1lbnQgaGFzIGl0IGFuZCBuZXcgb25lIGRvZXNudFxuICAgICAgICBmW2V2XSA9IHVuZGVmaW5lZCAvLyByZW1vdmUgaXQgZnJvbSBleGlzdGluZyBlbGVtZW50XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGNvcHkgdmFsdWVzIGZvciBmb3JtIGVsZW1lbnRzXG4gICAgaWYgKChmLm5vZGVOYW1lID09PSAnSU5QVVQnICYmIGYudHlwZSAhPT0gJ2ZpbGUnKSB8fCBmLm5vZGVOYW1lID09PSAnU0VMRUNUJykge1xuICAgICAgaWYgKHQuZ2V0QXR0cmlidXRlKCd2YWx1ZScpID09PSBudWxsKSB0LnZhbHVlID0gZi52YWx1ZVxuICAgIH0gZWxzZSBpZiAoZi5ub2RlTmFtZSA9PT0gJ1RFWFRBUkVBJykge1xuICAgICAgaWYgKHQuZ2V0QXR0cmlidXRlKCd2YWx1ZScpID09PSBudWxsKSBmLnZhbHVlID0gdC52YWx1ZVxuICAgIH1cbiAgfVxufVxuIiwidmFyIGRvY3VtZW50ID0gcmVxdWlyZSgnZ2xvYmFsL2RvY3VtZW50JylcclxudmFyIGh5cGVyeCA9IHJlcXVpcmUoJ2h5cGVyeCcpXHJcbnZhciBvbmxvYWQgPSByZXF1aXJlKCdvbi1sb2FkJylcclxuXHJcbnZhciBTVkdOUyA9ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZydcclxudmFyIFhMSU5LTlMgPSAnaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluaydcclxuXHJcbnZhciBCT09MX1BST1BTID0ge1xyXG4gIGF1dG9mb2N1czogMSxcclxuICBjaGVja2VkOiAxLFxyXG4gIGRlZmF1bHRjaGVja2VkOiAxLFxyXG4gIGRpc2FibGVkOiAxLFxyXG4gIGZvcm1ub3ZhbGlkYXRlOiAxLFxyXG4gIGluZGV0ZXJtaW5hdGU6IDEsXHJcbiAgcmVhZG9ubHk6IDEsXHJcbiAgcmVxdWlyZWQ6IDEsXHJcbiAgc2VsZWN0ZWQ6IDEsXHJcbiAgd2lsbHZhbGlkYXRlOiAxXHJcbn1cclxudmFyIFNWR19UQUdTID0gW1xyXG4gICdzdmcnLFxyXG4gICdhbHRHbHlwaCcsICdhbHRHbHlwaERlZicsICdhbHRHbHlwaEl0ZW0nLCAnYW5pbWF0ZScsICdhbmltYXRlQ29sb3InLFxyXG4gICdhbmltYXRlTW90aW9uJywgJ2FuaW1hdGVUcmFuc2Zvcm0nLCAnY2lyY2xlJywgJ2NsaXBQYXRoJywgJ2NvbG9yLXByb2ZpbGUnLFxyXG4gICdjdXJzb3InLCAnZGVmcycsICdkZXNjJywgJ2VsbGlwc2UnLCAnZmVCbGVuZCcsICdmZUNvbG9yTWF0cml4JyxcclxuICAnZmVDb21wb25lbnRUcmFuc2ZlcicsICdmZUNvbXBvc2l0ZScsICdmZUNvbnZvbHZlTWF0cml4JywgJ2ZlRGlmZnVzZUxpZ2h0aW5nJyxcclxuICAnZmVEaXNwbGFjZW1lbnRNYXAnLCAnZmVEaXN0YW50TGlnaHQnLCAnZmVGbG9vZCcsICdmZUZ1bmNBJywgJ2ZlRnVuY0InLFxyXG4gICdmZUZ1bmNHJywgJ2ZlRnVuY1InLCAnZmVHYXVzc2lhbkJsdXInLCAnZmVJbWFnZScsICdmZU1lcmdlJywgJ2ZlTWVyZ2VOb2RlJyxcclxuICAnZmVNb3JwaG9sb2d5JywgJ2ZlT2Zmc2V0JywgJ2ZlUG9pbnRMaWdodCcsICdmZVNwZWN1bGFyTGlnaHRpbmcnLFxyXG4gICdmZVNwb3RMaWdodCcsICdmZVRpbGUnLCAnZmVUdXJidWxlbmNlJywgJ2ZpbHRlcicsICdmb250JywgJ2ZvbnQtZmFjZScsXHJcbiAgJ2ZvbnQtZmFjZS1mb3JtYXQnLCAnZm9udC1mYWNlLW5hbWUnLCAnZm9udC1mYWNlLXNyYycsICdmb250LWZhY2UtdXJpJyxcclxuICAnZm9yZWlnbk9iamVjdCcsICdnJywgJ2dseXBoJywgJ2dseXBoUmVmJywgJ2hrZXJuJywgJ2ltYWdlJywgJ2xpbmUnLFxyXG4gICdsaW5lYXJHcmFkaWVudCcsICdtYXJrZXInLCAnbWFzaycsICdtZXRhZGF0YScsICdtaXNzaW5nLWdseXBoJywgJ21wYXRoJyxcclxuICAncGF0aCcsICdwYXR0ZXJuJywgJ3BvbHlnb24nLCAncG9seWxpbmUnLCAncmFkaWFsR3JhZGllbnQnLCAncmVjdCcsXHJcbiAgJ3NldCcsICdzdG9wJywgJ3N3aXRjaCcsICdzeW1ib2wnLCAndGV4dCcsICd0ZXh0UGF0aCcsICd0aXRsZScsICd0cmVmJyxcclxuICAndHNwYW4nLCAndXNlJywgJ3ZpZXcnLCAndmtlcm4nXHJcbl1cclxuXHJcbmZ1bmN0aW9uIGJlbENyZWF0ZUVsZW1lbnQgKHRhZywgcHJvcHMsIGNoaWxkcmVuKSB7XHJcbiAgdmFyIGVsXHJcblxyXG4gIC8vIElmIGFuIHN2ZyB0YWcsIGl0IG5lZWRzIGEgbmFtZXNwYWNlXHJcbiAgaWYgKFNWR19UQUdTLmluZGV4T2YodGFnKSAhPT0gLTEpIHtcclxuICAgIHByb3BzLm5hbWVzcGFjZSA9IFNWR05TXHJcbiAgfVxyXG5cclxuICAvLyBJZiB3ZSBhcmUgdXNpbmcgYSBuYW1lc3BhY2VcclxuICB2YXIgbnMgPSBmYWxzZVxyXG4gIGlmIChwcm9wcy5uYW1lc3BhY2UpIHtcclxuICAgIG5zID0gcHJvcHMubmFtZXNwYWNlXHJcbiAgICBkZWxldGUgcHJvcHMubmFtZXNwYWNlXHJcbiAgfVxyXG5cclxuICAvLyBDcmVhdGUgdGhlIGVsZW1lbnRcclxuICBpZiAobnMpIHtcclxuICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKG5zLCB0YWcpXHJcbiAgfSBlbHNlIHtcclxuICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpXHJcbiAgfVxyXG5cclxuICAvLyBJZiBhZGRpbmcgb25sb2FkIGV2ZW50c1xyXG4gIGlmIChwcm9wcy5vbmxvYWQgfHwgcHJvcHMub251bmxvYWQpIHtcclxuICAgIHZhciBsb2FkID0gcHJvcHMub25sb2FkIHx8IGZ1bmN0aW9uICgpIHt9XHJcbiAgICB2YXIgdW5sb2FkID0gcHJvcHMub251bmxvYWQgfHwgZnVuY3Rpb24gKCkge31cclxuICAgIG9ubG9hZChlbCwgZnVuY3Rpb24gYmVsT25sb2FkICgpIHtcclxuICAgICAgbG9hZChlbClcclxuICAgIH0sIGZ1bmN0aW9uIGJlbE9udW5sb2FkICgpIHtcclxuICAgICAgdW5sb2FkKGVsKVxyXG4gICAgfSxcclxuICAgIC8vIFdlIGhhdmUgdG8gdXNlIG5vbi1zdGFuZGFyZCBgY2FsbGVyYCB0byBmaW5kIHdobyBpbnZva2VzIGBiZWxDcmVhdGVFbGVtZW50YFxyXG4gICAgYmVsQ3JlYXRlRWxlbWVudC5jYWxsZXIuY2FsbGVyLmNhbGxlcilcclxuICAgIGRlbGV0ZSBwcm9wcy5vbmxvYWRcclxuICAgIGRlbGV0ZSBwcm9wcy5vbnVubG9hZFxyXG4gIH1cclxuXHJcbiAgLy8gQ3JlYXRlIHRoZSBwcm9wZXJ0aWVzXHJcbiAgZm9yICh2YXIgcCBpbiBwcm9wcykge1xyXG4gICAgaWYgKHByb3BzLmhhc093blByb3BlcnR5KHApKSB7XHJcbiAgICAgIHZhciBrZXkgPSBwLnRvTG93ZXJDYXNlKClcclxuICAgICAgdmFyIHZhbCA9IHByb3BzW3BdXHJcbiAgICAgIC8vIE5vcm1hbGl6ZSBjbGFzc05hbWVcclxuICAgICAgaWYgKGtleSA9PT0gJ2NsYXNzbmFtZScpIHtcclxuICAgICAgICBrZXkgPSAnY2xhc3MnXHJcbiAgICAgICAgcCA9ICdjbGFzcydcclxuICAgICAgfVxyXG4gICAgICAvLyBUaGUgZm9yIGF0dHJpYnV0ZSBnZXRzIHRyYW5zZm9ybWVkIHRvIGh0bWxGb3IsIGJ1dCB3ZSBqdXN0IHNldCBhcyBmb3JcclxuICAgICAgaWYgKHAgPT09ICdodG1sRm9yJykge1xyXG4gICAgICAgIHAgPSAnZm9yJ1xyXG4gICAgICB9XHJcbiAgICAgIC8vIElmIGEgcHJvcGVydHkgaXMgYm9vbGVhbiwgc2V0IGl0c2VsZiB0byB0aGUga2V5XHJcbiAgICAgIGlmIChCT09MX1BST1BTW2tleV0pIHtcclxuICAgICAgICBpZiAodmFsID09PSAndHJ1ZScpIHZhbCA9IGtleVxyXG4gICAgICAgIGVsc2UgaWYgKHZhbCA9PT0gJ2ZhbHNlJykgY29udGludWVcclxuICAgICAgfVxyXG4gICAgICAvLyBJZiBhIHByb3BlcnR5IHByZWZlcnMgYmVpbmcgc2V0IGRpcmVjdGx5IHZzIHNldEF0dHJpYnV0ZVxyXG4gICAgICBpZiAoa2V5LnNsaWNlKDAsIDIpID09PSAnb24nKSB7XHJcbiAgICAgICAgZWxbcF0gPSB2YWxcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBpZiAobnMpIHtcclxuICAgICAgICAgIGlmIChwID09PSAneGxpbms6aHJlZicpIHtcclxuICAgICAgICAgICAgZWwuc2V0QXR0cmlidXRlTlMoWExJTktOUywgcCwgdmFsKVxyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgZWwuc2V0QXR0cmlidXRlTlMobnVsbCwgcCwgdmFsKVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBlbC5zZXRBdHRyaWJ1dGUocCwgdmFsKVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gYXBwZW5kQ2hpbGQgKGNoaWxkcykge1xyXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGNoaWxkcykpIHJldHVyblxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgdmFyIG5vZGUgPSBjaGlsZHNbaV1cclxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkobm9kZSkpIHtcclxuICAgICAgICBhcHBlbmRDaGlsZChub2RlKVxyXG4gICAgICAgIGNvbnRpbnVlXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICh0eXBlb2Ygbm9kZSA9PT0gJ251bWJlcicgfHxcclxuICAgICAgICB0eXBlb2Ygbm9kZSA9PT0gJ2Jvb2xlYW4nIHx8XHJcbiAgICAgICAgbm9kZSBpbnN0YW5jZW9mIERhdGUgfHxcclxuICAgICAgICBub2RlIGluc3RhbmNlb2YgUmVnRXhwKSB7XHJcbiAgICAgICAgbm9kZSA9IG5vZGUudG9TdHJpbmcoKVxyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAodHlwZW9mIG5vZGUgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgaWYgKGVsLmxhc3RDaGlsZCAmJiBlbC5sYXN0Q2hpbGQubm9kZU5hbWUgPT09ICcjdGV4dCcpIHtcclxuICAgICAgICAgIGVsLmxhc3RDaGlsZC5ub2RlVmFsdWUgKz0gbm9kZVxyXG4gICAgICAgICAgY29udGludWVcclxuICAgICAgICB9XHJcbiAgICAgICAgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKG5vZGUpXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChub2RlICYmIG5vZGUubm9kZVR5cGUpIHtcclxuICAgICAgICBlbC5hcHBlbmRDaGlsZChub2RlKVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG4gIGFwcGVuZENoaWxkKGNoaWxkcmVuKVxyXG5cclxuICByZXR1cm4gZWxcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBoeXBlcngoYmVsQ3JlYXRlRWxlbWVudClcclxubW9kdWxlLmV4cG9ydHMuY3JlYXRlRWxlbWVudCA9IGJlbENyZWF0ZUVsZW1lbnRcclxuIiwidmFyIHRvcExldmVsID0gdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWwgOlxuICAgIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDoge31cbnZhciBtaW5Eb2MgPSByZXF1aXJlKCdtaW4tZG9jdW1lbnQnKTtcblxuaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGRvY3VtZW50O1xufSBlbHNlIHtcbiAgICB2YXIgZG9jY3kgPSB0b3BMZXZlbFsnX19HTE9CQUxfRE9DVU1FTlRfQ0FDSEVANCddO1xuXG4gICAgaWYgKCFkb2NjeSkge1xuICAgICAgICBkb2NjeSA9IHRvcExldmVsWydfX0dMT0JBTF9ET0NVTUVOVF9DQUNIRUA0J10gPSBtaW5Eb2M7XG4gICAgfVxuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBkb2NjeTtcbn1cbiIsImlmICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSB3aW5kb3c7XG59IGVsc2UgaWYgKHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGdsb2JhbDtcbn0gZWxzZSBpZiAodHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIpe1xuICAgIG1vZHVsZS5leHBvcnRzID0gc2VsZjtcbn0gZWxzZSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSB7fTtcbn1cbiIsInZhciBhdHRyVG9Qcm9wID0gcmVxdWlyZSgnaHlwZXJzY3JpcHQtYXR0cmlidXRlLXRvLXByb3BlcnR5JylcblxudmFyIFZBUiA9IDAsIFRFWFQgPSAxLCBPUEVOID0gMiwgQ0xPU0UgPSAzLCBBVFRSID0gNFxudmFyIEFUVFJfS0VZID0gNSwgQVRUUl9LRVlfVyA9IDZcbnZhciBBVFRSX1ZBTFVFX1cgPSA3LCBBVFRSX1ZBTFVFID0gOFxudmFyIEFUVFJfVkFMVUVfU1EgPSA5LCBBVFRSX1ZBTFVFX0RRID0gMTBcbnZhciBBVFRSX0VRID0gMTEsIEFUVFJfQlJFQUsgPSAxMlxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChoLCBvcHRzKSB7XG4gIGggPSBhdHRyVG9Qcm9wKGgpXG4gIGlmICghb3B0cykgb3B0cyA9IHt9XG4gIHZhciBjb25jYXQgPSBvcHRzLmNvbmNhdCB8fCBmdW5jdGlvbiAoYSwgYikge1xuICAgIHJldHVybiBTdHJpbmcoYSkgKyBTdHJpbmcoYilcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAoc3RyaW5ncykge1xuICAgIHZhciBzdGF0ZSA9IFRFWFQsIHJlZyA9ICcnXG4gICAgdmFyIGFyZ2xlbiA9IGFyZ3VtZW50cy5sZW5ndGhcbiAgICB2YXIgcGFydHMgPSBbXVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHJpbmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoaSA8IGFyZ2xlbiAtIDEpIHtcbiAgICAgICAgdmFyIGFyZyA9IGFyZ3VtZW50c1tpKzFdXG4gICAgICAgIHZhciBwID0gcGFyc2Uoc3RyaW5nc1tpXSlcbiAgICAgICAgdmFyIHhzdGF0ZSA9IHN0YXRlXG4gICAgICAgIGlmICh4c3RhdGUgPT09IEFUVFJfVkFMVUVfRFEpIHhzdGF0ZSA9IEFUVFJfVkFMVUVcbiAgICAgICAgaWYgKHhzdGF0ZSA9PT0gQVRUUl9WQUxVRV9TUSkgeHN0YXRlID0gQVRUUl9WQUxVRVxuICAgICAgICBpZiAoeHN0YXRlID09PSBBVFRSX1ZBTFVFX1cpIHhzdGF0ZSA9IEFUVFJfVkFMVUVcbiAgICAgICAgaWYgKHhzdGF0ZSA9PT0gQVRUUikgeHN0YXRlID0gQVRUUl9LRVlcbiAgICAgICAgcC5wdXNoKFsgVkFSLCB4c3RhdGUsIGFyZyBdKVxuICAgICAgICBwYXJ0cy5wdXNoLmFwcGx5KHBhcnRzLCBwKVxuICAgICAgfSBlbHNlIHBhcnRzLnB1c2guYXBwbHkocGFydHMsIHBhcnNlKHN0cmluZ3NbaV0pKVxuICAgIH1cblxuICAgIHZhciB0cmVlID0gW251bGwse30sW11dXG4gICAgdmFyIHN0YWNrID0gW1t0cmVlLC0xXV1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgY3VyID0gc3RhY2tbc3RhY2subGVuZ3RoLTFdWzBdXG4gICAgICB2YXIgcCA9IHBhcnRzW2ldLCBzID0gcFswXVxuICAgICAgaWYgKHMgPT09IE9QRU4gJiYgL15cXC8vLnRlc3QocFsxXSkpIHtcbiAgICAgICAgdmFyIGl4ID0gc3RhY2tbc3RhY2subGVuZ3RoLTFdWzFdXG4gICAgICAgIGlmIChzdGFjay5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgc3RhY2sucG9wKClcbiAgICAgICAgICBzdGFja1tzdGFjay5sZW5ndGgtMV1bMF1bMl1baXhdID0gaChcbiAgICAgICAgICAgIGN1clswXSwgY3VyWzFdLCBjdXJbMl0ubGVuZ3RoID8gY3VyWzJdIDogdW5kZWZpbmVkXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHMgPT09IE9QRU4pIHtcbiAgICAgICAgdmFyIGMgPSBbcFsxXSx7fSxbXV1cbiAgICAgICAgY3VyWzJdLnB1c2goYylcbiAgICAgICAgc3RhY2sucHVzaChbYyxjdXJbMl0ubGVuZ3RoLTFdKVxuICAgICAgfSBlbHNlIGlmIChzID09PSBBVFRSX0tFWSB8fCAocyA9PT0gVkFSICYmIHBbMV0gPT09IEFUVFJfS0VZKSkge1xuICAgICAgICB2YXIga2V5ID0gJydcbiAgICAgICAgdmFyIGNvcHlLZXlcbiAgICAgICAgZm9yICg7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChwYXJ0c1tpXVswXSA9PT0gQVRUUl9LRVkpIHtcbiAgICAgICAgICAgIGtleSA9IGNvbmNhdChrZXksIHBhcnRzW2ldWzFdKVxuICAgICAgICAgIH0gZWxzZSBpZiAocGFydHNbaV1bMF0gPT09IFZBUiAmJiBwYXJ0c1tpXVsxXSA9PT0gQVRUUl9LRVkpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcGFydHNbaV1bMl0gPT09ICdvYmplY3QnICYmICFrZXkpIHtcbiAgICAgICAgICAgICAgZm9yIChjb3B5S2V5IGluIHBhcnRzW2ldWzJdKSB7XG4gICAgICAgICAgICAgICAgaWYgKHBhcnRzW2ldWzJdLmhhc093blByb3BlcnR5KGNvcHlLZXkpICYmICFjdXJbMV1bY29weUtleV0pIHtcbiAgICAgICAgICAgICAgICAgIGN1clsxXVtjb3B5S2V5XSA9IHBhcnRzW2ldWzJdW2NvcHlLZXldXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBrZXkgPSBjb25jYXQoa2V5LCBwYXJ0c1tpXVsyXSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgYnJlYWtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGFydHNbaV1bMF0gPT09IEFUVFJfRVEpIGkrK1xuICAgICAgICB2YXIgaiA9IGlcbiAgICAgICAgZm9yICg7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChwYXJ0c1tpXVswXSA9PT0gQVRUUl9WQUxVRSB8fCBwYXJ0c1tpXVswXSA9PT0gQVRUUl9LRVkpIHtcbiAgICAgICAgICAgIGlmICghY3VyWzFdW2tleV0pIGN1clsxXVtrZXldID0gc3RyZm4ocGFydHNbaV1bMV0pXG4gICAgICAgICAgICBlbHNlIGN1clsxXVtrZXldID0gY29uY2F0KGN1clsxXVtrZXldLCBwYXJ0c1tpXVsxXSlcbiAgICAgICAgICB9IGVsc2UgaWYgKHBhcnRzW2ldWzBdID09PSBWQVJcbiAgICAgICAgICAmJiAocGFydHNbaV1bMV0gPT09IEFUVFJfVkFMVUUgfHwgcGFydHNbaV1bMV0gPT09IEFUVFJfS0VZKSkge1xuICAgICAgICAgICAgaWYgKCFjdXJbMV1ba2V5XSkgY3VyWzFdW2tleV0gPSBzdHJmbihwYXJ0c1tpXVsyXSlcbiAgICAgICAgICAgIGVsc2UgY3VyWzFdW2tleV0gPSBjb25jYXQoY3VyWzFdW2tleV0sIHBhcnRzW2ldWzJdKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoa2V5Lmxlbmd0aCAmJiAhY3VyWzFdW2tleV0gJiYgaSA9PT0galxuICAgICAgICAgICAgJiYgKHBhcnRzW2ldWzBdID09PSBDTE9TRSB8fCBwYXJ0c1tpXVswXSA9PT0gQVRUUl9CUkVBSykpIHtcbiAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2UvaW5mcmFzdHJ1Y3R1cmUuaHRtbCNib29sZWFuLWF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgLy8gZW1wdHkgc3RyaW5nIGlzIGZhbHN5LCBub3Qgd2VsbCBiZWhhdmVkIHZhbHVlIGluIGJyb3dzZXJcbiAgICAgICAgICAgICAgY3VyWzFdW2tleV0gPSBrZXkudG9Mb3dlckNhc2UoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gQVRUUl9LRVkpIHtcbiAgICAgICAgY3VyWzFdW3BbMV1dID0gdHJ1ZVxuICAgICAgfSBlbHNlIGlmIChzID09PSBWQVIgJiYgcFsxXSA9PT0gQVRUUl9LRVkpIHtcbiAgICAgICAgY3VyWzFdW3BbMl1dID0gdHJ1ZVxuICAgICAgfSBlbHNlIGlmIChzID09PSBDTE9TRSkge1xuICAgICAgICBpZiAoc2VsZkNsb3NpbmcoY3VyWzBdKSAmJiBzdGFjay5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgaXggPSBzdGFja1tzdGFjay5sZW5ndGgtMV1bMV1cbiAgICAgICAgICBzdGFjay5wb3AoKVxuICAgICAgICAgIHN0YWNrW3N0YWNrLmxlbmd0aC0xXVswXVsyXVtpeF0gPSBoKFxuICAgICAgICAgICAgY3VyWzBdLCBjdXJbMV0sIGN1clsyXS5sZW5ndGggPyBjdXJbMl0gOiB1bmRlZmluZWRcbiAgICAgICAgICApXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gVkFSICYmIHBbMV0gPT09IFRFWFQpIHtcbiAgICAgICAgaWYgKHBbMl0gPT09IHVuZGVmaW5lZCB8fCBwWzJdID09PSBudWxsKSBwWzJdID0gJydcbiAgICAgICAgZWxzZSBpZiAoIXBbMl0pIHBbMl0gPSBjb25jYXQoJycsIHBbMl0pXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHBbMl1bMF0pKSB7XG4gICAgICAgICAgY3VyWzJdLnB1c2guYXBwbHkoY3VyWzJdLCBwWzJdKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGN1clsyXS5wdXNoKHBbMl0pXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gVEVYVCkge1xuICAgICAgICBjdXJbMl0ucHVzaChwWzFdKVxuICAgICAgfSBlbHNlIGlmIChzID09PSBBVFRSX0VRIHx8IHMgPT09IEFUVFJfQlJFQUspIHtcbiAgICAgICAgLy8gbm8tb3BcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigndW5oYW5kbGVkOiAnICsgcylcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodHJlZVsyXS5sZW5ndGggPiAxICYmIC9eXFxzKiQvLnRlc3QodHJlZVsyXVswXSkpIHtcbiAgICAgIHRyZWVbMl0uc2hpZnQoKVxuICAgIH1cblxuICAgIGlmICh0cmVlWzJdLmxlbmd0aCA+IDJcbiAgICB8fCAodHJlZVsyXS5sZW5ndGggPT09IDIgJiYgL1xcUy8udGVzdCh0cmVlWzJdWzFdKSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ211bHRpcGxlIHJvb3QgZWxlbWVudHMgbXVzdCBiZSB3cmFwcGVkIGluIGFuIGVuY2xvc2luZyB0YWcnXG4gICAgICApXG4gICAgfVxuICAgIGlmIChBcnJheS5pc0FycmF5KHRyZWVbMl1bMF0pICYmIHR5cGVvZiB0cmVlWzJdWzBdWzBdID09PSAnc3RyaW5nJ1xuICAgICYmIEFycmF5LmlzQXJyYXkodHJlZVsyXVswXVsyXSkpIHtcbiAgICAgIHRyZWVbMl1bMF0gPSBoKHRyZWVbMl1bMF1bMF0sIHRyZWVbMl1bMF1bMV0sIHRyZWVbMl1bMF1bMl0pXG4gICAgfVxuICAgIHJldHVybiB0cmVlWzJdWzBdXG5cbiAgICBmdW5jdGlvbiBwYXJzZSAoc3RyKSB7XG4gICAgICB2YXIgcmVzID0gW11cbiAgICAgIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9XKSBzdGF0ZSA9IEFUVFJcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBjID0gc3RyLmNoYXJBdChpKVxuICAgICAgICBpZiAoc3RhdGUgPT09IFRFWFQgJiYgYyA9PT0gJzwnKSB7XG4gICAgICAgICAgaWYgKHJlZy5sZW5ndGgpIHJlcy5wdXNoKFtURVhULCByZWddKVxuICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgc3RhdGUgPSBPUEVOXG4gICAgICAgIH0gZWxzZSBpZiAoYyA9PT0gJz4nICYmICFxdW90KHN0YXRlKSkge1xuICAgICAgICAgIGlmIChzdGF0ZSA9PT0gT1BFTikge1xuICAgICAgICAgICAgcmVzLnB1c2goW09QRU4scmVnXSlcbiAgICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX0tFWSkge1xuICAgICAgICAgICAgcmVzLnB1c2goW0FUVFJfS0VZLHJlZ10pXG4gICAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRSAmJiByZWcubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXMucHVzaChbQVRUUl9WQUxVRSxyZWddKVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXMucHVzaChbQ0xPU0VdKVxuICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgc3RhdGUgPSBURVhUXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IFRFWFQpIHtcbiAgICAgICAgICByZWcgKz0gY1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBPUEVOICYmIC9cXHMvLnRlc3QoYykpIHtcbiAgICAgICAgICByZXMucHVzaChbT1BFTiwgcmVnXSlcbiAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIHN0YXRlID0gQVRUUlxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBPUEVOKSB7XG4gICAgICAgICAgcmVnICs9IGNcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUiAmJiAvW1xcdy1dLy50ZXN0KGMpKSB7XG4gICAgICAgICAgc3RhdGUgPSBBVFRSX0tFWVxuICAgICAgICAgIHJlZyA9IGNcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUiAmJiAvXFxzLy50ZXN0KGMpKSB7XG4gICAgICAgICAgaWYgKHJlZy5sZW5ndGgpIHJlcy5wdXNoKFtBVFRSX0tFWSxyZWddKVxuICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX0JSRUFLXSlcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9LRVkgJiYgL1xccy8udGVzdChjKSkge1xuICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX0tFWSxyZWddKVxuICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgc3RhdGUgPSBBVFRSX0tFWV9XXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfS0VZICYmIGMgPT09ICc9Jykge1xuICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX0tFWSxyZWddLFtBVFRSX0VRXSlcbiAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIHN0YXRlID0gQVRUUl9WQUxVRV9XXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfS0VZKSB7XG4gICAgICAgICAgcmVnICs9IGNcbiAgICAgICAgfSBlbHNlIGlmICgoc3RhdGUgPT09IEFUVFJfS0VZX1cgfHwgc3RhdGUgPT09IEFUVFIpICYmIGMgPT09ICc9Jykge1xuICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX0VRXSlcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJfVkFMVUVfV1xuICAgICAgICB9IGVsc2UgaWYgKChzdGF0ZSA9PT0gQVRUUl9LRVlfVyB8fCBzdGF0ZSA9PT0gQVRUUikgJiYgIS9cXHMvLnRlc3QoYykpIHtcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9CUkVBS10pXG4gICAgICAgICAgaWYgKC9bXFx3LV0vLnRlc3QoYykpIHtcbiAgICAgICAgICAgIHJlZyArPSBjXG4gICAgICAgICAgICBzdGF0ZSA9IEFUVFJfS0VZXG4gICAgICAgICAgfSBlbHNlIHN0YXRlID0gQVRUUlxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFX1cgJiYgYyA9PT0gJ1wiJykge1xuICAgICAgICAgIHN0YXRlID0gQVRUUl9WQUxVRV9EUVxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFX1cgJiYgYyA9PT0gXCInXCIpIHtcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJfVkFMVUVfU1FcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9EUSAmJiBjID09PSAnXCInKSB7XG4gICAgICAgICAgcmVzLnB1c2goW0FUVFJfVkFMVUUscmVnXSxbQVRUUl9CUkVBS10pXG4gICAgICAgICAgcmVnID0gJydcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9TUSAmJiBjID09PSBcIidcIikge1xuICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX1ZBTFVFLHJlZ10sW0FUVFJfQlJFQUtdKVxuICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgc3RhdGUgPSBBVFRSXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUVfVyAmJiAhL1xccy8udGVzdChjKSkge1xuICAgICAgICAgIHN0YXRlID0gQVRUUl9WQUxVRVxuICAgICAgICAgIGktLVxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFICYmIC9cXHMvLnRlc3QoYykpIHtcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9WQUxVRSxyZWddLFtBVFRSX0JSRUFLXSlcbiAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIHN0YXRlID0gQVRUUlxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFIHx8IHN0YXRlID09PSBBVFRSX1ZBTFVFX1NRXG4gICAgICAgIHx8IHN0YXRlID09PSBBVFRSX1ZBTFVFX0RRKSB7XG4gICAgICAgICAgcmVnICs9IGNcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHN0YXRlID09PSBURVhUICYmIHJlZy5sZW5ndGgpIHtcbiAgICAgICAgcmVzLnB1c2goW1RFWFQscmVnXSlcbiAgICAgICAgcmVnID0gJydcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUUgJiYgcmVnLmxlbmd0aCkge1xuICAgICAgICByZXMucHVzaChbQVRUUl9WQUxVRSxyZWddKVxuICAgICAgICByZWcgPSAnJ1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9EUSAmJiByZWcubGVuZ3RoKSB7XG4gICAgICAgIHJlcy5wdXNoKFtBVFRSX1ZBTFVFLHJlZ10pXG4gICAgICAgIHJlZyA9ICcnXG4gICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFX1NRICYmIHJlZy5sZW5ndGgpIHtcbiAgICAgICAgcmVzLnB1c2goW0FUVFJfVkFMVUUscmVnXSlcbiAgICAgICAgcmVnID0gJydcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfS0VZKSB7XG4gICAgICAgIHJlcy5wdXNoKFtBVFRSX0tFWSxyZWddKVxuICAgICAgICByZWcgPSAnJ1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHN0cmZuICh4KSB7XG4gICAgaWYgKHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nKSByZXR1cm4geFxuICAgIGVsc2UgaWYgKHR5cGVvZiB4ID09PSAnc3RyaW5nJykgcmV0dXJuIHhcbiAgICBlbHNlIGlmICh4ICYmIHR5cGVvZiB4ID09PSAnb2JqZWN0JykgcmV0dXJuIHhcbiAgICBlbHNlIHJldHVybiBjb25jYXQoJycsIHgpXG4gIH1cbn1cblxuZnVuY3Rpb24gcXVvdCAoc3RhdGUpIHtcbiAgcmV0dXJuIHN0YXRlID09PSBBVFRSX1ZBTFVFX1NRIHx8IHN0YXRlID09PSBBVFRSX1ZBTFVFX0RRXG59XG5cbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5XG5mdW5jdGlvbiBoYXMgKG9iaiwga2V5KSB7IHJldHVybiBoYXNPd24uY2FsbChvYmosIGtleSkgfVxuXG52YXIgY2xvc2VSRSA9IFJlZ0V4cCgnXignICsgW1xuICAnYXJlYScsICdiYXNlJywgJ2Jhc2Vmb250JywgJ2Jnc291bmQnLCAnYnInLCAnY29sJywgJ2NvbW1hbmQnLCAnZW1iZWQnLFxuICAnZnJhbWUnLCAnaHInLCAnaW1nJywgJ2lucHV0JywgJ2lzaW5kZXgnLCAna2V5Z2VuJywgJ2xpbmsnLCAnbWV0YScsICdwYXJhbScsXG4gICdzb3VyY2UnLCAndHJhY2snLCAnd2JyJyxcbiAgLy8gU1ZHIFRBR1NcbiAgJ2FuaW1hdGUnLCAnYW5pbWF0ZVRyYW5zZm9ybScsICdjaXJjbGUnLCAnY3Vyc29yJywgJ2Rlc2MnLCAnZWxsaXBzZScsXG4gICdmZUJsZW5kJywgJ2ZlQ29sb3JNYXRyaXgnLCAnZmVDb21wb3NpdGUnLFxuICAnZmVDb252b2x2ZU1hdHJpeCcsICdmZURpZmZ1c2VMaWdodGluZycsICdmZURpc3BsYWNlbWVudE1hcCcsXG4gICdmZURpc3RhbnRMaWdodCcsICdmZUZsb29kJywgJ2ZlRnVuY0EnLCAnZmVGdW5jQicsICdmZUZ1bmNHJywgJ2ZlRnVuY1InLFxuICAnZmVHYXVzc2lhbkJsdXInLCAnZmVJbWFnZScsICdmZU1lcmdlTm9kZScsICdmZU1vcnBob2xvZ3knLFxuICAnZmVPZmZzZXQnLCAnZmVQb2ludExpZ2h0JywgJ2ZlU3BlY3VsYXJMaWdodGluZycsICdmZVNwb3RMaWdodCcsICdmZVRpbGUnLFxuICAnZmVUdXJidWxlbmNlJywgJ2ZvbnQtZmFjZS1mb3JtYXQnLCAnZm9udC1mYWNlLW5hbWUnLCAnZm9udC1mYWNlLXVyaScsXG4gICdnbHlwaCcsICdnbHlwaFJlZicsICdoa2VybicsICdpbWFnZScsICdsaW5lJywgJ21pc3NpbmctZ2x5cGgnLCAnbXBhdGgnLFxuICAncGF0aCcsICdwb2x5Z29uJywgJ3BvbHlsaW5lJywgJ3JlY3QnLCAnc2V0JywgJ3N0b3AnLCAndHJlZicsICd1c2UnLCAndmlldycsXG4gICd2a2Vybidcbl0uam9pbignfCcpICsgJykoPzpbXFwuI11bYS16QS1aMC05XFx1MDA3Ri1cXHVGRkZGXzotXSspKiQnKVxuZnVuY3Rpb24gc2VsZkNsb3NpbmcgKHRhZykgeyByZXR1cm4gY2xvc2VSRS50ZXN0KHRhZykgfVxuIiwibW9kdWxlLmV4cG9ydHMgPSBhdHRyaWJ1dGVUb1Byb3BlcnR5XG5cbnZhciB0cmFuc2Zvcm0gPSB7XG4gICdjbGFzcyc6ICdjbGFzc05hbWUnLFxuICAnZm9yJzogJ2h0bWxGb3InLFxuICAnaHR0cC1lcXVpdic6ICdodHRwRXF1aXYnXG59XG5cbmZ1bmN0aW9uIGF0dHJpYnV0ZVRvUHJvcGVydHkgKGgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh0YWdOYW1lLCBhdHRycywgY2hpbGRyZW4pIHtcbiAgICBmb3IgKHZhciBhdHRyIGluIGF0dHJzKSB7XG4gICAgICBpZiAoYXR0ciBpbiB0cmFuc2Zvcm0pIHtcbiAgICAgICAgYXR0cnNbdHJhbnNmb3JtW2F0dHJdXSA9IGF0dHJzW2F0dHJdXG4gICAgICAgIGRlbGV0ZSBhdHRyc1thdHRyXVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaCh0YWdOYW1lLCBhdHRycywgY2hpbGRyZW4pXG4gIH1cbn1cbiIsIi8qIGdsb2JhbCBNdXRhdGlvbk9ic2VydmVyICovXG52YXIgZG9jdW1lbnQgPSByZXF1aXJlKCdnbG9iYWwvZG9jdW1lbnQnKVxudmFyIHdpbmRvdyA9IHJlcXVpcmUoJ2dsb2JhbC93aW5kb3cnKVxudmFyIHdhdGNoID0gT2JqZWN0LmNyZWF0ZShudWxsKVxudmFyIEtFWV9JRCA9ICdvbmxvYWRpZCcgKyAobmV3IERhdGUoKSAlIDllNikudG9TdHJpbmcoMzYpXG52YXIgS0VZX0FUVFIgPSAnZGF0YS0nICsgS0VZX0lEXG52YXIgSU5ERVggPSAwXG5cbmlmICh3aW5kb3cgJiYgd2luZG93Lk11dGF0aW9uT2JzZXJ2ZXIpIHtcbiAgdmFyIG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoZnVuY3Rpb24gKG11dGF0aW9ucykge1xuICAgIGlmIChPYmplY3Qua2V5cyh3YXRjaCkubGVuZ3RoIDwgMSkgcmV0dXJuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtdXRhdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChtdXRhdGlvbnNbaV0uYXR0cmlidXRlTmFtZSA9PT0gS0VZX0FUVFIpIHtcbiAgICAgICAgZWFjaEF0dHIobXV0YXRpb25zW2ldLCB0dXJub24sIHR1cm5vZmYpXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICBlYWNoTXV0YXRpb24obXV0YXRpb25zW2ldLnJlbW92ZWROb2RlcywgdHVybm9mZilcbiAgICAgIGVhY2hNdXRhdGlvbihtdXRhdGlvbnNbaV0uYWRkZWROb2RlcywgdHVybm9uKVxuICAgIH1cbiAgfSlcbiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7XG4gICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgIHN1YnRyZWU6IHRydWUsXG4gICAgYXR0cmlidXRlczogdHJ1ZSxcbiAgICBhdHRyaWJ1dGVPbGRWYWx1ZTogdHJ1ZSxcbiAgICBhdHRyaWJ1dGVGaWx0ZXI6IFtLRVlfQVRUUl1cbiAgfSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBvbmxvYWQgKGVsLCBvbiwgb2ZmLCBjYWxsZXIpIHtcbiAgb24gPSBvbiB8fCBmdW5jdGlvbiAoKSB7fVxuICBvZmYgPSBvZmYgfHwgZnVuY3Rpb24gKCkge31cbiAgZWwuc2V0QXR0cmlidXRlKEtFWV9BVFRSLCAnbycgKyBJTkRFWClcbiAgd2F0Y2hbJ28nICsgSU5ERVhdID0gW29uLCBvZmYsIDAsIGNhbGxlciB8fCBvbmxvYWQuY2FsbGVyXVxuICBJTkRFWCArPSAxXG4gIHJldHVybiBlbFxufVxuXG5mdW5jdGlvbiB0dXJub24gKGluZGV4LCBlbCkge1xuICBpZiAod2F0Y2hbaW5kZXhdWzBdICYmIHdhdGNoW2luZGV4XVsyXSA9PT0gMCkge1xuICAgIHdhdGNoW2luZGV4XVswXShlbClcbiAgICB3YXRjaFtpbmRleF1bMl0gPSAxXG4gIH1cbn1cblxuZnVuY3Rpb24gdHVybm9mZiAoaW5kZXgsIGVsKSB7XG4gIGlmICh3YXRjaFtpbmRleF1bMV0gJiYgd2F0Y2hbaW5kZXhdWzJdID09PSAxKSB7XG4gICAgd2F0Y2hbaW5kZXhdWzFdKGVsKVxuICAgIHdhdGNoW2luZGV4XVsyXSA9IDBcbiAgfVxufVxuXG5mdW5jdGlvbiBlYWNoQXR0ciAobXV0YXRpb24sIG9uLCBvZmYpIHtcbiAgdmFyIG5ld1ZhbHVlID0gbXV0YXRpb24udGFyZ2V0LmdldEF0dHJpYnV0ZShLRVlfQVRUUilcbiAgaWYgKHNhbWVPcmlnaW4obXV0YXRpb24ub2xkVmFsdWUsIG5ld1ZhbHVlKSkge1xuICAgIHdhdGNoW25ld1ZhbHVlXSA9IHdhdGNoW211dGF0aW9uLm9sZFZhbHVlXVxuICAgIHJldHVyblxuICB9XG4gIGlmICh3YXRjaFttdXRhdGlvbi5vbGRWYWx1ZV0pIHtcbiAgICBvZmYobXV0YXRpb24ub2xkVmFsdWUsIG11dGF0aW9uLnRhcmdldClcbiAgfVxuICBpZiAod2F0Y2hbbmV3VmFsdWVdKSB7XG4gICAgb24obmV3VmFsdWUsIG11dGF0aW9uLnRhcmdldClcbiAgfVxufVxuXG5mdW5jdGlvbiBzYW1lT3JpZ2luIChvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgaWYgKCFvbGRWYWx1ZSB8fCAhbmV3VmFsdWUpIHJldHVybiBmYWxzZVxuICByZXR1cm4gd2F0Y2hbb2xkVmFsdWVdWzNdID09PSB3YXRjaFtuZXdWYWx1ZV1bM11cbn1cblxuZnVuY3Rpb24gZWFjaE11dGF0aW9uIChub2RlcywgZm4pIHtcbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh3YXRjaClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgIGlmIChub2Rlc1tpXSAmJiBub2Rlc1tpXS5nZXRBdHRyaWJ1dGUgJiYgbm9kZXNbaV0uZ2V0QXR0cmlidXRlKEtFWV9BVFRSKSkge1xuICAgICAgdmFyIG9ubG9hZGlkID0gbm9kZXNbaV0uZ2V0QXR0cmlidXRlKEtFWV9BVFRSKVxuICAgICAga2V5cy5mb3JFYWNoKGZ1bmN0aW9uIChrKSB7XG4gICAgICAgIGlmIChvbmxvYWRpZCA9PT0gaykge1xuICAgICAgICAgIGZuKGssIG5vZGVzW2ldKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgICBpZiAobm9kZXNbaV0uY2hpbGROb2Rlcy5sZW5ndGggPiAwKSB7XG4gICAgICBlYWNoTXV0YXRpb24obm9kZXNbaV0uY2hpbGROb2RlcywgZm4pXG4gICAgfVxuICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG4vLyBDcmVhdGUgYSByYW5nZSBvYmplY3QgZm9yIGVmZmljZW50bHkgcmVuZGVyaW5nIHN0cmluZ3MgdG8gZWxlbWVudHMuXG52YXIgcmFuZ2U7XG5cbnZhciBkb2MgPSB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIGRvY3VtZW50O1xuXG52YXIgdGVzdEVsID0gZG9jID9cbiAgICBkb2MuYm9keSB8fCBkb2MuY3JlYXRlRWxlbWVudCgnZGl2JykgOlxuICAgIHt9O1xuXG52YXIgTlNfWEhUTUwgPSAnaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbCc7XG5cbnZhciBFTEVNRU5UX05PREUgPSAxO1xudmFyIFRFWFRfTk9ERSA9IDM7XG52YXIgQ09NTUVOVF9OT0RFID0gODtcblxuLy8gRml4ZXMgPGh0dHBzOi8vZ2l0aHViLmNvbS9wYXRyaWNrLXN0ZWVsZS1pZGVtL21vcnBoZG9tL2lzc3Vlcy8zMj5cbi8vIChJRTcrIHN1cHBvcnQpIDw9SUU3IGRvZXMgbm90IHN1cHBvcnQgZWwuaGFzQXR0cmlidXRlKG5hbWUpXG52YXIgaGFzQXR0cmlidXRlTlM7XG5cbmlmICh0ZXN0RWwuaGFzQXR0cmlidXRlTlMpIHtcbiAgICBoYXNBdHRyaWJ1dGVOUyA9IGZ1bmN0aW9uKGVsLCBuYW1lc3BhY2VVUkksIG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGVsLmhhc0F0dHJpYnV0ZU5TKG5hbWVzcGFjZVVSSSwgbmFtZSk7XG4gICAgfTtcbn0gZWxzZSBpZiAodGVzdEVsLmhhc0F0dHJpYnV0ZSkge1xuICAgIGhhc0F0dHJpYnV0ZU5TID0gZnVuY3Rpb24oZWwsIG5hbWVzcGFjZVVSSSwgbmFtZSkge1xuICAgICAgICByZXR1cm4gZWwuaGFzQXR0cmlidXRlKG5hbWUpO1xuICAgIH07XG59IGVsc2Uge1xuICAgIGhhc0F0dHJpYnV0ZU5TID0gZnVuY3Rpb24oZWwsIG5hbWVzcGFjZVVSSSwgbmFtZSkge1xuICAgICAgICByZXR1cm4gISFlbC5nZXRBdHRyaWJ1dGVOb2RlKG5hbWUpO1xuICAgIH07XG59XG5cbmZ1bmN0aW9uIHRvRWxlbWVudChzdHIpIHtcbiAgICBpZiAoIXJhbmdlICYmIGRvYy5jcmVhdGVSYW5nZSkge1xuICAgICAgICByYW5nZSA9IGRvYy5jcmVhdGVSYW5nZSgpO1xuICAgICAgICByYW5nZS5zZWxlY3ROb2RlKGRvYy5ib2R5KTtcbiAgICB9XG5cbiAgICB2YXIgZnJhZ21lbnQ7XG4gICAgaWYgKHJhbmdlICYmIHJhbmdlLmNyZWF0ZUNvbnRleHR1YWxGcmFnbWVudCkge1xuICAgICAgICBmcmFnbWVudCA9IHJhbmdlLmNyZWF0ZUNvbnRleHR1YWxGcmFnbWVudChzdHIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGZyYWdtZW50ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2JvZHknKTtcbiAgICAgICAgZnJhZ21lbnQuaW5uZXJIVE1MID0gc3RyO1xuICAgIH1cbiAgICByZXR1cm4gZnJhZ21lbnQuY2hpbGROb2Rlc1swXTtcbn1cblxuZnVuY3Rpb24gc3luY0Jvb2xlYW5BdHRyUHJvcChmcm9tRWwsIHRvRWwsIG5hbWUpIHtcbiAgICBpZiAoZnJvbUVsW25hbWVdICE9PSB0b0VsW25hbWVdKSB7XG4gICAgICAgIGZyb21FbFtuYW1lXSA9IHRvRWxbbmFtZV07XG4gICAgICAgIGlmIChmcm9tRWxbbmFtZV0pIHtcbiAgICAgICAgICAgIGZyb21FbC5zZXRBdHRyaWJ1dGUobmFtZSwgJycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZnJvbUVsLnJlbW92ZUF0dHJpYnV0ZShuYW1lLCAnJyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbnZhciBzcGVjaWFsRWxIYW5kbGVycyA9IHtcbiAgICAvKipcbiAgICAgKiBOZWVkZWQgZm9yIElFLiBBcHBhcmVudGx5IElFIGRvZXNuJ3QgdGhpbmsgdGhhdCBcInNlbGVjdGVkXCIgaXMgYW5cbiAgICAgKiBhdHRyaWJ1dGUgd2hlbiByZWFkaW5nIG92ZXIgdGhlIGF0dHJpYnV0ZXMgdXNpbmcgc2VsZWN0RWwuYXR0cmlidXRlc1xuICAgICAqL1xuICAgIE9QVElPTjogZnVuY3Rpb24oZnJvbUVsLCB0b0VsKSB7XG4gICAgICAgIHN5bmNCb29sZWFuQXR0clByb3AoZnJvbUVsLCB0b0VsLCAnc2VsZWN0ZWQnKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFRoZSBcInZhbHVlXCIgYXR0cmlidXRlIGlzIHNwZWNpYWwgZm9yIHRoZSA8aW5wdXQ+IGVsZW1lbnQgc2luY2UgaXQgc2V0c1xuICAgICAqIHRoZSBpbml0aWFsIHZhbHVlLiBDaGFuZ2luZyB0aGUgXCJ2YWx1ZVwiIGF0dHJpYnV0ZSB3aXRob3V0IGNoYW5naW5nIHRoZVxuICAgICAqIFwidmFsdWVcIiBwcm9wZXJ0eSB3aWxsIGhhdmUgbm8gZWZmZWN0IHNpbmNlIGl0IGlzIG9ubHkgdXNlZCB0byB0aGUgc2V0IHRoZVxuICAgICAqIGluaXRpYWwgdmFsdWUuICBTaW1pbGFyIGZvciB0aGUgXCJjaGVja2VkXCIgYXR0cmlidXRlLCBhbmQgXCJkaXNhYmxlZFwiLlxuICAgICAqL1xuICAgIElOUFVUOiBmdW5jdGlvbihmcm9tRWwsIHRvRWwpIHtcbiAgICAgICAgc3luY0Jvb2xlYW5BdHRyUHJvcChmcm9tRWwsIHRvRWwsICdjaGVja2VkJyk7XG4gICAgICAgIHN5bmNCb29sZWFuQXR0clByb3AoZnJvbUVsLCB0b0VsLCAnZGlzYWJsZWQnKTtcblxuICAgICAgICBpZiAoZnJvbUVsLnZhbHVlICE9PSB0b0VsLnZhbHVlKSB7XG4gICAgICAgICAgICBmcm9tRWwudmFsdWUgPSB0b0VsLnZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFoYXNBdHRyaWJ1dGVOUyh0b0VsLCBudWxsLCAndmFsdWUnKSkge1xuICAgICAgICAgICAgZnJvbUVsLnJlbW92ZUF0dHJpYnV0ZSgndmFsdWUnKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBURVhUQVJFQTogZnVuY3Rpb24oZnJvbUVsLCB0b0VsKSB7XG4gICAgICAgIHZhciBuZXdWYWx1ZSA9IHRvRWwudmFsdWU7XG4gICAgICAgIGlmIChmcm9tRWwudmFsdWUgIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBmcm9tRWwudmFsdWUgPSBuZXdWYWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmcm9tRWwuZmlyc3RDaGlsZCkge1xuICAgICAgICAgICAgZnJvbUVsLmZpcnN0Q2hpbGQubm9kZVZhbHVlID0gbmV3VmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdHdvIG5vZGUncyBuYW1lcyBhcmUgdGhlIHNhbWUuXG4gKlxuICogTk9URTogV2UgZG9uJ3QgYm90aGVyIGNoZWNraW5nIGBuYW1lc3BhY2VVUklgIGJlY2F1c2UgeW91IHdpbGwgbmV2ZXIgZmluZCB0d28gSFRNTCBlbGVtZW50cyB3aXRoIHRoZSBzYW1lXG4gKiAgICAgICBub2RlTmFtZSBhbmQgZGlmZmVyZW50IG5hbWVzcGFjZSBVUklzLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gYVxuICogQHBhcmFtIHtFbGVtZW50fSBiIFRoZSB0YXJnZXQgZWxlbWVudFxuICogQHJldHVybiB7Ym9vbGVhbn1cbiAqL1xuZnVuY3Rpb24gY29tcGFyZU5vZGVOYW1lcyhmcm9tRWwsIHRvRWwpIHtcbiAgICB2YXIgZnJvbU5vZGVOYW1lID0gZnJvbUVsLm5vZGVOYW1lO1xuICAgIHZhciB0b05vZGVOYW1lID0gdG9FbC5ub2RlTmFtZTtcblxuICAgIGlmIChmcm9tTm9kZU5hbWUgPT09IHRvTm9kZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHRvRWwuYWN0dWFsaXplICYmXG4gICAgICAgIGZyb21Ob2RlTmFtZS5jaGFyQ29kZUF0KDApIDwgOTEgJiYgLyogZnJvbSB0YWcgbmFtZSBpcyB1cHBlciBjYXNlICovXG4gICAgICAgIHRvTm9kZU5hbWUuY2hhckNvZGVBdCgwKSA+IDkwIC8qIHRhcmdldCB0YWcgbmFtZSBpcyBsb3dlciBjYXNlICovKSB7XG4gICAgICAgIC8vIElmIHRoZSB0YXJnZXQgZWxlbWVudCBpcyBhIHZpcnR1YWwgRE9NIG5vZGUgdGhlbiB3ZSBtYXkgbmVlZCB0byBub3JtYWxpemUgdGhlIHRhZyBuYW1lXG4gICAgICAgIC8vIGJlZm9yZSBjb21wYXJpbmcuIE5vcm1hbCBIVE1MIGVsZW1lbnRzIHRoYXQgYXJlIGluIHRoZSBcImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWxcIlxuICAgICAgICAvLyBhcmUgY29udmVydGVkIHRvIHVwcGVyIGNhc2VcbiAgICAgICAgcmV0dXJuIGZyb21Ob2RlTmFtZSA9PT0gdG9Ob2RlTmFtZS50b1VwcGVyQ2FzZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5cbi8qKlxuICogQ3JlYXRlIGFuIGVsZW1lbnQsIG9wdGlvbmFsbHkgd2l0aCBhIGtub3duIG5hbWVzcGFjZSBVUkkuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgdGhlIGVsZW1lbnQgbmFtZSwgZS5nLiAnZGl2JyBvciAnc3ZnJ1xuICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lc3BhY2VVUkldIHRoZSBlbGVtZW50J3MgbmFtZXNwYWNlIFVSSSwgaS5lLiB0aGUgdmFsdWUgb2ZcbiAqIGl0cyBgeG1sbnNgIGF0dHJpYnV0ZSBvciBpdHMgaW5mZXJyZWQgbmFtZXNwYWNlLlxuICpcbiAqIEByZXR1cm4ge0VsZW1lbnR9XG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnROUyhuYW1lLCBuYW1lc3BhY2VVUkkpIHtcbiAgICByZXR1cm4gIW5hbWVzcGFjZVVSSSB8fCBuYW1lc3BhY2VVUkkgPT09IE5TX1hIVE1MID9cbiAgICAgICAgZG9jLmNyZWF0ZUVsZW1lbnQobmFtZSkgOlxuICAgICAgICBkb2MuY3JlYXRlRWxlbWVudE5TKG5hbWVzcGFjZVVSSSwgbmFtZSk7XG59XG5cbi8qKlxuICogTG9vcCBvdmVyIGFsbCBvZiB0aGUgYXR0cmlidXRlcyBvbiB0aGUgdGFyZ2V0IG5vZGUgYW5kIG1ha2Ugc3VyZSB0aGUgb3JpZ2luYWxcbiAqIERPTSBub2RlIGhhcyB0aGUgc2FtZSBhdHRyaWJ1dGVzLiBJZiBhbiBhdHRyaWJ1dGUgZm91bmQgb24gdGhlIG9yaWdpbmFsIG5vZGVcbiAqIGlzIG5vdCBvbiB0aGUgbmV3IG5vZGUgdGhlbiByZW1vdmUgaXQgZnJvbSB0aGUgb3JpZ2luYWwgbm9kZS5cbiAqXG4gKiBAcGFyYW0gIHtFbGVtZW50fSBmcm9tTm9kZVxuICogQHBhcmFtICB7RWxlbWVudH0gdG9Ob2RlXG4gKi9cbmZ1bmN0aW9uIG1vcnBoQXR0cnMoZnJvbU5vZGUsIHRvTm9kZSkge1xuICAgIHZhciBhdHRycyA9IHRvTm9kZS5hdHRyaWJ1dGVzO1xuICAgIHZhciBpO1xuICAgIHZhciBhdHRyO1xuICAgIHZhciBhdHRyTmFtZTtcbiAgICB2YXIgYXR0ck5hbWVzcGFjZVVSSTtcbiAgICB2YXIgYXR0clZhbHVlO1xuICAgIHZhciBmcm9tVmFsdWU7XG5cbiAgICBpZiAodG9Ob2RlLmFzc2lnbkF0dHJpYnV0ZXMpIHtcbiAgICAgICAgdG9Ob2RlLmFzc2lnbkF0dHJpYnV0ZXMoZnJvbU5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAoaSA9IGF0dHJzLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgICAgICBhdHRyID0gYXR0cnNbaV07XG4gICAgICAgICAgICBhdHRyTmFtZSA9IGF0dHIubmFtZTtcbiAgICAgICAgICAgIGF0dHJOYW1lc3BhY2VVUkkgPSBhdHRyLm5hbWVzcGFjZVVSSTtcbiAgICAgICAgICAgIGF0dHJWYWx1ZSA9IGF0dHIudmFsdWU7XG5cbiAgICAgICAgICAgIGlmIChhdHRyTmFtZXNwYWNlVVJJKSB7XG4gICAgICAgICAgICAgICAgYXR0ck5hbWUgPSBhdHRyLmxvY2FsTmFtZSB8fCBhdHRyTmFtZTtcbiAgICAgICAgICAgICAgICBmcm9tVmFsdWUgPSBmcm9tTm9kZS5nZXRBdHRyaWJ1dGVOUyhhdHRyTmFtZXNwYWNlVVJJLCBhdHRyTmFtZSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZnJvbVZhbHVlICE9PSBhdHRyVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgZnJvbU5vZGUuc2V0QXR0cmlidXRlTlMoYXR0ck5hbWVzcGFjZVVSSSwgYXR0ck5hbWUsIGF0dHJWYWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmcm9tVmFsdWUgPSBmcm9tTm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGZyb21WYWx1ZSAhPT0gYXR0clZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGZyb21Ob2RlLnNldEF0dHJpYnV0ZShhdHRyTmFtZSwgYXR0clZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgYW55IGV4dHJhIGF0dHJpYnV0ZXMgZm91bmQgb24gdGhlIG9yaWdpbmFsIERPTSBlbGVtZW50IHRoYXRcbiAgICAvLyB3ZXJlbid0IGZvdW5kIG9uIHRoZSB0YXJnZXQgZWxlbWVudC5cbiAgICBhdHRycyA9IGZyb21Ob2RlLmF0dHJpYnV0ZXM7XG5cbiAgICBmb3IgKGkgPSBhdHRycy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICBhdHRyID0gYXR0cnNbaV07XG4gICAgICAgIGlmIChhdHRyLnNwZWNpZmllZCAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgIGF0dHJOYW1lID0gYXR0ci5uYW1lO1xuICAgICAgICAgICAgYXR0ck5hbWVzcGFjZVVSSSA9IGF0dHIubmFtZXNwYWNlVVJJO1xuXG4gICAgICAgICAgICBpZiAoYXR0ck5hbWVzcGFjZVVSSSkge1xuICAgICAgICAgICAgICAgIGF0dHJOYW1lID0gYXR0ci5sb2NhbE5hbWUgfHwgYXR0ck5hbWU7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWhhc0F0dHJpYnV0ZU5TKHRvTm9kZSwgYXR0ck5hbWVzcGFjZVVSSSwgYXR0ck5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZyb21Ob2RlLnJlbW92ZUF0dHJpYnV0ZU5TKGF0dHJOYW1lc3BhY2VVUkksIGF0dHJOYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghaGFzQXR0cmlidXRlTlModG9Ob2RlLCBudWxsLCBhdHRyTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZnJvbU5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHJOYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogQ29waWVzIHRoZSBjaGlsZHJlbiBvZiBvbmUgRE9NIGVsZW1lbnQgdG8gYW5vdGhlciBET00gZWxlbWVudFxuICovXG5mdW5jdGlvbiBtb3ZlQ2hpbGRyZW4oZnJvbUVsLCB0b0VsKSB7XG4gICAgdmFyIGN1ckNoaWxkID0gZnJvbUVsLmZpcnN0Q2hpbGQ7XG4gICAgd2hpbGUgKGN1ckNoaWxkKSB7XG4gICAgICAgIHZhciBuZXh0Q2hpbGQgPSBjdXJDaGlsZC5uZXh0U2libGluZztcbiAgICAgICAgdG9FbC5hcHBlbmRDaGlsZChjdXJDaGlsZCk7XG4gICAgICAgIGN1ckNoaWxkID0gbmV4dENoaWxkO1xuICAgIH1cbiAgICByZXR1cm4gdG9FbDtcbn1cblxuZnVuY3Rpb24gZGVmYXVsdEdldE5vZGVLZXkobm9kZSkge1xuICAgIHJldHVybiBub2RlLmlkO1xufVxuXG5mdW5jdGlvbiBtb3JwaGRvbShmcm9tTm9kZSwgdG9Ob2RlLCBvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHRvTm9kZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKGZyb21Ob2RlLm5vZGVOYW1lID09PSAnI2RvY3VtZW50JyB8fCBmcm9tTm9kZS5ub2RlTmFtZSA9PT0gJ0hUTUwnKSB7XG4gICAgICAgICAgICB2YXIgdG9Ob2RlSHRtbCA9IHRvTm9kZTtcbiAgICAgICAgICAgIHRvTm9kZSA9IGRvYy5jcmVhdGVFbGVtZW50KCdodG1sJyk7XG4gICAgICAgICAgICB0b05vZGUuaW5uZXJIVE1MID0gdG9Ob2RlSHRtbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRvTm9kZSA9IHRvRWxlbWVudCh0b05vZGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGdldE5vZGVLZXkgPSBvcHRpb25zLmdldE5vZGVLZXkgfHwgZGVmYXVsdEdldE5vZGVLZXk7XG4gICAgdmFyIG9uQmVmb3JlTm9kZUFkZGVkID0gb3B0aW9ucy5vbkJlZm9yZU5vZGVBZGRlZCB8fCBub29wO1xuICAgIHZhciBvbk5vZGVBZGRlZCA9IG9wdGlvbnMub25Ob2RlQWRkZWQgfHwgbm9vcDtcbiAgICB2YXIgb25CZWZvcmVFbFVwZGF0ZWQgPSBvcHRpb25zLm9uQmVmb3JlRWxVcGRhdGVkIHx8IG5vb3A7XG4gICAgdmFyIG9uRWxVcGRhdGVkID0gb3B0aW9ucy5vbkVsVXBkYXRlZCB8fCBub29wO1xuICAgIHZhciBvbkJlZm9yZU5vZGVEaXNjYXJkZWQgPSBvcHRpb25zLm9uQmVmb3JlTm9kZURpc2NhcmRlZCB8fCBub29wO1xuICAgIHZhciBvbk5vZGVEaXNjYXJkZWQgPSBvcHRpb25zLm9uTm9kZURpc2NhcmRlZCB8fCBub29wO1xuICAgIHZhciBvbkJlZm9yZUVsQ2hpbGRyZW5VcGRhdGVkID0gb3B0aW9ucy5vbkJlZm9yZUVsQ2hpbGRyZW5VcGRhdGVkIHx8IG5vb3A7XG4gICAgdmFyIGNoaWxkcmVuT25seSA9IG9wdGlvbnMuY2hpbGRyZW5Pbmx5ID09PSB0cnVlO1xuXG4gICAgLy8gVGhpcyBvYmplY3QgaXMgdXNlZCBhcyBhIGxvb2t1cCB0byBxdWlja2x5IGZpbmQgYWxsIGtleWVkIGVsZW1lbnRzIGluIHRoZSBvcmlnaW5hbCBET00gdHJlZS5cbiAgICB2YXIgZnJvbU5vZGVzTG9va3VwID0ge307XG4gICAgdmFyIGtleWVkUmVtb3ZhbExpc3Q7XG5cbiAgICBmdW5jdGlvbiBhZGRLZXllZFJlbW92YWwoa2V5KSB7XG4gICAgICAgIGlmIChrZXllZFJlbW92YWxMaXN0KSB7XG4gICAgICAgICAgICBrZXllZFJlbW92YWxMaXN0LnB1c2goa2V5KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGtleWVkUmVtb3ZhbExpc3QgPSBba2V5XTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHdhbGtEaXNjYXJkZWRDaGlsZE5vZGVzKG5vZGUsIHNraXBLZXllZE5vZGVzKSB7XG4gICAgICAgIGlmIChub2RlLm5vZGVUeXBlID09PSBFTEVNRU5UX05PREUpIHtcbiAgICAgICAgICAgIHZhciBjdXJDaGlsZCA9IG5vZGUuZmlyc3RDaGlsZDtcbiAgICAgICAgICAgIHdoaWxlIChjdXJDaGlsZCkge1xuXG4gICAgICAgICAgICAgICAgdmFyIGtleSA9IHVuZGVmaW5lZDtcblxuICAgICAgICAgICAgICAgIGlmIChza2lwS2V5ZWROb2RlcyAmJiAoa2V5ID0gZ2V0Tm9kZUtleShjdXJDaGlsZCkpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHdlIGFyZSBza2lwcGluZyBrZXllZCBub2RlcyB0aGVuIHdlIGFkZCB0aGUga2V5XG4gICAgICAgICAgICAgICAgICAgIC8vIHRvIGEgbGlzdCBzbyB0aGF0IGl0IGNhbiBiZSBoYW5kbGVkIGF0IHRoZSB2ZXJ5IGVuZC5cbiAgICAgICAgICAgICAgICAgICAgYWRkS2V5ZWRSZW1vdmFsKGtleSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gT25seSByZXBvcnQgdGhlIG5vZGUgYXMgZGlzY2FyZGVkIGlmIGl0IGlzIG5vdCBrZXllZC4gV2UgZG8gdGhpcyBiZWNhdXNlXG4gICAgICAgICAgICAgICAgICAgIC8vIGF0IHRoZSBlbmQgd2UgbG9vcCB0aHJvdWdoIGFsbCBrZXllZCBlbGVtZW50cyB0aGF0IHdlcmUgdW5tYXRjaGVkXG4gICAgICAgICAgICAgICAgICAgIC8vIGFuZCB0aGVuIGRpc2NhcmQgdGhlbSBpbiBvbmUgZmluYWwgcGFzcy5cbiAgICAgICAgICAgICAgICAgICAgb25Ob2RlRGlzY2FyZGVkKGN1ckNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGN1ckNoaWxkLmZpcnN0Q2hpbGQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdhbGtEaXNjYXJkZWRDaGlsZE5vZGVzKGN1ckNoaWxkLCBza2lwS2V5ZWROb2Rlcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjdXJDaGlsZCA9IGN1ckNoaWxkLm5leHRTaWJsaW5nO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIERPTSBub2RlIG91dCBvZiB0aGUgb3JpZ2luYWwgRE9NXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtOb2RlfSBub2RlIFRoZSBub2RlIHRvIHJlbW92ZVxuICAgICAqIEBwYXJhbSAge05vZGV9IHBhcmVudE5vZGUgVGhlIG5vZGVzIHBhcmVudFxuICAgICAqIEBwYXJhbSAge0Jvb2xlYW59IHNraXBLZXllZE5vZGVzIElmIHRydWUgdGhlbiBlbGVtZW50cyB3aXRoIGtleXMgd2lsbCBiZSBza2lwcGVkIGFuZCBub3QgZGlzY2FyZGVkLlxuICAgICAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiByZW1vdmVOb2RlKG5vZGUsIHBhcmVudE5vZGUsIHNraXBLZXllZE5vZGVzKSB7XG4gICAgICAgIGlmIChvbkJlZm9yZU5vZGVEaXNjYXJkZWQobm9kZSkgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocGFyZW50Tm9kZSkge1xuICAgICAgICAgICAgcGFyZW50Tm9kZS5yZW1vdmVDaGlsZChub2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG9uTm9kZURpc2NhcmRlZChub2RlKTtcbiAgICAgICAgd2Fsa0Rpc2NhcmRlZENoaWxkTm9kZXMobm9kZSwgc2tpcEtleWVkTm9kZXMpO1xuICAgIH1cblxuICAgIC8vIC8vIFRyZWVXYWxrZXIgaW1wbGVtZW50YXRpb24gaXMgbm8gZmFzdGVyLCBidXQga2VlcGluZyB0aGlzIGFyb3VuZCBpbiBjYXNlIHRoaXMgY2hhbmdlcyBpbiB0aGUgZnV0dXJlXG4gICAgLy8gZnVuY3Rpb24gaW5kZXhUcmVlKHJvb3QpIHtcbiAgICAvLyAgICAgdmFyIHRyZWVXYWxrZXIgPSBkb2N1bWVudC5jcmVhdGVUcmVlV2Fsa2VyKFxuICAgIC8vICAgICAgICAgcm9vdCxcbiAgICAvLyAgICAgICAgIE5vZGVGaWx0ZXIuU0hPV19FTEVNRU5UKTtcbiAgICAvL1xuICAgIC8vICAgICB2YXIgZWw7XG4gICAgLy8gICAgIHdoaWxlKChlbCA9IHRyZWVXYWxrZXIubmV4dE5vZGUoKSkpIHtcbiAgICAvLyAgICAgICAgIHZhciBrZXkgPSBnZXROb2RlS2V5KGVsKTtcbiAgICAvLyAgICAgICAgIGlmIChrZXkpIHtcbiAgICAvLyAgICAgICAgICAgICBmcm9tTm9kZXNMb29rdXBba2V5XSA9IGVsO1xuICAgIC8vICAgICAgICAgfVxuICAgIC8vICAgICB9XG4gICAgLy8gfVxuXG4gICAgLy8gLy8gTm9kZUl0ZXJhdG9yIGltcGxlbWVudGF0aW9uIGlzIG5vIGZhc3RlciwgYnV0IGtlZXBpbmcgdGhpcyBhcm91bmQgaW4gY2FzZSB0aGlzIGNoYW5nZXMgaW4gdGhlIGZ1dHVyZVxuICAgIC8vXG4gICAgLy8gZnVuY3Rpb24gaW5kZXhUcmVlKG5vZGUpIHtcbiAgICAvLyAgICAgdmFyIG5vZGVJdGVyYXRvciA9IGRvY3VtZW50LmNyZWF0ZU5vZGVJdGVyYXRvcihub2RlLCBOb2RlRmlsdGVyLlNIT1dfRUxFTUVOVCk7XG4gICAgLy8gICAgIHZhciBlbDtcbiAgICAvLyAgICAgd2hpbGUoKGVsID0gbm9kZUl0ZXJhdG9yLm5leHROb2RlKCkpKSB7XG4gICAgLy8gICAgICAgICB2YXIga2V5ID0gZ2V0Tm9kZUtleShlbCk7XG4gICAgLy8gICAgICAgICBpZiAoa2V5KSB7XG4gICAgLy8gICAgICAgICAgICAgZnJvbU5vZGVzTG9va3VwW2tleV0gPSBlbDtcbiAgICAvLyAgICAgICAgIH1cbiAgICAvLyAgICAgfVxuICAgIC8vIH1cblxuICAgIGZ1bmN0aW9uIGluZGV4VHJlZShub2RlKSB7XG4gICAgICAgIGlmIChub2RlLm5vZGVUeXBlID09PSBFTEVNRU5UX05PREUpIHtcbiAgICAgICAgICAgIHZhciBjdXJDaGlsZCA9IG5vZGUuZmlyc3RDaGlsZDtcbiAgICAgICAgICAgIHdoaWxlIChjdXJDaGlsZCkge1xuICAgICAgICAgICAgICAgIHZhciBrZXkgPSBnZXROb2RlS2V5KGN1ckNoaWxkKTtcbiAgICAgICAgICAgICAgICBpZiAoa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIGZyb21Ob2Rlc0xvb2t1cFtrZXldID0gY3VyQ2hpbGQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gV2FsayByZWN1cnNpdmVseVxuICAgICAgICAgICAgICAgIGluZGV4VHJlZShjdXJDaGlsZCk7XG5cbiAgICAgICAgICAgICAgICBjdXJDaGlsZCA9IGN1ckNoaWxkLm5leHRTaWJsaW5nO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaW5kZXhUcmVlKGZyb21Ob2RlKTtcblxuICAgIGZ1bmN0aW9uIGhhbmRsZU5vZGVBZGRlZChlbCkge1xuICAgICAgICBvbk5vZGVBZGRlZChlbCk7XG5cbiAgICAgICAgdmFyIGN1ckNoaWxkID0gZWwuZmlyc3RDaGlsZDtcbiAgICAgICAgd2hpbGUgKGN1ckNoaWxkKSB7XG4gICAgICAgICAgICB2YXIgbmV4dFNpYmxpbmcgPSBjdXJDaGlsZC5uZXh0U2libGluZztcblxuICAgICAgICAgICAgdmFyIGtleSA9IGdldE5vZGVLZXkoY3VyQ2hpbGQpO1xuICAgICAgICAgICAgaWYgKGtleSkge1xuICAgICAgICAgICAgICAgIHZhciB1bm1hdGNoZWRGcm9tRWwgPSBmcm9tTm9kZXNMb29rdXBba2V5XTtcbiAgICAgICAgICAgICAgICBpZiAodW5tYXRjaGVkRnJvbUVsICYmIGNvbXBhcmVOb2RlTmFtZXMoY3VyQ2hpbGQsIHVubWF0Y2hlZEZyb21FbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3VyQ2hpbGQucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQodW5tYXRjaGVkRnJvbUVsLCBjdXJDaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgIG1vcnBoRWwodW5tYXRjaGVkRnJvbUVsLCBjdXJDaGlsZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBoYW5kbGVOb2RlQWRkZWQoY3VyQ2hpbGQpO1xuICAgICAgICAgICAgY3VyQ2hpbGQgPSBuZXh0U2libGluZztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1vcnBoRWwoZnJvbUVsLCB0b0VsLCBjaGlsZHJlbk9ubHkpIHtcbiAgICAgICAgdmFyIHRvRWxLZXkgPSBnZXROb2RlS2V5KHRvRWwpO1xuICAgICAgICB2YXIgY3VyRnJvbU5vZGVLZXk7XG5cbiAgICAgICAgaWYgKHRvRWxLZXkpIHtcbiAgICAgICAgICAgIC8vIElmIGFuIGVsZW1lbnQgd2l0aCBhbiBJRCBpcyBiZWluZyBtb3JwaGVkIHRoZW4gaXQgaXMgd2lsbCBiZSBpbiB0aGUgZmluYWxcbiAgICAgICAgICAgIC8vIERPTSBzbyBjbGVhciBpdCBvdXQgb2YgdGhlIHNhdmVkIGVsZW1lbnRzIGNvbGxlY3Rpb25cbiAgICAgICAgICAgIGRlbGV0ZSBmcm9tTm9kZXNMb29rdXBbdG9FbEtleV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9Ob2RlLmlzU2FtZU5vZGUgJiYgdG9Ob2RlLmlzU2FtZU5vZGUoZnJvbU5vZGUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWNoaWxkcmVuT25seSkge1xuICAgICAgICAgICAgaWYgKG9uQmVmb3JlRWxVcGRhdGVkKGZyb21FbCwgdG9FbCkgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBtb3JwaEF0dHJzKGZyb21FbCwgdG9FbCk7XG4gICAgICAgICAgICBvbkVsVXBkYXRlZChmcm9tRWwpO1xuXG4gICAgICAgICAgICBpZiAob25CZWZvcmVFbENoaWxkcmVuVXBkYXRlZChmcm9tRWwsIHRvRWwpID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmcm9tRWwubm9kZU5hbWUgIT09ICdURVhUQVJFQScpIHtcbiAgICAgICAgICAgIHZhciBjdXJUb05vZGVDaGlsZCA9IHRvRWwuZmlyc3RDaGlsZDtcbiAgICAgICAgICAgIHZhciBjdXJGcm9tTm9kZUNoaWxkID0gZnJvbUVsLmZpcnN0Q2hpbGQ7XG4gICAgICAgICAgICB2YXIgY3VyVG9Ob2RlS2V5O1xuXG4gICAgICAgICAgICB2YXIgZnJvbU5leHRTaWJsaW5nO1xuICAgICAgICAgICAgdmFyIHRvTmV4dFNpYmxpbmc7XG4gICAgICAgICAgICB2YXIgbWF0Y2hpbmdGcm9tRWw7XG5cbiAgICAgICAgICAgIG91dGVyOiB3aGlsZSAoY3VyVG9Ob2RlQ2hpbGQpIHtcbiAgICAgICAgICAgICAgICB0b05leHRTaWJsaW5nID0gY3VyVG9Ob2RlQ2hpbGQubmV4dFNpYmxpbmc7XG4gICAgICAgICAgICAgICAgY3VyVG9Ob2RlS2V5ID0gZ2V0Tm9kZUtleShjdXJUb05vZGVDaGlsZCk7XG5cbiAgICAgICAgICAgICAgICB3aGlsZSAoY3VyRnJvbU5vZGVDaGlsZCkge1xuICAgICAgICAgICAgICAgICAgICBmcm9tTmV4dFNpYmxpbmcgPSBjdXJGcm9tTm9kZUNoaWxkLm5leHRTaWJsaW5nO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjdXJUb05vZGVDaGlsZC5pc1NhbWVOb2RlICYmIGN1clRvTm9kZUNoaWxkLmlzU2FtZU5vZGUoY3VyRnJvbU5vZGVDaGlsZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1clRvTm9kZUNoaWxkID0gdG9OZXh0U2libGluZztcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1ckZyb21Ob2RlQ2hpbGQgPSBmcm9tTmV4dFNpYmxpbmc7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZSBvdXRlcjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGN1ckZyb21Ob2RlS2V5ID0gZ2V0Tm9kZUtleShjdXJGcm9tTm9kZUNoaWxkKTtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgY3VyRnJvbU5vZGVUeXBlID0gY3VyRnJvbU5vZGVDaGlsZC5ub2RlVHlwZTtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgaXNDb21wYXRpYmxlID0gdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjdXJGcm9tTm9kZVR5cGUgPT09IGN1clRvTm9kZUNoaWxkLm5vZGVUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VyRnJvbU5vZGVUeXBlID09PSBFTEVNRU5UX05PREUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBCb3RoIG5vZGVzIGJlaW5nIGNvbXBhcmVkIGFyZSBFbGVtZW50IG5vZGVzXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VyVG9Ob2RlS2V5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoZSB0YXJnZXQgbm9kZSBoYXMgYSBrZXkgc28gd2Ugd2FudCB0byBtYXRjaCBpdCB1cCB3aXRoIHRoZSBjb3JyZWN0IGVsZW1lbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaW4gdGhlIG9yaWdpbmFsIERPTSB0cmVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjdXJUb05vZGVLZXkgIT09IGN1ckZyb21Ob2RlS2V5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGUgY3VycmVudCBlbGVtZW50IGluIHRoZSBvcmlnaW5hbCBET00gdHJlZSBkb2VzIG5vdCBoYXZlIGEgbWF0Y2hpbmcga2V5IHNvXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBsZXQncyBjaGVjayBvdXIgbG9va3VwIHRvIHNlZSBpZiB0aGVyZSBpcyBhIG1hdGNoaW5nIGVsZW1lbnQgaW4gdGhlIG9yaWdpbmFsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBET00gdHJlZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKChtYXRjaGluZ0Zyb21FbCA9IGZyb21Ob2Rlc0xvb2t1cFtjdXJUb05vZGVLZXldKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjdXJGcm9tTm9kZUNoaWxkLm5leHRTaWJsaW5nID09PSBtYXRjaGluZ0Zyb21FbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTcGVjaWFsIGNhc2UgZm9yIHNpbmdsZSBlbGVtZW50IHJlbW92YWxzLiBUbyBhdm9pZCByZW1vdmluZyB0aGUgb3JpZ2luYWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRE9NIG5vZGUgb3V0IG9mIHRoZSB0cmVlIChzaW5jZSB0aGF0IGNhbiBicmVhayBDU1MgdHJhbnNpdGlvbnMsIGV0Yy4pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3ZSB3aWxsIGluc3RlYWQgZGlzY2FyZCB0aGUgY3VycmVudCBub2RlIGFuZCB3YWl0IHVudGlsIHRoZSBuZXh0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGl0ZXJhdGlvbiB0byBwcm9wZXJseSBtYXRjaCB1cCB0aGUga2V5ZWQgdGFyZ2V0IGVsZW1lbnQgd2l0aCBpdHMgbWF0Y2hpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZWxlbWVudCBpbiB0aGUgb3JpZ2luYWwgdHJlZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc0NvbXBhdGlibGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBXZSBmb3VuZCBhIG1hdGNoaW5nIGtleWVkIGVsZW1lbnQgc29tZXdoZXJlIGluIHRoZSBvcmlnaW5hbCBET00gdHJlZS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTGV0J3MgbW92aW5nIHRoZSBvcmlnaW5hbCBET00gbm9kZSBpbnRvIHRoZSBjdXJyZW50IHBvc2l0aW9uIGFuZCBtb3JwaFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpdC5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBOT1RFOiBXZSB1c2UgaW5zZXJ0QmVmb3JlIGluc3RlYWQgb2YgcmVwbGFjZUNoaWxkIGJlY2F1c2Ugd2Ugd2FudCB0byBnbyB0aHJvdWdoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBgcmVtb3ZlTm9kZSgpYCBmdW5jdGlvbiBmb3IgdGhlIG5vZGUgdGhhdCBpcyBiZWluZyBkaXNjYXJkZWQgc28gdGhhdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbGwgbGlmZWN5Y2xlIGhvb2tzIGFyZSBjb3JyZWN0bHkgaW52b2tlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcm9tRWwuaW5zZXJ0QmVmb3JlKG1hdGNoaW5nRnJvbUVsLCBjdXJGcm9tTm9kZUNoaWxkKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VyRnJvbU5vZGVLZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNpbmNlIHRoZSBub2RlIGlzIGtleWVkIGl0IG1pZ2h0IGJlIG1hdGNoZWQgdXAgbGF0ZXIgc28gd2UgZGVmZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBhY3R1YWwgcmVtb3ZhbCB0byBsYXRlclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkS2V5ZWRSZW1vdmFsKGN1ckZyb21Ob2RlS2V5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5PVEU6IHdlIHNraXAgbmVzdGVkIGtleWVkIG5vZGVzIGZyb20gYmVpbmcgcmVtb3ZlZCBzaW5jZSB0aGVyZSBpc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgc3RpbGwgYSBjaGFuY2UgdGhleSB3aWxsIGJlIG1hdGNoZWQgdXAgbGF0ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZU5vZGUoY3VyRnJvbU5vZGVDaGlsZCwgZnJvbUVsLCB0cnVlIC8qIHNraXAga2V5ZWQgbm9kZXMgKi8pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbU5leHRTaWJsaW5nID0gY3VyRnJvbU5vZGVDaGlsZC5uZXh0U2libGluZztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VyRnJvbU5vZGVDaGlsZCA9IG1hdGNoaW5nRnJvbUVsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhlIG5vZGVzIGFyZSBub3QgY29tcGF0aWJsZSBzaW5jZSB0aGUgXCJ0b1wiIG5vZGUgaGFzIGEga2V5IGFuZCB0aGVyZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlzIG5vIG1hdGNoaW5nIGtleWVkIG5vZGUgaW4gdGhlIHNvdXJjZSB0cmVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNDb21wYXRpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGN1ckZyb21Ob2RlS2V5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoZSBvcmlnaW5hbCBoYXMgYSBrZXlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNDb21wYXRpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNDb21wYXRpYmxlID0gaXNDb21wYXRpYmxlICE9PSBmYWxzZSAmJiBjb21wYXJlTm9kZU5hbWVzKGN1ckZyb21Ob2RlQ2hpbGQsIGN1clRvTm9kZUNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNDb21wYXRpYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlIGZvdW5kIGNvbXBhdGlibGUgRE9NIGVsZW1lbnRzIHNvIHRyYW5zZm9ybVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgY3VycmVudCBcImZyb21cIiBub2RlIHRvIG1hdGNoIHRoZSBjdXJyZW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRhcmdldCBET00gbm9kZS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9ycGhFbChjdXJGcm9tTm9kZUNoaWxkLCBjdXJUb05vZGVDaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGN1ckZyb21Ob2RlVHlwZSA9PT0gVEVYVF9OT0RFIHx8IGN1ckZyb21Ob2RlVHlwZSA9PSBDT01NRU5UX05PREUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBCb3RoIG5vZGVzIGJlaW5nIGNvbXBhcmVkIGFyZSBUZXh0IG9yIENvbW1lbnQgbm9kZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc0NvbXBhdGlibGUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNpbXBseSB1cGRhdGUgbm9kZVZhbHVlIG9uIHRoZSBvcmlnaW5hbCBub2RlIHRvXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2hhbmdlIHRoZSB0ZXh0IHZhbHVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VyRnJvbU5vZGVDaGlsZC5ub2RlVmFsdWUgPSBjdXJUb05vZGVDaGlsZC5ub2RlVmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNDb21wYXRpYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBBZHZhbmNlIGJvdGggdGhlIFwidG9cIiBjaGlsZCBhbmQgdGhlIFwiZnJvbVwiIGNoaWxkIHNpbmNlIHdlIGZvdW5kIGEgbWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1clRvTm9kZUNoaWxkID0gdG9OZXh0U2libGluZztcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1ckZyb21Ob2RlQ2hpbGQgPSBmcm9tTmV4dFNpYmxpbmc7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZSBvdXRlcjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIE5vIGNvbXBhdGlibGUgbWF0Y2ggc28gcmVtb3ZlIHRoZSBvbGQgbm9kZSBmcm9tIHRoZSBET00gYW5kIGNvbnRpbnVlIHRyeWluZyB0byBmaW5kIGFcbiAgICAgICAgICAgICAgICAgICAgLy8gbWF0Y2ggaW4gdGhlIG9yaWdpbmFsIERPTS4gSG93ZXZlciwgd2Ugb25seSBkbyB0aGlzIGlmIHRoZSBmcm9tIG5vZGUgaXMgbm90IGtleWVkXG4gICAgICAgICAgICAgICAgICAgIC8vIHNpbmNlIGl0IGlzIHBvc3NpYmxlIHRoYXQgYSBrZXllZCBub2RlIG1pZ2h0IG1hdGNoIHVwIHdpdGggYSBub2RlIHNvbWV3aGVyZSBlbHNlIGluIHRoZVxuICAgICAgICAgICAgICAgICAgICAvLyB0YXJnZXQgdHJlZSBhbmQgd2UgZG9uJ3Qgd2FudCB0byBkaXNjYXJkIGl0IGp1c3QgeWV0IHNpbmNlIGl0IHN0aWxsIG1pZ2h0IGZpbmQgYVxuICAgICAgICAgICAgICAgICAgICAvLyBob21lIGluIHRoZSBmaW5hbCBET00gdHJlZS4gQWZ0ZXIgZXZlcnl0aGluZyBpcyBkb25lIHdlIHdpbGwgcmVtb3ZlIGFueSBrZXllZCBub2Rlc1xuICAgICAgICAgICAgICAgICAgICAvLyB0aGF0IGRpZG4ndCBmaW5kIGEgaG9tZVxuICAgICAgICAgICAgICAgICAgICBpZiAoY3VyRnJvbU5vZGVLZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNpbmNlIHRoZSBub2RlIGlzIGtleWVkIGl0IG1pZ2h0IGJlIG1hdGNoZWQgdXAgbGF0ZXIgc28gd2UgZGVmZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBhY3R1YWwgcmVtb3ZhbCB0byBsYXRlclxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkS2V5ZWRSZW1vdmFsKGN1ckZyb21Ob2RlS2V5KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5PVEU6IHdlIHNraXAgbmVzdGVkIGtleWVkIG5vZGVzIGZyb20gYmVpbmcgcmVtb3ZlZCBzaW5jZSB0aGVyZSBpc1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgc3RpbGwgYSBjaGFuY2UgdGhleSB3aWxsIGJlIG1hdGNoZWQgdXAgbGF0ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZU5vZGUoY3VyRnJvbU5vZGVDaGlsZCwgZnJvbUVsLCB0cnVlIC8qIHNraXAga2V5ZWQgbm9kZXMgKi8pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY3VyRnJvbU5vZGVDaGlsZCA9IGZyb21OZXh0U2libGluZztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBJZiB3ZSBnb3QgdGhpcyBmYXIgdGhlbiB3ZSBkaWQgbm90IGZpbmQgYSBjYW5kaWRhdGUgbWF0Y2ggZm9yXG4gICAgICAgICAgICAgICAgLy8gb3VyIFwidG8gbm9kZVwiIGFuZCB3ZSBleGhhdXN0ZWQgYWxsIG9mIHRoZSBjaGlsZHJlbiBcImZyb21cIlxuICAgICAgICAgICAgICAgIC8vIG5vZGVzLiBUaGVyZWZvcmUsIHdlIHdpbGwganVzdCBhcHBlbmQgdGhlIGN1cnJlbnQgXCJ0b1wiIG5vZGVcbiAgICAgICAgICAgICAgICAvLyB0byB0aGUgZW5kXG4gICAgICAgICAgICAgICAgaWYgKGN1clRvTm9kZUtleSAmJiAobWF0Y2hpbmdGcm9tRWwgPSBmcm9tTm9kZXNMb29rdXBbY3VyVG9Ob2RlS2V5XSkgJiYgY29tcGFyZU5vZGVOYW1lcyhtYXRjaGluZ0Zyb21FbCwgY3VyVG9Ob2RlQ2hpbGQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZyb21FbC5hcHBlbmRDaGlsZChtYXRjaGluZ0Zyb21FbCk7XG4gICAgICAgICAgICAgICAgICAgIG1vcnBoRWwobWF0Y2hpbmdGcm9tRWwsIGN1clRvTm9kZUNoaWxkKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2YXIgb25CZWZvcmVOb2RlQWRkZWRSZXN1bHQgPSBvbkJlZm9yZU5vZGVBZGRlZChjdXJUb05vZGVDaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvbkJlZm9yZU5vZGVBZGRlZFJlc3VsdCAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvbkJlZm9yZU5vZGVBZGRlZFJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1clRvTm9kZUNoaWxkID0gb25CZWZvcmVOb2RlQWRkZWRSZXN1bHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjdXJUb05vZGVDaGlsZC5hY3R1YWxpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJUb05vZGVDaGlsZCA9IGN1clRvTm9kZUNoaWxkLmFjdHVhbGl6ZShmcm9tRWwub3duZXJEb2N1bWVudCB8fCBkb2MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZnJvbUVsLmFwcGVuZENoaWxkKGN1clRvTm9kZUNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZU5vZGVBZGRlZChjdXJUb05vZGVDaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjdXJUb05vZGVDaGlsZCA9IHRvTmV4dFNpYmxpbmc7XG4gICAgICAgICAgICAgICAgY3VyRnJvbU5vZGVDaGlsZCA9IGZyb21OZXh0U2libGluZztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gV2UgaGF2ZSBwcm9jZXNzZWQgYWxsIG9mIHRoZSBcInRvIG5vZGVzXCIuIElmIGN1ckZyb21Ob2RlQ2hpbGQgaXNcbiAgICAgICAgICAgIC8vIG5vbi1udWxsIHRoZW4gd2Ugc3RpbGwgaGF2ZSBzb21lIGZyb20gbm9kZXMgbGVmdCBvdmVyIHRoYXQgbmVlZFxuICAgICAgICAgICAgLy8gdG8gYmUgcmVtb3ZlZFxuICAgICAgICAgICAgd2hpbGUgKGN1ckZyb21Ob2RlQ2hpbGQpIHtcbiAgICAgICAgICAgICAgICBmcm9tTmV4dFNpYmxpbmcgPSBjdXJGcm9tTm9kZUNoaWxkLm5leHRTaWJsaW5nO1xuICAgICAgICAgICAgICAgIGlmICgoY3VyRnJvbU5vZGVLZXkgPSBnZXROb2RlS2V5KGN1ckZyb21Ob2RlQ2hpbGQpKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBTaW5jZSB0aGUgbm9kZSBpcyBrZXllZCBpdCBtaWdodCBiZSBtYXRjaGVkIHVwIGxhdGVyIHNvIHdlIGRlZmVyXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBhY3R1YWwgcmVtb3ZhbCB0byBsYXRlclxuICAgICAgICAgICAgICAgICAgICBhZGRLZXllZFJlbW92YWwoY3VyRnJvbU5vZGVLZXkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE5PVEU6IHdlIHNraXAgbmVzdGVkIGtleWVkIG5vZGVzIGZyb20gYmVpbmcgcmVtb3ZlZCBzaW5jZSB0aGVyZSBpc1xuICAgICAgICAgICAgICAgICAgICAvLyAgICAgICBzdGlsbCBhIGNoYW5jZSB0aGV5IHdpbGwgYmUgbWF0Y2hlZCB1cCBsYXRlclxuICAgICAgICAgICAgICAgICAgICByZW1vdmVOb2RlKGN1ckZyb21Ob2RlQ2hpbGQsIGZyb21FbCwgdHJ1ZSAvKiBza2lwIGtleWVkIG5vZGVzICovKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY3VyRnJvbU5vZGVDaGlsZCA9IGZyb21OZXh0U2libGluZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzcGVjaWFsRWxIYW5kbGVyID0gc3BlY2lhbEVsSGFuZGxlcnNbZnJvbUVsLm5vZGVOYW1lXTtcbiAgICAgICAgaWYgKHNwZWNpYWxFbEhhbmRsZXIpIHtcbiAgICAgICAgICAgIHNwZWNpYWxFbEhhbmRsZXIoZnJvbUVsLCB0b0VsKTtcbiAgICAgICAgfVxuICAgIH0gLy8gRU5EOiBtb3JwaEVsKC4uLilcblxuICAgIHZhciBtb3JwaGVkTm9kZSA9IGZyb21Ob2RlO1xuICAgIHZhciBtb3JwaGVkTm9kZVR5cGUgPSBtb3JwaGVkTm9kZS5ub2RlVHlwZTtcbiAgICB2YXIgdG9Ob2RlVHlwZSA9IHRvTm9kZS5ub2RlVHlwZTtcblxuICAgIGlmICghY2hpbGRyZW5Pbmx5KSB7XG4gICAgICAgIC8vIEhhbmRsZSB0aGUgY2FzZSB3aGVyZSB3ZSBhcmUgZ2l2ZW4gdHdvIERPTSBub2RlcyB0aGF0IGFyZSBub3RcbiAgICAgICAgLy8gY29tcGF0aWJsZSAoZS5nLiA8ZGl2PiAtLT4gPHNwYW4+IG9yIDxkaXY+IC0tPiBURVhUKVxuICAgICAgICBpZiAobW9ycGhlZE5vZGVUeXBlID09PSBFTEVNRU5UX05PREUpIHtcbiAgICAgICAgICAgIGlmICh0b05vZGVUeXBlID09PSBFTEVNRU5UX05PREUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNvbXBhcmVOb2RlTmFtZXMoZnJvbU5vZGUsIHRvTm9kZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgb25Ob2RlRGlzY2FyZGVkKGZyb21Ob2RlKTtcbiAgICAgICAgICAgICAgICAgICAgbW9ycGhlZE5vZGUgPSBtb3ZlQ2hpbGRyZW4oZnJvbU5vZGUsIGNyZWF0ZUVsZW1lbnROUyh0b05vZGUubm9kZU5hbWUsIHRvTm9kZS5uYW1lc3BhY2VVUkkpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEdvaW5nIGZyb20gYW4gZWxlbWVudCBub2RlIHRvIGEgdGV4dCBub2RlXG4gICAgICAgICAgICAgICAgbW9ycGhlZE5vZGUgPSB0b05vZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAobW9ycGhlZE5vZGVUeXBlID09PSBURVhUX05PREUgfHwgbW9ycGhlZE5vZGVUeXBlID09PSBDT01NRU5UX05PREUpIHsgLy8gVGV4dCBvciBjb21tZW50IG5vZGVcbiAgICAgICAgICAgIGlmICh0b05vZGVUeXBlID09PSBtb3JwaGVkTm9kZVR5cGUpIHtcbiAgICAgICAgICAgICAgICBtb3JwaGVkTm9kZS5ub2RlVmFsdWUgPSB0b05vZGUubm9kZVZhbHVlO1xuICAgICAgICAgICAgICAgIHJldHVybiBtb3JwaGVkTm9kZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gVGV4dCBub2RlIHRvIHNvbWV0aGluZyBlbHNlXG4gICAgICAgICAgICAgICAgbW9ycGhlZE5vZGUgPSB0b05vZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobW9ycGhlZE5vZGUgPT09IHRvTm9kZSkge1xuICAgICAgICAvLyBUaGUgXCJ0byBub2RlXCIgd2FzIG5vdCBjb21wYXRpYmxlIHdpdGggdGhlIFwiZnJvbSBub2RlXCIgc28gd2UgaGFkIHRvXG4gICAgICAgIC8vIHRvc3Mgb3V0IHRoZSBcImZyb20gbm9kZVwiIGFuZCB1c2UgdGhlIFwidG8gbm9kZVwiXG4gICAgICAgIG9uTm9kZURpc2NhcmRlZChmcm9tTm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbW9ycGhFbChtb3JwaGVkTm9kZSwgdG9Ob2RlLCBjaGlsZHJlbk9ubHkpO1xuXG4gICAgICAgIC8vIFdlIG5vdyBuZWVkIHRvIGxvb3Agb3ZlciBhbnkga2V5ZWQgbm9kZXMgdGhhdCBtaWdodCBuZWVkIHRvIGJlXG4gICAgICAgIC8vIHJlbW92ZWQuIFdlIG9ubHkgZG8gdGhlIHJlbW92YWwgaWYgd2Uga25vdyB0aGF0IHRoZSBrZXllZCBub2RlXG4gICAgICAgIC8vIG5ldmVyIGZvdW5kIGEgbWF0Y2guIFdoZW4gYSBrZXllZCBub2RlIGlzIG1hdGNoZWQgdXAgd2UgcmVtb3ZlXG4gICAgICAgIC8vIGl0IG91dCBvZiBmcm9tTm9kZXNMb29rdXAgYW5kIHdlIHVzZSBmcm9tTm9kZXNMb29rdXAgdG8gZGV0ZXJtaW5lXG4gICAgICAgIC8vIGlmIGEga2V5ZWQgbm9kZSBoYXMgYmVlbiBtYXRjaGVkIHVwIG9yIG5vdFxuICAgICAgICBpZiAoa2V5ZWRSZW1vdmFsTGlzdCkge1xuICAgICAgICAgICAgZm9yICh2YXIgaT0wLCBsZW49a2V5ZWRSZW1vdmFsTGlzdC5sZW5ndGg7IGk8bGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgZWxUb1JlbW92ZSA9IGZyb21Ob2Rlc0xvb2t1cFtrZXllZFJlbW92YWxMaXN0W2ldXTtcbiAgICAgICAgICAgICAgICBpZiAoZWxUb1JlbW92ZSkge1xuICAgICAgICAgICAgICAgICAgICByZW1vdmVOb2RlKGVsVG9SZW1vdmUsIGVsVG9SZW1vdmUucGFyZW50Tm9kZSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICghY2hpbGRyZW5Pbmx5ICYmIG1vcnBoZWROb2RlICE9PSBmcm9tTm9kZSAmJiBmcm9tTm9kZS5wYXJlbnROb2RlKSB7XG4gICAgICAgIGlmIChtb3JwaGVkTm9kZS5hY3R1YWxpemUpIHtcbiAgICAgICAgICAgIG1vcnBoZWROb2RlID0gbW9ycGhlZE5vZGUuYWN0dWFsaXplKGZyb21Ob2RlLm93bmVyRG9jdW1lbnQgfHwgZG9jKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBJZiB3ZSBoYWQgdG8gc3dhcCBvdXQgdGhlIGZyb20gbm9kZSB3aXRoIGEgbmV3IG5vZGUgYmVjYXVzZSB0aGUgb2xkXG4gICAgICAgIC8vIG5vZGUgd2FzIG5vdCBjb21wYXRpYmxlIHdpdGggdGhlIHRhcmdldCBub2RlIHRoZW4gd2UgbmVlZCB0b1xuICAgICAgICAvLyByZXBsYWNlIHRoZSBvbGQgRE9NIG5vZGUgaW4gdGhlIG9yaWdpbmFsIERPTSB0cmVlLiBUaGlzIGlzIG9ubHlcbiAgICAgICAgLy8gcG9zc2libGUgaWYgdGhlIG9yaWdpbmFsIERPTSBub2RlIHdhcyBwYXJ0IG9mIGEgRE9NIHRyZWUgd2hpY2hcbiAgICAgICAgLy8gd2Uga25vdyBpcyB0aGUgY2FzZSBpZiBpdCBoYXMgYSBwYXJlbnQgbm9kZS5cbiAgICAgICAgZnJvbU5vZGUucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobW9ycGhlZE5vZGUsIGZyb21Ob2RlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbW9ycGhlZE5vZGU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbW9ycGhkb207XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFtcbiAgLy8gYXR0cmlidXRlIGV2ZW50cyAoY2FuIGJlIHNldCB3aXRoIGF0dHJpYnV0ZXMpXG4gICdvbmNsaWNrJyxcbiAgJ29uZGJsY2xpY2snLFxuICAnb25tb3VzZWRvd24nLFxuICAnb25tb3VzZXVwJyxcbiAgJ29ubW91c2VvdmVyJyxcbiAgJ29ubW91c2Vtb3ZlJyxcbiAgJ29ubW91c2VvdXQnLFxuICAnb25kcmFnc3RhcnQnLFxuICAnb25kcmFnJyxcbiAgJ29uZHJhZ2VudGVyJyxcbiAgJ29uZHJhZ2xlYXZlJyxcbiAgJ29uZHJhZ292ZXInLFxuICAnb25kcm9wJyxcbiAgJ29uZHJhZ2VuZCcsXG4gICdvbmtleWRvd24nLFxuICAnb25rZXlwcmVzcycsXG4gICdvbmtleXVwJyxcbiAgJ29udW5sb2FkJyxcbiAgJ29uYWJvcnQnLFxuICAnb25lcnJvcicsXG4gICdvbnJlc2l6ZScsXG4gICdvbnNjcm9sbCcsXG4gICdvbnNlbGVjdCcsXG4gICdvbmNoYW5nZScsXG4gICdvbnN1Ym1pdCcsXG4gICdvbnJlc2V0JyxcbiAgJ29uZm9jdXMnLFxuICAnb25ibHVyJyxcbiAgJ29uaW5wdXQnLFxuICAvLyBvdGhlciBjb21tb24gZXZlbnRzXG4gICdvbmNvbnRleHRtZW51JyxcbiAgJ29uZm9jdXNpbicsXG4gICdvbmZvY3Vzb3V0J1xuXVxuIiwiaW1wb3J0IFV0aWxzIGZyb20gJy4uL2NvcmUvVXRpbHMnXG5pbXBvcnQgVHJhbnNsYXRvciBmcm9tICcuLi9jb3JlL1RyYW5zbGF0b3InXG5pbXBvcnQgZWUgZnJvbSAnbmFtZXNwYWNlLWVtaXR0ZXInXG5pbXBvcnQgVXBweVNvY2tldCBmcm9tICcuL1VwcHlTb2NrZXQnXG5pbXBvcnQgZW5fVVMgZnJvbSAnLi4vbG9jYWxlcy9lbl9VUydcbi8vIGltcG9ydCBkZWVwRnJlZXplIGZyb20gJ2RlZXAtZnJlZXplLXN0cmljdCdcblxuLyoqXG4gKiBNYWluIFVwcHkgY29yZVxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBvcHRzIGdlbmVyYWwgb3B0aW9ucywgbGlrZSBsb2NhbGVzLCB0byBzaG93IG1vZGFsIG9yIG5vdCB0byBzaG93XG4gKi9cbmNsYXNzIFVwcHkge1xuICBjb25zdHJ1Y3RvciAob3B0cykge1xuICAgIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgIC8vIGxvYWQgRW5nbGlzaCBhcyB0aGUgZGVmYXVsdCBsb2NhbGVcbiAgICAgIGxvY2FsZTogZW5fVVMsXG4gICAgICBhdXRvUHJvY2VlZDogdHJ1ZSxcbiAgICAgIGRlYnVnOiBmYWxzZVxuICAgIH1cblxuICAgIC8vIE1lcmdlIGRlZmF1bHQgb3B0aW9ucyB3aXRoIHRoZSBvbmVzIHNldCBieSB1c2VyXG4gICAgdGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdHMpXG5cbiAgICAvLyAvLyBEaWN0YXRlcyBpbiB3aGF0IG9yZGVyIGRpZmZlcmVudCBwbHVnaW4gdHlwZXMgYXJlIHJhbjpcbiAgICAvLyB0aGlzLnR5cGVzID0gWyAncHJlc2V0dGVyJywgJ29yY2hlc3RyYXRvcicsICdwcm9ncmVzc2luZGljYXRvcicsXG4gICAgLy8gICAgICAgICAgICAgICAgICdhY3F1aXJlcicsICdtb2RpZmllcicsICd1cGxvYWRlcicsICdwcmVzZW50ZXInLCAnZGVidWdnZXInXVxuXG4gICAgLy8gQ29udGFpbmVyIGZvciBkaWZmZXJlbnQgdHlwZXMgb2YgcGx1Z2luc1xuICAgIHRoaXMucGx1Z2lucyA9IHt9XG5cbiAgICB0aGlzLnRyYW5zbGF0b3IgPSBuZXcgVHJhbnNsYXRvcih7bG9jYWxlOiB0aGlzLm9wdHMubG9jYWxlfSlcbiAgICB0aGlzLmkxOG4gPSB0aGlzLnRyYW5zbGF0b3IudHJhbnNsYXRlLmJpbmQodGhpcy50cmFuc2xhdG9yKVxuICAgIHRoaXMuZ2V0U3RhdGUgPSB0aGlzLmdldFN0YXRlLmJpbmQodGhpcylcbiAgICB0aGlzLnVwZGF0ZU1ldGEgPSB0aGlzLnVwZGF0ZU1ldGEuYmluZCh0aGlzKVxuICAgIHRoaXMuaW5pdFNvY2tldCA9IHRoaXMuaW5pdFNvY2tldC5iaW5kKHRoaXMpXG4gICAgdGhpcy5sb2cgPSB0aGlzLmxvZy5iaW5kKHRoaXMpXG4gICAgdGhpcy5hZGRGaWxlID0gdGhpcy5hZGRGaWxlLmJpbmQodGhpcylcblxuICAgIHRoaXMuYnVzID0gdGhpcy5lbWl0dGVyID0gZWUoKVxuICAgIHRoaXMub24gPSB0aGlzLmJ1cy5vbi5iaW5kKHRoaXMuYnVzKVxuICAgIHRoaXMuZW1pdCA9IHRoaXMuYnVzLmVtaXQuYmluZCh0aGlzLmJ1cylcblxuICAgIHRoaXMuc3RhdGUgPSB7XG4gICAgICBmaWxlczoge30sXG4gICAgICBjYXBhYmlsaXRpZXM6IHtcbiAgICAgICAgcmVzdW1hYmxlVXBsb2FkczogZmFsc2VcbiAgICAgIH0sXG4gICAgICB0b3RhbFByb2dyZXNzOiAwXG4gICAgfVxuXG4gICAgLy8gZm9yIGRlYnVnZ2luZyBhbmQgdGVzdGluZ1xuICAgIGlmICh0aGlzLm9wdHMuZGVidWcpIHtcbiAgICAgIGdsb2JhbC5VcHB5U3RhdGUgPSB0aGlzLnN0YXRlXG4gICAgICBnbG9iYWwudXBweUxvZyA9ICcnXG4gICAgICBnbG9iYWwuVXBweUFkZEZpbGUgPSB0aGlzLmFkZEZpbGUuYmluZCh0aGlzKVxuICAgICAgZ2xvYmFsLl9VcHB5ID0gdGhpc1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJdGVyYXRlIG9uIGFsbCBwbHVnaW5zIGFuZCBydW4gYHVwZGF0ZWAgb24gdGhlbS4gQ2FsbGVkIGVhY2ggdGltZSBzdGF0ZSBjaGFuZ2VzXG4gICAqXG4gICAqL1xuICB1cGRhdGVBbGwgKHN0YXRlKSB7XG4gICAgT2JqZWN0LmtleXModGhpcy5wbHVnaW5zKS5mb3JFYWNoKChwbHVnaW5UeXBlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbnNbcGx1Z2luVHlwZV0uZm9yRWFjaCgocGx1Z2luKSA9PiB7XG4gICAgICAgIHBsdWdpbi51cGRhdGUoc3RhdGUpXG4gICAgICB9KVxuICAgIH0pXG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlcyBzdGF0ZVxuICAgKlxuICAgKiBAcGFyYW0ge25ld1N0YXRlfSBvYmplY3RcbiAgICovXG4gIHNldFN0YXRlIChzdGF0ZVVwZGF0ZSkge1xuICAgIGNvbnN0IG5ld1N0YXRlID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5zdGF0ZSwgc3RhdGVVcGRhdGUpXG4gICAgdGhpcy5lbWl0KCdjb3JlOnN0YXRlLXVwZGF0ZScsIHRoaXMuc3RhdGUsIG5ld1N0YXRlLCBzdGF0ZVVwZGF0ZSlcblxuICAgIHRoaXMuc3RhdGUgPSBuZXdTdGF0ZVxuICAgIHRoaXMudXBkYXRlQWxsKHRoaXMuc3RhdGUpXG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBjdXJyZW50IHN0YXRlXG4gICAqXG4gICAqL1xuICBnZXRTdGF0ZSAoKSB7XG4gICAgLy8gdXNlIGRlZXBGcmVlemUgZm9yIGRlYnVnZ2luZ1xuICAgIC8vIHJldHVybiBkZWVwRnJlZXplKHRoaXMuc3RhdGUpXG4gICAgcmV0dXJuIHRoaXMuc3RhdGVcbiAgfVxuXG4gIHVwZGF0ZU1ldGEgKGRhdGEsIGZpbGVJRCkge1xuICAgIGNvbnN0IHVwZGF0ZWRGaWxlcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuZ2V0U3RhdGUoKS5maWxlcylcbiAgICBjb25zdCBuZXdNZXRhID0gT2JqZWN0LmFzc2lnbih7fSwgdXBkYXRlZEZpbGVzW2ZpbGVJRF0ubWV0YSwgZGF0YSlcbiAgICB1cGRhdGVkRmlsZXNbZmlsZUlEXSA9IE9iamVjdC5hc3NpZ24oe30sIHVwZGF0ZWRGaWxlc1tmaWxlSURdLCB7XG4gICAgICBtZXRhOiBuZXdNZXRhXG4gICAgfSlcbiAgICB0aGlzLnNldFN0YXRlKHtmaWxlczogdXBkYXRlZEZpbGVzfSlcbiAgfVxuXG4gIGFkZEZpbGUgKGZpbGUpIHtcbiAgICBjb25zdCB1cGRhdGVkRmlsZXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLnN0YXRlLmZpbGVzKVxuXG4gICAgY29uc3QgZmlsZU5hbWUgPSBmaWxlLm5hbWUgfHwgJ25vbmFtZSdcbiAgICBjb25zdCBmaWxlVHlwZSA9IFV0aWxzLmdldEZpbGVUeXBlKGZpbGUpID8gVXRpbHMuZ2V0RmlsZVR5cGUoZmlsZSkuc3BsaXQoJy8nKSA6IFsnJywgJyddXG4gICAgY29uc3QgZmlsZVR5cGVHZW5lcmFsID0gZmlsZVR5cGVbMF1cbiAgICBjb25zdCBmaWxlVHlwZVNwZWNpZmljID0gZmlsZVR5cGVbMV1cbiAgICBjb25zdCBmaWxlRXh0ZW5zaW9uID0gVXRpbHMuZ2V0RmlsZU5hbWVBbmRFeHRlbnNpb24oZmlsZU5hbWUpWzFdXG4gICAgY29uc3QgaXNSZW1vdGUgPSBmaWxlLmlzUmVtb3RlIHx8IGZhbHNlXG5cbiAgICBjb25zdCBmaWxlSUQgPSBVdGlscy5nZW5lcmF0ZUZpbGVJRChmaWxlTmFtZSlcblxuICAgIGNvbnN0IG5ld0ZpbGUgPSB7XG4gICAgICBzb3VyY2U6IGZpbGUuc291cmNlIHx8ICcnLFxuICAgICAgaWQ6IGZpbGVJRCxcbiAgICAgIG5hbWU6IGZpbGVOYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBmaWxlRXh0ZW5zaW9uIHx8ICcnLFxuICAgICAgbWV0YToge1xuICAgICAgICBuYW1lOiBmaWxlTmFtZVxuICAgICAgfSxcbiAgICAgIHR5cGU6IHtcbiAgICAgICAgZ2VuZXJhbDogZmlsZVR5cGVHZW5lcmFsLFxuICAgICAgICBzcGVjaWZpYzogZmlsZVR5cGVTcGVjaWZpY1xuICAgICAgfSxcbiAgICAgIGRhdGE6IGZpbGUuZGF0YSxcbiAgICAgIHByb2dyZXNzOiB7XG4gICAgICAgIHBlcmNlbnRhZ2U6IDAsXG4gICAgICAgIHVwbG9hZENvbXBsZXRlOiBmYWxzZSxcbiAgICAgICAgdXBsb2FkU3RhcnRlZDogZmFsc2VcbiAgICAgIH0sXG4gICAgICBzaXplOiBmaWxlLmRhdGEuc2l6ZSB8fCAwLFxuICAgICAgaXNSZW1vdGU6IGlzUmVtb3RlLFxuICAgICAgcmVtb3RlOiBmaWxlLnJlbW90ZSB8fCAnJ1xuICAgIH1cblxuICAgIHVwZGF0ZWRGaWxlc1tmaWxlSURdID0gbmV3RmlsZVxuICAgIHRoaXMuc2V0U3RhdGUoe2ZpbGVzOiB1cGRhdGVkRmlsZXN9KVxuXG4gICAgdGhpcy5idXMuZW1pdCgnZmlsZS1hZGRlZCcsIGZpbGVJRClcbiAgICB0aGlzLmxvZyhgQWRkZWQgZmlsZTogJHtmaWxlTmFtZX0sICR7ZmlsZUlEfWApXG5cbiAgICBpZiAoZmlsZVR5cGVHZW5lcmFsID09PSAnaW1hZ2UnICYmICFpc1JlbW90ZSkge1xuICAgICAgdGhpcy5hZGRUaHVtYm5haWwobmV3RmlsZS5pZClcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRzLmF1dG9Qcm9jZWVkKSB7XG4gICAgICB0aGlzLmJ1cy5lbWl0KCdjb3JlOnVwbG9hZCcpXG4gICAgfVxuICB9XG5cbiAgcmVtb3ZlRmlsZSAoZmlsZUlEKSB7XG4gICAgY29uc3QgdXBkYXRlZEZpbGVzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5nZXRTdGF0ZSgpLmZpbGVzKVxuICAgIGRlbGV0ZSB1cGRhdGVkRmlsZXNbZmlsZUlEXVxuICAgIHRoaXMuc2V0U3RhdGUoe2ZpbGVzOiB1cGRhdGVkRmlsZXN9KVxuICAgIHRoaXMubG9nKGBSZW1vdmVkIGZpbGU6ICR7ZmlsZUlEfWApXG4gIH1cblxuICBhZGRUaHVtYm5haWwgKGZpbGVJRCkge1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmdldFN0YXRlKCkuZmlsZXNbZmlsZUlEXVxuXG4gICAgVXRpbHMucmVhZEZpbGUoZmlsZS5kYXRhKVxuICAgICAgLnRoZW4oKGltZ0RhdGFVUkkpID0+IFV0aWxzLmNyZWF0ZUltYWdlVGh1bWJuYWlsKGltZ0RhdGFVUkksIDIwMCkpXG4gICAgICAudGhlbigodGh1bWJuYWlsKSA9PiB7XG4gICAgICAgIGNvbnN0IHVwZGF0ZWRGaWxlcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuZ2V0U3RhdGUoKS5maWxlcylcbiAgICAgICAgY29uc3QgdXBkYXRlZEZpbGUgPSBPYmplY3QuYXNzaWduKHt9LCB1cGRhdGVkRmlsZXNbZmlsZUlEXSwge1xuICAgICAgICAgIHByZXZpZXc6IHRodW1ibmFpbFxuICAgICAgICB9KVxuICAgICAgICB1cGRhdGVkRmlsZXNbZmlsZUlEXSA9IHVwZGF0ZWRGaWxlXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe2ZpbGVzOiB1cGRhdGVkRmlsZXN9KVxuICAgICAgfSlcbiAgfVxuXG4gIHN0YXJ0VXBsb2FkICgpIHtcbiAgICB0aGlzLmVtaXQoJ2NvcmU6dXBsb2FkJylcbiAgfVxuXG4gIGNhbGN1bGF0ZVByb2dyZXNzIChkYXRhKSB7XG4gICAgY29uc3QgZmlsZUlEID0gZGF0YS5pZFxuICAgIGNvbnN0IHVwZGF0ZWRGaWxlcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuZ2V0U3RhdGUoKS5maWxlcylcbiAgICBpZiAoIXVwZGF0ZWRGaWxlc1tmaWxlSURdKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdUcnlpbmcgdG8gc2V0IHByb2dyZXNzIGZvciBhIGZpbGUgdGhhdOKAmXMgbm90IHdpdGggdXMgYW55bW9yZTogJywgZmlsZUlEKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgY29uc3QgdXBkYXRlZEZpbGUgPSBPYmplY3QuYXNzaWduKHt9LCB1cGRhdGVkRmlsZXNbZmlsZUlEXSxcbiAgICAgIE9iamVjdC5hc3NpZ24oe30sIHtcbiAgICAgICAgcHJvZ3Jlc3M6IE9iamVjdC5hc3NpZ24oe30sIHVwZGF0ZWRGaWxlc1tmaWxlSURdLnByb2dyZXNzLCB7XG4gICAgICAgICAgYnl0ZXNVcGxvYWRlZDogZGF0YS5ieXRlc1VwbG9hZGVkLFxuICAgICAgICAgIGJ5dGVzVG90YWw6IGRhdGEuYnl0ZXNUb3RhbCxcbiAgICAgICAgICBwZXJjZW50YWdlOiBNYXRoLnJvdW5kKChkYXRhLmJ5dGVzVXBsb2FkZWQgLyBkYXRhLmJ5dGVzVG90YWwgKiAxMDApLnRvRml4ZWQoMikpXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgKSlcbiAgICB1cGRhdGVkRmlsZXNbZGF0YS5pZF0gPSB1cGRhdGVkRmlsZVxuXG4gICAgLy8gY2FsY3VsYXRlIHRvdGFsIHByb2dyZXNzLCB1c2luZyB0aGUgbnVtYmVyIG9mIGZpbGVzIGN1cnJlbnRseSB1cGxvYWRpbmcsXG4gICAgLy8gbXVsdGlwbGllZCBieSAxMDAgYW5kIHRoZSBzdW1tIG9mIGluZGl2aWR1YWwgcHJvZ3Jlc3Mgb2YgZWFjaCBmaWxlXG4gICAgY29uc3QgaW5Qcm9ncmVzcyA9IE9iamVjdC5rZXlzKHVwZGF0ZWRGaWxlcykuZmlsdGVyKChmaWxlKSA9PiB7XG4gICAgICByZXR1cm4gdXBkYXRlZEZpbGVzW2ZpbGVdLnByb2dyZXNzLnVwbG9hZFN0YXJ0ZWRcbiAgICB9KVxuICAgIGNvbnN0IHByb2dyZXNzTWF4ID0gaW5Qcm9ncmVzcy5sZW5ndGggKiAxMDBcbiAgICBsZXQgcHJvZ3Jlc3NBbGwgPSAwXG4gICAgaW5Qcm9ncmVzcy5mb3JFYWNoKChmaWxlKSA9PiB7XG4gICAgICBwcm9ncmVzc0FsbCA9IHByb2dyZXNzQWxsICsgdXBkYXRlZEZpbGVzW2ZpbGVdLnByb2dyZXNzLnBlcmNlbnRhZ2VcbiAgICB9KVxuXG4gICAgY29uc3QgdG90YWxQcm9ncmVzcyA9IE1hdGgucm91bmQoKHByb2dyZXNzQWxsICogMTAwIC8gcHJvZ3Jlc3NNYXgpLnRvRml4ZWQoMikpXG5cbiAgICAvLyBpZiAodG90YWxQcm9ncmVzcyA9PT0gMTAwKSB7XG4gICAgLy8gICBjb25zdCBjb21wbGV0ZUZpbGVzID0gT2JqZWN0LmtleXModXBkYXRlZEZpbGVzKS5maWx0ZXIoKGZpbGUpID0+IHtcbiAgICAvLyAgICAgLy8gdGhpcyBzaG91bGQgYmUgYHVwbG9hZENvbXBsZXRlYFxuICAgIC8vICAgICByZXR1cm4gdXBkYXRlZEZpbGVzW2ZpbGVdLnByb2dyZXNzLnBlcmNlbnRhZ2UgPT09IDEwMFxuICAgIC8vICAgfSlcbiAgICAvLyAgIHRoaXMuZW1pdCgnY29yZTpzdWNjZXNzJywgY29tcGxldGVGaWxlcy5sZW5ndGgpXG4gICAgLy8gfVxuXG4gICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICB0b3RhbFByb2dyZXNzOiB0b3RhbFByb2dyZXNzLFxuICAgICAgZmlsZXM6IHVwZGF0ZWRGaWxlc1xuICAgIH0pXG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIGxpc3RlbmVycyBmb3IgYWxsIGdsb2JhbCBhY3Rpb25zLCBsaWtlOlxuICAgKiBgZmlsZS1hZGRgLCBgZmlsZS1yZW1vdmVgLCBgdXBsb2FkLXByb2dyZXNzYCwgYHJlc2V0YFxuICAgKlxuICAgKi9cbiAgYWN0aW9ucyAoKSB7XG4gICAgLy8gdGhpcy5idXMub24oJyonLCAocGF5bG9hZCkgPT4ge1xuICAgIC8vICAgY29uc29sZS5sb2coJ2VtaXR0ZWQ6ICcsIHRoaXMuZXZlbnQpXG4gICAgLy8gICBjb25zb2xlLmxvZygnd2l0aCBwYXlsb2FkOiAnLCBwYXlsb2FkKVxuICAgIC8vIH0pXG5cbiAgICAvLyBjb25zdCBidXMgPSB0aGlzLmJ1c1xuXG4gICAgdGhpcy5vbignY29yZTpmaWxlLWFkZCcsIChkYXRhKSA9PiB7XG4gICAgICB0aGlzLmFkZEZpbGUoZGF0YSlcbiAgICB9KVxuXG4gICAgLy8gYHJlbW92ZS1maWxlYCByZW1vdmVzIGEgZmlsZSBmcm9tIGBzdGF0ZS5maWxlc2AsIGZvciBleGFtcGxlIHdoZW5cbiAgICAvLyBhIHVzZXIgZGVjaWRlcyBub3QgdG8gdXBsb2FkIHBhcnRpY3VsYXIgZmlsZSBhbmQgY2xpY2tzIGEgYnV0dG9uIHRvIHJlbW92ZSBpdFxuICAgIHRoaXMub24oJ2NvcmU6ZmlsZS1yZW1vdmUnLCAoZmlsZUlEKSA9PiB7XG4gICAgICB0aGlzLnJlbW92ZUZpbGUoZmlsZUlEKVxuICAgIH0pXG5cbiAgICB0aGlzLm9uKCdjb3JlOmNhbmNlbC1hbGwnLCAoKSA9PiB7XG4gICAgICBjb25zdCBmaWxlcyA9IHRoaXMuZ2V0U3RhdGUoKS5maWxlc1xuICAgICAgT2JqZWN0LmtleXMoZmlsZXMpLmZvckVhY2goKGZpbGUpID0+IHtcbiAgICAgICAgdGhpcy5yZW1vdmVGaWxlKGZpbGVzW2ZpbGVdLmlkKVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgdGhpcy5vbignY29yZTp1cGxvYWQtc3RhcnRlZCcsIChmaWxlSUQsIHVwbG9hZCkgPT4ge1xuICAgICAgY29uc3QgdXBkYXRlZEZpbGVzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5nZXRTdGF0ZSgpLmZpbGVzKVxuICAgICAgY29uc3QgdXBkYXRlZEZpbGUgPSBPYmplY3QuYXNzaWduKHt9LCB1cGRhdGVkRmlsZXNbZmlsZUlEXSxcbiAgICAgICAgT2JqZWN0LmFzc2lnbih7fSwge1xuICAgICAgICAgIHByb2dyZXNzOiBPYmplY3QuYXNzaWduKHt9LCB1cGRhdGVkRmlsZXNbZmlsZUlEXS5wcm9ncmVzcywge1xuICAgICAgICAgICAgdXBsb2FkU3RhcnRlZDogRGF0ZS5ub3coKVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICkpXG4gICAgICB1cGRhdGVkRmlsZXNbZmlsZUlEXSA9IHVwZGF0ZWRGaWxlXG5cbiAgICAgIHRoaXMuc2V0U3RhdGUoe2ZpbGVzOiB1cGRhdGVkRmlsZXN9KVxuICAgIH0pXG5cbiAgICAvLyBjb25zdCB0aHJvdHRsZWRDYWxjdWxhdGVQcm9ncmVzcyA9IHRocm90dGxlKDEwMDAsIChkYXRhKSA9PiB0aGlzLmNhbGN1bGF0ZVByb2dyZXNzKGRhdGEpKVxuXG4gICAgdGhpcy5vbignY29yZTp1cGxvYWQtcHJvZ3Jlc3MnLCAoZGF0YSkgPT4ge1xuICAgICAgdGhpcy5jYWxjdWxhdGVQcm9ncmVzcyhkYXRhKVxuICAgICAgLy8gdGhyb3R0bGVkQ2FsY3VsYXRlUHJvZ3Jlc3MoZGF0YSlcbiAgICB9KVxuXG4gICAgdGhpcy5vbignY29yZTp1cGxvYWQtc3VjY2VzcycsIChmaWxlSUQsIHVwbG9hZFVSTCkgPT4ge1xuICAgICAgY29uc3QgdXBkYXRlZEZpbGVzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5nZXRTdGF0ZSgpLmZpbGVzKVxuICAgICAgY29uc3QgdXBkYXRlZEZpbGUgPSBPYmplY3QuYXNzaWduKHt9LCB1cGRhdGVkRmlsZXNbZmlsZUlEXSwge1xuICAgICAgICBwcm9ncmVzczogT2JqZWN0LmFzc2lnbih7fSwgdXBkYXRlZEZpbGVzW2ZpbGVJRF0ucHJvZ3Jlc3MsIHtcbiAgICAgICAgICB1cGxvYWRDb21wbGV0ZTogdHJ1ZVxuICAgICAgICB9KSxcbiAgICAgICAgdXBsb2FkVVJMOiB1cGxvYWRVUkxcbiAgICAgIH0pXG4gICAgICB1cGRhdGVkRmlsZXNbZmlsZUlEXSA9IHVwZGF0ZWRGaWxlXG5cbiAgICAgIC8vIGNvbnNvbGUubG9nKHRoaXMuZ2V0U3RhdGUoKS50b3RhbFByb2dyZXNzKVxuXG4gICAgICBpZiAodGhpcy5nZXRTdGF0ZSgpLnRvdGFsUHJvZ3Jlc3MgPT09IDEwMCkge1xuICAgICAgICBjb25zdCBjb21wbGV0ZUZpbGVzID0gT2JqZWN0LmtleXModXBkYXRlZEZpbGVzKS5maWx0ZXIoKGZpbGUpID0+IHtcbiAgICAgICAgICAvLyB0aGlzIHNob3VsZCBiZSBgdXBsb2FkQ29tcGxldGVgXG4gICAgICAgICAgcmV0dXJuIHVwZGF0ZWRGaWxlc1tmaWxlXS5wcm9ncmVzcy51cGxvYWRDb21wbGV0ZVxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmVtaXQoJ2NvcmU6c3VjY2VzcycsIGNvbXBsZXRlRmlsZXMubGVuZ3RoKVxuICAgICAgfVxuXG4gICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgZmlsZXM6IHVwZGF0ZWRGaWxlc1xuICAgICAgfSlcbiAgICB9KVxuXG4gICAgdGhpcy5vbignY29yZTp1cGRhdGUtbWV0YScsIChkYXRhLCBmaWxlSUQpID0+IHtcbiAgICAgIHRoaXMudXBkYXRlTWV0YShkYXRhLCBmaWxlSUQpXG4gICAgfSlcblxuICAgIC8vIHNob3cgaW5mb3JtZXIgaWYgb2ZmbGluZVxuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ29ubGluZScsICgpID0+IHRoaXMuaXNPbmxpbmUodHJ1ZSkpXG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignb2ZmbGluZScsICgpID0+IHRoaXMuaXNPbmxpbmUoZmFsc2UpKVxuICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLmlzT25saW5lKCksIDMwMDApXG4gICAgfVxuICB9XG5cbiAgaXNPbmxpbmUgKHN0YXR1cykge1xuICAgIGNvbnN0IG9ubGluZSA9IHN0YXR1cyB8fCB3aW5kb3cubmF2aWdhdG9yLm9uTGluZVxuICAgIGlmICghb25saW5lKSB7XG4gICAgICB0aGlzLmVtaXQoJ2lzLW9mZmxpbmUnKVxuICAgICAgdGhpcy5lbWl0KCdpbmZvcm1lcicsICdObyBpbnRlcm5ldCBjb25uZWN0aW9uJywgJ2Vycm9yJywgMClcbiAgICAgIHRoaXMud2FzT2ZmbGluZSA9IHRydWVcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5lbWl0KCdpcy1vbmxpbmUnKVxuICAgICAgaWYgKHRoaXMud2FzT2ZmbGluZSkge1xuICAgICAgICB0aGlzLmVtaXQoJ2luZm9ybWVyJywgJ0Nvbm5lY3RlZCEnLCAnc3VjY2VzcycsIDMwMDApXG4gICAgICAgIHRoaXMud2FzT2ZmbGluZSA9IGZhbHNlXG4gICAgICB9XG4gICAgfVxuICB9XG5cbi8qKlxuICogUmVnaXN0ZXJzIGEgcGx1Z2luIHdpdGggQ29yZVxuICpcbiAqIEBwYXJhbSB7Q2xhc3N9IFBsdWdpbiBvYmplY3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIG9iamVjdCB0aGF0IHdpbGwgYmUgcGFzc2VkIHRvIFBsdWdpbiBsYXRlclxuICogQHJldHVybiB7T2JqZWN0fSBzZWxmIGZvciBjaGFpbmluZ1xuICovXG4gIHVzZSAoUGx1Z2luLCBvcHRzKSB7XG4gICAgLy8gUHJlcGFyZSBwcm9wcyB0byBwYXNzIHRvIHBsdWdpbnNcbiAgICAvLyBjb25zdCBwcm9wcyA9IHtcbiAgICAvLyAgIGdldFN0YXRlOiB0aGlzLmdldFN0YXRlLmJpbmQodGhpcyksXG4gICAgLy8gICBzZXRTdGF0ZTogdGhpcy5zZXRTdGF0ZS5iaW5kKHRoaXMpLFxuICAgIC8vICAgdXBkYXRlTWV0YTogdGhpcy51cGRhdGVNZXRhLmJpbmQodGhpcyksXG4gICAgLy8gICBhZGRGaWxlOiB0aGlzLmFkZEZpbGUuYmluZCh0aGlzKSxcbiAgICAvLyAgIGkxOG46IHRoaXMuaTE4bi5iaW5kKHRoaXMpLFxuICAgIC8vICAgYnVzOiB0aGlzLmVlLFxuICAgIC8vICAgbG9nOiB0aGlzLmxvZy5iaW5kKHRoaXMpXG4gICAgLy8gfVxuXG4gICAgLy8gSW5zdGFudGlhdGVcbiAgICBjb25zdCBwbHVnaW4gPSBuZXcgUGx1Z2luKHRoaXMsIG9wdHMpXG4gICAgY29uc3QgcGx1Z2luTmFtZSA9IHBsdWdpbi5pZFxuICAgIHRoaXMucGx1Z2luc1twbHVnaW4udHlwZV0gPSB0aGlzLnBsdWdpbnNbcGx1Z2luLnR5cGVdIHx8IFtdXG5cbiAgICBpZiAoIXBsdWdpbk5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignWW91ciBwbHVnaW4gbXVzdCBoYXZlIGEgbmFtZScpXG4gICAgfVxuXG4gICAgaWYgKCFwbHVnaW4udHlwZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3VyIHBsdWdpbiBtdXN0IGhhdmUgYSB0eXBlJylcbiAgICB9XG5cbiAgICBsZXQgZXhpc3RzUGx1Z2luQWxyZWFkeSA9IHRoaXMuZ2V0UGx1Z2luKHBsdWdpbk5hbWUpXG4gICAgaWYgKGV4aXN0c1BsdWdpbkFscmVhZHkpIHtcbiAgICAgIGxldCBtc2cgPSBgQWxyZWFkeSBmb3VuZCBhIHBsdWdpbiBuYW1lZCAnJHtleGlzdHNQbHVnaW5BbHJlYWR5Lm5hbWV9Jy5cbiAgICAgICAgVHJpZWQgdG8gdXNlOiAnJHtwbHVnaW5OYW1lfScuXG4gICAgICAgIFVwcHkgaXMgY3VycmVudGx5IGxpbWl0ZWQgdG8gcnVubmluZyBvbmUgb2YgZXZlcnkgcGx1Z2luLlxuICAgICAgICBTaGFyZSB5b3VyIHVzZSBjYXNlIHdpdGggdXMgb3ZlciBhdFxuICAgICAgICBodHRwczovL2dpdGh1Yi5jb20vdHJhbnNsb2FkaXQvdXBweS9pc3N1ZXMvXG4gICAgICAgIGlmIHlvdSB3YW50IHVzIHRvIHJlY29uc2lkZXIuYFxuICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZylcbiAgICB9XG5cbiAgICB0aGlzLnBsdWdpbnNbcGx1Z2luLnR5cGVdLnB1c2gocGx1Z2luKVxuICAgIHBsdWdpbi5pbnN0YWxsKClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuLyoqXG4gKiBGaW5kIG9uZSBQbHVnaW4gYnkgbmFtZVxuICpcbiAqIEBwYXJhbSBzdHJpbmcgbmFtZSBkZXNjcmlwdGlvblxuICovXG4gIGdldFBsdWdpbiAobmFtZSkge1xuICAgIGxldCBmb3VuZFBsdWdpbiA9IGZhbHNlXG4gICAgdGhpcy5pdGVyYXRlUGx1Z2lucygocGx1Z2luKSA9PiB7XG4gICAgICBjb25zdCBwbHVnaW5OYW1lID0gcGx1Z2luLmlkXG4gICAgICBpZiAocGx1Z2luTmFtZSA9PT0gbmFtZSkge1xuICAgICAgICBmb3VuZFBsdWdpbiA9IHBsdWdpblxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiBmb3VuZFBsdWdpblxuICB9XG5cbi8qKlxuICogSXRlcmF0ZSB0aHJvdWdoIGFsbCBgdXNlYGQgcGx1Z2luc1xuICpcbiAqIEBwYXJhbSBmdW5jdGlvbiBtZXRob2QgZGVzY3JpcHRpb25cbiAqL1xuICBpdGVyYXRlUGx1Z2lucyAobWV0aG9kKSB7XG4gICAgT2JqZWN0LmtleXModGhpcy5wbHVnaW5zKS5mb3JFYWNoKChwbHVnaW5UeXBlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbnNbcGx1Z2luVHlwZV0uZm9yRWFjaChtZXRob2QpXG4gICAgfSlcbiAgfVxuXG4vKipcbiAqIExvZ3Mgc3R1ZmYgdG8gY29uc29sZSwgb25seSBpZiBgZGVidWdgIGlzIHNldCB0byB0cnVlLiBTaWxlbnQgaW4gcHJvZHVjdGlvbi5cbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmd8T2JqZWN0fSB0byBsb2dcbiAqL1xuICBsb2cgKG1zZywgdHlwZSkge1xuICAgIGlmICghdGhpcy5vcHRzLmRlYnVnKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgaWYgKG1zZyA9PT0gYCR7bXNnfWApIHtcbiAgICAgIGNvbnNvbGUubG9nKGBMT0c6ICR7bXNnfWApXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZGlyKG1zZylcbiAgICB9XG5cbiAgICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgICAgY29uc29sZS5lcnJvcihgTE9HOiAke21zZ31gKVxuICAgIH1cblxuICAgIGdsb2JhbC51cHB5TG9nID0gZ2xvYmFsLnVwcHlMb2cgKyAnXFxuJyArICdERUJVRyBMT0c6ICcgKyBtc2dcbiAgfVxuXG4gIGluaXRTb2NrZXQgKG9wdHMpIHtcbiAgICBpZiAoIXRoaXMuc29ja2V0KSB7XG4gICAgICB0aGlzLnNvY2tldCA9IG5ldyBVcHB5U29ja2V0KG9wdHMpXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuc29ja2V0XG4gIH1cblxuICAvLyBpbnN0YWxsQWxsICgpIHtcbiAgLy8gICBPYmplY3Qua2V5cyh0aGlzLnBsdWdpbnMpLmZvckVhY2goKHBsdWdpblR5cGUpID0+IHtcbiAgLy8gICAgIHRoaXMucGx1Z2luc1twbHVnaW5UeXBlXS5mb3JFYWNoKChwbHVnaW4pID0+IHtcbiAgLy8gICAgICAgcGx1Z2luLmluc3RhbGwodGhpcylcbiAgLy8gICAgIH0pXG4gIC8vICAgfSlcbiAgLy8gfVxuXG4vKipcbiAqIEluaXRpYWxpemVzIGFjdGlvbnMsIGluc3RhbGxzIGFsbCBwbHVnaW5zIChieSBpdGVyYXRpbmcgb24gdGhlbSBhbmQgY2FsbGluZyBgaW5zdGFsbGApLCBzZXRzIG9wdGlvbnNcbiAqXG4gKi9cbiAgcnVuICgpIHtcbiAgICB0aGlzLmxvZygnQ29yZSBpcyBydW4sIGluaXRpYWxpemluZyBhY3Rpb25zLi4uJylcblxuICAgIHRoaXMuYWN0aW9ucygpXG5cbiAgICAvLyBGb3JzZSBzZXQgYGF1dG9Qcm9jZWVkYCBvcHRpb24gdG8gZmFsc2UgaWYgdGhlcmUgYXJlIG11bHRpcGxlIHNlbGVjdG9yIFBsdWdpbnMgYWN0aXZlXG4gICAgLy8gaWYgKHRoaXMucGx1Z2lucy5hY3F1aXJlciAmJiB0aGlzLnBsdWdpbnMuYWNxdWlyZXIubGVuZ3RoID4gMSkge1xuICAgIC8vICAgdGhpcy5vcHRzLmF1dG9Qcm9jZWVkID0gZmFsc2VcbiAgICAvLyB9XG5cbiAgICAvLyBJbnN0YWxsIGFsbCBwbHVnaW5zXG4gICAgLy8gdGhpcy5pbnN0YWxsQWxsKClcblxuICAgIHJldHVyblxuICB9XG59XG5cbi8vIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9wdHMpIHtcbi8vICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFVwcHkpKSB7XG4vLyAgICAgcmV0dXJuIG5ldyBVcHB5KG9wdHMpXG4vLyAgIH1cbi8vIH1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKG9wdHMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFVwcHkpKSB7XG4gICAgcmV0dXJuIG5ldyBVcHB5KG9wdHMpXG4gIH1cbn1cbiIsImltcG9ydCBlbl9VUyBmcm9tICcuLi9sb2NhbGVzL2VuX1VTJ1xuXG4vKipcbiAqIFRyYW5zbGF0ZXMgc3RyaW5ncyB3aXRoIGludGVycG9sYXRpb24gJiBwbHVyYWxpemF0aW9uIHN1cHBvcnQuRXh0ZW5zaWJsZSB3aXRoIGN1c3RvbSBkaWN0aW9uYXJpZXNcbiAqIGFuZCBwbHVyYWxpemF0aW9uIGZ1bmN0aW9ucy5cbiAqXG4gKiBCb3Jyb3dzIGhlYXZpbHkgZnJvbSBhbmQgaW5zcGlyZWQgYnkgUG9seWdsb3QgaHR0cHM6Ly9naXRodWIuY29tL2FpcmJuYi9wb2x5Z2xvdC5qcyxcbiAqIGJhc2ljYWxseSBhIHN0cmlwcGVkLWRvd24gdmVyc2lvbiBvZiBpdC4gRGlmZmVyZW5jZXM6IHBsdXJhbGl6YXRpb24gZnVuY3Rpb25zIGFyZSBub3QgaGFyZGNvZGVkXG4gKiBhbmQgY2FuIGJlIGVhc2lseSBhZGRlZCBhbW9uZyB3aXRoIGRpY3Rpb25hcmllcywgbmVzdGVkIG9iamVjdHMgYXJlIHVzZWQgZm9yIHBsdXJhbGl6YXRpb25cbiAqIGFzIG9wcG9zZWQgdG8gYHx8fHxgIGRlbGltZXRlclxuICpcbiAqIFVzYWdlIGV4YW1wbGU6IGB0cmFuc2xhdG9yLnRyYW5zbGF0ZSgnZmlsZXNfY2hvc2VuJywge3NtYXJ0X2NvdW50OiAzfSlgXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IG9wdHNcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVHJhbnNsYXRvciB7XG4gIGNvbnN0cnVjdG9yIChvcHRzKSB7XG4gICAgY29uc3QgZGVmYXVsdE9wdGlvbnMgPSB7XG4gICAgICBsb2NhbGU6IGVuX1VTXG4gICAgfVxuICAgIHRoaXMub3B0cyA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRPcHRpb25zLCBvcHRzKVxuICAgIHRoaXMubG9jYWxlID0gdGhpcy5vcHRzLmxvY2FsZVxuICAgIHRoaXMubG9jYWxlLnN0cmluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBlbl9VUy5zdHJpbmdzLCB0aGlzLm9wdHMubG9jYWxlLnN0cmluZ3MpXG4gIH1cblxuLyoqXG4gKiBUYWtlcyBhIHN0cmluZyB3aXRoIHBsYWNlaG9sZGVyIHZhcmlhYmxlcyBsaWtlIGAle3NtYXJ0X2NvdW50fSBmaWxlIHNlbGVjdGVkYFxuICogYW5kIHJlcGxhY2VzIGl0IHdpdGggdmFsdWVzIGZyb20gb3B0aW9ucyBge3NtYXJ0X2NvdW50OiA1fWBcbiAqXG4gKiBAbGljZW5zZSBodHRwczovL2dpdGh1Yi5jb20vYWlyYm5iL3BvbHlnbG90LmpzL2Jsb2IvbWFzdGVyL0xJQ0VOU0VcbiAqIHRha2VuIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2FpcmJuYi9wb2x5Z2xvdC5qcy9ibG9iL21hc3Rlci9saWIvcG9seWdsb3QuanMjTDI5OVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBwaHJhc2UgdGhhdCBuZWVkcyBpbnRlcnBvbGF0aW9uLCB3aXRoIHBsYWNlaG9sZGVyc1xuICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgd2l0aCB2YWx1ZXMgdGhhdCB3aWxsIGJlIHVzZWQgdG8gcmVwbGFjZSBwbGFjZWhvbGRlcnNcbiAqIEByZXR1cm4ge3N0cmluZ30gaW50ZXJwb2xhdGVkXG4gKi9cbiAgaW50ZXJwb2xhdGUgKHBocmFzZSwgb3B0aW9ucykge1xuICAgIGNvbnN0IHJlcGxhY2UgPSBTdHJpbmcucHJvdG90eXBlLnJlcGxhY2VcbiAgICBjb25zdCBkb2xsYXJSZWdleCA9IC9cXCQvZ1xuICAgIGNvbnN0IGRvbGxhckJpbGxzWWFsbCA9ICckJCQkJ1xuXG4gICAgZm9yIChsZXQgYXJnIGluIG9wdGlvbnMpIHtcbiAgICAgIGlmIChhcmcgIT09ICdfJyAmJiBvcHRpb25zLmhhc093blByb3BlcnR5KGFyZykpIHtcbiAgICAgICAgLy8gRW5zdXJlIHJlcGxhY2VtZW50IHZhbHVlIGlzIGVzY2FwZWQgdG8gcHJldmVudCBzcGVjaWFsICQtcHJlZml4ZWRcbiAgICAgICAgLy8gcmVnZXggcmVwbGFjZSB0b2tlbnMuIHRoZSBcIiQkJCRcIiBpcyBuZWVkZWQgYmVjYXVzZSBlYWNoIFwiJFwiIG5lZWRzIHRvXG4gICAgICAgIC8vIGJlIGVzY2FwZWQgd2l0aCBcIiRcIiBpdHNlbGYsIGFuZCB3ZSBuZWVkIHR3byBpbiB0aGUgcmVzdWx0aW5nIG91dHB1dC5cbiAgICAgICAgdmFyIHJlcGxhY2VtZW50ID0gb3B0aW9uc1thcmddXG4gICAgICAgIGlmICh0eXBlb2YgcmVwbGFjZW1lbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgcmVwbGFjZW1lbnQgPSByZXBsYWNlLmNhbGwob3B0aW9uc1thcmddLCBkb2xsYXJSZWdleCwgZG9sbGFyQmlsbHNZYWxsKVxuICAgICAgICB9XG4gICAgICAgIC8vIFdlIGNyZWF0ZSBhIG5ldyBgUmVnRXhwYCBlYWNoIHRpbWUgaW5zdGVhZCBvZiB1c2luZyBhIG1vcmUtZWZmaWNpZW50XG4gICAgICAgIC8vIHN0cmluZyByZXBsYWNlIHNvIHRoYXQgdGhlIHNhbWUgYXJndW1lbnQgY2FuIGJlIHJlcGxhY2VkIG11bHRpcGxlIHRpbWVzXG4gICAgICAgIC8vIGluIHRoZSBzYW1lIHBocmFzZS5cbiAgICAgICAgcGhyYXNlID0gcmVwbGFjZS5jYWxsKHBocmFzZSwgbmV3IFJlZ0V4cCgnJVxcXFx7JyArIGFyZyArICdcXFxcfScsICdnJyksIHJlcGxhY2VtZW50KVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcGhyYXNlXG4gIH1cblxuLyoqXG4gKiBQdWJsaWMgdHJhbnNsYXRlIG1ldGhvZFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIHdpdGggdmFsdWVzIHRoYXQgd2lsbCBiZSB1c2VkIGxhdGVyIHRvIHJlcGxhY2UgcGxhY2Vob2xkZXJzIGluIHN0cmluZ1xuICogQHJldHVybiB7c3RyaW5nfSB0cmFuc2xhdGVkIChhbmQgaW50ZXJwb2xhdGVkKVxuICovXG4gIHRyYW5zbGF0ZSAoa2V5LCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5zbWFydF9jb3VudCkge1xuICAgICAgdmFyIHBsdXJhbCA9IHRoaXMubG9jYWxlLnBsdXJhbGl6ZShvcHRpb25zLnNtYXJ0X2NvdW50KVxuICAgICAgcmV0dXJuIHRoaXMuaW50ZXJwb2xhdGUodGhpcy5vcHRzLmxvY2FsZS5zdHJpbmdzW2tleV1bcGx1cmFsXSwgb3B0aW9ucylcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pbnRlcnBvbGF0ZSh0aGlzLm9wdHMubG9jYWxlLnN0cmluZ3Nba2V5XSwgb3B0aW9ucylcbiAgfVxufVxuIiwiaW1wb3J0IGVlIGZyb20gJ25hbWVzcGFjZS1lbWl0dGVyJ1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVcHB5U29ja2V0IHtcbiAgY29uc3RydWN0b3IgKG9wdHMpIHtcbiAgICB0aGlzLnF1ZXVlZCA9IFtdXG4gICAgdGhpcy5pc09wZW4gPSBmYWxzZVxuICAgIHRoaXMuc29ja2V0ID0gbmV3IFdlYlNvY2tldChvcHRzLnRhcmdldClcbiAgICB0aGlzLmVtaXR0ZXIgPSBlZSgpXG5cbiAgICB0aGlzLnNvY2tldC5vbm9wZW4gPSAoZSkgPT4ge1xuICAgICAgdGhpcy5pc09wZW4gPSB0cnVlXG5cbiAgICAgIHdoaWxlICh0aGlzLnF1ZXVlZC5sZW5ndGggPiAwICYmIHRoaXMuaXNPcGVuKSB7XG4gICAgICAgIGNvbnN0IGZpcnN0ID0gdGhpcy5xdWV1ZWRbMF1cbiAgICAgICAgdGhpcy5zZW5kKGZpcnN0LmFjdGlvbiwgZmlyc3QucGF5bG9hZClcbiAgICAgICAgdGhpcy5xdWV1ZWQgPSB0aGlzLnF1ZXVlZC5zbGljZSgxKVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc29ja2V0Lm9uY2xvc2UgPSAoZSkgPT4ge1xuICAgICAgdGhpcy5pc09wZW4gPSBmYWxzZVxuICAgIH1cblxuICAgIHRoaXMuX2hhbmRsZU1lc3NhZ2UgPSB0aGlzLl9oYW5kbGVNZXNzYWdlLmJpbmQodGhpcylcblxuICAgIHRoaXMuc29ja2V0Lm9ubWVzc2FnZSA9IHRoaXMuX2hhbmRsZU1lc3NhZ2VcblxuICAgIHRoaXMuY2xvc2UgPSB0aGlzLmNsb3NlLmJpbmQodGhpcylcbiAgICB0aGlzLmVtaXQgPSB0aGlzLmVtaXQuYmluZCh0aGlzKVxuICAgIHRoaXMub24gPSB0aGlzLm9uLmJpbmQodGhpcylcbiAgICB0aGlzLm9uY2UgPSB0aGlzLm9uY2UuYmluZCh0aGlzKVxuICAgIHRoaXMuc2VuZCA9IHRoaXMuc2VuZC5iaW5kKHRoaXMpXG4gIH1cblxuICBjbG9zZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuc29ja2V0LmNsb3NlKClcbiAgfVxuXG4gIHNlbmQgKGFjdGlvbiwgcGF5bG9hZCkge1xuICAgIC8vIGF0dGFjaCB1dWlkXG5cbiAgICBpZiAoIXRoaXMuaXNPcGVuKSB7XG4gICAgICB0aGlzLnF1ZXVlZC5wdXNoKHthY3Rpb24sIHBheWxvYWR9KVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgdGhpcy5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICBhY3Rpb24sXG4gICAgICBwYXlsb2FkXG4gICAgfSkpXG4gIH1cblxuICBvbiAoYWN0aW9uLCBoYW5kbGVyKSB7XG4gICAgdGhpcy5lbWl0dGVyLm9uKGFjdGlvbiwgaGFuZGxlcilcbiAgfVxuXG4gIGVtaXQgKGFjdGlvbiwgcGF5bG9hZCkge1xuICAgIHRoaXMuZW1pdHRlci5lbWl0KGFjdGlvbiwgcGF5bG9hZClcbiAgfVxuXG4gIG9uY2UgKGFjdGlvbiwgaGFuZGxlcikge1xuICAgIHRoaXMuZW1pdHRlci5vbmNlKGFjdGlvbiwgaGFuZGxlcilcbiAgfVxuXG4gIF9oYW5kbGVNZXNzYWdlIChlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBKU09OLnBhcnNlKGUuZGF0YSlcbiAgICAgIHRoaXMuZW1pdChtZXNzYWdlLmFjdGlvbiwgbWVzc2FnZS5wYXlsb2FkKVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS5sb2coZXJyKVxuICAgIH1cbiAgfVxufVxuIiwiLy8gaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcydcbi8vIGltcG9ydCBwaWNhIGZyb20gJ3BpY2EnXG5cbi8qKlxuICogQSBjb2xsZWN0aW9uIG9mIHNtYWxsIHV0aWxpdHkgZnVuY3Rpb25zIHRoYXQgaGVscCB3aXRoIGRvbSBtYW5pcHVsYXRpb24sIGFkZGluZyBsaXN0ZW5lcnMsXG4gKiBwcm9taXNlcyBhbmQgb3RoZXIgZ29vZCB0aGluZ3MuXG4gKlxuICogQG1vZHVsZSBVdGlsc1xuICovXG5cbi8qKlxuICogU2hhbGxvdyBmbGF0dGVuIG5lc3RlZCBhcnJheXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmbGF0dGVuIChhcnIpIHtcbiAgcmV0dXJuIFtdLmNvbmNhdC5hcHBseShbXSwgYXJyKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNUb3VjaERldmljZSAoKSB7XG4gIHJldHVybiAnb250b3VjaHN0YXJ0JyBpbiB3aW5kb3cgfHwgLy8gd29ya3Mgb24gbW9zdCBicm93c2Vyc1xuICAgICAgICAgIG5hdmlnYXRvci5tYXhUb3VjaFBvaW50cyAgIC8vIHdvcmtzIG9uIElFMTAvMTEgYW5kIFN1cmZhY2Vcbn1cblxuLyoqXG4gKiBTaG9ydGVyIGFuZCBmYXN0IHdheSB0byBzZWxlY3QgYSBzaW5nbGUgbm9kZSBpbiB0aGUgRE9NXG4gKiBAcGFyYW0gICB7IFN0cmluZyB9IHNlbGVjdG9yIC0gdW5pcXVlIGRvbSBzZWxlY3RvclxuICogQHBhcmFtICAgeyBPYmplY3QgfSBjdHggLSBET00gbm9kZSB3aGVyZSB0aGUgdGFyZ2V0IG9mIG91ciBzZWFyY2ggd2lsbCBpcyBsb2NhdGVkXG4gKiBAcmV0dXJucyB7IE9iamVjdCB9IGRvbSBub2RlIGZvdW5kXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiAkIChzZWxlY3RvciwgY3R4KSB7XG4gIHJldHVybiAoY3R4IHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKVxufVxuXG4vKipcbiAqIFNob3J0ZXIgYW5kIGZhc3Qgd2F5IHRvIHNlbGVjdCBtdWx0aXBsZSBub2RlcyBpbiB0aGUgRE9NXG4gKiBAcGFyYW0gICB7IFN0cmluZ3xBcnJheSB9IHNlbGVjdG9yIC0gRE9NIHNlbGVjdG9yIG9yIG5vZGVzIGxpc3RcbiAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gY3R4IC0gRE9NIG5vZGUgd2hlcmUgdGhlIHRhcmdldHMgb2Ygb3VyIHNlYXJjaCB3aWxsIGlzIGxvY2F0ZWRcbiAqIEByZXR1cm5zIHsgT2JqZWN0IH0gZG9tIG5vZGVzIGZvdW5kXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiAkJCAoc2VsZWN0b3IsIGN0eCkge1xuICB2YXIgZWxzXG4gIGlmICh0eXBlb2Ygc2VsZWN0b3IgPT09ICdzdHJpbmcnKSB7XG4gICAgZWxzID0gKGN0eCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcilcbiAgfSBlbHNlIHtcbiAgICBlbHMgPSBzZWxlY3RvclxuICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChlbHMpXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRydW5jYXRlU3RyaW5nIChzdHIsIGxlbmd0aCkge1xuICBpZiAoc3RyLmxlbmd0aCA+IGxlbmd0aCkge1xuICAgIHJldHVybiBzdHIuc3Vic3RyKDAsIGxlbmd0aCAvIDIpICsgJy4uLicgKyBzdHIuc3Vic3RyKHN0ci5sZW5ndGggLSBsZW5ndGggLyA0LCBzdHIubGVuZ3RoKVxuICB9XG4gIHJldHVybiBzdHJcblxuICAvLyBtb3JlIHByZWNpc2UgdmVyc2lvbiBpZiBuZWVkZWRcbiAgLy8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvODMxNTgzXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZWNvbmRzVG9UaW1lIChyYXdTZWNvbmRzKSB7XG4gIGNvbnN0IGhvdXJzID0gTWF0aC5mbG9vcihyYXdTZWNvbmRzIC8gMzYwMCkgJSAyNFxuICBjb25zdCBtaW51dGVzID0gTWF0aC5mbG9vcihyYXdTZWNvbmRzIC8gNjApICUgNjBcbiAgY29uc3Qgc2Vjb25kcyA9IE1hdGguZmxvb3IocmF3U2Vjb25kcyAlIDYwKVxuXG4gIHJldHVybiB7IGhvdXJzLCBtaW51dGVzLCBzZWNvbmRzIH1cbn1cblxuLyoqXG4gKiBQYXJ0aXRpb24gYXJyYXkgYnkgYSBncm91cGluZyBmdW5jdGlvbi5cbiAqIEBwYXJhbSAge1t0eXBlXX0gYXJyYXkgICAgICBJbnB1dCBhcnJheVxuICogQHBhcmFtICB7W3R5cGVdfSBncm91cGluZ0ZuIEdyb3VwaW5nIGZ1bmN0aW9uXG4gKiBAcmV0dXJuIHtbdHlwZV19ICAgICAgICAgICAgQXJyYXkgb2YgYXJyYXlzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBncm91cEJ5IChhcnJheSwgZ3JvdXBpbmdGbikge1xuICByZXR1cm4gYXJyYXkucmVkdWNlKChyZXN1bHQsIGl0ZW0pID0+IHtcbiAgICBsZXQga2V5ID0gZ3JvdXBpbmdGbihpdGVtKVxuICAgIGxldCB4cyA9IHJlc3VsdC5nZXQoa2V5KSB8fCBbXVxuICAgIHhzLnB1c2goaXRlbSlcbiAgICByZXN1bHQuc2V0KGtleSwgeHMpXG4gICAgcmV0dXJuIHJlc3VsdFxuICB9LCBuZXcgTWFwKCkpXG59XG5cbi8qKlxuICogVGVzdHMgaWYgZXZlcnkgYXJyYXkgZWxlbWVudCBwYXNzZXMgcHJlZGljYXRlXG4gKiBAcGFyYW0gIHtBcnJheX0gIGFycmF5ICAgICAgIElucHV0IGFycmF5XG4gKiBAcGFyYW0gIHtPYmplY3R9IHByZWRpY2F0ZUZuIFByZWRpY2F0ZVxuICogQHJldHVybiB7Ym9vbH0gICAgICAgICAgICAgICBFdmVyeSBlbGVtZW50IHBhc3NcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV2ZXJ5IChhcnJheSwgcHJlZGljYXRlRm4pIHtcbiAgcmV0dXJuIGFycmF5LnJlZHVjZSgocmVzdWx0LCBpdGVtKSA9PiB7XG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIHJldHVybiBwcmVkaWNhdGVGbihpdGVtKVxuICB9LCB0cnVlKVxufVxuXG4vKipcbiAqIENvbnZlcnRzIGxpc3QgaW50byBhcnJheVxuKi9cbmV4cG9ydCBmdW5jdGlvbiB0b0FycmF5IChsaXN0KSB7XG4gIHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChsaXN0IHx8IFtdLCAwKVxufVxuXG4vKipcbiAqIFRha2VzIGEgZmlsZU5hbWUgYW5kIHR1cm5zIGl0IGludG8gZmlsZUlELCBieSBjb252ZXJ0aW5nIHRvIGxvd2VyY2FzZSxcbiAqIHJlbW92aW5nIGV4dHJhIGNoYXJhY3RlcnMgYW5kIGFkZGluZyB1bml4IHRpbWVzdGFtcFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBmaWxlTmFtZVxuICpcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlRmlsZUlEIChmaWxlTmFtZSkge1xuICBsZXQgZmlsZUlEID0gZmlsZU5hbWUudG9Mb3dlckNhc2UoKVxuICBmaWxlSUQgPSBmaWxlSUQucmVwbGFjZSgvW15BLVowLTldL2lnLCAnJylcbiAgZmlsZUlEID0gZmlsZUlEICsgRGF0ZS5ub3coKVxuICByZXR1cm4gZmlsZUlEXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHRlbmQgKC4uLm9ianMpIHtcbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24uYXBwbHkodGhpcywgW3t9XS5jb25jYXQob2JqcykpXG59XG5cbi8qKlxuICogVGFrZXMgZnVuY3Rpb24gb3IgY2xhc3MsIHJldHVybnMgaXRzIG5hbWUuXG4gKiBCZWNhdXNlIElFIGRvZXNu4oCZdCBzdXBwb3J0IGBjb25zdHJ1Y3Rvci5uYW1lYC5cbiAqIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL2Rma2F5ZS82Mzg0NDM5LCBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNTcxNDQ0NVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBmbiDigJQgZnVuY3Rpb25cbiAqXG4gKi9cbi8vIGZ1bmN0aW9uIGdldEZuTmFtZSAoZm4pIHtcbi8vICAgdmFyIGYgPSB0eXBlb2YgZm4gPT09ICdmdW5jdGlvbidcbi8vICAgdmFyIHMgPSBmICYmICgoZm4ubmFtZSAmJiBbJycsIGZuLm5hbWVdKSB8fCBmbi50b1N0cmluZygpLm1hdGNoKC9mdW5jdGlvbiAoW15cXChdKykvKSlcbi8vICAgcmV0dXJuICghZiAmJiAnbm90IGEgZnVuY3Rpb24nKSB8fCAocyAmJiBzWzFdIHx8ICdhbm9ueW1vdXMnKVxuLy8gfVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UHJvcG9ydGlvbmFsSW1hZ2VIZWlnaHQgKGltZywgbmV3V2lkdGgpIHtcbiAgdmFyIGFzcGVjdCA9IGltZy53aWR0aCAvIGltZy5oZWlnaHRcbiAgdmFyIG5ld0hlaWdodCA9IE1hdGgucm91bmQobmV3V2lkdGggLyBhc3BlY3QpXG4gIHJldHVybiBuZXdIZWlnaHRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEZpbGVUeXBlIChmaWxlKSB7XG4gIGlmIChmaWxlLnR5cGUpIHtcbiAgICByZXR1cm4gZmlsZS50eXBlXG4gIH1cbiAgcmV0dXJuICcnXG4gIC8vIHJldHVybiBtaW1lLmxvb2t1cChmaWxlLm5hbWUpXG59XG5cbi8vIHJldHVybnMgW2ZpbGVOYW1lLCBmaWxlRXh0XVxuZXhwb3J0IGZ1bmN0aW9uIGdldEZpbGVOYW1lQW5kRXh0ZW5zaW9uIChmdWxsRmlsZU5hbWUpIHtcbiAgdmFyIHJlID0gLyg/OlxcLihbXi5dKykpPyQvXG4gIHZhciBmaWxlRXh0ID0gcmUuZXhlYyhmdWxsRmlsZU5hbWUpWzFdXG4gIHZhciBmaWxlTmFtZSA9IGZ1bGxGaWxlTmFtZS5yZXBsYWNlKCcuJyArIGZpbGVFeHQsICcnKVxuICByZXR1cm4gW2ZpbGVOYW1lLCBmaWxlRXh0XVxufVxuXG4vKipcbiAqIFJlYWRzIGZpbGUgYXMgZGF0YSBVUkkgZnJvbSBmaWxlIG9iamVjdCxcbiAqIHRoZSBvbmUgeW91IGdldCBmcm9tIGlucHV0W3R5cGU9ZmlsZV0gb3IgZHJhZyAmIGRyb3AuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGZpbGUgb2JqZWN0XG4gKiBAcmV0dXJuIHtQcm9taXNlfSBkYXRhVVJMIG9mIHRoZSBmaWxlXG4gKlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVhZEZpbGUgKGZpbGVPYmopIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpXG4gICAgcmVhZGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgIHJldHVybiByZXNvbHZlKGV2LnRhcmdldC5yZXN1bHQpXG4gICAgfSlcbiAgICByZWFkZXIucmVhZEFzRGF0YVVSTChmaWxlT2JqKVxuXG4gICAgLy8gZnVuY3Rpb24gd29ya2VyU2NyaXB0ICgpIHtcbiAgICAvLyAgIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIChlKSA9PiB7XG4gICAgLy8gICAgIGNvbnN0IGZpbGUgPSBlLmRhdGEuZmlsZVxuICAgIC8vICAgICB0cnkge1xuICAgIC8vICAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyU3luYygpXG4gICAgLy8gICAgICAgcG9zdE1lc3NhZ2Uoe1xuICAgIC8vICAgICAgICAgZmlsZTogcmVhZGVyLnJlYWRBc0RhdGFVUkwoZmlsZSlcbiAgICAvLyAgICAgICB9KVxuICAgIC8vICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAvLyAgICAgICBjb25zb2xlLmxvZyhlcnIpXG4gICAgLy8gICAgIH1cbiAgICAvLyAgIH0pXG4gICAgLy8gfVxuICAgIC8vXG4gICAgLy8gY29uc3Qgd29ya2VyID0gbWFrZVdvcmtlcih3b3JrZXJTY3JpcHQpXG4gICAgLy8gd29ya2VyLnBvc3RNZXNzYWdlKHtmaWxlOiBmaWxlT2JqfSlcbiAgICAvLyB3b3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIChlKSA9PiB7XG4gICAgLy8gICBjb25zdCBmaWxlRGF0YVVSTCA9IGUuZGF0YS5maWxlXG4gICAgLy8gICBjb25zb2xlLmxvZygnRklMRSBfIERBVEEgXyBVUkwnKVxuICAgIC8vICAgcmV0dXJuIHJlc29sdmUoZmlsZURhdGFVUkwpXG4gICAgLy8gfSlcbiAgfSlcbn1cblxuLyoqXG4gKiBSZXNpemVzIGFuIGltYWdlIHRvIHNwZWNpZmllZCB3aWR0aCBhbmQgcHJvcG9ydGlvbmFsIGhlaWdodCwgdXNpbmcgY2FudmFzXG4gKiBTZWUgaHR0cHM6Ly9kYXZpZHdhbHNoLm5hbWUvcmVzaXplLWltYWdlLWNhbnZhcyxcbiAqIGh0dHA6Ly9iYWJhbGFuLmNvbS9yZXNpemluZy1pbWFnZXMtd2l0aC1qYXZhc2NyaXB0L1xuICogQFRPRE8gc2VlIGlmIHdlIG5lZWQgaHR0cHM6Ly9naXRodWIuY29tL3N0b21pdGEvaW9zLWltYWdlZmlsZS1tZWdhcGl4ZWwgZm9yIGlPU1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBEYXRhIFVSSSBvZiB0aGUgb3JpZ2luYWwgaW1hZ2VcbiAqIEBwYXJhbSB7U3RyaW5nfSB3aWR0aCBvZiB0aGUgcmVzdWx0aW5nIGltYWdlXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERhdGEgVVJJIG9mIHRoZSByZXNpemVkIGltYWdlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJbWFnZVRodW1ibmFpbCAoaW1nRGF0YVVSSSwgbmV3V2lkdGgpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKVxuICAgIGltZy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgKCkgPT4ge1xuICAgICAgY29uc3QgbmV3SW1hZ2VXaWR0aCA9IG5ld1dpZHRoXG4gICAgICBjb25zdCBuZXdJbWFnZUhlaWdodCA9IGdldFByb3BvcnRpb25hbEltYWdlSGVpZ2h0KGltZywgbmV3SW1hZ2VXaWR0aClcblxuICAgICAgLy8gY3JlYXRlIGFuIG9mZi1zY3JlZW4gY2FudmFzXG4gICAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKVxuICAgICAgY29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJylcblxuICAgICAgLy8gc2V0IGl0cyBkaW1lbnNpb24gdG8gdGFyZ2V0IHNpemVcbiAgICAgIGNhbnZhcy53aWR0aCA9IG5ld0ltYWdlV2lkdGhcbiAgICAgIGNhbnZhcy5oZWlnaHQgPSBuZXdJbWFnZUhlaWdodFxuXG4gICAgICAvLyBkcmF3IHNvdXJjZSBpbWFnZSBpbnRvIHRoZSBvZmYtc2NyZWVuIGNhbnZhczpcbiAgICAgIC8vIGN0eC5jbGVhclJlY3QoMCwgMCwgd2lkdGgsIGhlaWdodClcbiAgICAgIGN0eC5kcmF3SW1hZ2UoaW1nLCAwLCAwLCBuZXdJbWFnZVdpZHRoLCBuZXdJbWFnZUhlaWdodClcblxuICAgICAgLy8gcGljYS5yZXNpemVDYW52YXMoaW1nLCBjYW52YXMsIChlcnIpID0+IHtcbiAgICAgIC8vICAgaWYgKGVycikgY29uc29sZS5sb2coZXJyKVxuICAgICAgLy8gICBjb25zdCB0aHVtYm5haWwgPSBjYW52YXMudG9EYXRhVVJMKCdpbWFnZS9wbmcnKVxuICAgICAgLy8gICByZXR1cm4gcmVzb2x2ZSh0aHVtYm5haWwpXG4gICAgICAvLyB9KVxuXG4gICAgICAvLyBlbmNvZGUgaW1hZ2UgdG8gZGF0YS11cmkgd2l0aCBiYXNlNjQgdmVyc2lvbiBvZiBjb21wcmVzc2VkIGltYWdlXG4gICAgICAvLyBjYW52YXMudG9EYXRhVVJMKCdpbWFnZS9qcGVnJywgcXVhbGl0eSk7ICAvLyBxdWFsaXR5ID0gWzAuMCwgMS4wXVxuICAgICAgY29uc3QgdGh1bWJuYWlsID0gY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvcG5nJylcbiAgICAgIHJldHVybiByZXNvbHZlKHRodW1ibmFpbClcbiAgICB9KVxuICAgIGltZy5zcmMgPSBpbWdEYXRhVVJJXG4gIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkYXRhVVJJdG9CbG9iIChkYXRhVVJJLCBvcHRzLCB0b0ZpbGUpIHtcbiAgLy8gZ2V0IHRoZSBiYXNlNjQgZGF0YVxuICB2YXIgZGF0YSA9IGRhdGFVUkkuc3BsaXQoJywnKVsxXVxuXG4gIC8vIHVzZXIgbWF5IHByb3ZpZGUgbWltZSB0eXBlLCBpZiBub3QgZ2V0IGl0IGZyb20gZGF0YSBVUklcbiAgdmFyIG1pbWVUeXBlID0gb3B0cy5taW1lVHlwZSB8fCBkYXRhVVJJLnNwbGl0KCcsJylbMF0uc3BsaXQoJzonKVsxXS5zcGxpdCgnOycpWzBdXG5cbiAgLy8gZGVmYXVsdCB0byBwbGFpbi90ZXh0IGlmIGRhdGEgVVJJIGhhcyBubyBtaW1lVHlwZVxuICBpZiAobWltZVR5cGUgPT0gbnVsbCkge1xuICAgIG1pbWVUeXBlID0gJ3BsYWluL3RleHQnXG4gIH1cblxuICB2YXIgYmluYXJ5ID0gYXRvYihkYXRhKVxuICB2YXIgYXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGJpbmFyeS5sZW5ndGg7IGkrKykge1xuICAgIGFycmF5LnB1c2goYmluYXJ5LmNoYXJDb2RlQXQoaSkpXG4gIH1cblxuICAvLyBDb252ZXJ0IHRvIGEgRmlsZT9cbiAgaWYgKHRvRmlsZSkge1xuICAgIHJldHVybiBuZXcgRmlsZShbbmV3IFVpbnQ4QXJyYXkoYXJyYXkpXSwgb3B0cy5uYW1lIHx8ICcnLCB7dHlwZTogbWltZVR5cGV9KVxuICB9XG5cbiAgcmV0dXJuIG5ldyBCbG9iKFtuZXcgVWludDhBcnJheShhcnJheSldLCB7dHlwZTogbWltZVR5cGV9KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGF0YVVSSXRvRmlsZSAoZGF0YVVSSSwgb3B0cykge1xuICByZXR1cm4gZGF0YVVSSXRvQmxvYihkYXRhVVJJLCBvcHRzLCB0cnVlKVxufVxuXG4vKipcbiAqIENvcGllcyB0ZXh0IHRvIGNsaXBib2FyZCBieSBjcmVhdGluZyBhbiBhbG1vc3QgaW52aXNpYmxlIHRleHRhcmVhLFxuICogYWRkaW5nIHRleHQgdGhlcmUsIHRoZW4gcnVubmluZyBleGVjQ29tbWFuZCgnY29weScpLlxuICogRmFsbHMgYmFjayB0byBwcm9tcHQoKSB3aGVuIHRoZSBlYXN5IHdheSBmYWlscyAoaGVsbG8sIFNhZmFyaSEpXG4gKiBGcm9tIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzMwODEwMzIyXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHRleHRUb0NvcHlcbiAqIEBwYXJhbSB7U3RyaW5nfSBmYWxsYmFja1N0cmluZ1xuICogQHJldHVybiB7UHJvbWlzZX1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvcHlUb0NsaXBib2FyZCAodGV4dFRvQ29weSwgZmFsbGJhY2tTdHJpbmcpIHtcbiAgZmFsbGJhY2tTdHJpbmcgPSBmYWxsYmFja1N0cmluZyB8fCAnQ29weSB0aGUgVVJMIGJlbG93J1xuXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29uc3QgdGV4dEFyZWEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpXG4gICAgdGV4dEFyZWEuc2V0QXR0cmlidXRlKCdzdHlsZScsIHtcbiAgICAgIHBvc2l0aW9uOiAnZml4ZWQnLFxuICAgICAgdG9wOiAwLFxuICAgICAgbGVmdDogMCxcbiAgICAgIHdpZHRoOiAnMmVtJyxcbiAgICAgIGhlaWdodDogJzJlbScsXG4gICAgICBwYWRkaW5nOiAwLFxuICAgICAgYm9yZGVyOiAnbm9uZScsXG4gICAgICBvdXRsaW5lOiAnbm9uZScsXG4gICAgICBib3hTaGFkb3c6ICdub25lJyxcbiAgICAgIGJhY2tncm91bmQ6ICd0cmFuc3BhcmVudCdcbiAgICB9KVxuXG4gICAgdGV4dEFyZWEudmFsdWUgPSB0ZXh0VG9Db3B5XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0ZXh0QXJlYSlcbiAgICB0ZXh0QXJlYS5zZWxlY3QoKVxuXG4gICAgY29uc3QgbWFnaWNDb3B5RmFpbGVkID0gKGVycikgPT4ge1xuICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0ZXh0QXJlYSlcbiAgICAgIHdpbmRvdy5wcm9tcHQoZmFsbGJhY2tTdHJpbmcsIHRleHRUb0NvcHkpXG4gICAgICByZXR1cm4gcmVqZWN0KCdPb3BzLCB1bmFibGUgdG8gY29weSBkaXNwbGF5ZWQgZmFsbGJhY2sgcHJvbXB0OiAnICsgZXJyKVxuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdWNjZXNzZnVsID0gZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ2NvcHknKVxuICAgICAgaWYgKCFzdWNjZXNzZnVsKSB7XG4gICAgICAgIHJldHVybiBtYWdpY0NvcHlGYWlsZWQoJ2NvcHkgY29tbWFuZCB1bmF2YWlsYWJsZScpXG4gICAgICB9XG4gICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKHRleHRBcmVhKVxuICAgICAgcmV0dXJuIHJlc29sdmUoKVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0ZXh0QXJlYSlcbiAgICAgIHJldHVybiBtYWdpY0NvcHlGYWlsZWQoZXJyKVxuICAgIH1cbiAgfSlcbn1cblxuLy8gZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUlubGluZVdvcmtlciAod29ya2VyRnVuY3Rpb24pIHtcbi8vICAgbGV0IGNvZGUgPSB3b3JrZXJGdW5jdGlvbi50b1N0cmluZygpXG4vLyAgIGNvZGUgPSBjb2RlLnN1YnN0cmluZyhjb2RlLmluZGV4T2YoJ3snKSArIDEsIGNvZGUubGFzdEluZGV4T2YoJ30nKSlcbi8vXG4vLyAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbY29kZV0sIHt0eXBlOiAnYXBwbGljYXRpb24vamF2YXNjcmlwdCd9KVxuLy8gICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYikpXG4vL1xuLy8gICByZXR1cm4gd29ya2VyXG4vLyB9XG5cbmV4cG9ydCBmdW5jdGlvbiBtYWtlV29ya2VyIChzY3JpcHQpIHtcbiAgdmFyIFVSTCA9IHdpbmRvdy5VUkwgfHwgd2luZG93LndlYmtpdFVSTFxuICB2YXIgQmxvYiA9IHdpbmRvdy5CbG9iXG4gIHZhciBXb3JrZXIgPSB3aW5kb3cuV29ya2VyXG5cbiAgaWYgKCFVUkwgfHwgIUJsb2IgfHwgIVdvcmtlciB8fCAhc2NyaXB0KSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIGxldCBjb2RlID0gc2NyaXB0LnRvU3RyaW5nKClcbiAgY29kZSA9IGNvZGUuc3Vic3RyaW5nKGNvZGUuaW5kZXhPZigneycpICsgMSwgY29kZS5sYXN0SW5kZXhPZignfScpKVxuXG4gIHZhciBibG9iID0gbmV3IEJsb2IoW2NvZGVdKVxuICB2YXIgd29ya2VyID0gbmV3IFdvcmtlcihVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpKVxuICByZXR1cm4gd29ya2VyXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTcGVlZCAoZmlsZVByb2dyZXNzKSB7XG4gIGlmICghZmlsZVByb2dyZXNzLmJ5dGVzVXBsb2FkZWQpIHJldHVybiAwXG5cbiAgY29uc3QgdGltZUVsYXBzZWQgPSAobmV3IERhdGUoKSkgLSBmaWxlUHJvZ3Jlc3MudXBsb2FkU3RhcnRlZFxuICBjb25zdCB1cGxvYWRTcGVlZCA9IGZpbGVQcm9ncmVzcy5ieXRlc1VwbG9hZGVkIC8gKHRpbWVFbGFwc2VkIC8gMTAwMClcbiAgcmV0dXJuIHVwbG9hZFNwZWVkXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRFVEEgKGZpbGVQcm9ncmVzcykge1xuICBpZiAoIWZpbGVQcm9ncmVzcy5ieXRlc1VwbG9hZGVkKSByZXR1cm4gMFxuXG4gIGNvbnN0IHVwbG9hZFNwZWVkID0gZ2V0U3BlZWQoZmlsZVByb2dyZXNzKVxuICBjb25zdCBieXRlc1JlbWFpbmluZyA9IGZpbGVQcm9ncmVzcy5ieXRlc1RvdGFsIC0gZmlsZVByb2dyZXNzLmJ5dGVzVXBsb2FkZWRcbiAgY29uc3Qgc2Vjb25kc1JlbWFpbmluZyA9IE1hdGgucm91bmQoYnl0ZXNSZW1haW5pbmcgLyB1cGxvYWRTcGVlZCAqIDEwKSAvIDEwXG5cbiAgcmV0dXJuIHNlY29uZHNSZW1haW5pbmdcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByZXR0eUVUQSAoc2Vjb25kcykge1xuICBjb25zdCB0aW1lID0gc2Vjb25kc1RvVGltZShzZWNvbmRzKVxuXG4gIC8vIE9ubHkgZGlzcGxheSBob3VycyBhbmQgbWludXRlcyBpZiB0aGV5IGFyZSBncmVhdGVyIHRoYW4gMCBidXQgYWx3YXlzXG4gIC8vIGRpc3BsYXkgbWludXRlcyBpZiBob3VycyBpcyBiZWluZyBkaXNwbGF5ZWRcbiAgY29uc3QgaG91cnNTdHIgPSB0aW1lLmhvdXJzID8gdGltZS5ob3VycyArICdoJyA6ICcnXG4gIGNvbnN0IG1pbnV0ZXNTdHIgPSAodGltZS5ob3VycyB8fCB0aW1lLm1pbnV0ZXMpID8gdGltZS5taW51dGVzICsgJ20nIDogJydcbiAgY29uc3Qgc2Vjb25kc1N0ciA9IHRpbWUuc2Vjb25kcyArICdzJ1xuXG4gIHJldHVybiBgJHtob3Vyc1N0cn0gJHttaW51dGVzU3RyfSAke3NlY29uZHNTdHJ9YFxufVxuXG5leHBvcnQgZnVuY3Rpb24gbWFrZUNhY2hpbmdGdW5jdGlvbiAoKSB7XG4gIGxldCBjYWNoZWRFbCA9IG51bGxcbiAgbGV0IGxhc3RVcGRhdGUgPSBEYXRlLm5vdygpXG5cbiAgcmV0dXJuIGZ1bmN0aW9uIGNhY2hlRWxlbWVudCAoZWwsIHRpbWUpIHtcbiAgICBpZiAoRGF0ZS5ub3coKSAtIGxhc3RVcGRhdGUgPCB0aW1lKSB7XG4gICAgICByZXR1cm4gY2FjaGVkRWxcbiAgICB9XG5cbiAgICBjYWNoZWRFbCA9IGVsXG4gICAgbGFzdFVwZGF0ZSA9IERhdGUubm93KClcblxuICAgIHJldHVybiBlbFxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgZ2VuZXJhdGVGaWxlSUQsXG4gIHRvQXJyYXksXG4gIGV2ZXJ5LFxuICBmbGF0dGVuLFxuICBncm91cEJ5LFxuICAkLFxuICAkJCxcbiAgZXh0ZW5kLFxuICByZWFkRmlsZSxcbiAgY3JlYXRlSW1hZ2VUaHVtYm5haWwsXG4gIGdldFByb3BvcnRpb25hbEltYWdlSGVpZ2h0LFxuICBpc1RvdWNoRGV2aWNlLFxuICBnZXRGaWxlTmFtZUFuZEV4dGVuc2lvbixcbiAgdHJ1bmNhdGVTdHJpbmcsXG4gIGdldEZpbGVUeXBlLFxuICBzZWNvbmRzVG9UaW1lLFxuICBkYXRhVVJJdG9CbG9iLFxuICBkYXRhVVJJdG9GaWxlLFxuICBnZXRTcGVlZCxcbiAgZ2V0RVRBLFxuICBtYWtlV29ya2VyLFxuICBtYWtlQ2FjaGluZ0Z1bmN0aW9uXG59XG4iLCJpbXBvcnQgeW8gZnJvbSAneW8teW8nXG5leHBvcnQgZGVmYXVsdCB5b1xuIiwiaW1wb3J0IENvcmUgZnJvbSAnLi9Db3JlJ1xuZXhwb3J0IGRlZmF1bHQgQ29yZVxuIiwiY29uc3QgZW5fVVMgPSB7fVxuXG5lbl9VUy5zdHJpbmdzID0ge1xuICBjaG9vc2VGaWxlOiAnQ2hvb3NlIGEgZmlsZScsXG4gIHlvdUhhdmVDaG9zZW46ICdZb3UgaGF2ZSBjaG9zZW46ICV7ZmlsZU5hbWV9JyxcbiAgb3JEcmFnRHJvcDogJ29yIGRyYWcgaXQgaGVyZScsXG4gIGZpbGVzQ2hvc2VuOiB7XG4gICAgMDogJyV7c21hcnRfY291bnR9IGZpbGUgc2VsZWN0ZWQnLFxuICAgIDE6ICcle3NtYXJ0X2NvdW50fSBmaWxlcyBzZWxlY3RlZCdcbiAgfSxcbiAgZmlsZXNVcGxvYWRlZDoge1xuICAgIDA6ICcle3NtYXJ0X2NvdW50fSBmaWxlIHVwbG9hZGVkJyxcbiAgICAxOiAnJXtzbWFydF9jb3VudH0gZmlsZXMgdXBsb2FkZWQnXG4gIH0sXG4gIGZpbGVzOiB7XG4gICAgMDogJyV7c21hcnRfY291bnR9IGZpbGUnLFxuICAgIDE6ICcle3NtYXJ0X2NvdW50fSBmaWxlcydcbiAgfSxcbiAgdXBsb2FkRmlsZXM6IHtcbiAgICAwOiAnVXBsb2FkICV7c21hcnRfY291bnR9IGZpbGUnLFxuICAgIDE6ICdVcGxvYWQgJXtzbWFydF9jb3VudH0gZmlsZXMnXG4gIH0sXG4gIHNlbGVjdFRvVXBsb2FkOiAnU2VsZWN0IGZpbGVzIHRvIHVwbG9hZCcsXG4gIGNsb3NlTW9kYWw6ICdDbG9zZSBNb2RhbCcsXG4gIHVwbG9hZDogJ1VwbG9hZCcsXG4gIGltcG9ydEZyb206ICdJbXBvcnQgZmlsZXMgZnJvbScsXG4gIGRhc2hib2FyZFdpbmRvd1RpdGxlOiAnVXBweSBEYXNoYm9hcmQgV2luZG93IChQcmVzcyBlc2NhcGUgdG8gY2xvc2UpJyxcbiAgZGFzaGJvYXJkVGl0bGU6ICdVcHB5IERhc2hib2FyZCcsXG4gIGNvcHlMaW5rVG9DbGlwYm9hcmRTdWNjZXNzOiAnTGluayBjb3BpZWQgdG8gY2xpcGJvYXJkLicsXG4gIGNvcHlMaW5rVG9DbGlwYm9hcmRGYWxsYmFjazogJ0NvcHkgdGhlIFVSTCBiZWxvdycsXG4gIGRvbmU6ICdEb25lJyxcbiAgbG9jYWxEaXNrOiAnTG9jYWwgRGlzaycsXG4gIGRyb3BQYXN0ZUltcG9ydDogJ0Ryb3AgZmlsZXMgaGVyZSwgcGFzdGUsIGltcG9ydCBmcm9tIG9uZSBvZiB0aGUgbG9jYXRpb25zIGFib3ZlIG9yJyxcbiAgZHJvcFBhc3RlOiAnRHJvcCBmaWxlcyBoZXJlLCBwYXN0ZSBvcicsXG4gIGJyb3dzZTogJ2Jyb3dzZScsXG4gIGZpbGVQcm9ncmVzczogJ0ZpbGUgcHJvZ3Jlc3M6IHVwbG9hZCBzcGVlZCBhbmQgRVRBJyxcbiAgbnVtYmVyT2ZTZWxlY3RlZEZpbGVzOiAnTnVtYmVyIG9mIHNlbGVjdGVkIGZpbGVzJyxcbiAgdXBsb2FkQWxsTmV3RmlsZXM6ICdVcGxvYWQgYWxsIG5ldyBmaWxlcydcbn1cblxuZW5fVVMucGx1cmFsaXplID0gZnVuY3Rpb24gKG4pIHtcbiAgaWYgKG4gPT09IDEpIHtcbiAgICByZXR1cm4gMFxuICB9XG4gIHJldHVybiAxXG59XG5cbmlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2Ygd2luZG93LlVwcHkgIT09ICd1bmRlZmluZWQnKSB7XG4gIHdpbmRvdy5VcHB5LmxvY2FsZXMuZW5fVVMgPSBlbl9VU1xufVxuXG5leHBvcnQgZGVmYXVsdCBlbl9VU1xuIiwiaW1wb3J0IGh0bWwgZnJvbSAnLi4vLi4vY29yZS9odG1sJ1xuXG5leHBvcnQgZGVmYXVsdCAocHJvcHMpID0+IHtcbiAgcmV0dXJuIGh0bWxgXG4gICAgPHNwYW4+XG4gICAgICAke3Byb3BzLmFjcXVpcmVycy5sZW5ndGggPT09IDBcbiAgICAgICAgPyBwcm9wcy5pMThuKCdkcm9wUGFzdGUnKVxuICAgICAgICA6IHByb3BzLmkxOG4oJ2Ryb3BQYXN0ZUltcG9ydCcpXG4gICAgICB9XG4gICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICBjbGFzcz1cIlVwcHlEYXNoYm9hcmQtYnJvd3NlXCJcbiAgICAgICAgICAgICAgb25jbGljaz0keyhldikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlucHV0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgJHtwcm9wcy5jb250YWluZXJ9IC5VcHB5RGFzaGJvYXJkLWlucHV0YClcbiAgICAgICAgICAgICAgICBpbnB1dC5jbGljaygpXG4gICAgICAgICAgICAgIH19PiR7cHJvcHMuaTE4bignYnJvd3NlJyl9PC9idXR0b24+XG4gICAgICA8aW5wdXQgY2xhc3M9XCJVcHB5RGFzaGJvYXJkLWlucHV0XCIgdHlwZT1cImZpbGVcIiBuYW1lPVwiZmlsZXNbXVwiIG11bHRpcGxlPVwidHJ1ZVwiXG4gICAgICAgICAgICAgb25jaGFuZ2U9JHtwcm9wcy5oYW5kbGVJbnB1dENoYW5nZX0gLz5cbiAgICA8L3NwYW4+XG4gIGBcbn1cbiIsImltcG9ydCBodG1sIGZyb20gJy4uLy4uL2NvcmUvaHRtbCdcbmltcG9ydCBGaWxlTGlzdCBmcm9tICcuL0ZpbGVMaXN0J1xuaW1wb3J0IFRhYnMgZnJvbSAnLi9UYWJzJ1xuaW1wb3J0IEZpbGVDYXJkIGZyb20gJy4vRmlsZUNhcmQnXG5pbXBvcnQgVXBsb2FkQnRuIGZyb20gJy4vVXBsb2FkQnRuJ1xuLy8gaW1wb3J0IFByb2dyZXNzQ2lyY2xlIGZyb20gJy4vUHJvZ3Jlc3NDaXJjbGUnXG5pbXBvcnQgU3RhdHVzQmFyIGZyb20gJy4vU3RhdHVzQmFyJ1xuaW1wb3J0IHsgaXNUb3VjaERldmljZSwgdG9BcnJheSB9IGZyb20gJy4uLy4uL2NvcmUvVXRpbHMnXG5pbXBvcnQgeyBjbG9zZUljb24gfSBmcm9tICcuL2ljb25zJ1xuXG4vLyBodHRwOi8vZGV2LmVkZW5zcGlla2VybWFubi5jb20vMjAxNi8wMi8xMS9pbnRyb2R1Y2luZy1hY2Nlc3NpYmxlLW1vZGFsLWRpYWxvZ1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBEYXNoYm9hcmQgKHByb3BzKSB7XG4gIGNvbnN0IGhhbmRsZUlucHV0Q2hhbmdlID0gKGV2KSA9PiB7XG4gICAgZXYucHJldmVudERlZmF1bHQoKVxuICAgIGNvbnN0IGZpbGVzID0gdG9BcnJheShldi50YXJnZXQuZmlsZXMpXG5cbiAgICBmaWxlcy5mb3JFYWNoKChmaWxlKSA9PiB7XG4gICAgICBwcm9wcy5hZGRGaWxlKHtcbiAgICAgICAgc291cmNlOiBwcm9wcy5pZCxcbiAgICAgICAgbmFtZTogZmlsZS5uYW1lLFxuICAgICAgICB0eXBlOiBmaWxlLnR5cGUsXG4gICAgICAgIGRhdGE6IGZpbGVcbiAgICAgIH0pXG4gICAgfSlcbiAgfVxuXG4gIC8vIEBUT0RPIEV4cHJpbWVudGFsLCB3b3JrIGluIHByb2dyZXNzXG4gIC8vIG5vIG5hbWVzLCB3ZWlyZCBBUEksIENocm9tZS1vbmx5IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIyOTQwMDIwXG4gIGNvbnN0IGhhbmRsZVBhc3RlID0gKGV2KSA9PiB7XG4gICAgZXYucHJldmVudERlZmF1bHQoKVxuXG4gICAgY29uc3QgZmlsZXMgPSB0b0FycmF5KGV2LmNsaXBib2FyZERhdGEuaXRlbXMpXG4gICAgZmlsZXMuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgaWYgKGZpbGUua2luZCAhPT0gJ2ZpbGUnKSByZXR1cm5cblxuICAgICAgY29uc3QgYmxvYiA9IGZpbGUuZ2V0QXNGaWxlKClcbiAgICAgIHByb3BzLmxvZygnRmlsZSBwYXN0ZWQnKVxuICAgICAgcHJvcHMuYWRkRmlsZSh7XG4gICAgICAgIHNvdXJjZTogcHJvcHMuaWQsXG4gICAgICAgIG5hbWU6IGZpbGUubmFtZSxcbiAgICAgICAgdHlwZTogZmlsZS50eXBlLFxuICAgICAgICBkYXRhOiBibG9iXG4gICAgICB9KVxuICAgIH0pXG4gIH1cblxuICByZXR1cm4gaHRtbGBcbiAgICA8ZGl2IGNsYXNzPVwiVXBweSBVcHB5VGhlbWUtLWRlZmF1bHQgVXBweURhc2hib2FyZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAke2lzVG91Y2hEZXZpY2UoKSA/ICdVcHB5LS1pc1RvdWNoRGV2aWNlJyA6ICcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAke3Byb3BzLnNlbWlUcmFuc3BhcmVudCA/ICdVcHB5RGFzaGJvYXJkLS1zZW1pVHJhbnNwYXJlbnQnIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICR7IXByb3BzLmlubGluZSA/ICdVcHB5RGFzaGJvYXJkLS1tb2RhbCcgOiAnJ31cIlxuICAgICAgICAgIGFyaWEtaGlkZGVuPVwiJHtwcm9wcy5pbmxpbmUgPyAnZmFsc2UnIDogcHJvcHMubW9kYWwuaXNIaWRkZW59XCJcbiAgICAgICAgICBhcmlhLWxhYmVsPVwiJHshcHJvcHMuaW5saW5lXG4gICAgICAgICAgICAgICAgICAgICAgID8gcHJvcHMuaTE4bignZGFzaGJvYXJkV2luZG93VGl0bGUnKVxuICAgICAgICAgICAgICAgICAgICAgICA6IHByb3BzLmkxOG4oJ2Rhc2hib2FyZFRpdGxlJyl9XCJcbiAgICAgICAgICByb2xlPVwiZGlhbG9nXCJcbiAgICAgICAgICBvbnBhc3RlPSR7aGFuZGxlUGFzdGV9PlxuXG4gICAgPGJ1dHRvbiBjbGFzcz1cIlVwcHlEYXNoYm9hcmQtY2xvc2VcIlxuICAgICAgICAgICAgYXJpYS1sYWJlbD1cIiR7cHJvcHMuaTE4bignY2xvc2VNb2RhbCcpfVwiXG4gICAgICAgICAgICB0aXRsZT1cIiR7cHJvcHMuaTE4bignY2xvc2VNb2RhbCcpfVwiXG4gICAgICAgICAgICBvbmNsaWNrPSR7cHJvcHMuaGlkZU1vZGFsfT4ke2Nsb3NlSWNvbigpfTwvYnV0dG9uPlxuXG4gICAgPGRpdiBjbGFzcz1cIlVwcHlEYXNoYm9hcmQtb3ZlcmxheVwiXG4gICAgICAgICBvbmNsaWNrPSR7cHJvcHMuaGlkZU1vZGFsfT5cbiAgICA8L2Rpdj5cblxuICAgIDxkaXYgY2xhc3M9XCJVcHB5RGFzaGJvYXJkLWlubmVyXCIgdGFiaW5kZXg9XCIwXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiVXBweURhc2hib2FyZC1pbm5lcldyYXBcIj5cblxuICAgICAgICAke1RhYnMoe1xuICAgICAgICAgIGZpbGVzOiBwcm9wcy5maWxlcyxcbiAgICAgICAgICBoYW5kbGVJbnB1dENoYW5nZTogaGFuZGxlSW5wdXRDaGFuZ2UsXG4gICAgICAgICAgYWNxdWlyZXJzOiBwcm9wcy5hY3F1aXJlcnMsXG4gICAgICAgICAgY29udGFpbmVyOiBwcm9wcy5jb250YWluZXIsXG4gICAgICAgICAgcGFuZWxTZWxlY3RvclByZWZpeDogcHJvcHMucGFuZWxTZWxlY3RvclByZWZpeCxcbiAgICAgICAgICBzaG93UGFuZWw6IHByb3BzLnNob3dQYW5lbCxcbiAgICAgICAgICBpMThuOiBwcm9wcy5pMThuXG4gICAgICAgIH0pfVxuXG4gICAgICAgICR7RmlsZUNhcmQoe1xuICAgICAgICAgIGZpbGVzOiBwcm9wcy5maWxlcyxcbiAgICAgICAgICBmaWxlQ2FyZEZvcjogcHJvcHMuZmlsZUNhcmRGb3IsXG4gICAgICAgICAgZG9uZTogcHJvcHMuZmlsZUNhcmREb25lLFxuICAgICAgICAgIG1ldGFGaWVsZHM6IHByb3BzLm1ldGFGaWVsZHMsXG4gICAgICAgICAgbG9nOiBwcm9wcy5sb2csXG4gICAgICAgICAgaTE4bjogcHJvcHMuaTE4blxuICAgICAgICB9KX1cblxuICAgICAgICA8ZGl2IGNsYXNzPVwiVXBweURhc2hib2FyZC1maWxlc0NvbnRhaW5lclwiPlxuXG4gICAgICAgICAgJHtGaWxlTGlzdCh7XG4gICAgICAgICAgICBhY3F1aXJlcnM6IHByb3BzLmFjcXVpcmVycyxcbiAgICAgICAgICAgIGZpbGVzOiBwcm9wcy5maWxlcyxcbiAgICAgICAgICAgIGhhbmRsZUlucHV0Q2hhbmdlOiBoYW5kbGVJbnB1dENoYW5nZSxcbiAgICAgICAgICAgIGNvbnRhaW5lcjogcHJvcHMuY29udGFpbmVyLFxuICAgICAgICAgICAgc2hvd0ZpbGVDYXJkOiBwcm9wcy5zaG93RmlsZUNhcmQsXG4gICAgICAgICAgICBzaG93UHJvZ3Jlc3NEZXRhaWxzOiBwcm9wcy5zaG93UHJvZ3Jlc3NEZXRhaWxzLFxuICAgICAgICAgICAgdG90YWxQcm9ncmVzczogcHJvcHMudG90YWxQcm9ncmVzcyxcbiAgICAgICAgICAgIHRvdGFsRmlsZUNvdW50OiBwcm9wcy50b3RhbEZpbGVDb3VudCxcbiAgICAgICAgICAgIGluZm86IHByb3BzLmluZm8sXG4gICAgICAgICAgICBpMThuOiBwcm9wcy5pMThuLFxuICAgICAgICAgICAgbG9nOiBwcm9wcy5sb2csXG4gICAgICAgICAgICByZW1vdmVGaWxlOiBwcm9wcy5yZW1vdmVGaWxlLFxuICAgICAgICAgICAgcGF1c2VBbGw6IHByb3BzLnBhdXNlQWxsLFxuICAgICAgICAgICAgcmVzdW1lQWxsOiBwcm9wcy5yZXN1bWVBbGwsXG4gICAgICAgICAgICBwYXVzZVVwbG9hZDogcHJvcHMucGF1c2VVcGxvYWQsXG4gICAgICAgICAgICBzdGFydFVwbG9hZDogcHJvcHMuc3RhcnRVcGxvYWQsXG4gICAgICAgICAgICBjYW5jZWxVcGxvYWQ6IHByb3BzLmNhbmNlbFVwbG9hZCxcbiAgICAgICAgICAgIHJlc3VtYWJsZVVwbG9hZHM6IHByb3BzLnJlc3VtYWJsZVVwbG9hZHNcbiAgICAgICAgICB9KX1cblxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJVcHB5RGFzaGJvYXJkLWFjdGlvbnNcIj5cbiAgICAgICAgICAgICR7IXByb3BzLmF1dG9Qcm9jZWVkICYmIHByb3BzLm5ld0ZpbGVzLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgPyBVcGxvYWRCdG4oe1xuICAgICAgICAgICAgICAgIGkxOG46IHByb3BzLmkxOG4sXG4gICAgICAgICAgICAgICAgc3RhcnRVcGxvYWQ6IHByb3BzLnN0YXJ0VXBsb2FkLFxuICAgICAgICAgICAgICAgIG5ld0ZpbGVDb3VudDogcHJvcHMubmV3RmlsZXMubGVuZ3RoXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIDogbnVsbFxuICAgICAgICAgICAgfVxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIDxkaXYgY2xhc3M9XCJVcHB5RGFzaGJvYXJkQ29udGVudC1wYW5lbFwiXG4gICAgICAgICAgICAgcm9sZT1cInRhYnBhbmVsXCJcbiAgICAgICAgICAgICBhcmlhLWhpZGRlbj1cIiR7cHJvcHMuYWN0aXZlUGFuZWwgPyAnZmFsc2UnIDogJ3RydWUnfVwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJVcHB5RGFzaGJvYXJkQ29udGVudC1iYXJcIj5cbiAgICAgICAgICAgIDxoMiBjbGFzcz1cIlVwcHlEYXNoYm9hcmRDb250ZW50LXRpdGxlXCI+XG4gICAgICAgICAgICAgICR7cHJvcHMuaTE4bignaW1wb3J0RnJvbScpfSAke3Byb3BzLmFjdGl2ZVBhbmVsID8gcHJvcHMuYWN0aXZlUGFuZWwubmFtZSA6IG51bGx9XG4gICAgICAgICAgICA8L2gyPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cIlVwcHlEYXNoYm9hcmRDb250ZW50LWJhY2tcIlxuICAgICAgICAgICAgICAgICAgICBvbmNsaWNrPSR7cHJvcHMuaGlkZUFsbFBhbmVsc30+JHtwcm9wcy5pMThuKCdkb25lJyl9PC9idXR0b24+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgJHtwcm9wcy5hY3RpdmVQYW5lbCA/IHByb3BzLmFjdGl2ZVBhbmVsLnJlbmRlcihwcm9wcy5zdGF0ZSkgOiAnJ31cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiBjbGFzcz1cIlVwcHlEYXNoYm9hcmQtcHJvZ3Jlc3NpbmRpY2F0b3JzXCI+XG4gICAgICAgICAgJHtTdGF0dXNCYXIoe1xuICAgICAgICAgICAgdG90YWxQcm9ncmVzczogcHJvcHMudG90YWxQcm9ncmVzcyxcbiAgICAgICAgICAgIHRvdGFsRmlsZUNvdW50OiBwcm9wcy50b3RhbEZpbGVDb3VudCxcbiAgICAgICAgICAgIHVwbG9hZFN0YXJ0ZWRGaWxlczogcHJvcHMudXBsb2FkU3RhcnRlZEZpbGVzLFxuICAgICAgICAgICAgaXNBbGxDb21wbGV0ZTogcHJvcHMuaXNBbGxDb21wbGV0ZSxcbiAgICAgICAgICAgIGlzQWxsUGF1c2VkOiBwcm9wcy5pc0FsbFBhdXNlZCxcbiAgICAgICAgICAgIGlzVXBsb2FkU3RhcnRlZDogcHJvcHMuaXNVcGxvYWRTdGFydGVkLFxuICAgICAgICAgICAgcGF1c2VBbGw6IHByb3BzLnBhdXNlQWxsLFxuICAgICAgICAgICAgcmVzdW1lQWxsOiBwcm9wcy5yZXN1bWVBbGwsXG4gICAgICAgICAgICBjYW5jZWxBbGw6IHByb3BzLmNhbmNlbEFsbCxcbiAgICAgICAgICAgIGNvbXBsZXRlOiBwcm9wcy5jb21wbGV0ZUZpbGVzLmxlbmd0aCxcbiAgICAgICAgICAgIGluUHJvZ3Jlc3M6IHByb3BzLmluUHJvZ3Jlc3MsXG4gICAgICAgICAgICB0b3RhbFNwZWVkOiBwcm9wcy50b3RhbFNwZWVkLFxuICAgICAgICAgICAgdG90YWxFVEE6IHByb3BzLnRvdGFsRVRBLFxuICAgICAgICAgICAgc3RhcnRVcGxvYWQ6IHByb3BzLnN0YXJ0VXBsb2FkLFxuICAgICAgICAgICAgbmV3RmlsZUNvdW50OiBwcm9wcy5uZXdGaWxlcy5sZW5ndGgsXG4gICAgICAgICAgICBpMThuOiBwcm9wcy5pMThuLFxuICAgICAgICAgICAgcmVzdW1hYmxlVXBsb2FkczogcHJvcHMucmVzdW1hYmxlVXBsb2Fkc1xuICAgICAgICAgIH0pfVxuXG4gICAgICAgICAgJHtwcm9wcy5wcm9ncmVzc2luZGljYXRvcnMubWFwKCh0YXJnZXQpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0YXJnZXQucmVuZGVyKHByb3BzLnN0YXRlKVxuICAgICAgICAgIH0pfVxuICAgICAgICA8L2Rpdj5cblxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gIDwvZGl2PlxuICBgXG59XG4iLCJpbXBvcnQgaHRtbCBmcm9tICcuLi8uLi9jb3JlL2h0bWwnXG5pbXBvcnQgeyBpY29uVGV4dCwgaWNvbkZpbGUsIGljb25BdWRpbywgY2hlY2tJY29uIH0gZnJvbSAnLi9pY29ucydcblxuZnVuY3Rpb24gZ2V0SWNvbkJ5TWltZSAoZmlsZVR5cGVHZW5lcmFsKSB7XG4gIHN3aXRjaCAoZmlsZVR5cGVHZW5lcmFsKSB7XG4gICAgY2FzZSAndGV4dCc6XG4gICAgICByZXR1cm4gaWNvblRleHQoKVxuICAgIGNhc2UgJ2F1ZGlvJzpcbiAgICAgIHJldHVybiBpY29uQXVkaW8oKVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gaWNvbkZpbGUoKVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGZpbGVDYXJkIChwcm9wcykge1xuICBjb25zdCBmaWxlID0gcHJvcHMuZmlsZUNhcmRGb3IgPyBwcm9wcy5maWxlc1twcm9wcy5maWxlQ2FyZEZvcl0gOiBmYWxzZVxuICBjb25zdCBtZXRhID0ge31cblxuICBmdW5jdGlvbiB0ZW1wU3RvcmVNZXRhIChldikge1xuICAgIGNvbnN0IHZhbHVlID0gZXYudGFyZ2V0LnZhbHVlXG4gICAgY29uc3QgbmFtZSA9IGV2LnRhcmdldC5hdHRyaWJ1dGVzLm5hbWUudmFsdWVcbiAgICBtZXRhW25hbWVdID0gdmFsdWVcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlck1ldGFGaWVsZHMgKGZpbGUpIHtcbiAgICBjb25zdCBtZXRhRmllbGRzID0gcHJvcHMubWV0YUZpZWxkcyB8fCBbXVxuICAgIHJldHVybiBtZXRhRmllbGRzLm1hcCgoZmllbGQpID0+IHtcbiAgICAgIHJldHVybiBodG1sYDxmaWVsZHNldCBjbGFzcz1cIlVwcHlEYXNoYm9hcmRGaWxlQ2FyZC1maWVsZHNldFwiPlxuICAgICAgICA8bGFiZWwgY2xhc3M9XCJVcHB5RGFzaGJvYXJkRmlsZUNhcmQtbGFiZWxcIj4ke2ZpZWxkLm5hbWV9PC9sYWJlbD5cbiAgICAgICAgPGlucHV0IGNsYXNzPVwiVXBweURhc2hib2FyZEZpbGVDYXJkLWlucHV0XCJcbiAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lPVwiJHtmaWVsZC5pZH1cIlxuICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcbiAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT1cIiR7ZmlsZS5tZXRhW2ZpZWxkLmlkXX1cIlxuICAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiJHtmaWVsZC5wbGFjZWhvbGRlciB8fCAnJ31cIlxuICAgICAgICAgICAgICAgICAgICAgICAgIG9ua2V5dXA9JHt0ZW1wU3RvcmVNZXRhfSAvPjwvZmllbGRzZXQ+YFxuICAgIH0pXG4gIH1cblxuICByZXR1cm4gaHRtbGA8ZGl2IGNsYXNzPVwiVXBweURhc2hib2FyZEZpbGVDYXJkXCIgYXJpYS1oaWRkZW49XCIkeyFwcm9wcy5maWxlQ2FyZEZvcn1cIj5cbiAgICA8ZGl2IGNsYXNzPVwiVXBweURhc2hib2FyZENvbnRlbnQtYmFyXCI+XG4gICAgICA8aDIgY2xhc3M9XCJVcHB5RGFzaGJvYXJkQ29udGVudC10aXRsZVwiPkVkaXRpbmcgPHNwYW4gY2xhc3M9XCJVcHB5RGFzaGJvYXJkQ29udGVudC10aXRsZUZpbGVcIj4ke2ZpbGUubWV0YSA/IGZpbGUubWV0YS5uYW1lIDogZmlsZS5uYW1lfTwvc3Bhbj48L2gyPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cIlVwcHlEYXNoYm9hcmRDb250ZW50LWJhY2tcIiB0aXRsZT1cIkZpbmlzaCBlZGl0aW5nIGZpbGVcIlxuICAgICAgICAgICAgICBvbmNsaWNrPSR7KCkgPT4gcHJvcHMuZG9uZShtZXRhLCBmaWxlLmlkKX0+RG9uZTwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICAgICR7cHJvcHMuZmlsZUNhcmRGb3JcbiAgICAgID8gaHRtbGA8ZGl2IGNsYXNzPVwiVXBweURhc2hib2FyZEZpbGVDYXJkLWlubmVyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIlVwcHlEYXNoYm9hcmRGaWxlQ2FyZC1wcmV2aWV3XCI+XG4gICAgICAgICAgICAke2ZpbGUucHJldmlld1xuICAgICAgICAgICAgICA/IGh0bWxgPGltZyBhbHQ9XCIke2ZpbGUubmFtZX1cIiBzcmM9XCIke2ZpbGUucHJldmlld31cIj5gXG4gICAgICAgICAgICAgIDogaHRtbGA8ZGl2IGNsYXNzPVwiVXBweURhc2hib2FyZEl0ZW0tcHJldmlld0ljb25cIj4ke2dldEljb25CeU1pbWUoZmlsZS50eXBlLmdlbmVyYWwpfTwvZGl2PmBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiVXBweURhc2hib2FyZEZpbGVDYXJkLWluZm9cIj5cbiAgICAgICAgICAgIDxmaWVsZHNldCBjbGFzcz1cIlVwcHlEYXNoYm9hcmRGaWxlQ2FyZC1maWVsZHNldFwiPlxuICAgICAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJVcHB5RGFzaGJvYXJkRmlsZUNhcmQtbGFiZWxcIj5OYW1lPC9sYWJlbD5cbiAgICAgICAgICAgICAgPGlucHV0IGNsYXNzPVwiVXBweURhc2hib2FyZEZpbGVDYXJkLWlucHV0XCIgbmFtZT1cIm5hbWVcIiB0eXBlPVwidGV4dFwiIHZhbHVlPVwiJHtmaWxlLm1ldGEubmFtZX1cIlxuICAgICAgICAgICAgICAgICAgICAgb25rZXl1cD0ke3RlbXBTdG9yZU1ldGF9IC8+XG4gICAgICAgICAgICA8L2ZpZWxkc2V0PlxuICAgICAgICAgICAgJHtyZW5kZXJNZXRhRmllbGRzKGZpbGUpfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5gXG4gICAgICA6IG51bGxcbiAgICB9XG4gICAgPGRpdiBjbGFzcz1cIlVwcHlEYXNoYm9hcmQtYWN0aW9uc1wiPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cIlVwcHlCdXR0b24tLWNpcmN1bGFyIFVwcHlCdXR0b24tLWJsdWUgVXBweUJ1dHRvbi0tc2l6ZU0gVXBweURhc2hib2FyZEZpbGVDYXJkLWRvbmVcIlxuICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgdGl0bGU9XCJGaW5pc2ggZWRpdGluZyBmaWxlXCJcbiAgICAgICAgICAgICAgb25jbGljaz0keygpID0+IHByb3BzLmRvbmUobWV0YSwgZmlsZS5pZCl9PiR7Y2hlY2tJY29uKCl9PC9idXR0b24+XG4gICAgPC9kaXY+XG4gICAgPC9kaXY+YFxufVxuIiwiaW1wb3J0IGh0bWwgZnJvbSAnLi4vLi4vY29yZS9odG1sJ1xuaW1wb3J0IHsgZ2V0RVRBLFxuICAgICAgICAgZ2V0U3BlZWQsXG4gICAgICAgICBwcmV0dHlFVEEsXG4gICAgICAgICBnZXRGaWxlTmFtZUFuZEV4dGVuc2lvbixcbiAgICAgICAgIHRydW5jYXRlU3RyaW5nLFxuICAgICAgICAgY29weVRvQ2xpcGJvYXJkIH0gZnJvbSAnLi4vLi4vY29yZS9VdGlscydcbmltcG9ydCBwcmV0dHlCeXRlcyBmcm9tICdwcmV0dHktYnl0ZXMnXG5pbXBvcnQgRmlsZUl0ZW1Qcm9ncmVzcyBmcm9tICcuL0ZpbGVJdGVtUHJvZ3Jlc3MnXG5pbXBvcnQgeyBpY29uVGV4dCwgaWNvbkZpbGUsIGljb25BdWRpbywgaWNvbkVkaXQsIGljb25Db3B5IH0gZnJvbSAnLi9pY29ucydcblxuZnVuY3Rpb24gZ2V0SWNvbkJ5TWltZSAoZmlsZVR5cGVHZW5lcmFsKSB7XG4gIHN3aXRjaCAoZmlsZVR5cGVHZW5lcmFsKSB7XG4gICAgY2FzZSAndGV4dCc6XG4gICAgICByZXR1cm4gaWNvblRleHQoKVxuICAgIGNhc2UgJ2F1ZGlvJzpcbiAgICAgIHJldHVybiBpY29uQXVkaW8oKVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gaWNvbkZpbGUoKVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGZpbGVJdGVtIChwcm9wcykge1xuICBjb25zdCBmaWxlID0gcHJvcHMuZmlsZVxuXG4gIGNvbnN0IGlzVXBsb2FkZWQgPSBmaWxlLnByb2dyZXNzLnVwbG9hZENvbXBsZXRlXG4gIGNvbnN0IHVwbG9hZEluUHJvZ3Jlc3NPckNvbXBsZXRlID0gZmlsZS5wcm9ncmVzcy51cGxvYWRTdGFydGVkXG4gIGNvbnN0IHVwbG9hZEluUHJvZ3Jlc3MgPSBmaWxlLnByb2dyZXNzLnVwbG9hZFN0YXJ0ZWQgJiYgIWZpbGUucHJvZ3Jlc3MudXBsb2FkQ29tcGxldGVcbiAgY29uc3QgaXNQYXVzZWQgPSBmaWxlLmlzUGF1c2VkIHx8IGZhbHNlXG5cbiAgY29uc3QgZmlsZU5hbWUgPSBnZXRGaWxlTmFtZUFuZEV4dGVuc2lvbihmaWxlLm1ldGEubmFtZSlbMF1cbiAgY29uc3QgdHJ1bmNhdGVkRmlsZU5hbWUgPSB0cnVuY2F0ZVN0cmluZyhmaWxlTmFtZSwgMTUpXG5cbiAgcmV0dXJuIGh0bWxgPGxpIGNsYXNzPVwiVXBweURhc2hib2FyZEl0ZW1cbiAgICAgICAgICAgICAgICAgICAgICAgICR7dXBsb2FkSW5Qcm9ncmVzcyA/ICdpcy1pbnByb2dyZXNzJyA6ICcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgJHtpc1VwbG9hZGVkID8gJ2lzLWNvbXBsZXRlJyA6ICcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgJHtpc1BhdXNlZCA/ICdpcy1wYXVzZWQnIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICAke3Byb3BzLnJlc3VtYWJsZVVwbG9hZHMgPyAnaXMtcmVzdW1hYmxlJyA6ICcnfVwiXG4gICAgICAgICAgICAgICAgICBpZD1cInVwcHlfJHtmaWxlLmlkfVwiXG4gICAgICAgICAgICAgICAgICB0aXRsZT1cIiR7ZmlsZS5tZXRhLm5hbWV9XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiVXBweURhc2hib2FyZEl0ZW0tcHJldmlld1wiPlxuICAgICAgICAke2ZpbGUucHJldmlld1xuICAgICAgICAgID8gaHRtbGA8aW1nIGFsdD1cIiR7ZmlsZS5uYW1lfVwiIHNyYz1cIiR7ZmlsZS5wcmV2aWV3fVwiPmBcbiAgICAgICAgICA6IGdldEljb25CeU1pbWUoZmlsZS50eXBlLmdlbmVyYWwpXG4gICAgICAgIH1cbiAgICAgICAgPGRpdiBjbGFzcz1cIlVwcHlEYXNoYm9hcmRJdGVtLXByb2dyZXNzXCI+XG4gICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cIlVwcHlEYXNoYm9hcmRJdGVtLXByb2dyZXNzQnRuXCJcbiAgICAgICAgICAgICAgICAgIHRpdGxlPVwiJHtpc1VwbG9hZGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgID8gJ3VwbG9hZCBjb21wbGV0ZSdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgOiBwcm9wcy5yZXN1bWFibGVVcGxvYWRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBmaWxlLmlzUGF1c2VkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/ICdyZXN1bWUgdXBsb2FkJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAncGF1c2UgdXBsb2FkJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogJ2NhbmNlbCB1cGxvYWQnXG4gICAgICAgICAgICAgICAgICAgICAgICB9XCJcbiAgICAgICAgICAgICAgICAgIG9uY2xpY2s9JHsoZXYpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzVXBsb2FkZWQpIHJldHVyblxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcHMucmVzdW1hYmxlVXBsb2Fkcykge1xuICAgICAgICAgICAgICAgICAgICAgIHByb3BzLnBhdXNlVXBsb2FkKGZpbGUuaWQpXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgcHJvcHMuY2FuY2VsVXBsb2FkKGZpbGUuaWQpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH19PlxuICAgICAgICAgICAgJHtGaWxlSXRlbVByb2dyZXNzKHtcbiAgICAgICAgICAgICAgcHJvZ3Jlc3M6IGZpbGUucHJvZ3Jlc3MucGVyY2VudGFnZSxcbiAgICAgICAgICAgICAgZmlsZUlEOiBmaWxlLmlkXG4gICAgICAgICAgICB9KX1cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAke3Byb3BzLnNob3dQcm9ncmVzc0RldGFpbHNcbiAgICAgICAgICAgID8gaHRtbGA8ZGl2IGNsYXNzPVwiVXBweURhc2hib2FyZEl0ZW0tcHJvZ3Jlc3NJbmZvXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiJHtwcm9wcy5pMThuKCdmaWxlUHJvZ3Jlc3MnKX1cIlxuICAgICAgICAgICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIiR7cHJvcHMuaTE4bignZmlsZVByb2dyZXNzJyl9XCI+XG4gICAgICAgICAgICAgICAgJHshZmlsZS5pc1BhdXNlZCAmJiAhaXNVcGxvYWRlZFxuICAgICAgICAgICAgICAgICAgPyBodG1sYDxzcGFuPiR7cHJldHR5RVRBKGdldEVUQShmaWxlLnByb2dyZXNzKSl9IOODuyDihpEgJHtwcmV0dHlCeXRlcyhnZXRTcGVlZChmaWxlLnByb2dyZXNzKSl9L3M8L3NwYW4+YFxuICAgICAgICAgICAgICAgICAgOiBudWxsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICA8L2Rpdj5gXG4gICAgICAgICAgICA6IG51bGxcbiAgICAgICAgICB9XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cIlVwcHlEYXNoYm9hcmRJdGVtLWluZm9cIj5cbiAgICAgIDxoNCBjbGFzcz1cIlVwcHlEYXNoYm9hcmRJdGVtLW5hbWVcIiB0aXRsZT1cIiR7ZmlsZU5hbWV9XCI+XG4gICAgICAgICR7ZmlsZS51cGxvYWRVUkxcbiAgICAgICAgICA/IGh0bWxgPGEgaHJlZj1cIiR7ZmlsZS51cGxvYWRVUkx9XCIgdGFyZ2V0PVwiX2JsYW5rXCI+XG4gICAgICAgICAgICAgICR7ZmlsZS5leHRlbnNpb24gPyB0cnVuY2F0ZWRGaWxlTmFtZSArICcuJyArIGZpbGUuZXh0ZW5zaW9uIDogdHJ1bmNhdGVkRmlsZU5hbWV9XG4gICAgICAgICAgICA8L2E+YFxuICAgICAgICAgIDogZmlsZS5leHRlbnNpb24gPyB0cnVuY2F0ZWRGaWxlTmFtZSArICcuJyArIGZpbGUuZXh0ZW5zaW9uIDogdHJ1bmNhdGVkRmlsZU5hbWVcbiAgICAgICAgfVxuICAgICAgPC9oND5cbiAgICAgIDxkaXYgY2xhc3M9XCJVcHB5RGFzaGJvYXJkSXRlbS1zdGF0dXNcIj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJVcHB5RGFzaGJvYXJkSXRlbS1zdGF0dXNTaXplXCI+JHtmaWxlLmRhdGEuc2l6ZSA/IHByZXR0eUJ5dGVzKGZpbGUuZGF0YS5zaXplKSA6ICc/J308L3NwYW4+XG4gICAgICA8L2Rpdj5cbiAgICAgICR7IXVwbG9hZEluUHJvZ3Jlc3NPckNvbXBsZXRlXG4gICAgICAgID8gaHRtbGA8YnV0dG9uIGNsYXNzPVwiVXBweURhc2hib2FyZEl0ZW0tZWRpdFwiXG4gICAgICAgICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCJFZGl0IGZpbGVcIlxuICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIkVkaXQgZmlsZVwiXG4gICAgICAgICAgICAgICAgICAgICAgIG9uY2xpY2s9JHsoZSkgPT4gcHJvcHMuc2hvd0ZpbGVDYXJkKGZpbGUuaWQpfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICR7aWNvbkVkaXQoKX08L2J1dHRvbj5gXG4gICAgICAgIDogbnVsbFxuICAgICAgfVxuICAgICAgJHtmaWxlLnVwbG9hZFVSTFxuICAgICAgICA/IGh0bWxgPGJ1dHRvbiBjbGFzcz1cIlVwcHlEYXNoYm9hcmRJdGVtLWNvcHlMaW5rXCJcbiAgICAgICAgICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIkNvcHkgbGlua1wiXG4gICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiQ29weSBsaW5rXCJcbiAgICAgICAgICAgICAgICAgICAgICAgb25jbGljaz0keygpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICBjb3B5VG9DbGlwYm9hcmQoZmlsZS51cGxvYWRVUkwsIHByb3BzLmkxOG4oJ2NvcHlMaW5rVG9DbGlwYm9hcmRGYWxsYmFjaycpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcHMubG9nKCdMaW5rIGNvcGllZCB0byBjbGlwYm9hcmQuJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wcy5pbmZvKHByb3BzLmkxOG4oJ2NvcHlMaW5rVG9DbGlwYm9hcmRTdWNjZXNzJyksICdpbmZvJywgMzAwMClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKHByb3BzLmxvZylcbiAgICAgICAgICAgICAgICAgICAgICAgfX0+JHtpY29uQ29weSgpfTwvYnV0dG9uPmBcbiAgICAgICAgOiBudWxsXG4gICAgICB9XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cIlVwcHlEYXNoYm9hcmRJdGVtLWFjdGlvblwiPlxuICAgICAgJHshaXNVcGxvYWRlZFxuICAgICAgICA/IGh0bWxgPGJ1dHRvbiBjbGFzcz1cIlVwcHlEYXNoYm9hcmRJdGVtLXJlbW92ZVwiXG4gICAgICAgICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCJSZW1vdmUgZmlsZVwiXG4gICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiUmVtb3ZlIGZpbGVcIlxuICAgICAgICAgICAgICAgICAgICAgICBvbmNsaWNrPSR7KCkgPT4gcHJvcHMucmVtb3ZlRmlsZShmaWxlLmlkKX0+XG4gICAgICAgICAgICAgICAgIDxzdmcgY2xhc3M9XCJVcHB5SWNvblwiIHdpZHRoPVwiMjJcIiBoZWlnaHQ9XCIyMVwiIHZpZXdCb3g9XCIwIDAgMTggMTdcIj5cbiAgICAgICAgICAgICAgICAgICA8ZWxsaXBzZSBmaWxsPVwiIzQyNDI0MlwiIGN4PVwiOC42MlwiIGN5PVwiOC4zODNcIiByeD1cIjguNjJcIiByeT1cIjguMzgzXCIvPlxuICAgICAgICAgICAgICAgICAgIDxwYXRoIHN0cm9rZT1cIiNGRkZcIiBmaWxsPVwiI0ZGRlwiIGQ9XCJNMTEgNi4xNDdMMTAuODUgNiA4LjUgOC4yODQgNi4xNSA2IDYgNi4xNDcgOC4zNSA4LjQzIDYgMTAuNzE3bC4xNS4xNDZMOC41IDguNTc4bDIuMzUgMi4yODQuMTUtLjE0Nkw4LjY1IDguNDN6XCIvPlxuICAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgIDwvYnV0dG9uPmBcbiAgICAgICAgOiBudWxsXG4gICAgICB9XG4gICAgPC9kaXY+XG4gIDwvbGk+YFxufVxuIiwiaW1wb3J0IGh0bWwgZnJvbSAnLi4vLi4vY29yZS9odG1sJ1xuXG4vLyBodHRwOi8vY29kZXBlbi5pby9IYXJra28vcGVuL3JWeHZOTVxuLy8gaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vZXN3YWsvYWQ0ZWE1N2JjZDVmZjdhYTVkNDJcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHByb3BzKSB7XG4gIHJldHVybiBodG1sYFxuICAgIDxzdmcgd2lkdGg9XCI3MFwiIGhlaWdodD1cIjcwXCIgdmlld0JveD1cIjAgMCAzNiAzNlwiIGNsYXNzPVwiVXBweUljb24gVXBweUljb24tcHJvZ3Jlc3NDaXJjbGVcIj5cbiAgICAgIDxnIGNsYXNzPVwicHJvZ3Jlc3MtZ3JvdXBcIj5cbiAgICAgICAgPGNpcmNsZSByPVwiMTVcIiBjeD1cIjE4XCIgY3k9XCIxOFwiIHN0cm9rZS13aWR0aD1cIjJcIiBmaWxsPVwibm9uZVwiIGNsYXNzPVwiYmdcIi8+XG4gICAgICAgIDxjaXJjbGUgcj1cIjE1XCIgY3g9XCIxOFwiIGN5PVwiMThcIiB0cmFuc2Zvcm09XCJyb3RhdGUoLTkwLCAxOCwgMTgpXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIGZpbGw9XCJub25lXCIgc3Ryb2tlLWRhc2hhcnJheT1cIjEwMFwiIHN0cm9rZS1kYXNob2Zmc2V0PVwiJHsxMDAgLSBwcm9wcy5wcm9ncmVzc31cIiBjbGFzcz1cInByb2dyZXNzXCIvPlxuICAgICAgPC9nPlxuICAgICAgPHBvbHlnb24gdHJhbnNmb3JtPVwidHJhbnNsYXRlKDMsIDMpXCIgcG9pbnRzPVwiMTIgMjAgMTIgMTAgMjAgMTVcIiBjbGFzcz1cInBsYXlcIi8+XG4gICAgICA8ZyB0cmFuc2Zvcm09XCJ0cmFuc2xhdGUoMTQuNSwgMTMpXCIgY2xhc3M9XCJwYXVzZVwiPlxuICAgICAgICA8cmVjdCB4PVwiMFwiIHk9XCIwXCIgd2lkdGg9XCIyXCIgaGVpZ2h0PVwiMTBcIiByeD1cIjBcIiAvPlxuICAgICAgICA8cmVjdCB4PVwiNVwiIHk9XCIwXCIgd2lkdGg9XCIyXCIgaGVpZ2h0PVwiMTBcIiByeD1cIjBcIiAvPlxuICAgICAgPC9nPlxuICAgICAgPHBvbHlnb24gdHJhbnNmb3JtPVwidHJhbnNsYXRlKDIsIDMpXCIgcG9pbnRzPVwiMTQgMjIuNSA3IDE1LjI0NTcwNjUgOC45OTk4NTg1NyAxMy4xNzMyODE1IDE0IDE4LjM1NDcxMDQgMjIuOTcyOTg4MyA5IDI1IDExLjEwMDU2MzRcIiBjbGFzcz1cImNoZWNrXCIvPlxuICAgICAgPHBvbHlnb24gY2xhc3M9XCJjYW5jZWxcIiB0cmFuc2Zvcm09XCJ0cmFuc2xhdGUoMiwgMilcIiBwb2ludHM9XCIxOS44ODU2NTE2IDExLjA2MjUgMTYgMTQuOTQ4MTUxNiAxMi4xMDE5NzM3IDExLjA2MjUgMTEuMDYyNSAxMi4xMTQzNDg0IDE0Ljk0ODE1MTYgMTYgMTEuMDYyNSAxOS44OTgwMjYzIDEyLjEwMTk3MzcgMjAuOTM3NSAxNiAxNy4wNTE4NDg0IDE5Ljg4NTY1MTYgMjAuOTM3NSAyMC45Mzc1IDE5Ljg5ODAyNjMgMTcuMDUxODQ4NCAxNiAyMC45Mzc1IDEyXCI+PC9wb2x5Z29uPlxuICA8L3N2Zz5gXG59XG4iLCJpbXBvcnQgaHRtbCBmcm9tICcuLi8uLi9jb3JlL2h0bWwnXG5pbXBvcnQgRmlsZUl0ZW0gZnJvbSAnLi9GaWxlSXRlbSdcbmltcG9ydCBBY3Rpb25Ccm93c2VUYWdsaW5lIGZyb20gJy4vQWN0aW9uQnJvd3NlVGFnbGluZSdcbmltcG9ydCB7IGRhc2hib2FyZEJnSWNvbiB9IGZyb20gJy4vaWNvbnMnXG5cbmV4cG9ydCBkZWZhdWx0IChwcm9wcykgPT4ge1xuICByZXR1cm4gaHRtbGA8dWwgY2xhc3M9XCJVcHB5RGFzaGJvYXJkLWZpbGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgJHtwcm9wcy50b3RhbEZpbGVDb3VudCA9PT0gMCA/ICdVcHB5RGFzaGJvYXJkLWZpbGVzLS1ub0ZpbGVzJyA6ICcnfVwiPlxuICAgICAgJHtwcm9wcy50b3RhbEZpbGVDb3VudCA9PT0gMFxuICAgICAgID8gaHRtbGA8ZGl2IGNsYXNzPVwiVXBweURhc2hib2FyZC1iZ0ljb25cIj5cbiAgICAgICAgICAke2Rhc2hib2FyZEJnSWNvbigpfVxuICAgICAgICAgIDxoMyBjbGFzcz1cIlVwcHlEYXNoYm9hcmQtZHJvcEZpbGVzVGl0bGVcIj5cbiAgICAgICAgICAgICR7QWN0aW9uQnJvd3NlVGFnbGluZSh7XG4gICAgICAgICAgICAgIGFjcXVpcmVyczogcHJvcHMuYWNxdWlyZXJzLFxuICAgICAgICAgICAgICBjb250YWluZXI6IHByb3BzLmNvbnRhaW5lcixcbiAgICAgICAgICAgICAgaGFuZGxlSW5wdXRDaGFuZ2U6IHByb3BzLmhhbmRsZUlucHV0Q2hhbmdlLFxuICAgICAgICAgICAgICBpMThuOiBwcm9wcy5pMThuXG4gICAgICAgICAgICB9KX1cbiAgICAgICAgICA8L2gzPlxuICAgICAgICAgIDxpbnB1dCBjbGFzcz1cIlVwcHlEYXNoYm9hcmQtaW5wdXRcIiB0eXBlPVwiZmlsZVwiIG5hbWU9XCJmaWxlc1tdXCIgbXVsdGlwbGU9XCJ0cnVlXCJcbiAgICAgICAgICAgICAgICAgb25jaGFuZ2U9JHtwcm9wcy5oYW5kbGVJbnB1dENoYW5nZX0gLz5cbiAgICAgICAgIDwvZGl2PmBcbiAgICAgICA6IG51bGxcbiAgICAgIH1cbiAgICAgICR7T2JqZWN0LmtleXMocHJvcHMuZmlsZXMpLm1hcCgoZmlsZUlEKSA9PiB7XG4gICAgICAgIHJldHVybiBGaWxlSXRlbSh7XG4gICAgICAgICAgZmlsZTogcHJvcHMuZmlsZXNbZmlsZUlEXSxcbiAgICAgICAgICBzaG93RmlsZUNhcmQ6IHByb3BzLnNob3dGaWxlQ2FyZCxcbiAgICAgICAgICBzaG93UHJvZ3Jlc3NEZXRhaWxzOiBwcm9wcy5zaG93UHJvZ3Jlc3NEZXRhaWxzLFxuICAgICAgICAgIGluZm86IHByb3BzLmluZm8sXG4gICAgICAgICAgbG9nOiBwcm9wcy5sb2csXG4gICAgICAgICAgaTE4bjogcHJvcHMuaTE4bixcbiAgICAgICAgICByZW1vdmVGaWxlOiBwcm9wcy5yZW1vdmVGaWxlLFxuICAgICAgICAgIHBhdXNlVXBsb2FkOiBwcm9wcy5wYXVzZVVwbG9hZCxcbiAgICAgICAgICBjYW5jZWxVcGxvYWQ6IHByb3BzLmNhbmNlbFVwbG9hZCxcbiAgICAgICAgICByZXN1bWFibGVVcGxvYWRzOiBwcm9wcy5yZXN1bWFibGVVcGxvYWRzXG4gICAgICAgIH0pXG4gICAgICB9KX1cbiAgICA8L3VsPmBcbn1cbiIsImltcG9ydCBodG1sIGZyb20gJy4uLy4uL2NvcmUvaHRtbCdcblxuZXhwb3J0IGRlZmF1bHQgKHByb3BzKSA9PiB7XG4gIHByb3BzID0gcHJvcHMgfHwge31cblxuICBjb25zdCBpc0hpZGRlbiA9IHByb3BzLnRvdGFsRmlsZUNvdW50ID09PSAwIHx8ICFwcm9wcy5pc1VwbG9hZFN0YXJ0ZWRcblxuICByZXR1cm4gaHRtbGBcbiAgICA8ZGl2IGNsYXNzPVwiVXBweURhc2hib2FyZC1zdGF0dXNCYXJcbiAgICAgICAgICAgICAgICAke3Byb3BzLmlzQWxsQ29tcGxldGUgPyAnaXMtY29tcGxldGUnIDogJyd9XCJcbiAgICAgICAgICAgICAgICBhcmlhLWhpZGRlbj1cIiR7aXNIaWRkZW59XCI+XG5cbiAgICAgIDxkaXYgY2xhc3M9XCJVcHB5RGFzaGJvYXJkLXN0YXR1c0JhclByb2dyZXNzXCIgc3R5bGU9XCJ3aWR0aDogJHtwcm9wcy50b3RhbFByb2dyZXNzfSVcIj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJVcHB5RGFzaGJvYXJkLXN0YXR1c0JhckNvbnRlbnRcIj5cbiAgICAgICAgJHtwcm9wcy5pc1VwbG9hZFN0YXJ0ZWQgJiYgIXByb3BzLmlzQWxsQ29tcGxldGVcbiAgICAgICAgICA/ICFwcm9wcy5pc0FsbFBhdXNlZFxuICAgICAgICAgICAgPyBodG1sYDxzcGFuPiR7cGF1c2VSZXN1bWVCdXR0b25zKHByb3BzKX0gVXBsb2FkaW5nLi4uICR7cHJvcHMuY29tcGxldGV9IC8gJHtwcm9wcy5pblByb2dyZXNzfeODuyR7cHJvcHMudG90YWxQcm9ncmVzcyB8fCAwfSXjg7ske3Byb3BzLnRvdGFsRVRBfeODu+KGkSAke3Byb3BzLnRvdGFsU3BlZWR9L3M8L3NwYW4+YFxuICAgICAgICAgICAgOiBodG1sYDxzcGFuPiR7cGF1c2VSZXN1bWVCdXR0b25zKHByb3BzKX0gUGF1c2Vk44O7JHtwcm9wcy50b3RhbFByb2dyZXNzfSU8L3NwYW4+YFxuICAgICAgICAgIDogbnVsbFxuICAgICAgICAgIH1cbiAgICAgICAgJHtwcm9wcy5pc0FsbENvbXBsZXRlXG4gICAgICAgICAgPyBodG1sYDxzcGFuPjxzdmcgY2xhc3M9XCJVcHB5SWNvblwiIHdpZHRoPVwiMThcIiBoZWlnaHQ9XCIxN1wiIHZpZXdCb3g9XCIwIDAgMjMgMTdcIj5cbiAgICAgICAgICAgICAgPHBhdGggZD1cIk04Ljk0NCAxN0wwIDcuODY1bDIuNTU1LTIuNjEgNi4zOSA2LjUyNUwyMC40MSAwIDIzIDIuNjQ1elwiIC8+XG4gICAgICAgICAgICA8L3N2Zz5VcGxvYWQgY29tcGxldGXjg7ske3Byb3BzLnRvdGFsUHJvZ3Jlc3N9JTwvc3Bhbj5gXG4gICAgICAgICAgOiBudWxsXG4gICAgICAgIH1cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICBgXG59XG5cbi8vICR7IXByb3BzLmF1dG9Qcm9jZWVkICYmIHByb3BzLm5ld0ZpbGVDb3VudCA+IDBcbi8vICAgPyBzdGFydFVwbG9hZChwcm9wcylcbi8vICAgOiBudWxsXG4vLyB9XG5cbi8vIGNvbnN0IHN0YXJ0VXBsb2FkID0gKHByb3BzKSA9PiB7XG4vLyAgIHJldHVybiBodG1sYDxidXR0b24gdHlwZT1cImJ1dHRvblwiIG9uY2xpY2s9JHtwcm9wcy5zdGFydFVwbG9hZH0+XG4vLyAgICAgVXBsb2FkXG4vLyAgICAgPHN1cCBjbGFzcz1cIlVwcHlEYXNoYm9hcmQtdXBsb2FkQ291bnRmXCJcbi8vICAgICAgICAgIHRpdGxlPVwiJHtwcm9wcy5pMThuKCdudW1iZXJPZlNlbGVjdGVkRmlsZXMnKX1cIlxuLy8gICAgICAgICAgYXJpYS1sYWJlbD1cIiR7cHJvcHMuaTE4bignbnVtYmVyT2ZTZWxlY3RlZEZpbGVzJyl9XCI+XG4vLyAgICAgICAke3Byb3BzLm5ld0ZpbGVDb3VudH1cbi8vICAgICA8L3N1cD5cbi8vICAgPC9idXR0b24+YFxuLy8gfVxuXG5jb25zdCBwYXVzZVJlc3VtZUJ1dHRvbnMgPSAocHJvcHMpID0+IHtcbiAgY29uc29sZS5sb2cocHJvcHMucmVzdW1hYmxlVXBsb2FkcylcbiAgcmV0dXJuIGh0bWxgPGJ1dHRvbiBjbGFzcz1cIlVwcHlEYXNoYm9hcmQtc3RhdHVzQmFyQWN0aW9uXCIgdHlwZT1cImJ1dHRvblwiIG9uY2xpY2s9JHsoKSA9PiB0b2dnbGVQYXVzZVJlc3VtZShwcm9wcyl9PlxuICAgICR7cHJvcHMucmVzdW1hYmxlVXBsb2Fkc1xuICAgICAgPyBwcm9wcy5pc0FsbFBhdXNlZFxuICAgICAgICA/IGh0bWxgPHN2ZyBjbGFzcz1cIlVwcHlJY29uXCIgd2lkdGg9XCIxNVwiIGhlaWdodD1cIjE3XCIgdmlld0JveD1cIjAgMCAxMSAxM1wiPlxuICAgICAgICAgIDxwYXRoIGQ9XCJNMS4yNiAxMi41MzRhLjY3LjY3IDAgMCAxLS42NzQuMDEyLjY3LjY3IDAgMCAxLS4zMzYtLjU4M3YtMTFDLjI1LjcyNC4zOC41LjU4Ni4zODJhLjY1OC42NTggMCAwIDEgLjY3My4wMTJsOS4xNjUgNS41YS42Ni42NiAwIDAgMSAuMzI1LjU3LjY2LjY2IDAgMCAxLS4zMjUuNTczbC05LjE2NiA1LjV6XCIgLz5cbiAgICAgICAgPC9zdmc+YFxuICAgICAgICA6IGh0bWxgPHN2ZyBjbGFzcz1cIlVwcHlJY29uXCIgd2lkdGg9XCIxNlwiIGhlaWdodD1cIjE3XCIgdmlld0JveD1cIjAgMCAxMiAxM1wiPlxuICAgICAgICAgIDxwYXRoIGQ9XCJNNC44ODguODF2MTEuMzhjMCAuNDQ2LS4zMjQuODEtLjcyMi44MUgyLjcyMkMyLjMyNCAxMyAyIDEyLjYzNiAyIDEyLjE5Vi44MWMwLS40NDYuMzI0LS44MS43MjItLjgxaDEuNDQ0Yy4zOTggMCAuNzIyLjM2NC43MjIuODF6TTkuODg4LjgxdjExLjM4YzAgLjQ0Ni0uMzI0LjgxLS43MjIuODFINy43MjJDNy4zMjQgMTMgNyAxMi42MzYgNyAxMi4xOVYuODFjMC0uNDQ2LjMyNC0uODEuNzIyLS44MWgxLjQ0NGMuMzk4IDAgLjcyMi4zNjQuNzIyLjgxelwiLz5cbiAgICAgICAgPC9zdmc+YFxuICAgICAgOiBodG1sYDxzdmcgY2xhc3M9XCJVcHB5SWNvblwiIHdpZHRoPVwiMTZweFwiIGhlaWdodD1cIjE2cHhcIiB2aWV3Qm94PVwiMCAwIDE5IDE5XCI+XG4gICAgICAgIDxwYXRoIGQ9XCJNMTcuMzE4IDE3LjIzMkw5Ljk0IDkuODU0IDkuNTg2IDkuNWwtLjM1NC4zNTQtNy4zNzggNy4zNzhoLjcwN2wtLjYyLS42MnYuNzA2TDkuMzE4IDkuOTRsLjM1NC0uMzU0LS4zNTQtLjM1NEwxLjk0IDEuODU0di43MDdsLjYyLS42MmgtLjcwNmw3LjM3OCA3LjM3OC4zNTQuMzU0LjM1NC0uMzU0IDcuMzc4LTcuMzc4aC0uNzA3bC42MjIuNjJ2LS43MDZMOS44NTQgOS4yMzJsLS4zNTQuMzU0LjM1NC4zNTQgNy4zNzggNy4zNzguNzA4LS43MDctNy4zOC03LjM3OHYuNzA4bDcuMzgtNy4zOC4zNTMtLjM1My0uMzUzLS4zNTMtLjYyMi0uNjIyLS4zNTMtLjM1My0uMzU0LjM1Mi03LjM3OCA3LjM4aC43MDhMMi41NiAxLjIzIDIuMjA4Ljg4bC0uMzUzLjM1My0uNjIyLjYyLS4zNTMuMzU1LjM1Mi4zNTMgNy4zOCA3LjM4di0uNzA4bC03LjM4IDcuMzgtLjM1My4zNTMuMzUyLjM1My42MjIuNjIyLjM1My4zNTMuMzU0LS4zNTMgNy4zOC03LjM4aC0uNzA4bDcuMzggNy4zOHpcIi8+XG4gICAgICA8L3N2Zz5gXG4gICAgfVxuICA8L2J1dHRvbj5gXG59XG5cbmNvbnN0IHRvZ2dsZVBhdXNlUmVzdW1lID0gKHByb3BzKSA9PiB7XG4gIGlmIChwcm9wcy5pc0FsbENvbXBsZXRlKSByZXR1cm5cblxuICBpZiAoIXByb3BzLnJlc3VtYWJsZVVwbG9hZHMpIHtcbiAgICByZXR1cm4gcHJvcHMuY2FuY2VsQWxsKClcbiAgfVxuXG4gIGlmIChwcm9wcy5pc0FsbFBhdXNlZCkge1xuICAgIHJldHVybiBwcm9wcy5yZXN1bWVBbGwoKVxuICB9XG5cbiAgcmV0dXJuIHByb3BzLnBhdXNlQWxsKClcbn1cbiIsImltcG9ydCBodG1sIGZyb20gJy4uLy4uL2NvcmUvaHRtbCdcbmltcG9ydCBBY3Rpb25Ccm93c2VUYWdsaW5lIGZyb20gJy4vQWN0aW9uQnJvd3NlVGFnbGluZSdcbmltcG9ydCB7IGxvY2FsSWNvbiB9IGZyb20gJy4vaWNvbnMnXG5cbmV4cG9ydCBkZWZhdWx0IChwcm9wcykgPT4ge1xuICBjb25zdCBpc0hpZGRlbiA9IE9iamVjdC5rZXlzKHByb3BzLmZpbGVzKS5sZW5ndGggPT09IDBcblxuICBpZiAocHJvcHMuYWNxdWlyZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBodG1sYFxuICAgICAgPGRpdiBjbGFzcz1cIlVwcHlEYXNoYm9hcmRUYWJzXCIgYXJpYS1oaWRkZW49XCIke2lzSGlkZGVufVwiPlxuICAgICAgICA8aDMgY2xhc3M9XCJVcHB5RGFzaGJvYXJkVGFicy10aXRsZVwiPlxuICAgICAgICAke0FjdGlvbkJyb3dzZVRhZ2xpbmUoe1xuICAgICAgICAgIGFjcXVpcmVyczogcHJvcHMuYWNxdWlyZXJzLFxuICAgICAgICAgIGNvbnRhaW5lcjogcHJvcHMuY29udGFpbmVyLFxuICAgICAgICAgIGhhbmRsZUlucHV0Q2hhbmdlOiBwcm9wcy5oYW5kbGVJbnB1dENoYW5nZSxcbiAgICAgICAgICBpMThuOiBwcm9wcy5pMThuXG4gICAgICAgIH0pfVxuICAgICAgICA8L2gzPlxuICAgICAgPC9kaXY+XG4gICAgYFxuICB9XG5cbiAgcmV0dXJuIGh0bWxgPGRpdiBjbGFzcz1cIlVwcHlEYXNoYm9hcmRUYWJzXCI+XG4gICAgPG5hdj5cbiAgICAgIDx1bCBjbGFzcz1cIlVwcHlEYXNoYm9hcmRUYWJzLWxpc3RcIiByb2xlPVwidGFibGlzdFwiPlxuICAgICAgICA8bGkgY2xhc3M9XCJVcHB5RGFzaGJvYXJkVGFiXCI+XG4gICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJVcHB5RGFzaGJvYXJkVGFiLWJ0biBVcHB5RGFzaGJvYXJkLWZvY3VzXCJcbiAgICAgICAgICAgICAgICAgIHJvbGU9XCJ0YWJcIlxuICAgICAgICAgICAgICAgICAgdGFiaW5kZXg9XCIwXCJcbiAgICAgICAgICAgICAgICAgIG9uY2xpY2s9JHsoZXYpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5wdXQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGAke3Byb3BzLmNvbnRhaW5lcn0gLlVwcHlEYXNoYm9hcmQtaW5wdXRgKVxuICAgICAgICAgICAgICAgICAgICBpbnB1dC5jbGljaygpXG4gICAgICAgICAgICAgICAgICB9fT5cbiAgICAgICAgICAgICR7bG9jYWxJY29uKCl9XG4gICAgICAgICAgICA8aDUgY2xhc3M9XCJVcHB5RGFzaGJvYXJkVGFiLW5hbWVcIj4ke3Byb3BzLmkxOG4oJ2xvY2FsRGlzaycpfTwvaDU+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPGlucHV0IGNsYXNzPVwiVXBweURhc2hib2FyZC1pbnB1dFwiIHR5cGU9XCJmaWxlXCIgbmFtZT1cImZpbGVzW11cIiBtdWx0aXBsZT1cInRydWVcIlxuICAgICAgICAgICAgICAgICBvbmNoYW5nZT0ke3Byb3BzLmhhbmRsZUlucHV0Q2hhbmdlfSAvPlxuICAgICAgICA8L2xpPlxuICAgICAgICAke3Byb3BzLmFjcXVpcmVycy5tYXAoKHRhcmdldCkgPT4ge1xuICAgICAgICAgIHJldHVybiBodG1sYDxsaSBjbGFzcz1cIlVwcHlEYXNoYm9hcmRUYWJcIj5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJVcHB5RGFzaGJvYXJkVGFiLWJ0blwiXG4gICAgICAgICAgICAgICAgICAgIHJvbGU9XCJ0YWJcIlxuICAgICAgICAgICAgICAgICAgICB0YWJpbmRleD1cIjBcIlxuICAgICAgICAgICAgICAgICAgICBhcmlhLWNvbnRyb2xzPVwiJHtwcm9wcy5wYW5lbFNlbGVjdG9yUHJlZml4fS0tJHt0YXJnZXQuaWR9XCJcbiAgICAgICAgICAgICAgICAgICAgYXJpYS1zZWxlY3RlZD1cIiR7dGFyZ2V0LmlzSGlkZGVuID8gJ2ZhbHNlJyA6ICd0cnVlJ31cIlxuICAgICAgICAgICAgICAgICAgICBvbmNsaWNrPSR7KCkgPT4gcHJvcHMuc2hvd1BhbmVsKHRhcmdldC5pZCl9PlxuICAgICAgICAgICAgICAke3RhcmdldC5pY29ufVxuICAgICAgICAgICAgICA8aDUgY2xhc3M9XCJVcHB5RGFzaGJvYXJkVGFiLW5hbWVcIj4ke3RhcmdldC5uYW1lfTwvaDU+XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8L2xpPmBcbiAgICAgICAgfSl9XG4gICAgICA8L3VsPlxuICAgIDwvbmF2PlxuICA8L2Rpdj5gXG59XG4iLCJpbXBvcnQgaHRtbCBmcm9tICcuLi8uLi9jb3JlL2h0bWwnXG5pbXBvcnQgeyB1cGxvYWRJY29uIH0gZnJvbSAnLi9pY29ucydcblxuZXhwb3J0IGRlZmF1bHQgKHByb3BzKSA9PiB7XG4gIHByb3BzID0gcHJvcHMgfHwge31cblxuICByZXR1cm4gaHRtbGA8YnV0dG9uIGNsYXNzPVwiVXBweUJ1dHRvbi0tY2lyY3VsYXJcbiAgICAgICAgICAgICAgICAgICBVcHB5QnV0dG9uLS1ibHVlXG4gICAgICAgICAgICAgICAgICAgVXBweUJ1dHRvbi0tc2l6ZU1cbiAgICAgICAgICAgICAgICAgICBVcHB5RGFzaGJvYXJkLXVwbG9hZFwiXG4gICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICB0aXRsZT1cIiR7cHJvcHMuaTE4bigndXBsb2FkQWxsTmV3RmlsZXMnKX1cIlxuICAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiJHtwcm9wcy5pMThuKCd1cGxvYWRBbGxOZXdGaWxlcycpfVwiXG4gICAgICAgICAgICAgICAgIG9uY2xpY2s9JHtwcm9wcy5zdGFydFVwbG9hZH0+XG4gICAgICAgICAgICAke3VwbG9hZEljb24oKX1cbiAgICAgICAgICAgIDxzdXAgY2xhc3M9XCJVcHB5RGFzaGJvYXJkLXVwbG9hZENvdW50XCJcbiAgICAgICAgICAgICAgICAgdGl0bGU9XCIke3Byb3BzLmkxOG4oJ251bWJlck9mU2VsZWN0ZWRGaWxlcycpfVwiXG4gICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCIke3Byb3BzLmkxOG4oJ251bWJlck9mU2VsZWN0ZWRGaWxlcycpfVwiPlxuICAgICAgICAgICAgICAgICAgJHtwcm9wcy5uZXdGaWxlQ291bnR9PC9zdXA+XG4gICAgPC9idXR0b24+XG4gIGBcbn1cbiIsImltcG9ydCBodG1sIGZyb20gJy4uLy4uL2NvcmUvaHRtbCdcblxuLy8gaHR0cHM6Ly9jc3MtdHJpY2tzLmNvbS9jcmVhdGluZy1zdmctaWNvbi1zeXN0ZW0tcmVhY3QvXG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZhdWx0VGFiSWNvbiAoKSB7XG4gIHJldHVybiBodG1sYDxzdmcgY2xhc3M9XCJVcHB5SWNvblwiIHdpZHRoPVwiMzBcIiBoZWlnaHQ9XCIzMFwiIHZpZXdCb3g9XCIwIDAgMzAgMzBcIj5cbiAgICA8cGF0aCBkPVwiTTE1IDMwYzguMjg0IDAgMTUtNi43MTYgMTUtMTUgMC04LjI4NC02LjcxNi0xNS0xNS0xNUM2LjcxNiAwIDAgNi43MTYgMCAxNWMwIDguMjg0IDYuNzE2IDE1IDE1IDE1em00LjI1OC0xMi42NzZ2Ni44NDZoLTguNDI2di02Ljg0Nkg1LjIwNGw5LjgyLTEyLjM2NCA5LjgyIDEyLjM2NEgxOS4yNnpcIiAvPlxuICA8L3N2Zz5gXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpY29uQ29weSAoKSB7XG4gIHJldHVybiBodG1sYDxzdmcgY2xhc3M9XCJVcHB5SWNvblwiIHdpZHRoPVwiNTFcIiBoZWlnaHQ9XCI1MVwiIHZpZXdCb3g9XCIwIDAgNTEgNTFcIj5cbiAgICA8cGF0aCBkPVwiTTE3LjIxIDQ1Ljc2NWE1LjM5NCA1LjM5NCAwIDAgMS03LjYyIDBsLTQuMTItNC4xMjJhNS4zOTMgNS4zOTMgMCAwIDEgMC03LjYxOGw2Ljc3NC02Ljc3NS0yLjQwNC0yLjQwNC02Ljc3NSA2Ljc3NmMtMy40MjQgMy40MjctMy40MjQgOSAwIDEyLjQyNmw0LjEyIDQuMTIzYTguNzY2IDguNzY2IDAgMCAwIDYuMjE2IDIuNTdjMi4yNSAwIDQuNS0uODU4IDYuMjE0LTIuNTdsMTMuNTUtMTMuNTUyYTguNzIgOC43MiAwIDAgMCAyLjU3NS02LjIxMyA4LjczIDguNzMgMCAwIDAtMi41NzUtNi4yMTNsLTQuMTIzLTQuMTItMi40MDQgMi40MDQgNC4xMjMgNC4xMmE1LjM1MiA1LjM1MiAwIDAgMSAxLjU4IDMuODFjMCAxLjQzOC0uNTYyIDIuNzktMS41OCAzLjgwOGwtMTMuNTUgMTMuNTV6XCIvPlxuICAgIDxwYXRoIGQ9XCJNNDQuMjU2IDIuODU4QTguNzI4IDguNzI4IDAgMCAwIDM4LjA0My4yODNoLS4wMDJhOC43MyA4LjczIDAgMCAwLTYuMjEyIDIuNTc0bC0xMy41NSAxMy41NWE4LjcyNSA4LjcyNSAwIDAgMC0yLjU3NSA2LjIxNCA4LjczIDguNzMgMCAwIDAgMi41NzQgNi4yMTZsNC4xMiA0LjEyIDIuNDA1LTIuNDAzLTQuMTItNC4xMmE1LjM1NyA1LjM1NyAwIDAgMS0xLjU4LTMuODEyYzAtMS40MzcuNTYyLTIuNzkgMS41OC0zLjgwOGwxMy41NS0xMy41NWE1LjM0OCA1LjM0OCAwIDAgMSAzLjgxLTEuNThjMS40NCAwIDIuNzkyLjU2MiAzLjgxIDEuNThsNC4xMiA0LjEyYzIuMSAyLjEgMi4xIDUuNTE4IDAgNy42MTdMMzkuMiAyMy43NzVsMi40MDQgMi40MDQgNi43NzUtNi43NzdjMy40MjYtMy40MjcgMy40MjYtOSAwLTEyLjQyNmwtNC4xMi00LjEyelwiLz5cbiAgPC9zdmc+YFxufVxuXG5leHBvcnQgZnVuY3Rpb24gaWNvblJlc3VtZSAoKSB7XG4gIHJldHVybiBodG1sYDxzdmcgY2xhc3M9XCJVcHB5SWNvblwiIHdpZHRoPVwiMjVcIiBoZWlnaHQ9XCIyNVwiIHZpZXdCb3g9XCIwIDAgNDQgNDRcIj5cbiAgICA8cG9seWdvbiBjbGFzcz1cInBsYXlcIiB0cmFuc2Zvcm09XCJ0cmFuc2xhdGUoNiwgNS41KVwiIHBvaW50cz1cIjEzIDIxLjY2NjY2NjcgMTMgMTEgMjEgMTYuMzMzMzMzM1wiIC8+XG4gIDwvc3ZnPmBcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGljb25QYXVzZSAoKSB7XG4gIHJldHVybiBodG1sYDxzdmcgY2xhc3M9XCJVcHB5SWNvblwiIHdpZHRoPVwiMjVweFwiIGhlaWdodD1cIjI1cHhcIiB2aWV3Qm94PVwiMCAwIDQ0IDQ0XCI+XG4gICAgPGcgdHJhbnNmb3JtPVwidHJhbnNsYXRlKDE4LCAxNylcIiBjbGFzcz1cInBhdXNlXCI+XG4gICAgICA8cmVjdCB4PVwiMFwiIHk9XCIwXCIgd2lkdGg9XCIyXCIgaGVpZ2h0PVwiMTBcIiByeD1cIjBcIiAvPlxuICAgICAgPHJlY3QgeD1cIjZcIiB5PVwiMFwiIHdpZHRoPVwiMlwiIGhlaWdodD1cIjEwXCIgcng9XCIwXCIgLz5cbiAgICA8L2c+XG4gIDwvc3ZnPmBcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGljb25FZGl0ICgpIHtcbiAgcmV0dXJuIGh0bWxgPHN2ZyBjbGFzcz1cIlVwcHlJY29uXCIgd2lkdGg9XCIyOFwiIGhlaWdodD1cIjI4XCIgdmlld0JveD1cIjAgMCAyOCAyOFwiPlxuICAgIDxwYXRoIGQ9XCJNMjUuNDM2IDIuNTY2YTcuOTggNy45OCAwIDAgMC0yLjA3OC0xLjUxQzIyLjYzOC43MDMgMjEuOTA2LjUgMjEuMTk4LjVhMyAzIDAgMCAwLTEuMDIzLjE3IDIuNDM2IDIuNDM2IDAgMCAwLS44OTMuNTYyTDIuMjkyIDE4LjIxNy41IDI3LjVsOS4yOC0xLjc5NiAxNi45OS0xNi45OWMuMjU1LS4yNTQuNDQ0LS41Ni41NjItLjg4OGEzIDMgMCAwIDAgLjE3LTEuMDIzYzAtLjcwOC0uMjA1LTEuNDQtLjU1NS0yLjE2YTggOCAwIDAgMC0xLjUxLTIuMDc3ek05LjAxIDI0LjI1MmwtNC4zMTMuODM0YzAtLjAzLjAwOC0uMDYuMDEyLS4wOS4wMDctLjk0NC0uNzQtMS43MTUtMS42Ny0xLjcyMy0uMDQgMC0uMDc4LjAwNy0uMTE4LjAxbC44My00LjI5TDE3LjcyIDUuMDI0bDUuMjY0IDUuMjY0TDkuMDEgMjQuMjUyem0xNi44NC0xNi45NmEuODE4LjgxOCAwIDAgMS0uMTk0LjMxbC0xLjU3IDEuNTctNS4yNi01LjI2IDEuNTctMS41N2EuODIuODIgMCAwIDEgLjMxLS4xOTQgMS40NSAxLjQ1IDAgMCAxIC40OTItLjA3NGMuMzk3IDAgLjkxNy4xMjYgMS40NjguMzk3LjU1LjI3IDEuMTMuNjc4IDEuNjU2IDEuMjEuNTMuNTMuOTQgMS4xMSAxLjIwOCAxLjY1NS4yNzIuNTUuMzk3IDEuMDcuMzkzIDEuNDY4LjAwNC4xOTMtLjAyNy4zNTgtLjA3NC40ODh6XCIgLz5cbiAgPC9zdmc+YFxufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9jYWxJY29uICgpIHtcbiAgcmV0dXJuIGh0bWxgPHN2ZyBjbGFzcz1cIlVwcHlJY29uXCIgd2lkdGg9XCIyN1wiIGhlaWdodD1cIjI1XCIgdmlld0JveD1cIjAgMCAyNyAyNVwiPlxuICAgIDxwYXRoIGQ9XCJNNS41ODYgOS4yODhhLjMxMy4zMTMgMCAwIDAgLjI4Mi4xNzZoNC44NHYzLjkyMmMwIDEuNTE0IDEuMjUgMi4yNCAyLjc5MiAyLjI0IDEuNTQgMCAyLjc5LS43MjYgMi43OS0yLjI0VjkuNDY0aDQuODRjLjEyMiAwIC4yMy0uMDY4LjI4NC0uMTc2YS4zMDQuMzA0IDAgMCAwLS4wNDYtLjMyNEwxMy43MzUuMTA2YS4zMTYuMzE2IDAgMCAwLS40NzIgMGwtNy42MyA4Ljg1N2EuMzAyLjMwMiAwIDAgMC0uMDQ3LjMyNXpcIi8+XG4gICAgPHBhdGggZD1cIk0yNC4zIDUuMDkzYy0uMjE4LS43Ni0uNTQtMS4xODctMS4yMDgtMS4xODdoLTQuODU2bDEuMDE4IDEuMThoMy45NDhsMi4wNDMgMTEuMDM4aC03LjE5M3YyLjcyOEg5LjExNHYtMi43MjVoLTcuMzZsMi42Ni0xMS4wNGgzLjMzbDEuMDE4LTEuMThIMy45MDdjLS42NjggMC0xLjA2LjQ2LTEuMjEgMS4xODZMMCAxNi40NTZ2Ny4wNjJDMCAyNC4zMzguNjc2IDI1IDEuNTEgMjVoMjMuOThjLjgzMyAwIDEuNTEtLjY2MyAxLjUxLTEuNDgydi03LjA2MkwyNC4zIDUuMDkzelwiLz5cbiAgPC9zdmc+YFxufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xvc2VJY29uICgpIHtcbiAgcmV0dXJuIGh0bWxgPHN2ZyBjbGFzcz1cIlVwcHlJY29uXCIgd2lkdGg9XCIxNHB4XCIgaGVpZ2h0PVwiMTRweFwiIHZpZXdCb3g9XCIwIDAgMTkgMTlcIj5cbiAgICA8cGF0aCBkPVwiTTE3LjMxOCAxNy4yMzJMOS45NCA5Ljg1NCA5LjU4NiA5LjVsLS4zNTQuMzU0LTcuMzc4IDcuMzc4aC43MDdsLS42Mi0uNjJ2LjcwNkw5LjMxOCA5Ljk0bC4zNTQtLjM1NC0uMzU0LS4zNTRMMS45NCAxLjg1NHYuNzA3bC42Mi0uNjJoLS43MDZsNy4zNzggNy4zNzguMzU0LjM1NC4zNTQtLjM1NCA3LjM3OC03LjM3OGgtLjcwN2wuNjIyLjYydi0uNzA2TDkuODU0IDkuMjMybC0uMzU0LjM1NC4zNTQuMzU0IDcuMzc4IDcuMzc4LjcwOC0uNzA3LTcuMzgtNy4zNzh2LjcwOGw3LjM4LTcuMzguMzUzLS4zNTMtLjM1My0uMzUzLS42MjItLjYyMi0uMzUzLS4zNTMtLjM1NC4zNTItNy4zNzggNy4zOGguNzA4TDIuNTYgMS4yMyAyLjIwOC44OGwtLjM1My4zNTMtLjYyMi42Mi0uMzUzLjM1NS4zNTIuMzUzIDcuMzggNy4zOHYtLjcwOGwtNy4zOCA3LjM4LS4zNTMuMzUzLjM1Mi4zNTMuNjIyLjYyMi4zNTMuMzUzLjM1NC0uMzUzIDcuMzgtNy4zOGgtLjcwOGw3LjM4IDcuMzh6XCIvPlxuICA8L3N2Zz5gXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwbHVnaW5JY29uICgpIHtcbiAgcmV0dXJuIGh0bWxgPHN2ZyBjbGFzcz1cIlVwcHlJY29uXCIgd2lkdGg9XCIxNnB4XCIgaGVpZ2h0PVwiMTZweFwiIHZpZXdCb3g9XCIwIDAgMzIgMzBcIj5cbiAgICAgIDxwYXRoIGQ9XCJNNi42MjA5ODk0LDExLjE0NTExNjIgQzYuNjgyMzA1MSwxMS4yNzUxNjY5IDYuODEzNzQyNDgsMTEuMzU3MjE4OCA2Ljk1NDYzODEzLDExLjM1NzIxODggTDEyLjY5MjU0ODIsMTEuMzU3MjE4OCBMMTIuNjkyNTQ4MiwxNi4wNjMwNDI3IEMxMi42OTI1NDgyLDE3Ljg4MDUwOSAxNC4xNzI2MDQ4LDE4Ljc1IDE2LjAwMDAwODMsMTguNzUgQzE3LjgyNjEwNzIsMTguNzUgMTkuMzA3NDY4NCwxNy44ODAxODQ3IDE5LjMwNzQ2ODQsMTYuMDYzMDQyNyBMMTkuMzA3NDY4NCwxMS4zNTcyMTg4IEwyNS4wNDM3NDc4LDExLjM1NzIxODggQzI1LjE4NzU3ODcsMTEuMzU3MjE4OCAyNS4zMTY0MDY5LDExLjI3NTE2NjkgMjUuMzc5MDI3MiwxMS4xNDUxMTYyIEMyNS40MzcwODE0LDExLjAxNzMzNTggMjUuNDE3MTg2NSwxMC44NjQyNTg3IDI1LjMyNTIxMjksMTAuNzU2MjYxNSBMMTYuMjc4MjEyLDAuMTI3MTMxODM3IEMxNi4yMDkzOTQ5LDAuMDQ2Mzc3MTc1MSAxNi4xMDY5ODQ2LDAgMTUuOTk5NjgyMiwwIEMxNS44OTEwNzUxLDAgMTUuNzg4NjY0OCwwLjA0NjM3NzE3NTEgMTUuNzE4MjE3LDAuMTI3MTMxODM3IEw2LjY3NjEwODMsMTAuNzU1OTM3MSBDNi41ODI1MDQwMiwxMC44NjQyNTg3IDYuNTYyOTM1MTgsMTEuMDE3MzM1OCA2LjYyMDk4OTQsMTEuMTQ1MTE2MiBMNi42MjA5ODk0LDExLjE0NTExNjIgWlwiLz5cbiAgICAgIDxwYXRoIGQ9XCJNMjguODAwODcyMiw2LjExMTQyNjQ1IEMyOC41NDE3ODkxLDUuMTk4MzE1NTUgMjguMTU4MzMzMSw0LjY4NzUgMjcuMzY4NDg0OCw0LjY4NzUgTDIxLjYxMjQ0NTQsNC42ODc1IEwyMi44MTkwMjM0LDYuMTAzMDc4NzQgTDI3LjQ5ODY3MjUsNi4xMDMwNzg3NCBMMjkuOTE5NTgxNywxOS4zNDg2NDQ5IEwyMS4zOTQzODkxLDE5LjM1MDI1MDIgTDIxLjM5NDM4OTEsMjIuNjIyNTUyIEwxMC44MDIzNDYxLDIyLjYyMjU1MiBMMTAuODAyMzQ2MSwxOS4zNTI0OTc3IEwyLjA3ODE1NzAyLDE5LjM1MzQ2MDkgTDUuMjI5Nzk2OTksNi4xMDMwNzg3NCBMOS4xNzg3MTUyOSw2LjEwMzA3ODc0IEwxMC4zODQwMDExLDQuNjg3NSBMNC42MzA4NjkxLDQuNjg3NSBDMy44Mzk0MDU1OSw0LjY4NzUgMy4zNzQyMTg4OCw1LjIzOTA5MDkgMy4xOTgxNTg2NCw2LjExMTQyNjQ1IEwwLDE5Ljc0NzA4NzQgTDAsMjguMjIxMjk1OSBDMCwyOS4yMDQzOTkyIDAuODAxNDc3OTM3LDMwIDEuNzg4NzA3NTEsMzAgTDMwLjIwOTY3NzMsMzAgQzMxLjE5ODE5OSwzMCAzMiwyOS4yMDQzOTkyIDMyLDI4LjIyMTI5NTkgTDMyLDE5Ljc0NzA4NzQgTDI4LjgwMDg3MjIsNi4xMTE0MjY0NSBMMjguODAwODcyMiw2LjExMTQyNjQ1IFpcIi8+XG4gICAgPC9zdmc+YFxufVxuXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tJY29uICgpIHtcbiAgcmV0dXJuIGh0bWxgPHN2ZyBjbGFzcz1cIlVwcHlJY29uIFVwcHlJY29uLWNoZWNrXCIgd2lkdGg9XCIxM3B4XCIgaGVpZ2h0PVwiOXB4XCIgdmlld0JveD1cIjAgMCAxMyA5XCI+XG4gICAgPHBvbHlnb24gcG9pbnRzPVwiNSA3LjI5MyAxLjM1NCAzLjY0NyAwLjY0NiA0LjM1NCA1IDguNzA3IDEyLjM1NCAxLjM1NCAxMS42NDYgMC42NDdcIj48L3BvbHlnb24+XG4gIDwvc3ZnPmBcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGljb25BdWRpbyAoKSB7XG4gIHJldHVybiBodG1sYDxzdmcgY2xhc3M9XCJVcHB5SWNvblwiIHdpZHRoPVwiMzRcIiBoZWlnaHQ9XCI5MVwiIHZpZXdCb3g9XCIwIDAgMzQgOTFcIj5cbiAgICA8cGF0aCBkPVwiTTIyLjM2NiA0My4xMzRWMjkuMzNjNS44OTItNi41ODggMTAuOTg2LTE0LjUwNyAxMC45ODYtMjIuMTgzIDAtNC4xMTQtMi45ODYtNy4xLTcuMS03LjEtMy45MTQgMC03LjEgMy4xODYtNy4xIDcuMXYyMC45MzZhOTIuNTYyIDkyLjU2MiAwIDAgMS01LjcyOCA1LjY3N2wtLjM4NC4zNDhDNC42NDMgNDEuNzYyLjQyOCA0NS42MDQuNDI4IDU0LjgwMmMwIDguODY2IDcuMjE0IDE2LjA4IDE2LjA4IDE2LjA4LjkwMiAwIDEuNzg0LS4wNzQgMi42NDQtLjIxNnYxMS4yNmMwIDIuNzAyLTIuMTk4IDQuOS00LjkgNC45YTQuODU1IDQuODU1IDAgMCAxLTIuOTUtMS4wMTVjMi4zNjQtLjI0IDQuMjIyLTIuMjE4IDQuMjIyLTQuNjQzYTQuNjk4IDQuNjk4IDAgMCAwLTQuNjkyLTQuNjkyIDQuNzM4IDQuNzM4IDAgMCAwLTQuMjEzIDIuNjI4Yy0uOTIzIDEuODc0LS41NiA0LjM4Ni4yNzcgNi4yMjhhNy44MiA3LjgyIDAgMCAwIC45IDEuNTAyIDguMTc4IDguMTc4IDAgMCAwIDQuMjMgMi44OTZjLjcyMy4yMDcgMS40NzQuMzEgMi4yMjYuMzEgNC40NzQgMCA4LjExMy0zLjY0IDguMTEzLTguMTEzVjY5Ljc4YzUuOTgtMi4zNDUgMTAuMjI1LTguMTc2IDEwLjIyNS0xNC45NzcgMC01Ljk3NS00LjQ2NC0xMC44NzYtMTAuMjI0LTExLjY3em0wLTM1Ljk4N2EzLjg5IDMuODkgMCAwIDEgMy44ODctMy44ODVjMS45MzMgMCAzLjg4NSAxLjIwMiAzLjg4NSAzLjg4NSAwIDQuOTUtMi43MDIgMTAuODYyLTcuNzcyIDE3LjIwNFY3LjE0OHpNMTYuNTEgNjcuNjdjLTcuMDk2IDAtMTIuODY3LTUuNzctMTIuODY3LTEyLjg2NyAwLTcuNzggMy4zODUtMTAuODY1IDExLjU2My0xOC4zMmwuMzg0LS4zNWMxLjE2Ni0xLjA2NCAyLjM2NS0yLjIgMy41NjItMy40MDJ2MTAuNDA0Yy01Ljc1OC43OTMtMTAuMjIzIDUuNjk1LTEwLjIyMyAxMS42NyAwIDMuOTM1IDEuOTQ4IDcuNjAzIDUuMjEyIDkuODFhMS42MDUgMS42MDUgMCAxIDAgMS44LTIuNjYgOC42MjIgOC42MjIgMCAwIDEtMy44LTcuMTVjMC00LjIgMy4wMjUtNy43IDcuMDEtOC40NTZ2MjEuMDVjLS44NTMuMTc4LTEuNzM2LjI3Mi0yLjY0Mi4yNzJ6bTUuODU2LTEuNDEydi0xOS45MWMzLjk4NS43NTYgNy4wMSA0LjI1MyA3LjAxIDguNDU1IDAgNC45ODctMi44NSA5LjMyLTcuMDEgMTEuNDU1elwiIC8+XG4gIDwvc3ZnPmBcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGljb25GaWxlICgpIHtcbiAgcmV0dXJuIGh0bWxgPHN2ZyBjbGFzcz1cIlVwcHlJY29uXCIgd2lkdGg9XCI0NFwiIGhlaWdodD1cIjU4XCIgdmlld0JveD1cIjAgMCA0NCA1OFwiPlxuICAgIDxwYXRoIGQ9XCJNMjcuNDM3LjUxN2ExIDEgMCAwIDAtLjA5NC4wM0g0LjI1QzIuMDM3LjU0OC4yMTcgMi4zNjguMjE3IDQuNTh2NDguNDA1YzAgMi4yMTIgMS44MiA0LjAzIDQuMDMgNC4wM0gzOS4wM2MyLjIxIDAgNC4wMy0xLjgxOCA0LjAzLTQuMDNWMTUuNjFhMSAxIDAgMCAwLS4wMy0uMjggMSAxIDAgMCAwIDAtLjA5MyAxIDEgMCAwIDAtLjAzLS4wMzIgMSAxIDAgMCAwIDAtLjAzIDEgMSAwIDAgMC0uMDMyLS4wNjMgMSAxIDAgMCAwLS4wMy0uMDYzIDEgMSAwIDAgMC0uMDMyIDAgMSAxIDAgMCAwLS4wMy0uMDYzIDEgMSAwIDAgMC0uMDMyLS4wMyAxIDEgMCAwIDAtLjAzLS4wNjMgMSAxIDAgMCAwLS4wNjMtLjA2MmwtMTQuNTkzLTE0YTEgMSAwIDAgMC0uMDYyLS4wNjJBMSAxIDAgMCAwIDI4IC43MDhhMSAxIDAgMCAwLS4zNzQtLjE1NyAxIDEgMCAwIDAtLjE1NiAwIDEgMSAwIDAgMC0uMDMtLjAzbC0uMDAzLS4wMDN6TTQuMjUgMi41NDdoMjIuMjE4djkuOTdjMCAyLjIxIDEuODIgNC4wMyA0LjAzIDQuMDNoMTAuNTY0djM2LjQzOGEyLjAyIDIuMDIgMCAwIDEtMi4wMzIgMi4wMzJINC4yNWMtMS4xMyAwLTIuMDMyLS45LTIuMDMyLTIuMDMyVjQuNThjMC0xLjEzLjkwMi0yLjAzMiAyLjAzLTIuMDMyem0yNC4yMTggMS4zNDVsMTAuMzc1IDkuOTM3Ljc1LjcxOEgzMC41Yy0xLjEzIDAtMi4wMzItLjktMi4wMzItMi4wM1YzLjg5elwiIC8+XG4gIDwvc3ZnPmBcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGljb25UZXh0ICgpIHtcbiAgcmV0dXJuIGh0bWxgPHN2ZyBjbGFzcz1cIlVwcHlJY29uXCIgd2lkdGg9XCI1MFwiIGhlaWdodD1cIjYzXCIgdmlld0JveD1cIjAgMCA1MCA2M1wiPlxuICAgIDxwYXRoIGQ9XCJNMCAuNXYxNS42MTdoNi4yNWwxLjctNS4xYTYuMjQyIDYuMjQyIDAgMCAxIDUuOTMzLTQuMjY3aDhWNTAuNWMwIDMuNDUtMi44IDYuMjUtNi4yNSA2LjI1SDEyLjVWNjNoMjV2LTYuMjVoLTMuMTMzYy0zLjQ1IDAtNi4yNS0yLjgtNi4yNS02LjI1VjYuNzVoOGE2LjI1NyA2LjI1NyAwIDAgMSA1LjkzMyA0LjI2N2wxLjcgNS4xSDUwVi41SDB6XCIgLz5cbiAgPC9zdmc+YFxufVxuXG4vLyBleHBvcnQgZnVuY3Rpb24gcmVtb3ZlSWNvbiAoKSB7XG4vLyAgIHJldHVybiBodG1sIGA8c3ZnIGNsYXNzPVwiVXBweUljb25cIiB3aWR0aD1cIjIyXCIgaGVpZ2h0PVwiMjFcIiB2aWV3Qm94PVwiMCAwIDE4IDE3XCI+XG4vLyAgICAgPGVsbGlwc2UgY3g9XCI4LjYyXCIgY3k9XCI4LjM4M1wiIHJ4PVwiOC42MlwiIHJ5PVwiOC4zODNcIi8+XG4vLyAgICAgPHBhdGggc3Ryb2tlPVwiI0ZGRlwiIGZpbGw9XCIjRkZGXCIgZD1cIk0xMSA2LjE0N0wxMC44NSA2IDguNSA4LjI4NCA2LjE1IDYgNiA2LjE0NyA4LjM1IDguNDMgNiAxMC43MTdsLjE1LjE0Nkw4LjUgOC41NzhsMi4zNSAyLjI4NC4xNS0uMTQ2TDguNjUgOC40M3pcIi8+XG4vLyAgIDwvc3ZnPmBcbi8vIH1cblxuZXhwb3J0IGZ1bmN0aW9uIHVwbG9hZEljb24gKCkge1xuICByZXR1cm4gaHRtbGA8c3ZnIGNsYXNzPVwiVXBweUljb25cIiB3aWR0aD1cIjM3XCIgaGVpZ2h0PVwiMzNcIiB2aWV3Qm94PVwiMCAwIDM3IDMzXCI+XG4gICAgPHBhdGggZD1cIk0yOS4xMDcgMjQuNWM0LjA3IDAgNy4zOTMtMy4zNTUgNy4zOTMtNy40NDIgMC0zLjk5NC0zLjEwNS03LjMwNy03LjAxMi03LjUwMmwuNDY4LjQxNUMyOS4wMiA0LjUyIDI0LjM0LjUgMTguODg2LjVjLTQuMzQ4IDAtOC4yNyAyLjUyMi0xMC4xMzggNi41MDZsLjQ0Ni0uMjg4QzQuMzk0IDYuNzgyLjUgMTAuNzU4LjUgMTUuNjA4YzAgNC45MjQgMy45MDYgOC44OTIgOC43NiA4Ljg5Mmg0Ljg3MmMuNjM1IDAgMS4wOTUtLjQ2NyAxLjA5NS0xLjEwNCAwLS42MzYtLjQ2LTEuMTAzLTEuMDk1LTEuMTAzSDkuMjZjLTMuNjQ0IDAtNi42My0zLjAzNS02LjYzLTYuNzQ0IDAtMy43MSAyLjkyNi02LjY4NSA2LjU3LTYuNjg1aC45NjRsLjE0LS4yOC4xNzctLjM2MmMxLjQ3Ny0zLjQgNC43NDQtNS41NzYgOC4zNDctNS41NzYgNC41OCAwIDguNDUgMy40NTIgOS4wMSA4LjA3MmwuMDYuNTM2LjA1LjQ0NmgxLjEwMWMyLjg3IDAgNS4yMDQgMi4zNyA1LjIwNCA1LjI5NXMtMi4zMzMgNS4yOTYtNS4yMDQgNS4yOTZoLTYuMDYyYy0uNjM0IDAtMS4wOTQuNDY3LTEuMDk0IDEuMTAzIDAgLjYzNy40NiAxLjEwNCAxLjA5NCAxLjEwNGg2LjEyelwiLz5cbiAgICA8cGF0aCBkPVwiTTIzLjE5NiAxOC45MmwtNC44MjgtNS4yNTgtLjM2Ni0uNC0uMzY4LjM5OC00LjgyOCA1LjE5NmExLjEzIDEuMTMgMCAwIDAgMCAxLjU0NmMuNDI4LjQ2IDEuMTEuNDYgMS41MzcgMGwzLjQ1LTMuNzEtLjg2OC0uMzR2MTUuMDNjMCAuNjQuNDQ1IDEuMTE4IDEuMDc1IDEuMTE4LjYzIDAgMS4wNzUtLjQ4IDEuMDc1LTEuMTJWMTYuMzVsLS44NjcuMzQgMy40NSAzLjcxMmExIDEgMCAwIDAgLjc2Ny4zNDUgMSAxIDAgMCAwIC43Ny0uMzQ1Yy40MTYtLjMzLjQxNi0xLjAzNiAwLTEuNDg1di4wMDN6XCIvPlxuICA8L3N2Zz5gXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkYXNoYm9hcmRCZ0ljb24gKCkge1xuICByZXR1cm4gaHRtbGA8c3ZnIGNsYXNzPVwiVXBweUljb25cIiB3aWR0aD1cIjQ4XCIgaGVpZ2h0PVwiNjlcIiB2aWV3Qm94PVwiMCAwIDQ4IDY5XCI+XG4gICAgPHBhdGggZD1cIk0uNSAxLjVoNXpNMTAuNSAxLjVoNXpNMjAuNSAxLjVoNXpNMzAuNTA0IDEuNWg1ek00NS41IDExLjV2NXpNNDUuNSAyMS41djV6TTQ1LjUgMzEuNXY1ek00NS41IDQxLjUwMnY1ek00NS41IDUxLjUwMnY1ek00NS41IDYxLjV2NXpNNDUuNSA2Ni41MDJoLTQuOTk4ek0zNS41MDMgNjYuNTAyaC01ek0yNS41IDY2LjUwMmgtNXpNMTUuNSA2Ni41MDJoLTV6TTUuNSA2Ni41MDJoLTV6TS41IDY2LjUwMnYtNXpNLjUgNTYuNTAydi01ek0uNSA0Ni41MDNWNDEuNXpNLjUgMzYuNXYtNXpNLjUgMjYuNXYtNXpNLjUgMTYuNXYtNXpNLjUgNi41VjEuNDk4ek00NC44MDcgMTFIMzZWMi4xOTV6XCIvPlxuICA8L3N2Zz5gXG59XG4iLCJpbXBvcnQgUGx1Z2luIGZyb20gJy4uL1BsdWdpbidcbmltcG9ydCBkcmFnRHJvcCBmcm9tICdkcmFnLWRyb3AnXG5pbXBvcnQgRGFzaGJvYXJkIGZyb20gJy4vRGFzaGJvYXJkJ1xuaW1wb3J0IHsgZ2V0U3BlZWQsIGdldEVUQSwgcHJldHR5RVRBIH0gZnJvbSAnLi4vLi4vY29yZS9VdGlscydcbmltcG9ydCBwcmV0dHlCeXRlcyBmcm9tICdwcmV0dHktYnl0ZXMnXG5pbXBvcnQgeyBkZWZhdWx0VGFiSWNvbiB9IGZyb20gJy4vaWNvbnMnXG5cbi8qKlxuICogTW9kYWwgRGlhbG9nICYgRGFzaGJvYXJkXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIERhc2hib2FyZFVJIGV4dGVuZHMgUGx1Z2luIHtcbiAgY29uc3RydWN0b3IgKGNvcmUsIG9wdHMpIHtcbiAgICBzdXBlcihjb3JlLCBvcHRzKVxuICAgIHRoaXMuaWQgPSAnRGFzaGJvYXJkVUknXG4gICAgdGhpcy50aXRsZSA9ICdEYXNoYm9hcmQgVUknXG4gICAgdGhpcy50eXBlID0gJ29yY2hlc3RyYXRvcidcblxuICAgIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgIHRhcmdldDogJ2JvZHknLFxuICAgICAgaW5saW5lOiBmYWxzZSxcbiAgICAgIHNlbWlUcmFuc3BhcmVudDogZmFsc2UsXG4gICAgICBkZWZhdWx0VGFiSWNvbjogZGVmYXVsdFRhYkljb24oKSxcbiAgICAgIHBhbmVsU2VsZWN0b3JQcmVmaXg6ICdVcHB5RGFzaGJvYXJkQ29udGVudC1wYW5lbCcsXG4gICAgICBzaG93UHJvZ3Jlc3NEZXRhaWxzOiB0cnVlXG4gICAgfVxuXG4gICAgLy8gbWVyZ2UgZGVmYXVsdCBvcHRpb25zIHdpdGggdGhlIG9uZXMgc2V0IGJ5IHVzZXJcbiAgICB0aGlzLm9wdHMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0cylcblxuICAgIHRoaXMuaGlkZU1vZGFsID0gdGhpcy5oaWRlTW9kYWwuYmluZCh0aGlzKVxuICAgIHRoaXMuc2hvd01vZGFsID0gdGhpcy5zaG93TW9kYWwuYmluZCh0aGlzKVxuXG4gICAgdGhpcy5hZGRUYXJnZXQgPSB0aGlzLmFkZFRhcmdldC5iaW5kKHRoaXMpXG4gICAgdGhpcy5hY3Rpb25zID0gdGhpcy5hY3Rpb25zLmJpbmQodGhpcylcbiAgICB0aGlzLmhpZGVBbGxQYW5lbHMgPSB0aGlzLmhpZGVBbGxQYW5lbHMuYmluZCh0aGlzKVxuICAgIHRoaXMuc2hvd1BhbmVsID0gdGhpcy5zaG93UGFuZWwuYmluZCh0aGlzKVxuICAgIHRoaXMuaW5pdEV2ZW50cyA9IHRoaXMuaW5pdEV2ZW50cy5iaW5kKHRoaXMpXG4gICAgdGhpcy5oYW5kbGVEcm9wID0gdGhpcy5oYW5kbGVEcm9wLmJpbmQodGhpcylcbiAgICB0aGlzLnBhdXNlQWxsID0gdGhpcy5wYXVzZUFsbC5iaW5kKHRoaXMpXG4gICAgdGhpcy5yZXN1bWVBbGwgPSB0aGlzLnJlc3VtZUFsbC5iaW5kKHRoaXMpXG4gICAgdGhpcy5jYW5jZWxBbGwgPSB0aGlzLmNhbmNlbEFsbC5iaW5kKHRoaXMpXG4gICAgdGhpcy5yZW5kZXIgPSB0aGlzLnJlbmRlci5iaW5kKHRoaXMpXG4gICAgdGhpcy5pbnN0YWxsID0gdGhpcy5pbnN0YWxsLmJpbmQodGhpcylcbiAgfVxuXG4gIGFkZFRhcmdldCAocGx1Z2luKSB7XG4gICAgY29uc3QgY2FsbGVyUGx1Z2luSWQgPSBwbHVnaW4uY29uc3RydWN0b3IubmFtZVxuICAgIGNvbnN0IGNhbGxlclBsdWdpbk5hbWUgPSBwbHVnaW4udGl0bGUgfHwgY2FsbGVyUGx1Z2luSWRcbiAgICBjb25zdCBjYWxsZXJQbHVnaW5JY29uID0gcGx1Z2luLmljb24gfHwgdGhpcy5vcHRzLmRlZmF1bHRUYWJJY29uXG4gICAgY29uc3QgY2FsbGVyUGx1Z2luVHlwZSA9IHBsdWdpbi50eXBlXG5cbiAgICBpZiAoY2FsbGVyUGx1Z2luVHlwZSAhPT0gJ2FjcXVpcmVyJyAmJlxuICAgICAgICBjYWxsZXJQbHVnaW5UeXBlICE9PSAncHJvZ3Jlc3NpbmRpY2F0b3InICYmXG4gICAgICAgIGNhbGxlclBsdWdpblR5cGUgIT09ICdwcmVzZW50ZXInKSB7XG4gICAgICBsZXQgbXNnID0gJ0Vycm9yOiBNb2RhbCBjYW4gb25seSBiZSB1c2VkIGJ5IHBsdWdpbnMgb2YgdHlwZXM6IGFjcXVpcmVyLCBwcm9ncmVzc2luZGljYXRvciwgcHJlc2VudGVyJ1xuICAgICAgdGhpcy5jb3JlLmxvZyhtc2cpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBjb25zdCB0YXJnZXQgPSB7XG4gICAgICBpZDogY2FsbGVyUGx1Z2luSWQsXG4gICAgICBuYW1lOiBjYWxsZXJQbHVnaW5OYW1lLFxuICAgICAgaWNvbjogY2FsbGVyUGx1Z2luSWNvbixcbiAgICAgIHR5cGU6IGNhbGxlclBsdWdpblR5cGUsXG4gICAgICBmb2N1czogcGx1Z2luLmZvY3VzLFxuICAgICAgcmVuZGVyOiBwbHVnaW4ucmVuZGVyLFxuICAgICAgaXNIaWRkZW46IHRydWVcbiAgICB9XG5cbiAgICBjb25zdCBtb2RhbCA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLm1vZGFsXG4gICAgY29uc3QgbmV3VGFyZ2V0cyA9IG1vZGFsLnRhcmdldHMuc2xpY2UoKVxuICAgIG5ld1RhcmdldHMucHVzaCh0YXJnZXQpXG5cbiAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe1xuICAgICAgbW9kYWw6IE9iamVjdC5hc3NpZ24oe30sIG1vZGFsLCB7XG4gICAgICAgIHRhcmdldHM6IG5ld1RhcmdldHNcbiAgICAgIH0pXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzLm9wdHMudGFyZ2V0XG4gIH1cblxuICBoaWRlQWxsUGFuZWxzICgpIHtcbiAgICBjb25zdCBtb2RhbCA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLm1vZGFsXG5cbiAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe21vZGFsOiBPYmplY3QuYXNzaWduKHt9LCBtb2RhbCwge1xuICAgICAgYWN0aXZlUGFuZWw6IGZhbHNlXG4gICAgfSl9KVxuICB9XG5cbiAgc2hvd1BhbmVsIChpZCkge1xuICAgIGNvbnN0IG1vZGFsID0gdGhpcy5jb3JlLmdldFN0YXRlKCkubW9kYWxcblxuICAgIGNvbnN0IGFjdGl2ZVBhbmVsID0gbW9kYWwudGFyZ2V0cy5maWx0ZXIoKHRhcmdldCkgPT4ge1xuICAgICAgcmV0dXJuIHRhcmdldC50eXBlID09PSAnYWNxdWlyZXInICYmIHRhcmdldC5pZCA9PT0gaWRcbiAgICB9KVswXVxuXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHttb2RhbDogT2JqZWN0LmFzc2lnbih7fSwgbW9kYWwsIHtcbiAgICAgIGFjdGl2ZVBhbmVsOiBhY3RpdmVQYW5lbFxuICAgIH0pfSlcbiAgfVxuXG4gIGhpZGVNb2RhbCAoKSB7XG4gICAgY29uc3QgbW9kYWwgPSB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5tb2RhbFxuXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHtcbiAgICAgIG1vZGFsOiBPYmplY3QuYXNzaWduKHt9LCBtb2RhbCwge1xuICAgICAgICBpc0hpZGRlbjogdHJ1ZVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKCdpcy1VcHB5RGFzaGJvYXJkLW9wZW4nKVxuICB9XG5cbiAgc2hvd01vZGFsICgpIHtcbiAgICBjb25zdCBtb2RhbCA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLm1vZGFsXG5cbiAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe1xuICAgICAgbW9kYWw6IE9iamVjdC5hc3NpZ24oe30sIG1vZGFsLCB7XG4gICAgICAgIGlzSGlkZGVuOiBmYWxzZVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgLy8gYWRkIGNsYXNzIHRvIGJvZHkgdGhhdCBzZXRzIHBvc2l0aW9uIGZpeGVkXG4gICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKCdpcy1VcHB5RGFzaGJvYXJkLW9wZW4nKVxuICAgIC8vIGZvY3VzIG9uIG1vZGFsIGlubmVyIGJsb2NrXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLlVwcHlEYXNoYm9hcmQtaW5uZXInKS5mb2N1cygpXG4gIH1cblxuICBpbml0RXZlbnRzICgpIHtcbiAgICAvLyBjb25zdCBkYXNoYm9hcmRFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYCR7dGhpcy5vcHRzLnRhcmdldH0gLlVwcHlEYXNoYm9hcmRgKVxuXG4gICAgLy8gTW9kYWwgb3BlbiBidXR0b25cbiAgICBjb25zdCBzaG93TW9kYWxUcmlnZ2VyID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0aGlzLm9wdHMudHJpZ2dlcilcbiAgICBpZiAoIXRoaXMub3B0cy5pbmxpbmUgJiYgc2hvd01vZGFsVHJpZ2dlcikge1xuICAgICAgc2hvd01vZGFsVHJpZ2dlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuc2hvd01vZGFsKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNvcmUubG9nKCdNb2RhbCB0cmlnZ2VyIHdhc27igJl0IGZvdW5kJylcbiAgICB9XG5cbiAgICAvLyBDbG9zZSB0aGUgTW9kYWwgb24gZXNjIGtleSBwcmVzc1xuICAgIGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCAoZXZlbnQpID0+IHtcbiAgICAgIGlmIChldmVudC5rZXlDb2RlID09PSAyNykge1xuICAgICAgICB0aGlzLmhpZGVNb2RhbCgpXG4gICAgICB9XG4gICAgfSlcblxuICAgIC8vIERyYWcgRHJvcFxuICAgIGRyYWdEcm9wKHRoaXMuZWwsIChmaWxlcykgPT4ge1xuICAgICAgdGhpcy5oYW5kbGVEcm9wKGZpbGVzKVxuICAgIH0pXG4gIH1cblxuICBhY3Rpb25zICgpIHtcbiAgICBjb25zdCBidXMgPSB0aGlzLmNvcmUuYnVzXG5cbiAgICBidXMub24oJ2NvcmU6ZmlsZS1hZGQnLCAoKSA9PiB7XG4gICAgICB0aGlzLmhpZGVBbGxQYW5lbHMoKVxuICAgIH0pXG5cbiAgICBidXMub24oJ2Rhc2hib2FyZDpmaWxlLWNhcmQnLCAoZmlsZUlkKSA9PiB7XG4gICAgICBjb25zdCBtb2RhbCA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLm1vZGFsXG5cbiAgICAgIHRoaXMuY29yZS5zZXRTdGF0ZSh7XG4gICAgICAgIG1vZGFsOiBPYmplY3QuYXNzaWduKHt9LCBtb2RhbCwge1xuICAgICAgICAgIGZpbGVDYXJkRm9yOiBmaWxlSWQgfHwgZmFsc2VcbiAgICAgICAgfSlcbiAgICAgIH0pXG4gICAgfSlcblxuICAgIC8vIGJ1cy5vbignY29yZTpzdWNjZXNzJywgKHVwbG9hZGVkQ291bnQpID0+IHtcbiAgICAvLyAgIGJ1cy5lbWl0KFxuICAgIC8vICAgICAnaW5mb3JtZXInLFxuICAgIC8vICAgICBgJHt0aGlzLmNvcmUuaTE4bignZmlsZXMnLCB7J3NtYXJ0X2NvdW50JzogdXBsb2FkZWRDb3VudH0pfSBzdWNjZXNzZnVsbHkgdXBsb2FkZWQsIFNpciFgLFxuICAgIC8vICAgICAnaW5mbycsXG4gICAgLy8gICAgIDYwMDBcbiAgICAvLyAgIClcbiAgICAvLyB9KVxuICB9XG5cbiAgaGFuZGxlRHJvcCAoZmlsZXMpIHtcbiAgICB0aGlzLmNvcmUubG9nKCdBbGwgcmlnaHQsIHNvbWVvbmUgZHJvcHBlZCBzb21ldGhpbmcuLi4nKVxuXG4gICAgZmlsZXMuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgdGhpcy5jb3JlLmJ1cy5lbWl0KCdjb3JlOmZpbGUtYWRkJywge1xuICAgICAgICBzb3VyY2U6IHRoaXMuaWQsXG4gICAgICAgIG5hbWU6IGZpbGUubmFtZSxcbiAgICAgICAgdHlwZTogZmlsZS50eXBlLFxuICAgICAgICBkYXRhOiBmaWxlXG4gICAgICB9KVxuICAgIH0pXG4gIH1cblxuICBjYW5jZWxBbGwgKCkge1xuICAgIHRoaXMuY29yZS5idXMuZW1pdCgnY29yZTpjYW5jZWwtYWxsJylcbiAgfVxuXG4gIHBhdXNlQWxsICgpIHtcbiAgICB0aGlzLmNvcmUuYnVzLmVtaXQoJ2NvcmU6cGF1c2UtYWxsJylcbiAgfVxuXG4gIHJlc3VtZUFsbCAoKSB7XG4gICAgdGhpcy5jb3JlLmJ1cy5lbWl0KCdjb3JlOnJlc3VtZS1hbGwnKVxuICB9XG5cbiAgZ2V0VG90YWxTcGVlZCAoZmlsZXMpIHtcbiAgICBsZXQgdG90YWxTcGVlZCA9IDBcbiAgICBmaWxlcy5mb3JFYWNoKChmaWxlKSA9PiB7XG4gICAgICB0b3RhbFNwZWVkID0gdG90YWxTcGVlZCArIGdldFNwZWVkKGZpbGUucHJvZ3Jlc3MpXG4gICAgfSlcbiAgICByZXR1cm4gdG90YWxTcGVlZFxuICB9XG5cbiAgZ2V0VG90YWxFVEEgKGZpbGVzKSB7XG4gICAgbGV0IHRvdGFsU2Vjb25kcyA9IDBcblxuICAgIGZpbGVzLmZvckVhY2goKGZpbGUpID0+IHtcbiAgICAgIHRvdGFsU2Vjb25kcyA9IHRvdGFsU2Vjb25kcyArIGdldEVUQShmaWxlLnByb2dyZXNzKVxuICAgIH0pXG5cbiAgICByZXR1cm4gdG90YWxTZWNvbmRzXG4gIH1cblxuICByZW5kZXIgKHN0YXRlKSB7XG4gICAgY29uc3QgZmlsZXMgPSBzdGF0ZS5maWxlc1xuXG4gICAgY29uc3QgbmV3RmlsZXMgPSBPYmplY3Qua2V5cyhmaWxlcykuZmlsdGVyKChmaWxlKSA9PiB7XG4gICAgICByZXR1cm4gIWZpbGVzW2ZpbGVdLnByb2dyZXNzLnVwbG9hZFN0YXJ0ZWRcbiAgICB9KVxuICAgIGNvbnN0IHVwbG9hZFN0YXJ0ZWRGaWxlcyA9IE9iamVjdC5rZXlzKGZpbGVzKS5maWx0ZXIoKGZpbGUpID0+IHtcbiAgICAgIHJldHVybiBmaWxlc1tmaWxlXS5wcm9ncmVzcy51cGxvYWRTdGFydGVkXG4gICAgfSlcbiAgICBjb25zdCBjb21wbGV0ZUZpbGVzID0gT2JqZWN0LmtleXMoZmlsZXMpLmZpbHRlcigoZmlsZSkgPT4ge1xuICAgICAgcmV0dXJuIGZpbGVzW2ZpbGVdLnByb2dyZXNzLnVwbG9hZENvbXBsZXRlXG4gICAgfSlcbiAgICBjb25zdCBpblByb2dyZXNzRmlsZXMgPSBPYmplY3Qua2V5cyhmaWxlcykuZmlsdGVyKChmaWxlKSA9PiB7XG4gICAgICByZXR1cm4gIWZpbGVzW2ZpbGVdLnByb2dyZXNzLnVwbG9hZENvbXBsZXRlICYmXG4gICAgICAgICAgICAgZmlsZXNbZmlsZV0ucHJvZ3Jlc3MudXBsb2FkU3RhcnRlZCAmJlxuICAgICAgICAgICAgICFmaWxlc1tmaWxlXS5pc1BhdXNlZFxuICAgIH0pXG5cbiAgICBsZXQgaW5Qcm9ncmVzc0ZpbGVzQXJyYXkgPSBbXVxuICAgIGluUHJvZ3Jlc3NGaWxlcy5mb3JFYWNoKChmaWxlKSA9PiB7XG4gICAgICBpblByb2dyZXNzRmlsZXNBcnJheS5wdXNoKGZpbGVzW2ZpbGVdKVxuICAgIH0pXG5cbiAgICBjb25zdCB0b3RhbFNwZWVkID0gcHJldHR5Qnl0ZXModGhpcy5nZXRUb3RhbFNwZWVkKGluUHJvZ3Jlc3NGaWxlc0FycmF5KSlcbiAgICBjb25zdCB0b3RhbEVUQSA9IHByZXR0eUVUQSh0aGlzLmdldFRvdGFsRVRBKGluUHJvZ3Jlc3NGaWxlc0FycmF5KSlcblxuICAgIGNvbnN0IGlzQWxsQ29tcGxldGUgPSBzdGF0ZS50b3RhbFByb2dyZXNzID09PSAxMDBcbiAgICBjb25zdCBpc0FsbFBhdXNlZCA9IGluUHJvZ3Jlc3NGaWxlcy5sZW5ndGggPT09IDAgJiYgIWlzQWxsQ29tcGxldGUgJiYgdXBsb2FkU3RhcnRlZEZpbGVzLmxlbmd0aCA+IDBcbiAgICBjb25zdCBpc1VwbG9hZFN0YXJ0ZWQgPSB1cGxvYWRTdGFydGVkRmlsZXMubGVuZ3RoID4gMFxuXG4gICAgY29uc3QgYWNxdWlyZXJzID0gc3RhdGUubW9kYWwudGFyZ2V0cy5maWx0ZXIoKHRhcmdldCkgPT4ge1xuICAgICAgcmV0dXJuIHRhcmdldC50eXBlID09PSAnYWNxdWlyZXInXG4gICAgfSlcblxuICAgIGNvbnN0IHByb2dyZXNzaW5kaWNhdG9ycyA9IHN0YXRlLm1vZGFsLnRhcmdldHMuZmlsdGVyKCh0YXJnZXQpID0+IHtcbiAgICAgIHJldHVybiB0YXJnZXQudHlwZSA9PT0gJ3Byb2dyZXNzaW5kaWNhdG9yJ1xuICAgIH0pXG5cbiAgICBjb25zdCBhZGRGaWxlID0gKGZpbGUpID0+IHtcbiAgICAgIHRoaXMuY29yZS5lbWl0dGVyLmVtaXQoJ2NvcmU6ZmlsZS1hZGQnLCBmaWxlKVxuICAgIH1cblxuICAgIGNvbnN0IHJlbW92ZUZpbGUgPSAoZmlsZUlEKSA9PiB7XG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdjb3JlOmZpbGUtcmVtb3ZlJywgZmlsZUlEKVxuICAgIH1cblxuICAgIGNvbnN0IHN0YXJ0VXBsb2FkID0gKGV2KSA9PiB7XG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdjb3JlOnVwbG9hZCcpXG4gICAgfVxuXG4gICAgY29uc3QgcGF1c2VVcGxvYWQgPSAoZmlsZUlEKSA9PiB7XG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdjb3JlOnVwbG9hZC1wYXVzZScsIGZpbGVJRClcbiAgICB9XG5cbiAgICBjb25zdCBjYW5jZWxVcGxvYWQgPSAoZmlsZUlEKSA9PiB7XG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdjb3JlOnVwbG9hZC1jYW5jZWwnLCBmaWxlSUQpXG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdjb3JlOmZpbGUtcmVtb3ZlJywgZmlsZUlEKVxuICAgIH1cblxuICAgIGNvbnN0IHNob3dGaWxlQ2FyZCA9IChmaWxlSUQpID0+IHtcbiAgICAgIHRoaXMuY29yZS5lbWl0dGVyLmVtaXQoJ2Rhc2hib2FyZDpmaWxlLWNhcmQnLCBmaWxlSUQpXG4gICAgfVxuXG4gICAgY29uc3QgZmlsZUNhcmREb25lID0gKG1ldGEsIGZpbGVJRCkgPT4ge1xuICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnY29yZTp1cGRhdGUtbWV0YScsIG1ldGEsIGZpbGVJRClcbiAgICAgIHRoaXMuY29yZS5lbWl0dGVyLmVtaXQoJ2Rhc2hib2FyZDpmaWxlLWNhcmQnKVxuICAgIH1cblxuICAgIGNvbnN0IGluZm8gPSAodGV4dCwgdHlwZSwgZHVyYXRpb24pID0+IHtcbiAgICAgIHRoaXMuY29yZS5lbWl0dGVyLmVtaXQoJ2luZm9ybWVyJywgdGV4dCwgdHlwZSwgZHVyYXRpb24pXG4gICAgfVxuXG4gICAgY29uc3QgcmVzdW1hYmxlVXBsb2FkcyA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLmNhcGFiaWxpdGllcy5yZXN1bWFibGVVcGxvYWRzIHx8IGZhbHNlXG5cbiAgICByZXR1cm4gRGFzaGJvYXJkKHtcbiAgICAgIHN0YXRlOiBzdGF0ZSxcbiAgICAgIG1vZGFsOiBzdGF0ZS5tb2RhbCxcbiAgICAgIG5ld0ZpbGVzOiBuZXdGaWxlcyxcbiAgICAgIGZpbGVzOiBmaWxlcyxcbiAgICAgIHRvdGFsRmlsZUNvdW50OiBPYmplY3Qua2V5cyhmaWxlcykubGVuZ3RoLFxuICAgICAgaXNVcGxvYWRTdGFydGVkOiBpc1VwbG9hZFN0YXJ0ZWQsXG4gICAgICBpblByb2dyZXNzOiB1cGxvYWRTdGFydGVkRmlsZXMubGVuZ3RoLFxuICAgICAgY29tcGxldGVGaWxlczogY29tcGxldGVGaWxlcyxcbiAgICAgIGluUHJvZ3Jlc3NGaWxlczogaW5Qcm9ncmVzc0ZpbGVzLFxuICAgICAgdG90YWxTcGVlZDogdG90YWxTcGVlZCxcbiAgICAgIHRvdGFsRVRBOiB0b3RhbEVUQSxcbiAgICAgIHRvdGFsUHJvZ3Jlc3M6IHN0YXRlLnRvdGFsUHJvZ3Jlc3MsXG4gICAgICBpc0FsbENvbXBsZXRlOiBpc0FsbENvbXBsZXRlLFxuICAgICAgaXNBbGxQYXVzZWQ6IGlzQWxsUGF1c2VkLFxuICAgICAgYWNxdWlyZXJzOiBhY3F1aXJlcnMsXG4gICAgICBhY3RpdmVQYW5lbDogc3RhdGUubW9kYWwuYWN0aXZlUGFuZWwsXG4gICAgICBwcm9ncmVzc2luZGljYXRvcnM6IHByb2dyZXNzaW5kaWNhdG9ycyxcbiAgICAgIGF1dG9Qcm9jZWVkOiB0aGlzLmNvcmUub3B0cy5hdXRvUHJvY2VlZCxcbiAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgY29udGFpbmVyOiB0aGlzLm9wdHMudGFyZ2V0LFxuICAgICAgaGlkZU1vZGFsOiB0aGlzLmhpZGVNb2RhbCxcbiAgICAgIHBhbmVsU2VsZWN0b3JQcmVmaXg6IHRoaXMub3B0cy5wYW5lbFNlbGVjdG9yUHJlZml4LFxuICAgICAgc2hvd1Byb2dyZXNzRGV0YWlsczogdGhpcy5vcHRzLnNob3dQcm9ncmVzc0RldGFpbHMsXG4gICAgICBpbmxpbmU6IHRoaXMub3B0cy5pbmxpbmUsXG4gICAgICBzZW1pVHJhbnNwYXJlbnQ6IHRoaXMub3B0cy5zZW1pVHJhbnNwYXJlbnQsXG4gICAgICBvblBhc3RlOiB0aGlzLmhhbmRsZVBhc3RlLFxuICAgICAgc2hvd1BhbmVsOiB0aGlzLnNob3dQYW5lbCxcbiAgICAgIGhpZGVBbGxQYW5lbHM6IHRoaXMuaGlkZUFsbFBhbmVscyxcbiAgICAgIGxvZzogdGhpcy5jb3JlLmxvZyxcbiAgICAgIGJ1czogdGhpcy5jb3JlLmVtaXR0ZXIsXG4gICAgICBpMThuOiB0aGlzLmNvcmUuaTE4bixcbiAgICAgIHBhdXNlQWxsOiB0aGlzLnBhdXNlQWxsLFxuICAgICAgcmVzdW1lQWxsOiB0aGlzLnJlc3VtZUFsbCxcbiAgICAgIGNhbmNlbEFsbDogdGhpcy5jYW5jZWxBbGwsXG4gICAgICBhZGRGaWxlOiBhZGRGaWxlLFxuICAgICAgcmVtb3ZlRmlsZTogcmVtb3ZlRmlsZSxcbiAgICAgIGluZm86IGluZm8sXG4gICAgICBtZXRhRmllbGRzOiBzdGF0ZS5tZXRhRmllbGRzLFxuICAgICAgcmVzdW1hYmxlVXBsb2FkczogcmVzdW1hYmxlVXBsb2FkcyxcbiAgICAgIHN0YXJ0VXBsb2FkOiBzdGFydFVwbG9hZCxcbiAgICAgIHBhdXNlVXBsb2FkOiBwYXVzZVVwbG9hZCxcbiAgICAgIGNhbmNlbFVwbG9hZDogY2FuY2VsVXBsb2FkLFxuICAgICAgZmlsZUNhcmRGb3I6IHN0YXRlLm1vZGFsLmZpbGVDYXJkRm9yLFxuICAgICAgc2hvd0ZpbGVDYXJkOiBzaG93RmlsZUNhcmQsXG4gICAgICBmaWxlQ2FyZERvbmU6IGZpbGVDYXJkRG9uZVxuICAgIH0pXG4gIH1cblxuICBpbnN0YWxsICgpIHtcbiAgICAvLyBTZXQgZGVmYXVsdCBzdGF0ZSBmb3IgTW9kYWxcbiAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe21vZGFsOiB7XG4gICAgICBpc0hpZGRlbjogdHJ1ZSxcbiAgICAgIHNob3dGaWxlQ2FyZDogZmFsc2UsXG4gICAgICBhY3RpdmVQYW5lbDogZmFsc2UsXG4gICAgICB0YXJnZXRzOiBbXVxuICAgIH19KVxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5vcHRzLnRhcmdldFxuICAgIGNvbnN0IHBsdWdpbiA9IHRoaXNcbiAgICB0aGlzLnRhcmdldCA9IHRoaXMubW91bnQodGFyZ2V0LCBwbHVnaW4pXG5cbiAgICB0aGlzLmluaXRFdmVudHMoKVxuICAgIHRoaXMuYWN0aW9ucygpXG4gIH1cbn1cbiIsImltcG9ydCBodG1sIGZyb20gJy4uLy4uL2NvcmUvaHRtbCdcblxuZXhwb3J0IGRlZmF1bHQgKHByb3BzKSA9PiB7XG4gIGNvbnN0IGRlbW9MaW5rID0gcHJvcHMuZGVtbyA/IGh0bWxgPGEgb25jbGljaz0ke3Byb3BzLmhhbmRsZURlbW9BdXRofT5Qcm9jZWVkIHdpdGggRGVtbyBBY2NvdW50PC9hPmAgOiBudWxsXG4gIHJldHVybiBodG1sYFxuICAgIDxkaXYgY2xhc3M9XCJVcHB5R29vZ2xlRHJpdmUtYXV0aGVudGljYXRlXCI+XG4gICAgICA8aDE+WW91IG5lZWQgdG8gYXV0aGVudGljYXRlIHdpdGggR29vZ2xlIGJlZm9yZSBzZWxlY3RpbmcgZmlsZXMuPC9oMT5cbiAgICAgIDxhIGhyZWY9JHtwcm9wcy5saW5rfT5BdXRoZW50aWNhdGU8L2E+XG4gICAgICAke2RlbW9MaW5rfVxuICAgIDwvZGl2PlxuICBgXG59XG4iLCJpbXBvcnQgaHRtbCBmcm9tICcuLi8uLi9jb3JlL2h0bWwnXG5cbmV4cG9ydCBkZWZhdWx0IChwcm9wcykgPT4ge1xuICByZXR1cm4gaHRtbGBcbiAgICA8ZGl2PlxuICAgICAgPHNwYW4+XG4gICAgICAgIFNvbWV0aGluZyB3ZW50IHdyb25nLiAgUHJvYmFibHkgb3VyIGZhdWx0LiAke3Byb3BzLmVycm9yfVxuICAgICAgPC9zcGFuPlxuICAgIDwvZGl2PlxuICBgXG59XG4iLCJpbXBvcnQgVXRpbHMgZnJvbSAnLi4vLi4vY29yZS9VdGlscydcbmltcG9ydCBQbHVnaW4gZnJvbSAnLi4vUGx1Z2luJ1xuaW1wb3J0ICd3aGF0d2ctZmV0Y2gnXG5pbXBvcnQgaHRtbCBmcm9tICcuLi8uLi9jb3JlL2h0bWwnXG5cbmltcG9ydCBQcm92aWRlciBmcm9tICcuLi8uLi91cHB5LWJhc2Uvc3JjL3BsdWdpbnMvUHJvdmlkZXInXG5cbmltcG9ydCBBdXRoVmlldyBmcm9tICcuL0F1dGhWaWV3J1xuaW1wb3J0IEJyb3dzZXIgZnJvbSAnLi9uZXcvQnJvd3NlcidcbmltcG9ydCBFcnJvclZpZXcgZnJvbSAnLi9FcnJvcidcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgR29vZ2xlIGV4dGVuZHMgUGx1Z2luIHtcbiAgY29uc3RydWN0b3IgKGNvcmUsIG9wdHMpIHtcbiAgICBzdXBlcihjb3JlLCBvcHRzKVxuICAgIHRoaXMudHlwZSA9ICdhY3F1aXJlcidcbiAgICB0aGlzLmlkID0gJ0dvb2dsZURyaXZlJ1xuICAgIHRoaXMudGl0bGUgPSAnR29vZ2xlIERyaXZlJ1xuICAgIHRoaXMuaWNvbiA9IGh0bWxgXG4gICAgICA8c3ZnIGNsYXNzPVwiVXBweUljb24gVXBweU1vZGFsVGFiLWljb25cIiB3aWR0aD1cIjI4XCIgaGVpZ2h0PVwiMjhcIiB2aWV3Qm94PVwiMCAwIDE2IDE2XCI+XG4gICAgICAgIDxwYXRoIGQ9XCJNMi45NTUgMTQuOTNsMi42NjctNC42MkgxNmwtMi42NjcgNC42MkgyLjk1NXptMi4zNzgtNC42MmwtMi42NjYgNC42MkwwIDEwLjMxbDUuMTktOC45OSAyLjY2NiA0LjYyLTIuNTIzIDQuMzd6bTEwLjUyMy0uMjVoLTUuMzMzbC01LjE5LTguOTloNS4zMzRsNS4xOSA4Ljk5elwiLz5cbiAgICAgIDwvc3ZnPlxuICAgIGBcblxuICAgIHRoaXMuR29vZ2xlRHJpdmUgPSBuZXcgUHJvdmlkZXIoe1xuICAgICAgaG9zdDogdGhpcy5vcHRzLmhvc3QsXG4gICAgICBwcm92aWRlcjogJ2RyaXZlJ1xuICAgIH0pXG5cbiAgICB0aGlzLmZpbGVzID0gW11cblxuICAgIC8vIHRoaXMuY29yZS5zb2NrZXQub24oJycpXG4gICAgLy8gTG9naWNcbiAgICB0aGlzLmFkZEZpbGUgPSB0aGlzLmFkZEZpbGUuYmluZCh0aGlzKVxuICAgIHRoaXMuZmlsdGVySXRlbXMgPSB0aGlzLmZpbHRlckl0ZW1zLmJpbmQodGhpcylcbiAgICB0aGlzLmZpbHRlclF1ZXJ5ID0gdGhpcy5maWx0ZXJRdWVyeS5iaW5kKHRoaXMpXG4gICAgdGhpcy5nZXRGb2xkZXIgPSB0aGlzLmdldEZvbGRlci5iaW5kKHRoaXMpXG4gICAgdGhpcy5nZXROZXh0Rm9sZGVyID0gdGhpcy5nZXROZXh0Rm9sZGVyLmJpbmQodGhpcylcbiAgICB0aGlzLmhhbmRsZVJvd0NsaWNrID0gdGhpcy5oYW5kbGVSb3dDbGljay5iaW5kKHRoaXMpXG4gICAgdGhpcy5sb2dvdXQgPSB0aGlzLmxvZ291dC5iaW5kKHRoaXMpXG4gICAgdGhpcy5oYW5kbGVEZW1vQXV0aCA9IHRoaXMuaGFuZGxlRGVtb0F1dGguYmluZCh0aGlzKVxuICAgIHRoaXMuc29ydEJ5VGl0bGUgPSB0aGlzLnNvcnRCeVRpdGxlLmJpbmQodGhpcylcbiAgICB0aGlzLnNvcnRCeURhdGUgPSB0aGlzLnNvcnRCeURhdGUuYmluZCh0aGlzKVxuXG4gICAgLy8gVmlzdWFsXG4gICAgdGhpcy5yZW5kZXIgPSB0aGlzLnJlbmRlci5iaW5kKHRoaXMpXG5cbiAgICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gICAgY29uc3QgZGVmYXVsdE9wdGlvbnMgPSB7fVxuXG4gICAgLy8gbWVyZ2UgZGVmYXVsdCBvcHRpb25zIHdpdGggdGhlIG9uZXMgc2V0IGJ5IHVzZXJcbiAgICB0aGlzLm9wdHMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0cylcbiAgfVxuXG4gIGluc3RhbGwgKCkge1xuICAgIC8vIFNldCBkZWZhdWx0IHN0YXRlIGZvciBHb29nbGUgRHJpdmVcbiAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe1xuICAgICAgZ29vZ2xlRHJpdmU6IHtcbiAgICAgICAgYXV0aGVudGljYXRlZDogZmFsc2UsXG4gICAgICAgIGZpbGVzOiBbXSxcbiAgICAgICAgZm9sZGVyczogW10sXG4gICAgICAgIGRpcmVjdG9yaWVzOiBbe1xuICAgICAgICAgIHRpdGxlOiAnTXkgRHJpdmUnLFxuICAgICAgICAgIGlkOiAncm9vdCdcbiAgICAgICAgfV0sXG4gICAgICAgIGFjdGl2ZVJvdzogLTEsXG4gICAgICAgIGZpbHRlcklucHV0OiAnJ1xuICAgICAgfVxuICAgIH0pXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLm9wdHMudGFyZ2V0XG4gICAgY29uc3QgcGx1Z2luID0gdGhpc1xuICAgIHRoaXMudGFyZ2V0ID0gdGhpcy5tb3VudCh0YXJnZXQsIHBsdWdpbilcblxuICAgIHRoaXMuY2hlY2tBdXRoZW50aWNhdGlvbigpXG4gICAgICAudGhlbigoYXV0aGVudGljYXRlZCkgPT4ge1xuICAgICAgICB0aGlzLnVwZGF0ZVN0YXRlKHthdXRoZW50aWNhdGVkfSlcblxuICAgICAgICBjb25zb2xlLmxvZygnYXJlIHdlIGF1dGhlbnRpY2F0ZWQ/JylcbiAgICAgICAgY29uc29sZS5sb2coYXV0aGVudGljYXRlZClcblxuICAgICAgICBpZiAoYXV0aGVudGljYXRlZCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLmdldEZvbGRlcigncm9vdCcpXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXV0aGVudGljYXRlZFxuICAgICAgfSlcbiAgICAgIC50aGVuKChuZXdTdGF0ZSkgPT4ge1xuICAgICAgICB0aGlzLnVwZGF0ZVN0YXRlKG5ld1N0YXRlKVxuICAgICAgfSlcblxuICAgIHJldHVyblxuICB9XG5cbiAgZm9jdXMgKCkge1xuICB9XG5cbiAgLyoqXG4gICAqIExpdHRsZSBzaG9ydGhhbmQgdG8gdXBkYXRlIHRoZSBzdGF0ZSB3aXRoIG15IG5ldyBzdGF0ZVxuICAgKi9cbiAgdXBkYXRlU3RhdGUgKG5ld1N0YXRlKSB7XG4gICAgY29uc3Qge3N0YXRlfSA9IHRoaXMuY29yZVxuICAgIGNvbnN0IGdvb2dsZURyaXZlID0gT2JqZWN0LmFzc2lnbih7fSwgc3RhdGUuZ29vZ2xlRHJpdmUsIG5ld1N0YXRlKVxuXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHtnb29nbGVEcml2ZX0pXG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgdG8gc2VlIGlmIHRoZSB1c2VyIGlzIGF1dGhlbnRpY2F0ZWQuXG4gICAqIEByZXR1cm4ge1Byb21pc2V9IGF1dGhlbnRpY2F0aW9uIHN0YXR1c1xuICAgKi9cbiAgY2hlY2tBdXRoZW50aWNhdGlvbiAoKSB7XG4gICAgcmV0dXJuIGZldGNoKGAke3RoaXMub3B0cy5ob3N0fS9kcml2ZS9hdXRoYCwge1xuICAgICAgbWV0aG9kOiAnZ2V0JyxcbiAgICAgIGNyZWRlbnRpYWxzOiAnaW5jbHVkZScsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdBY2NlcHQnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgIH1cbiAgICB9KVxuICAgIC50aGVuKChyZXMpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKHJlcy5zdGF0dXMpXG4gICAgICBpZiAocmVzLnN0YXR1cyA8IDIwMCB8fCByZXMuc3RhdHVzID4gMzAwKSB7XG4gICAgICAgIHRoaXMudXBkYXRlU3RhdGUoe1xuICAgICAgICAgIGF1dGhlbnRpY2F0ZWQ6IGZhbHNlLFxuICAgICAgICAgIGVycm9yOiB0cnVlXG4gICAgICAgIH0pXG4gICAgICAgIGxldCBlcnJvciA9IG5ldyBFcnJvcihyZXMuc3RhdHVzVGV4dClcbiAgICAgICAgZXJyb3IucmVzcG9uc2UgPSByZXNcbiAgICAgICAgdGhyb3cgZXJyb3JcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlcy5qc29uKClcbiAgICB9KVxuICAgIC50aGVuKChkYXRhKSA9PiBkYXRhLmF1dGhlbnRpY2F0ZWQpXG4gICAgLmNhdGNoKChlcnIpID0+IGVycilcbiAgfVxuXG4gIC8qKlxuICAgKiBCYXNlZCBvbiBmb2xkZXIgSUQsIGZldGNoIGEgbmV3IGZvbGRlclxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IGlkIEZvbGRlciBpZFxuICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgIEZvbGRlcnMvZmlsZXMgaW4gZm9sZGVyXG4gICAqL1xuICBnZXRGb2xkZXIgKGlkID0gJ3Jvb3QnKSB7XG4gICAgcmV0dXJuIHRoaXMuR29vZ2xlRHJpdmUubGlzdChpZClcbiAgICAgIC50aGVuKChyZXMpID0+IHtcbiAgICAgICAgLy8gbGV0IHJlc3VsdCA9IFV0aWxzLmdyb3VwQnkoZGF0YS5pdGVtcywgKGl0ZW0pID0+IGl0ZW0ubWltZVR5cGUpXG4gICAgICAgIGxldCBmb2xkZXJzID0gW11cbiAgICAgICAgbGV0IGZpbGVzID0gW11cbiAgICAgICAgcmVzLml0ZW1zLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgICAgICBpZiAoaXRlbS5taW1lVHlwZSA9PT0gJ2FwcGxpY2F0aW9uL3ZuZC5nb29nbGUtYXBwcy5mb2xkZXInKSB7XG4gICAgICAgICAgICBmb2xkZXJzLnB1c2goaXRlbSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZmlsZXMucHVzaChpdGVtKVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBmb2xkZXJzLFxuICAgICAgICAgIGZpbGVzXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICByZXR1cm4gZXJyXG4gICAgICB9KVxuICB9XG5cbiAgLyoqXG4gICAqIEZldGNoZXMgbmV3IGZvbGRlciBhbmQgYWRkcyB0byBicmVhZGNydW1iIG5hdlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IGlkICAgIEZvbGRlciBpZFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHRpdGxlIEZvbGRlciB0aXRsZVxuICAgKi9cbiAgZ2V0TmV4dEZvbGRlciAoaWQsIHRpdGxlKSB7XG4gICAgdGhpcy5nZXRGb2xkZXIoaWQpXG4gICAgICAudGhlbigoZGF0YSkgPT4ge1xuICAgICAgICBjb25zdCBzdGF0ZSA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLmdvb2dsZURyaXZlXG5cbiAgICAgICAgY29uc3QgaW5kZXggPSBzdGF0ZS5kaXJlY3Rvcmllcy5maW5kSW5kZXgoKGRpcikgPT4gaWQgPT09IGRpci5pZClcbiAgICAgICAgbGV0IHVwZGF0ZWREaXJlY3Rvcmllc1xuXG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICB1cGRhdGVkRGlyZWN0b3JpZXMgPSBzdGF0ZS5kaXJlY3Rvcmllcy5zbGljZSgwLCBpbmRleCArIDEpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdXBkYXRlZERpcmVjdG9yaWVzID0gc3RhdGUuZGlyZWN0b3JpZXMuY29uY2F0KFt7XG4gICAgICAgICAgICBpZCxcbiAgICAgICAgICAgIHRpdGxlXG4gICAgICAgICAgfV0pXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnVwZGF0ZVN0YXRlKFV0aWxzLmV4dGVuZChkYXRhLCB7XG4gICAgICAgICAgZGlyZWN0b3JpZXM6IHVwZGF0ZWREaXJlY3Rvcmllc1xuICAgICAgICB9KSlcbiAgICAgIH0pXG4gIH1cblxuICBhZGRGaWxlIChmaWxlKSB7XG4gICAgY29uc3QgdGFnRmlsZSA9IHtcbiAgICAgIHNvdXJjZTogdGhpcy5pZCxcbiAgICAgIGRhdGE6IGZpbGUsXG4gICAgICBuYW1lOiBmaWxlLnRpdGxlLFxuICAgICAgdHlwZTogZmlsZS5taW1lVHlwZSxcbiAgICAgIGlzUmVtb3RlOiB0cnVlLFxuICAgICAgYm9keToge1xuICAgICAgICBmaWxlSWQ6IGZpbGUuaWRcbiAgICAgIH0sXG4gICAgICByZW1vdGU6IHtcbiAgICAgICAgaG9zdDogdGhpcy5vcHRzLmhvc3QsXG4gICAgICAgIHVybDogYCR7dGhpcy5vcHRzLmhvc3R9L2RyaXZlL2dldC8ke2ZpbGUuaWR9YCxcbiAgICAgICAgYm9keToge1xuICAgICAgICAgIGZpbGVJZDogZmlsZS5pZFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKCdhZGRpbmcgZmlsZScpXG4gICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnY29yZTpmaWxlLWFkZCcsIHRhZ0ZpbGUpXG4gIH1cblxuICBoYW5kbGVFcnJvciAocmVzcG9uc2UpIHtcbiAgICB0aGlzLmNoZWNrQXV0aGVudGljYXRpb24oKVxuICAgICAgLnRoZW4oKGF1dGhlbnRpY2F0ZWQpID0+IHtcbiAgICAgICAgdGhpcy51cGRhdGVTdGF0ZSh7YXV0aGVudGljYXRlZH0pXG4gICAgICB9KVxuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgc2Vzc2lvbiB0b2tlbiBvbiBjbGllbnQgc2lkZS5cbiAgICovXG4gIGxvZ291dCAoKSB7XG4gICAgdGhpcy5Hb29nbGVEcml2ZS5sb2dvdXQobG9jYXRpb24uaHJlZilcbiAgICAgIC50aGVuKChyZXMpID0+IHJlcy5qc29uKCkpXG4gICAgICAudGhlbigocmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXMub2spIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnb2snKVxuICAgICAgICAgIGNvbnN0IG5ld1N0YXRlID0ge1xuICAgICAgICAgICAgYXV0aGVudGljYXRlZDogZmFsc2UsXG4gICAgICAgICAgICBmaWxlczogW10sXG4gICAgICAgICAgICBmb2xkZXJzOiBbXSxcbiAgICAgICAgICAgIGRpcmVjdG9yaWVzOiBbe1xuICAgICAgICAgICAgICB0aXRsZTogJ015IERyaXZlJyxcbiAgICAgICAgICAgICAgaWQ6ICdyb290J1xuICAgICAgICAgICAgfV1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXRlKG5ld1N0YXRlKVxuICAgICAgICB9XG4gICAgICB9KVxuICB9XG5cbiAgZ2V0RmlsZVR5cGUgKGZpbGUpIHtcbiAgICBjb25zdCBmaWxlVHlwZXMgPSB7XG4gICAgICAnYXBwbGljYXRpb24vdm5kLmdvb2dsZS1hcHBzLmZvbGRlcic6ICdGb2xkZXInLFxuICAgICAgJ2FwcGxpY2F0aW9uL3ZuZC5nb29nbGUtYXBwcy5kb2N1bWVudCc6ICdHb29nbGUgRG9jcycsXG4gICAgICAnYXBwbGljYXRpb24vdm5kLmdvb2dsZS1hcHBzLnNwcmVhZHNoZWV0JzogJ0dvb2dsZSBTaGVldHMnLFxuICAgICAgJ2FwcGxpY2F0aW9uL3ZuZC5nb29nbGUtYXBwcy5wcmVzZW50YXRpb24nOiAnR29vZ2xlIFNsaWRlcycsXG4gICAgICAnaW1hZ2UvanBlZyc6ICdKUEVHIEltYWdlJyxcbiAgICAgICdpbWFnZS9wbmcnOiAnUE5HIEltYWdlJ1xuICAgIH1cblxuICAgIHJldHVybiBmaWxlVHlwZXNbZmlsZS5taW1lVHlwZV0gPyBmaWxlVHlwZXNbZmlsZS5taW1lVHlwZV0gOiBmaWxlLmZpbGVFeHRlbnNpb24udG9VcHBlckNhc2UoKVxuICB9XG5cbiAgLyoqXG4gICAqIFVzZWQgdG8gc2V0IGFjdGl2ZSBmaWxlL2ZvbGRlci5cbiAgICogQHBhcmFtICB7T2JqZWN0fSBmaWxlICAgQWN0aXZlIGZpbGUvZm9sZGVyXG4gICAqL1xuICBoYW5kbGVSb3dDbGljayAoZmlsZUlkKSB7XG4gICAgY29uc3Qgc3RhdGUgPSB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5nb29nbGVEcml2ZVxuICAgIGNvbnN0IG5ld1N0YXRlID0gT2JqZWN0LmFzc2lnbih7fSwgc3RhdGUsIHtcbiAgICAgIGFjdGl2ZVJvdzogZmlsZUlkXG4gICAgfSlcblxuICAgIHRoaXMudXBkYXRlU3RhdGUobmV3U3RhdGUpXG4gIH1cblxuICBmaWx0ZXJRdWVyeSAoZSkge1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5jb3JlLmdldFN0YXRlKCkuZ29vZ2xlRHJpdmVcbiAgICB0aGlzLnVwZGF0ZVN0YXRlKE9iamVjdC5hc3NpZ24oe30sIHN0YXRlLCB7XG4gICAgICBmaWx0ZXJJbnB1dDogZS50YXJnZXQudmFsdWVcbiAgICB9KSlcbiAgfVxuXG4gIGZpbHRlckl0ZW1zIChpdGVtcykge1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5jb3JlLmdldFN0YXRlKCkuZ29vZ2xlRHJpdmVcbiAgICByZXR1cm4gaXRlbXMuZmlsdGVyKChmb2xkZXIpID0+IHtcbiAgICAgIHJldHVybiBmb2xkZXIudGl0bGUudG9Mb3dlckNhc2UoKS5pbmRleE9mKHN0YXRlLmZpbHRlcklucHV0LnRvTG93ZXJDYXNlKCkpICE9PSAtMVxuICAgIH0pXG4gIH1cblxuICBzb3J0QnlUaXRsZSAoKSB7XG4gICAgY29uc3Qgc3RhdGUgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5nb29nbGVEcml2ZSlcbiAgICBjb25zdCB7ZmlsZXMsIGZvbGRlcnMsIHNvcnRpbmd9ID0gc3RhdGVcblxuICAgIGxldCBzb3J0ZWRGaWxlcyA9IGZpbGVzLnNvcnQoKGZpbGVBLCBmaWxlQikgPT4ge1xuICAgICAgaWYgKHNvcnRpbmcgPT09ICd0aXRsZURlc2NlbmRpbmcnKSB7XG4gICAgICAgIHJldHVybiBmaWxlQi50aXRsZS5sb2NhbGVDb21wYXJlKGZpbGVBLnRpdGxlKVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZpbGVBLnRpdGxlLmxvY2FsZUNvbXBhcmUoZmlsZUIudGl0bGUpXG4gICAgfSlcblxuICAgIGxldCBzb3J0ZWRGb2xkZXJzID0gZm9sZGVycy5zb3J0KChmb2xkZXJBLCBmb2xkZXJCKSA9PiB7XG4gICAgICBpZiAoc29ydGluZyA9PT0gJ3RpdGxlRGVzY2VuZGluZycpIHtcbiAgICAgICAgcmV0dXJuIGZvbGRlckIudGl0bGUubG9jYWxlQ29tcGFyZShmb2xkZXJBLnRpdGxlKVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZvbGRlckEudGl0bGUubG9jYWxlQ29tcGFyZShmb2xkZXJCLnRpdGxlKVxuICAgIH0pXG5cbiAgICB0aGlzLnVwZGF0ZVN0YXRlKE9iamVjdC5hc3NpZ24oe30sIHN0YXRlLCB7XG4gICAgICBmaWxlczogc29ydGVkRmlsZXMsXG4gICAgICBmb2xkZXJzOiBzb3J0ZWRGb2xkZXJzLFxuICAgICAgc29ydGluZzogKHNvcnRpbmcgPT09ICd0aXRsZURlc2NlbmRpbmcnKSA/ICd0aXRsZUFzY2VuZGluZycgOiAndGl0bGVEZXNjZW5kaW5nJ1xuICAgIH0pKVxuICB9XG5cbiAgc29ydEJ5RGF0ZSAoKSB7XG4gICAgY29uc3Qgc3RhdGUgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5nb29nbGVEcml2ZSlcbiAgICBjb25zdCB7ZmlsZXMsIGZvbGRlcnMsIHNvcnRpbmd9ID0gc3RhdGVcblxuICAgIGxldCBzb3J0ZWRGaWxlcyA9IGZpbGVzLnNvcnQoKGZpbGVBLCBmaWxlQikgPT4ge1xuICAgICAgbGV0IGEgPSBuZXcgRGF0ZShmaWxlQS5tb2RpZmllZEJ5TWVEYXRlKVxuICAgICAgbGV0IGIgPSBuZXcgRGF0ZShmaWxlQi5tb2RpZmllZEJ5TWVEYXRlKVxuXG4gICAgICBpZiAoc29ydGluZyA9PT0gJ2RhdGVEZXNjZW5kaW5nJykge1xuICAgICAgICByZXR1cm4gYSA+IGIgPyAtMSA6IGEgPCBiID8gMSA6IDBcbiAgICAgIH1cbiAgICAgIHJldHVybiBhID4gYiA/IDEgOiBhIDwgYiA/IC0xIDogMFxuICAgIH0pXG5cbiAgICBsZXQgc29ydGVkRm9sZGVycyA9IGZvbGRlcnMuc29ydCgoZm9sZGVyQSwgZm9sZGVyQikgPT4ge1xuICAgICAgbGV0IGEgPSBuZXcgRGF0ZShmb2xkZXJBLm1vZGlmaWVkQnlNZURhdGUpXG4gICAgICBsZXQgYiA9IG5ldyBEYXRlKGZvbGRlckIubW9kaWZpZWRCeU1lRGF0ZSlcblxuICAgICAgaWYgKHNvcnRpbmcgPT09ICdkYXRlRGVzY2VuZGluZycpIHtcbiAgICAgICAgcmV0dXJuIGEgPiBiID8gLTEgOiBhIDwgYiA/IDEgOiAwXG4gICAgICB9XG5cbiAgICAgIHJldHVybiBhID4gYiA/IDEgOiBhIDwgYiA/IC0xIDogMFxuICAgIH0pXG5cbiAgICB0aGlzLnVwZGF0ZVN0YXRlKE9iamVjdC5hc3NpZ24oe30sIHN0YXRlLCB7XG4gICAgICBmaWxlczogc29ydGVkRmlsZXMsXG4gICAgICBmb2xkZXJzOiBzb3J0ZWRGb2xkZXJzLFxuICAgICAgc29ydGluZzogKHNvcnRpbmcgPT09ICdkYXRlRGVzY2VuZGluZycpID8gJ2RhdGVBc2NlbmRpbmcnIDogJ2RhdGVEZXNjZW5kaW5nJ1xuICAgIH0pKVxuICB9XG5cbiAgaGFuZGxlRGVtb0F1dGggKCkge1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5jb3JlLmdldFN0YXRlKCkuZ29vZ2xlRHJpdmVcbiAgICB0aGlzLnVwZGF0ZVN0YXRlKHt9LCBzdGF0ZSwge1xuICAgICAgYXV0aGVudGljYXRlZDogdHJ1ZVxuICAgIH0pXG4gIH1cblxuICByZW5kZXIgKHN0YXRlKSB7XG4gICAgY29uc3QgeyBhdXRoZW50aWNhdGVkLCBlcnJvciB9ID0gc3RhdGUuZ29vZ2xlRHJpdmVcblxuICAgIGlmIChlcnJvcikge1xuICAgICAgcmV0dXJuIEVycm9yVmlldyh7IGVycm9yOiBlcnJvciB9KVxuICAgIH1cblxuICAgIGlmICghYXV0aGVudGljYXRlZCkge1xuICAgICAgY29uc3QgYXV0aFN0YXRlID0gYnRvYShKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHJlZGlyZWN0OiBsb2NhdGlvbi5ocmVmLnNwbGl0KCcjJylbMF1cbiAgICAgIH0pKVxuXG4gICAgICBjb25zdCBsaW5rID0gYCR7dGhpcy5vcHRzLmhvc3R9L2Nvbm5lY3QvZ29vZ2xlP3N0YXRlPSR7YXV0aFN0YXRlfWBcblxuICAgICAgcmV0dXJuIEF1dGhWaWV3KHtcbiAgICAgICAgbGluazogbGluayxcbiAgICAgICAgZGVtbzogdGhpcy5vcHRzLmRlbW8sXG4gICAgICAgIGhhbmRsZURlbW9BdXRoOiB0aGlzLmhhbmRsZURlbW9BdXRoXG4gICAgICB9KVxuICAgIH1cblxuICAgIGNvbnN0IGJyb3dzZXJQcm9wcyA9IE9iamVjdC5hc3NpZ24oe30sIHN0YXRlLmdvb2dsZURyaXZlLCB7XG4gICAgICBnZXROZXh0Rm9sZGVyOiB0aGlzLmdldE5leHRGb2xkZXIsXG4gICAgICBnZXRGb2xkZXI6IHRoaXMuZ2V0Rm9sZGVyLFxuICAgICAgYWRkRmlsZTogdGhpcy5hZGRGaWxlLFxuICAgICAgZmlsdGVySXRlbXM6IHRoaXMuZmlsdGVySXRlbXMsXG4gICAgICBmaWx0ZXJRdWVyeTogdGhpcy5maWx0ZXJRdWVyeSxcbiAgICAgIGhhbmRsZVJvd0NsaWNrOiB0aGlzLmhhbmRsZVJvd0NsaWNrLFxuICAgICAgc29ydEJ5VGl0bGU6IHRoaXMuc29ydEJ5VGl0bGUsXG4gICAgICBzb3J0QnlEYXRlOiB0aGlzLnNvcnRCeURhdGUsXG4gICAgICBsb2dvdXQ6IHRoaXMubG9nb3V0LFxuICAgICAgZGVtbzogdGhpcy5vcHRzLmRlbW9cbiAgICB9KVxuXG4gICAgcmV0dXJuIEJyb3dzZXIoYnJvd3NlclByb3BzKVxuICB9XG59XG4iLCJpbXBvcnQgaHRtbCBmcm9tICcuLi8uLi8uLi9jb3JlL2h0bWwnXG5cbmV4cG9ydCBkZWZhdWx0IChwcm9wcykgPT4ge1xuICByZXR1cm4gaHRtbGBcbiAgICA8bGk+XG4gICAgICA8YnV0dG9uIG9uY2xpY2s9JHtwcm9wcy5nZXROZXh0Rm9sZGVyfT4ke3Byb3BzLnRpdGxlfTwvYnV0dG9uPlxuICAgIDwvbGk+XG4gIGBcbn1cbiIsImltcG9ydCBodG1sIGZyb20gJy4uLy4uLy4uL2NvcmUvaHRtbCdcbmltcG9ydCBCcmVhZGNydW1iIGZyb20gJy4vQnJlYWRjcnVtYidcblxuZXhwb3J0IGRlZmF1bHQgKHByb3BzKSA9PiB7XG4gIHJldHVybiBodG1sYFxuICAgIDx1bCBjbGFzcz1cIlVwcHlHb29nbGVEcml2ZS1icmVhZGNydW1ic1wiPlxuICAgICAgJHtcbiAgICAgICAgcHJvcHMuZGlyZWN0b3JpZXMubWFwKChkaXJlY3RvcnkpID0+IHtcbiAgICAgICAgICByZXR1cm4gQnJlYWRjcnVtYih7XG4gICAgICAgICAgICBnZXROZXh0Rm9sZGVyOiAoKSA9PiBwcm9wcy5nZXROZXh0Rm9sZGVyKGRpcmVjdG9yeS5pZCwgZGlyZWN0b3J5LnRpdGxlKSxcbiAgICAgICAgICAgIHRpdGxlOiBkaXJlY3RvcnkudGl0bGVcbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIDwvdWw+XG4gIGBcbn1cbiIsImltcG9ydCBodG1sIGZyb20gJy4uLy4uLy4uL2NvcmUvaHRtbCdcbmltcG9ydCBCcmVhZGNydW1icyBmcm9tICcuL0JyZWFkY3J1bWJzJ1xuaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUnXG5cbmV4cG9ydCBkZWZhdWx0IChwcm9wcykgPT4ge1xuICBsZXQgZmlsdGVyZWRGb2xkZXJzID0gcHJvcHMuZm9sZGVyc1xuICBsZXQgZmlsdGVyZWRGaWxlcyA9IHByb3BzLmZpbGVzXG5cbiAgaWYgKHByb3BzLmZpbHRlcklucHV0ICE9PSAnJykge1xuICAgIGZpbHRlcmVkRm9sZGVycyA9IHByb3BzLmZpbHRlckl0ZW1zKHByb3BzLmZvbGRlcnMpXG4gICAgZmlsdGVyZWRGaWxlcyA9IHByb3BzLmZpbHRlckl0ZW1zKHByb3BzLmZpbGVzKVxuICB9XG5cbiAgcmV0dXJuIGh0bWxgXG4gICAgPGRpdiBjbGFzcz1cIkJyb3dzZXJcIj5cbiAgICAgIDxoZWFkZXI+XG4gICAgICAgIDxpbnB1dFxuICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcbiAgICAgICAgICBjbGFzcz1cIkJyb3dzZXItc2VhcmNoXCJcbiAgICAgICAgICBwbGFjZWhvbGRlcj1cIlNlYXJjaCBEcml2ZVwiXG4gICAgICAgICAgb25rZXl1cD0ke3Byb3BzLmZpbHRlclF1ZXJ5fVxuICAgICAgICAgIHZhbHVlPSR7cHJvcHMuZmlsdGVySW5wdXR9Lz5cbiAgICAgIDwvaGVhZGVyPlxuICAgICAgPGRpdiBjbGFzcz1cIkJyb3dzZXItc3ViSGVhZGVyXCI+XG4gICAgICAgICR7QnJlYWRjcnVtYnMoe1xuICAgICAgICAgIGdldE5leHRGb2xkZXI6IHByb3BzLmdldE5leHRGb2xkZXIsXG4gICAgICAgICAgZGlyZWN0b3JpZXM6IHByb3BzLmRpcmVjdG9yaWVzXG4gICAgICAgIH0pfVxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiQnJvd3Nlci1ib2R5XCI+XG4gICAgICAgIDxtYWluIGNsYXNzPVwiQnJvd3Nlci1jb250ZW50XCI+XG4gICAgICAgICAgJHtUYWJsZSh7XG4gICAgICAgICAgICBjb2x1bW5zOiBbe1xuICAgICAgICAgICAgICBuYW1lOiAnTmFtZScsXG4gICAgICAgICAgICAgIGtleTogJ3RpdGxlJ1xuICAgICAgICAgICAgfV0sXG4gICAgICAgICAgICBmb2xkZXJzOiBmaWx0ZXJlZEZvbGRlcnMsXG4gICAgICAgICAgICBmaWxlczogZmlsdGVyZWRGaWxlcyxcbiAgICAgICAgICAgIGFjdGl2ZVJvdzogcHJvcHMuYWN0aXZlUm93LFxuICAgICAgICAgICAgc29ydEJ5VGl0bGU6IHByb3BzLnNvcnRCeVRpdGxlLFxuICAgICAgICAgICAgc29ydEJ5RGF0ZTogcHJvcHMuc29ydEJ5RGF0ZSxcbiAgICAgICAgICAgIGhhbmRsZVJvd0NsaWNrOiBwcm9wcy5oYW5kbGVSb3dDbGljayxcbiAgICAgICAgICAgIGhhbmRsZUZpbGVEb3VibGVDbGljazogcHJvcHMuYWRkRmlsZSxcbiAgICAgICAgICAgIGhhbmRsZUZvbGRlckRvdWJsZUNsaWNrOiBwcm9wcy5nZXROZXh0Rm9sZGVyXG4gICAgICAgICAgfSl9XG4gICAgICAgIDwvbWFpbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICBgXG59XG4iLCJpbXBvcnQgaHRtbCBmcm9tICcuLi8uLi8uLi9jb3JlL2h0bWwnXG5pbXBvcnQgUm93IGZyb20gJy4vVGFibGVSb3cnXG5cbmV4cG9ydCBkZWZhdWx0IChwcm9wcykgPT4ge1xuICBjb25zdCBoZWFkZXJzID0gcHJvcHMuY29sdW1ucy5tYXAoKGNvbHVtbikgPT4ge1xuICAgIHJldHVybiBodG1sYFxuICAgICAgPHRoIGNsYXNzPVwiQnJvd3NlclRhYmxlLWhlYWRlckNvbHVtbiBCcm93c2VyVGFibGUtY29sdW1uXCIgb25jbGljaz0ke3Byb3BzLnNvcnRCeVRpdGxlfT5cbiAgICAgICAgJHtjb2x1bW4ubmFtZX1cbiAgICAgIDwvdGg+XG4gICAgYFxuICB9KVxuXG4gIHJldHVybiBodG1sYFxuICAgIDx0YWJsZSBjbGFzcz1cIkJyb3dzZXJUYWJsZVwiPlxuICAgICAgPHRoZWFkIGNsYXNzPVwiQnJvd3NlclRhYmxlLWhlYWRlclwiPlxuICAgICAgICA8dHI+XG4gICAgICAgICAgJHtoZWFkZXJzfVxuICAgICAgICA8L3RyPlxuICAgICAgPC90aGVhZD5cbiAgICAgIDx0Ym9keT5cbiAgICAgICAgJHtwcm9wcy5mb2xkZXJzLm1hcCgoZm9sZGVyKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIFJvdyh7XG4gICAgICAgICAgICB0aXRsZTogZm9sZGVyLnRpdGxlLFxuICAgICAgICAgICAgYWN0aXZlOiBwcm9wcy5hY3RpdmVSb3cgPT09IGZvbGRlci5pZCxcbiAgICAgICAgICAgIGljb25MaW5rOiBmb2xkZXIuaWNvbkxpbmssXG4gICAgICAgICAgICBtb2RpZmllZEJ5TWVEYXRlOiBmb2xkZXIubW9kaWZpZWRCeU1lRGF0ZSxcbiAgICAgICAgICAgIGhhbmRsZUNsaWNrOiAoKSA9PiBwcm9wcy5oYW5kbGVSb3dDbGljayhmb2xkZXIuaWQpLFxuICAgICAgICAgICAgaGFuZGxlRG91YmxlQ2xpY2s6ICgpID0+IHByb3BzLmhhbmRsZUZvbGRlckRvdWJsZUNsaWNrKGZvbGRlci5pZCwgZm9sZGVyLnRpdGxlKSxcbiAgICAgICAgICAgIGNvbHVtbnM6IHByb3BzLmNvbHVtbnNcbiAgICAgICAgICB9KVxuICAgICAgICB9KX1cbiAgICAgICAgJHtwcm9wcy5maWxlcy5tYXAoKGZpbGUpID0+IHtcbiAgICAgICAgICByZXR1cm4gUm93KHtcbiAgICAgICAgICAgIHRpdGxlOiBmaWxlLnRpdGxlLFxuICAgICAgICAgICAgYWN0aXZlOiBwcm9wcy5hY3RpdmVSb3cgPT09IGZpbGUuaWQsXG4gICAgICAgICAgICBpY29uTGluazogZmlsZS5pY29uTGluayxcbiAgICAgICAgICAgIG1vZGlmaWVkQnlNZURhdGU6IGZpbGUubW9kaWZpZWRCeU1lRGF0ZSxcbiAgICAgICAgICAgIGhhbmRsZUNsaWNrOiAoKSA9PiBwcm9wcy5oYW5kbGVSb3dDbGljayhmaWxlLmlkKSxcbiAgICAgICAgICAgIGhhbmRsZURvdWJsZUNsaWNrOiAoKSA9PiBwcm9wcy5oYW5kbGVGaWxlRG91YmxlQ2xpY2soZmlsZSksXG4gICAgICAgICAgICBjb2x1bW5zOiBwcm9wcy5jb2x1bW5zLFxuICAgICAgICAgICAgb3duZXI6ICdKb2UgTWFtYSdcbiAgICAgICAgICB9KVxuICAgICAgICB9KX1cbiAgICAgIDwvdGJvZHk+XG4gICAgPC90YWJsZT5cbiAgYFxufVxuIiwiaW1wb3J0IGh0bWwgZnJvbSAnLi4vLi4vLi4vY29yZS9odG1sJ1xuXG5leHBvcnQgZGVmYXVsdCAocHJvcHMpID0+IHtcbiAgcmV0dXJuIGh0bWxgXG4gICAgPHRkIGNsYXNzPVwiQnJvd3NlclRhYmxlLXJvd0NvbHVtbiBCcm93c2VyVGFibGUtY29sdW1uXCI+XG4gICAgICA8aW1nIHNyYz0ke3Byb3BzLmljb25MaW5rfS8+ICR7cHJvcHMudmFsdWV9XG4gICAgPC90ZD5cbiAgYFxufVxuIiwiaW1wb3J0IGh0bWwgZnJvbSAnLi4vLi4vLi4vY29yZS9odG1sJ1xuaW1wb3J0IENvbHVtbiBmcm9tICcuL1RhYmxlQ29sdW1uJ1xuXG5leHBvcnQgZGVmYXVsdCAocHJvcHMpID0+IHtcbiAgY29uc3QgY2xhc3NlcyA9IHByb3BzLmFjdGl2ZSA/ICdCcm93c2VyVGFibGUtcm93IGlzLWFjdGl2ZScgOiAnQnJvd3NlclRhYmxlLXJvdydcbiAgcmV0dXJuIGh0bWxgXG4gICAgPHRyIG9uY2xpY2s9JHtwcm9wcy5oYW5kbGVDbGlja30gb25kYmxjbGljaz0ke3Byb3BzLmhhbmRsZURvdWJsZUNsaWNrfSBjbGFzcz0ke2NsYXNzZXN9PlxuICAgICAgJHtDb2x1bW4oe1xuICAgICAgICBpY29uTGluazogcHJvcHMuaWNvbkxpbmssXG4gICAgICAgIHZhbHVlOiBwcm9wcy50aXRsZSB8fCAnJ1xuICAgICAgfSl9XG4gICAgPC90cj5cbiAgYFxufVxuIiwiaW1wb3J0IFBsdWdpbiBmcm9tICcuL1BsdWdpbidcbmltcG9ydCBodG1sIGZyb20gJy4uL2NvcmUvaHRtbCdcblxuLyoqXG4gKiBJbmZvcm1lclxuICogU2hvd3MgcmFkIG1lc3NhZ2UgYnViYmxlc1xuICogdXNlZCBsaWtlIHRoaXM6IGBidXMuZW1pdCgnaW5mb3JtZXInLCAnaGVsbG8gd29ybGQnLCAnaW5mbycsIDUwMDApYFxuICogb3IgZm9yIGVycm9yczogYGJ1cy5lbWl0KCdpbmZvcm1lcicsICdFcnJvciB1cGxvYWRpbmcgaW1nLmpwZycsICdlcnJvcicsIDUwMDApYFxuICpcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSW5mb3JtZXIgZXh0ZW5kcyBQbHVnaW4ge1xuICBjb25zdHJ1Y3RvciAoY29yZSwgb3B0cykge1xuICAgIHN1cGVyKGNvcmUsIG9wdHMpXG4gICAgdGhpcy50eXBlID0gJ3Byb2dyZXNzaW5kaWNhdG9yJ1xuICAgIHRoaXMuaWQgPSAnSW5mb3JtZXInXG4gICAgdGhpcy50aXRsZSA9ICdJbmZvcm1lcidcblxuICAgIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHt9XG5cbiAgICAvLyBtZXJnZSBkZWZhdWx0IG9wdGlvbnMgd2l0aCB0aGUgb25lcyBzZXQgYnkgdXNlclxuICAgIHRoaXMub3B0cyA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRPcHRpb25zLCBvcHRzKVxuICB9XG5cbiAgc2hvd0luZm9ybWVyIChtc2csIHR5cGUsIGR1cmF0aW9uKSB7XG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHtcbiAgICAgIGluZm9ybWVyOiB7XG4gICAgICAgIGlzSGlkZGVuOiBmYWxzZSxcbiAgICAgICAgbXNnOiBtc2dcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgaWYgKGR1cmF0aW9uID09PSAwKSByZXR1cm5cblxuICAgIC8vIGhpZGUgdGhlIGluZm9ybWVyIGFmdGVyIGBkdXJhdGlvbmAgbWlsbGlzZWNvbmRzXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBjb25zdCBuZXdJbmZvcm1lciA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuY29yZS5nZXRTdGF0ZSgpLmluZm9ybWVyLCB7XG4gICAgICAgIGlzSGlkZGVuOiB0cnVlXG4gICAgICB9KVxuICAgICAgdGhpcy5jb3JlLnNldFN0YXRlKHtcbiAgICAgICAgaW5mb3JtZXI6IG5ld0luZm9ybWVyXG4gICAgICB9KVxuICAgIH0sIGR1cmF0aW9uKVxuICB9XG5cbiAgaGlkZUluZm9ybWVyICgpIHtcbiAgICBjb25zdCBuZXdJbmZvcm1lciA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuY29yZS5nZXRTdGF0ZSgpLmluZm9ybWVyLCB7XG4gICAgICBpc0hpZGRlbjogdHJ1ZVxuICAgIH0pXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHtcbiAgICAgIGluZm9ybWVyOiBuZXdJbmZvcm1lclxuICAgIH0pXG4gIH1cblxuICByZW5kZXIgKHN0YXRlKSB7XG4gICAgY29uc3QgbXNnID0gc3RhdGUuaW5mb3JtZXIubXNnXG4gICAgY29uc3QgaXNIaWRkZW4gPSBzdGF0ZS5pbmZvcm1lci5pc0hpZGRlblxuXG4gICAgLy8gQFRPRE8gYWRkIGFyaWEtbGl2ZSBmb3Igc2NyZWVuLXJlYWRlcnNcbiAgICByZXR1cm4gaHRtbGA8ZGl2IGNsYXNzPVwiVXBweUluZm9ybWVyXCIgYXJpYS1oaWRkZW49XCIke2lzSGlkZGVufVwiPlxuICAgICAgPHA+JHttc2d9PC9wPlxuICAgIDwvZGl2PmBcbiAgfVxuXG4gIGluc3RhbGwgKCkge1xuICAgIC8vIFNldCBkZWZhdWx0IHN0YXRlIGZvciBHb29nbGUgRHJpdmVcbiAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe1xuICAgICAgaW5mb3JtZXI6IHtcbiAgICAgICAgaXNIaWRkZW46IHRydWUsXG4gICAgICAgIG1zZzogJydcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgY29uc3QgYnVzID0gdGhpcy5jb3JlLmJ1c1xuXG4gICAgYnVzLm9uKCdpbmZvcm1lcicsIChtc2csIHR5cGUsIGR1cmF0aW9uKSA9PiB7XG4gICAgICB0aGlzLnNob3dJbmZvcm1lcihtc2csIHR5cGUsIGR1cmF0aW9uKVxuICAgIH0pXG5cbiAgICBidXMub24oJ2luZm9ybWVyLWhpZGUnLCAoKSA9PiB7XG4gICAgICB0aGlzLmhpZGVJbmZvcm1lcigpXG4gICAgfSlcblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMub3B0cy50YXJnZXRcbiAgICBjb25zdCBwbHVnaW4gPSB0aGlzXG4gICAgdGhpcy50YXJnZXQgPSB0aGlzLm1vdW50KHRhcmdldCwgcGx1Z2luKVxuICB9XG59XG4iLCJpbXBvcnQgUGx1Z2luIGZyb20gJy4vUGx1Z2luJ1xuXG4vKipcbiAqIE1ldGEgRGF0YVxuICogQWRkcyBtZXRhZGF0YSBmaWVsZHMgdG8gVXBweVxuICpcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWV0YURhdGEgZXh0ZW5kcyBQbHVnaW4ge1xuICBjb25zdHJ1Y3RvciAoY29yZSwgb3B0cykge1xuICAgIHN1cGVyKGNvcmUsIG9wdHMpXG4gICAgdGhpcy50eXBlID0gJ21vZGlmaWVyJ1xuICAgIHRoaXMuaWQgPSAnTWV0YURhdGEnXG4gICAgdGhpcy50aXRsZSA9ICdNZXRhIERhdGEnXG5cbiAgICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gICAgY29uc3QgZGVmYXVsdE9wdGlvbnMgPSB7fVxuXG4gICAgLy8gbWVyZ2UgZGVmYXVsdCBvcHRpb25zIHdpdGggdGhlIG9uZXMgc2V0IGJ5IHVzZXJcbiAgICB0aGlzLm9wdHMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0cylcbiAgfVxuXG4gIGFkZEluaXRpYWxNZXRhICgpIHtcbiAgICBjb25zdCBtZXRhRmllbGRzID0gdGhpcy5vcHRzLmZpZWxkc1xuXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHtcbiAgICAgIG1ldGFGaWVsZHM6IG1ldGFGaWVsZHNcbiAgICB9KVxuXG4gICAgdGhpcy5jb3JlLmVtaXR0ZXIub24oJ2ZpbGUtYWRkZWQnLCAoZmlsZUlEKSA9PiB7XG4gICAgICBtZXRhRmllbGRzLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgICAgY29uc3Qgb2JqID0ge31cbiAgICAgICAgb2JqW2l0ZW0uaWRdID0gaXRlbS52YWx1ZVxuICAgICAgICB0aGlzLmNvcmUudXBkYXRlTWV0YShvYmosIGZpbGVJRClcbiAgICAgIH0pXG4gICAgfSlcbiAgfVxuXG4gIGluc3RhbGwgKCkge1xuICAgIHRoaXMuYWRkSW5pdGlhbE1ldGEoKVxuICB9XG59XG4iLCJpbXBvcnQgeW8gZnJvbSAneW8teW8nXG5cbi8qKlxuICogQm9pbGVycGxhdGUgdGhhdCBhbGwgUGx1Z2lucyBzaGFyZSAtIGFuZCBzaG91bGQgbm90IGJlIHVzZWRcbiAqIGRpcmVjdGx5LiBJdCBhbHNvIHNob3dzIHdoaWNoIG1ldGhvZHMgZmluYWwgcGx1Z2lucyBzaG91bGQgaW1wbGVtZW50L292ZXJyaWRlLFxuICogdGhpcyBkZWNpZGluZyBvbiBzdHJ1Y3R1cmUuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IG1haW4gVXBweSBjb3JlIG9iamVjdFxuICogQHBhcmFtIHtvYmplY3R9IG9iamVjdCB3aXRoIHBsdWdpbiBvcHRpb25zXG4gKiBAcmV0dXJuIHthcnJheSB8IHN0cmluZ30gZmlsZXMgb3Igc3VjY2Vzcy9mYWlsIG1lc3NhZ2VcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUGx1Z2luIHtcblxuICBjb25zdHJ1Y3RvciAoY29yZSwgb3B0cykge1xuICAgIHRoaXMuY29yZSA9IGNvcmVcbiAgICB0aGlzLm9wdHMgPSBvcHRzIHx8IHt9XG4gICAgdGhpcy50eXBlID0gJ25vbmUnXG5cbiAgICAvLyBjbGVhciBldmVyeXRoaW5nIGluc2lkZSB0aGUgdGFyZ2V0IHNlbGVjdG9yXG4gICAgdGhpcy5vcHRzLnJlcGxhY2VUYXJnZXRDb250ZW50ID09PSB0aGlzLm9wdHMucmVwbGFjZVRhcmdldENvbnRlbnQgfHwgdHJ1ZVxuXG4gICAgdGhpcy51cGRhdGUgPSB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpXG4gICAgdGhpcy5tb3VudCA9IHRoaXMubW91bnQuYmluZCh0aGlzKVxuICAgIHRoaXMuZm9jdXMgPSB0aGlzLmZvY3VzLmJpbmQodGhpcylcbiAgICB0aGlzLmluc3RhbGwgPSB0aGlzLmluc3RhbGwuYmluZCh0aGlzKVxuICB9XG5cbiAgdXBkYXRlIChzdGF0ZSkge1xuICAgIGlmICh0eXBlb2YgdGhpcy5lbCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGNvbnN0IG5ld0VsID0gdGhpcy5yZW5kZXIoc3RhdGUpXG4gICAgeW8udXBkYXRlKHRoaXMuZWwsIG5ld0VsKVxuXG4gICAgLy8gb3B0aW1pemVzIHBlcmZvcm1hbmNlP1xuICAgIC8vIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgLy8gICBjb25zdCBuZXdFbCA9IHRoaXMucmVuZGVyKHN0YXRlKVxuICAgIC8vICAgeW8udXBkYXRlKHRoaXMuZWwsIG5ld0VsKVxuICAgIC8vIH0pXG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgc3VwcGxpZWQgYHRhcmdldGAgaXMgYSBgc3RyaW5nYCBvciBhbiBgb2JqZWN0YC5cbiAgICogSWYgaXTigJlzIGFuIG9iamVjdCDigJQgdGFyZ2V0IGlzIGEgcGx1Z2luLCBhbmQgd2Ugc2VhcmNoIGBwbHVnaW5zYFxuICAgKiBmb3IgYSBwbHVnaW4gd2l0aCBzYW1lIG5hbWUgYW5kIHJldHVybiBpdHMgdGFyZ2V0LlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ3xPYmplY3R9IHRhcmdldFxuICAgKlxuICAgKi9cbiAgbW91bnQgKHRhcmdldCwgcGx1Z2luKSB7XG4gICAgY29uc3QgY2FsbGVyUGx1Z2luTmFtZSA9IHBsdWdpbi5pZFxuXG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLmNvcmUubG9nKGBJbnN0YWxsaW5nICR7Y2FsbGVyUGx1Z2luTmFtZX0gdG8gJHt0YXJnZXR9YClcblxuICAgICAgLy8gY2xlYXIgZXZlcnl0aGluZyBpbnNpZGUgdGhlIHRhcmdldCBjb250YWluZXJcbiAgICAgIGlmICh0aGlzLm9wdHMucmVwbGFjZVRhcmdldENvbnRlbnQpIHtcbiAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0YXJnZXQpLmlubmVySFRNTCA9ICcnXG4gICAgICB9XG5cbiAgICAgIHRoaXMuZWwgPSBwbHVnaW4ucmVuZGVyKHRoaXMuY29yZS5zdGF0ZSlcbiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IodGFyZ2V0KS5hcHBlbmRDaGlsZCh0aGlzLmVsKVxuXG4gICAgICByZXR1cm4gdGFyZ2V0XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRPRE86IGlzIGluc3RhbnRpYXRpbmcgdGhlIHBsdWdpbiByZWFsbHkgdGhlIHdheSB0byByb2xsXG4gICAgICAvLyBqdXN0IHRvIGdldCB0aGUgcGx1Z2luIG5hbWU/XG4gICAgICBjb25zdCBUYXJnZXQgPSB0YXJnZXRcbiAgICAgIGNvbnN0IHRhcmdldFBsdWdpbk5hbWUgPSBuZXcgVGFyZ2V0KCkuaWRcblxuICAgICAgdGhpcy5jb3JlLmxvZyhgSW5zdGFsbGluZyAke2NhbGxlclBsdWdpbk5hbWV9IHRvICR7dGFyZ2V0UGx1Z2luTmFtZX1gKVxuXG4gICAgICBjb25zdCB0YXJnZXRQbHVnaW4gPSB0aGlzLmNvcmUuZ2V0UGx1Z2luKHRhcmdldFBsdWdpbk5hbWUpXG4gICAgICBjb25zdCBzZWxlY3RvclRhcmdldCA9IHRhcmdldFBsdWdpbi5hZGRUYXJnZXQocGx1Z2luKVxuXG4gICAgICByZXR1cm4gc2VsZWN0b3JUYXJnZXRcbiAgICB9XG4gIH1cblxuICBmb2N1cyAoKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICBpbnN0YWxsICgpIHtcbiAgICByZXR1cm5cbiAgfVxufVxuIiwiaW1wb3J0IFBsdWdpbiBmcm9tICcuL1BsdWdpbidcbmltcG9ydCB0dXMgZnJvbSAndHVzLWpzLWNsaWVudCdcbmltcG9ydCBVcHB5U29ja2V0IGZyb20gJy4uL2NvcmUvVXBweVNvY2tldCdcblxuLyoqXG4gKiBUdXMgcmVzdW1hYmxlIGZpbGUgdXBsb2FkZXJcbiAqXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFR1czEwIGV4dGVuZHMgUGx1Z2luIHtcbiAgY29uc3RydWN0b3IgKGNvcmUsIG9wdHMpIHtcbiAgICBzdXBlcihjb3JlLCBvcHRzKVxuICAgIHRoaXMudHlwZSA9ICd1cGxvYWRlcidcbiAgICB0aGlzLmlkID0gJ1R1cydcbiAgICB0aGlzLnRpdGxlID0gJ1R1cydcblxuICAgIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgIHJlc3VtZTogdHJ1ZSxcbiAgICAgIGFsbG93UGF1c2U6IHRydWVcbiAgICB9XG5cbiAgICAvLyBtZXJnZSBkZWZhdWx0IG9wdGlvbnMgd2l0aCB0aGUgb25lcyBzZXQgYnkgdXNlclxuICAgIHRoaXMub3B0cyA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRPcHRpb25zLCBvcHRzKVxuICB9XG5cbiAgcGF1c2VSZXN1bWUgKGFjdGlvbiwgZmlsZUlEKSB7XG4gICAgY29uc3QgdXBkYXRlZEZpbGVzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5jb3JlLmdldFN0YXRlKCkuZmlsZXMpXG4gICAgY29uc3QgaW5Qcm9ncmVzc1VwZGF0ZWRGaWxlcyA9IE9iamVjdC5rZXlzKHVwZGF0ZWRGaWxlcykuZmlsdGVyKChmaWxlKSA9PiB7XG4gICAgICByZXR1cm4gIXVwZGF0ZWRGaWxlc1tmaWxlXS5wcm9ncmVzcy51cGxvYWRDb21wbGV0ZSAmJlxuICAgICAgICAgICAgIHVwZGF0ZWRGaWxlc1tmaWxlXS5wcm9ncmVzcy51cGxvYWRTdGFydGVkXG4gICAgfSlcblxuICAgIHN3aXRjaCAoYWN0aW9uKSB7XG4gICAgICBjYXNlICd0b2dnbGUnOlxuICAgICAgICBpZiAodXBkYXRlZEZpbGVzW2ZpbGVJRF0udXBsb2FkQ29tcGxldGUpIHJldHVyblxuXG4gICAgICAgIGNvbnN0IHdhc1BhdXNlZCA9IHVwZGF0ZWRGaWxlc1tmaWxlSURdLmlzUGF1c2VkIHx8IGZhbHNlXG4gICAgICAgIGNvbnN0IGlzUGF1c2VkID0gIXdhc1BhdXNlZFxuICAgICAgICBsZXQgdXBkYXRlZEZpbGVcbiAgICAgICAgaWYgKHdhc1BhdXNlZCkge1xuICAgICAgICAgIHVwZGF0ZWRGaWxlID0gT2JqZWN0LmFzc2lnbih7fSwgdXBkYXRlZEZpbGVzW2ZpbGVJRF0sIHtcbiAgICAgICAgICAgIGlzUGF1c2VkOiBmYWxzZVxuICAgICAgICAgIH0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdXBkYXRlZEZpbGUgPSBPYmplY3QuYXNzaWduKHt9LCB1cGRhdGVkRmlsZXNbZmlsZUlEXSwge1xuICAgICAgICAgICAgaXNQYXVzZWQ6IHRydWVcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZWRGaWxlc1tmaWxlSURdID0gdXBkYXRlZEZpbGVcbiAgICAgICAgdGhpcy5jb3JlLnNldFN0YXRlKHtmaWxlczogdXBkYXRlZEZpbGVzfSlcbiAgICAgICAgcmV0dXJuIGlzUGF1c2VkXG4gICAgICBjYXNlICdwYXVzZUFsbCc6XG4gICAgICAgIGluUHJvZ3Jlc3NVcGRhdGVkRmlsZXMuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgICAgIGNvbnN0IHVwZGF0ZWRGaWxlID0gT2JqZWN0LmFzc2lnbih7fSwgdXBkYXRlZEZpbGVzW2ZpbGVdLCB7XG4gICAgICAgICAgICBpc1BhdXNlZDogdHJ1ZVxuICAgICAgICAgIH0pXG4gICAgICAgICAgdXBkYXRlZEZpbGVzW2ZpbGVdID0gdXBkYXRlZEZpbGVcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5jb3JlLnNldFN0YXRlKHtmaWxlczogdXBkYXRlZEZpbGVzfSlcbiAgICAgICAgcmV0dXJuXG4gICAgICBjYXNlICdyZXN1bWVBbGwnOlxuICAgICAgICBpblByb2dyZXNzVXBkYXRlZEZpbGVzLmZvckVhY2goKGZpbGUpID0+IHtcbiAgICAgICAgICBjb25zdCB1cGRhdGVkRmlsZSA9IE9iamVjdC5hc3NpZ24oe30sIHVwZGF0ZWRGaWxlc1tmaWxlXSwge1xuICAgICAgICAgICAgaXNQYXVzZWQ6IGZhbHNlXG4gICAgICAgICAgfSlcbiAgICAgICAgICB1cGRhdGVkRmlsZXNbZmlsZV0gPSB1cGRhdGVkRmlsZVxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe2ZpbGVzOiB1cGRhdGVkRmlsZXN9KVxuICAgICAgICByZXR1cm5cbiAgICB9XG4gIH1cblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgVHVzIHVwbG9hZFxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBmaWxlIGZvciB1c2Ugd2l0aCB1cGxvYWRcbiAqIEBwYXJhbSB7aW50ZWdlcn0gY3VycmVudCBmaWxlIGluIGEgcXVldWVcbiAqIEBwYXJhbSB7aW50ZWdlcn0gdG90YWwgbnVtYmVyIG9mIGZpbGVzIGluIGEgcXVldWVcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG4gIHVwbG9hZCAoZmlsZSwgY3VycmVudCwgdG90YWwpIHtcbiAgICB0aGlzLmNvcmUubG9nKGB1cGxvYWRpbmcgJHtjdXJyZW50fSBvZiAke3RvdGFsfWApXG5cbiAgICAvLyBDcmVhdGUgYSBuZXcgdHVzIHVwbG9hZFxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCB1cGxvYWQgPSBuZXcgdHVzLlVwbG9hZChmaWxlLmRhdGEsIHtcblxuICAgICAgICAvLyBUT0RPIG1lcmdlIHRoaXMub3B0cyBvciB0aGlzLm9wdHMudHVzIGhlcmVcbiAgICAgICAgbWV0YWRhdGE6IGZpbGUubWV0YSxcbiAgICAgICAgcmVzdW1lOiB0aGlzLm9wdHMucmVzdW1lLFxuICAgICAgICBlbmRwb2ludDogdGhpcy5vcHRzLmVuZHBvaW50LFxuXG4gICAgICAgIG9uRXJyb3I6IChlcnIpID0+IHtcbiAgICAgICAgICB0aGlzLmNvcmUubG9nKGVycilcbiAgICAgICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdjb3JlOnVwbG9hZC1lcnJvcicsIGZpbGUuaWQpXG4gICAgICAgICAgcmVqZWN0KCdGYWlsZWQgYmVjYXVzZTogJyArIGVycilcbiAgICAgICAgfSxcbiAgICAgICAgb25Qcm9ncmVzczogKGJ5dGVzVXBsb2FkZWQsIGJ5dGVzVG90YWwpID0+IHtcbiAgICAgICAgICAvLyBEaXNwYXRjaCBwcm9ncmVzcyBldmVudFxuICAgICAgICAgIGNvbnNvbGUubG9nKGJ5dGVzVXBsb2FkZWQsIGJ5dGVzVG90YWwpXG4gICAgICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnY29yZTp1cGxvYWQtcHJvZ3Jlc3MnLCB7XG4gICAgICAgICAgICB1cGxvYWRlcjogdGhpcyxcbiAgICAgICAgICAgIGlkOiBmaWxlLmlkLFxuICAgICAgICAgICAgYnl0ZXNVcGxvYWRlZDogYnl0ZXNVcGxvYWRlZCxcbiAgICAgICAgICAgIGJ5dGVzVG90YWw6IGJ5dGVzVG90YWxcbiAgICAgICAgICB9KVxuICAgICAgICB9LFxuICAgICAgICBvblN1Y2Nlc3M6ICgpID0+IHtcbiAgICAgICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdjb3JlOnVwbG9hZC1zdWNjZXNzJywgZmlsZS5pZCwgdXBsb2FkLnVybClcblxuICAgICAgICAgIHRoaXMuY29yZS5sb2coYERvd25sb2FkICR7dXBsb2FkLmZpbGUubmFtZX0gZnJvbSAke3VwbG9hZC51cmx9YClcbiAgICAgICAgICByZXNvbHZlKHVwbG9hZClcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIub24oJ2NvcmU6ZmlsZS1yZW1vdmUnLCAoZmlsZUlEKSA9PiB7XG4gICAgICAgIGlmIChmaWxlSUQgPT09IGZpbGUuaWQpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygncmVtb3ZpbmcgZmlsZTogJywgZmlsZUlEKVxuICAgICAgICAgIHVwbG9hZC5hYm9ydCgpXG4gICAgICAgICAgcmVzb2x2ZShgdXBsb2FkICR7ZmlsZUlEfSB3YXMgcmVtb3ZlZGApXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIHRoaXMuY29yZS5lbWl0dGVyLm9uKCdjb3JlOnVwbG9hZC1wYXVzZScsIChmaWxlSUQpID0+IHtcbiAgICAgICAgaWYgKGZpbGVJRCA9PT0gZmlsZS5pZCkge1xuICAgICAgICAgIGNvbnN0IGlzUGF1c2VkID0gdGhpcy5wYXVzZVJlc3VtZSgndG9nZ2xlJywgZmlsZUlEKVxuICAgICAgICAgIGlzUGF1c2VkID8gdXBsb2FkLmFib3J0KCkgOiB1cGxvYWQuc3RhcnQoKVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5vbignY29yZTpwYXVzZS1hbGwnLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGZpbGVzID0gdGhpcy5jb3JlLmdldFN0YXRlKCkuZmlsZXNcbiAgICAgICAgaWYgKCFmaWxlc1tmaWxlLmlkXSkgcmV0dXJuXG4gICAgICAgIHVwbG9hZC5hYm9ydCgpXG4gICAgICB9KVxuXG4gICAgICB0aGlzLmNvcmUuZW1pdHRlci5vbignY29yZTpyZXN1bWUtYWxsJywgKCkgPT4ge1xuICAgICAgICBjb25zdCBmaWxlcyA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLmZpbGVzXG4gICAgICAgIGlmICghZmlsZXNbZmlsZS5pZF0pIHJldHVyblxuICAgICAgICB1cGxvYWQuc3RhcnQoKVxuICAgICAgfSlcblxuICAgICAgdXBsb2FkLnN0YXJ0KClcbiAgICAgIHRoaXMuY29yZS5lbWl0dGVyLmVtaXQoJ2NvcmU6dXBsb2FkLXN0YXJ0ZWQnLCBmaWxlLmlkLCB1cGxvYWQpXG4gICAgfSlcbiAgfVxuXG4gIHVwbG9hZFJlbW90ZSAoZmlsZSwgY3VycmVudCwgdG90YWwpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5jb3JlLmxvZyhmaWxlLnJlbW90ZS51cmwpXG4gICAgICBmZXRjaChmaWxlLnJlbW90ZS51cmwsIHtcbiAgICAgICAgbWV0aG9kOiAncG9zdCcsXG4gICAgICAgIGNyZWRlbnRpYWxzOiAnaW5jbHVkZScsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoT2JqZWN0LmFzc2lnbih7fSwgZmlsZS5yZW1vdGUuYm9keSwge1xuICAgICAgICAgIGVuZHBvaW50OiB0aGlzLm9wdHMuZW5kcG9pbnQsXG4gICAgICAgICAgcHJvdG9jb2w6ICd0dXMnXG4gICAgICAgIH0pKVxuICAgICAgfSlcbiAgICAgIC50aGVuKChyZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcy5zdGF0dXMgPCAyMDAgJiYgcmVzLnN0YXR1cyA+IDMwMCkge1xuICAgICAgICAgIHJldHVybiByZWplY3QocmVzLnN0YXR1c1RleHQpXG4gICAgICAgIH1cblxuICAgICAgICByZXMuanNvbigpXG4gICAgICAgIC50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgLy8gZ2V0IHRoZSBob3N0IGRvbWFpblxuICAgICAgICAgIHZhciByZWdleCA9IC9eKD86aHR0cHM/OlxcL1xcL3xcXC9cXC8pPyg/OlteQFxcL1xcbl0rQCk/KD86d3d3XFwuKT8oW15cXC9cXG5dKykvXG4gICAgICAgICAgdmFyIGhvc3QgPSByZWdleC5leGVjKGZpbGUucmVtb3RlLmhvc3QpWzFdXG4gICAgICAgICAgdmFyIHNvY2tldFByb3RvY29sID0gbG9jYXRpb24ucHJvdG9jb2wgPT09ICdodHRwczonID8gJ3dzcycgOiAnd3MnXG5cbiAgICAgICAgICB2YXIgdG9rZW4gPSBkYXRhLnRva2VuXG4gICAgICAgICAgdmFyIHNvY2tldCA9IG5ldyBVcHB5U29ja2V0KHtcbiAgICAgICAgICAgIHRhcmdldDogc29ja2V0UHJvdG9jb2wgKyBgOi8vJHtob3N0fS9hcGkvJHt0b2tlbn1gXG4gICAgICAgICAgfSlcblxuICAgICAgICAgIHNvY2tldC5vbigncHJvZ3Jlc3MnLCAocHJvZ3Jlc3NEYXRhKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB7cHJvZ3Jlc3MsIGJ5dGVzVXBsb2FkZWQsIGJ5dGVzVG90YWx9ID0gcHJvZ3Jlc3NEYXRhXG5cbiAgICAgICAgICAgIGlmIChwcm9ncmVzcykge1xuICAgICAgICAgICAgICB0aGlzLmNvcmUubG9nKGBVcGxvYWQgcHJvZ3Jlc3M6ICR7cHJvZ3Jlc3N9YClcblxuICAgICAgICAgICAgICAvLyBEaXNwYXRjaCBwcm9ncmVzcyBldmVudFxuICAgICAgICAgICAgICB0aGlzLmNvcmUuZW1pdHRlci5lbWl0KCdjb3JlOnVwbG9hZC1wcm9ncmVzcycsIHtcbiAgICAgICAgICAgICAgICB1cGxvYWRlcjogdGhpcyxcbiAgICAgICAgICAgICAgICBpZDogZmlsZS5pZCxcbiAgICAgICAgICAgICAgICBieXRlc1VwbG9hZGVkOiBieXRlc1VwbG9hZGVkLFxuICAgICAgICAgICAgICAgIGJ5dGVzVG90YWw6IGJ5dGVzVG90YWxcbiAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICBpZiAocHJvZ3Jlc3MgPT09ICcxMDAuMDAnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnY29yZTp1cGxvYWQtc3VjY2VzcycsIGZpbGUuaWQpXG4gICAgICAgICAgICAgICAgc29ja2V0LmNsb3NlKClcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgfSlcbiAgICB9KVxuICB9XG5cbiAgdXBsb2FkRmlsZXMgKGZpbGVzKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKGZpbGVzKS5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuY29yZS5sb2coJ25vIGZpbGVzIHRvIHVwbG9hZCEnKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgY29uc3QgdXBsb2FkZXJzID0gW11cbiAgICBmaWxlcy5mb3JFYWNoKChmaWxlLCBpbmRleCkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudCA9IHBhcnNlSW50KGluZGV4LCAxMCkgKyAxXG4gICAgICBjb25zdCB0b3RhbCA9IGZpbGVzLmxlbmd0aFxuXG4gICAgICBpZiAoIWZpbGUuaXNSZW1vdGUpIHtcbiAgICAgICAgdXBsb2FkZXJzLnB1c2godGhpcy51cGxvYWQoZmlsZSwgY3VycmVudCwgdG90YWwpKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdXBsb2FkZXJzLnB1c2godGhpcy51cGxvYWRSZW1vdGUoZmlsZSwgY3VycmVudCwgdG90YWwpKVxuICAgICAgfVxuICAgIH0pXG5cbiAgICByZXR1cm4gUHJvbWlzZS5hbGwodXBsb2FkZXJzKVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICB0aGlzLmNvcmUubG9nKCdBbGwgZmlsZXMgdXBsb2FkZWQnKVxuICAgICAgICByZXR1cm4geyB1cGxvYWRlZENvdW50OiBmaWxlcy5sZW5ndGggfVxuICAgICAgfSlcbiAgICAgIC5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgIHRoaXMuY29yZS5sb2coJ1VwbG9hZCBlcnJvcjogJyArIGVycilcbiAgICAgIH0pXG4gIH1cblxuICBzZWxlY3RGb3JVcGxvYWQgKGZpbGVzKSB7XG4gICAgLy8gVE9ETzogcmVwbGFjZSBmaWxlc1tmaWxlXS5pc1JlbW90ZSB3aXRoIHNvbWUgbG9naWNcbiAgICAvL1xuICAgIC8vIGZpbHRlciBmaWxlcyB0aGF0IGFyZSBub3cgeWV0IGJlaW5nIHVwbG9hZGVkIC8gaGF2ZW7igJl0IGJlZW4gdXBsb2FkZWRcbiAgICAvLyBhbmQgcmVtb3RlIHRvb1xuICAgIGNvbnN0IGZpbGVzRm9yVXBsb2FkID0gT2JqZWN0LmtleXMoZmlsZXMpLmZpbHRlcigoZmlsZSkgPT4ge1xuICAgICAgaWYgKCFmaWxlc1tmaWxlXS5wcm9ncmVzcy51cGxvYWRTdGFydGVkIHx8IGZpbGVzW2ZpbGVdLmlzUmVtb3RlKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9KS5tYXAoKGZpbGUpID0+IHtcbiAgICAgIHJldHVybiBmaWxlc1tmaWxlXVxuICAgIH0pXG5cbiAgICB0aGlzLnVwbG9hZEZpbGVzKGZpbGVzRm9yVXBsb2FkKVxuICB9XG5cbiAgYWN0aW9ucyAoKSB7XG4gICAgdGhpcy5jb3JlLmVtaXR0ZXIub24oJ2NvcmU6cGF1c2UtYWxsJywgKCkgPT4ge1xuICAgICAgdGhpcy5wYXVzZVJlc3VtZSgncGF1c2VBbGwnKVxuICAgIH0pXG5cbiAgICB0aGlzLmNvcmUuZW1pdHRlci5vbignY29yZTpyZXN1bWUtYWxsJywgKCkgPT4ge1xuICAgICAgdGhpcy5wYXVzZVJlc3VtZSgncmVzdW1lQWxsJylcbiAgICB9KVxuXG4gICAgdGhpcy5jb3JlLmVtaXR0ZXIub24oJ2NvcmU6dXBsb2FkJywgKCkgPT4ge1xuICAgICAgdGhpcy5jb3JlLmxvZygnVHVzIGlzIHVwbG9hZGluZy4uLicpXG4gICAgICBjb25zdCBmaWxlcyA9IHRoaXMuY29yZS5nZXRTdGF0ZSgpLmZpbGVzXG4gICAgICB0aGlzLnNlbGVjdEZvclVwbG9hZChmaWxlcylcbiAgICB9KVxuICB9XG5cbiAgYWRkUmVzdW1hYmxlVXBsb2Fkc0NhcGFiaWxpdHlGbGFnICgpIHtcbiAgICBjb25zdCBuZXdDYXBhYmlsaXRpZXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmNvcmUuZ2V0U3RhdGUoKS5jYXBhYmlsaXRpZXMpXG4gICAgbmV3Q2FwYWJpbGl0aWVzLnJlc3VtYWJsZVVwbG9hZHMgPSB0cnVlXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHtcbiAgICAgIGNhcGFiaWxpdGllczogbmV3Q2FwYWJpbGl0aWVzXG4gICAgfSlcbiAgfVxuXG4gIGluc3RhbGwgKCkge1xuICAgIHRoaXMuYWRkUmVzdW1hYmxlVXBsb2Fkc0NhcGFiaWxpdHlGbGFnKClcbiAgICB0aGlzLmFjdGlvbnMoKVxuICB9XG59XG4iLCJpbXBvcnQgaHRtbCBmcm9tICcuLi8uLi9jb3JlL2h0bWwnXG5cbmV4cG9ydCBkZWZhdWx0IChwcm9wcykgPT4ge1xuICByZXR1cm4gaHRtbGA8c3ZnIGNsYXNzPVwiVXBweUljb25cIiB3aWR0aD1cIjEwMFwiIGhlaWdodD1cIjc3XCIgdmlld0JveD1cIjAgMCAxMDAgNzdcIj5cbiAgICA8Zz5cbiAgICAgIDxwYXRoIGQ9XCJNNTAgMzJjLTcuMTY4IDAtMTMgNS44MzItMTMgMTNzNS44MzIgMTMgMTMgMTMgMTMtNS44MzIgMTMtMTMtNS44MzItMTMtMTMtMTN6XCIvPlxuICAgICAgPHBhdGggZD1cIk04NyAxM0g3MmMwLTcuMTgtNS44Mi0xMy0xMy0xM0g0MWMtNy4xOCAwLTEzIDUuODItMTMgMTNIMTNDNS44MiAxMyAwIDE4LjgyIDAgMjZ2MzhjMCA3LjE4IDUuODIgMTMgMTMgMTNoNzRjNy4xOCAwIDEzLTUuODIgMTMtMTNWMjZjMC03LjE4LTUuODItMTMtMTMtMTN6TTUwIDY4Yy0xMi42ODMgMC0yMy0xMC4zMTgtMjMtMjNzMTAuMzE3LTIzIDIzLTIzIDIzIDEwLjMxOCAyMyAyMy0xMC4zMTcgMjMtMjMgMjN6XCIvPlxuICAgIDxnPlxuICA8L3N2Zz5gXG59XG4iLCJpbXBvcnQgaHRtbCBmcm9tICcuLi8uLi9jb3JlL2h0bWwnXG5pbXBvcnQgQ2FtZXJhSWNvbiBmcm9tICcuL0NhbWVyYUljb24nXG5cbmV4cG9ydCBkZWZhdWx0IChwcm9wcykgPT4ge1xuICBjb25zdCBzcmMgPSBwcm9wcy5zcmMgfHwgJydcbiAgbGV0IHZpZGVvXG5cbiAgaWYgKHByb3BzLnVzZVRoZUZsYXNoKSB7XG4gICAgdmlkZW8gPSBwcm9wcy5nZXRTV0ZIVE1MKClcbiAgfSBlbHNlIHtcbiAgICB2aWRlbyA9IGh0bWxgPHZpZGVvIGNsYXNzPVwiVXBweVdlYmNhbS12aWRlb1wiIGF1dG9wbGF5IHNyYz1cIiR7c3JjfVwiPjwvdmlkZW8+YFxuICB9XG5cbiAgcmV0dXJuIGh0bWxgXG4gICAgPGRpdiBjbGFzcz1cIlVwcHlXZWJjYW0tY29udGFpbmVyXCIgb25sb2FkPSR7KGVsKSA9PiB7XG4gICAgICBwcm9wcy5vbkZvY3VzKClcbiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5VcHB5V2ViY2FtLXN0b3BSZWNvcmRCdG4nKS5mb2N1cygpXG4gICAgfX0gb251bmxvYWQ9JHsoZWwpID0+IHtcbiAgICAgIHByb3BzLm9uU3RvcCgpXG4gICAgfX0+XG4gICAgICA8ZGl2IGNsYXNzPSdVcHB5V2ViY2FtLXZpZGVvQ29udGFpbmVyJz5cbiAgICAgICAgJHt2aWRlb31cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz0nVXBweVdlYmNhbS1idXR0b25Db250YWluZXInPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiVXBweUJ1dHRvbi0tY2lyY3VsYXIgVXBweUJ1dHRvbi0tcmVkIFVwcHlCdXR0b24tLXNpemVNIFVwcHlXZWJjYW0tc3RvcFJlY29yZEJ0blwiXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgdGl0bGU9XCJUYWtlIGEgc25hcHNob3RcIlxuICAgICAgICAgIGFyaWEtbGFiZWw9XCJUYWtlIGEgc25hcHNob3RcIlxuICAgICAgICAgIG9uY2xpY2s9JHtwcm9wcy5vblNuYXBzaG90fT5cbiAgICAgICAgICAke0NhbWVyYUljb24oKX1cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxjYW52YXMgY2xhc3M9XCJVcHB5V2ViY2FtLWNhbnZhc1wiIHN0eWxlPVwiZGlzcGxheTogbm9uZTtcIj48L2NhbnZhcz5cbiAgICA8L2Rpdj5cbiAgYFxufVxuIiwiaW1wb3J0IGh0bWwgZnJvbSAnLi4vLi4vY29yZS9odG1sJ1xuXG5leHBvcnQgZGVmYXVsdCAocHJvcHMpID0+IHtcbiAgcmV0dXJuIGh0bWxgXG4gICAgPGRpdj5cbiAgICAgIDxoMT5QbGVhc2UgYWxsb3cgYWNjZXNzIHRvIHlvdXIgY2FtZXJhPC9oMT5cbiAgICAgIDxzcGFuPllvdSBoYXZlIGJlZW4gcHJvbXB0ZWQgdG8gYWxsb3cgY2FtZXJhIGFjY2VzcyBmcm9tIHRoaXMgc2l0ZS4gSW4gb3JkZXIgdG8gdGFrZSBwaWN0dXJlcyB3aXRoIHlvdXIgY2FtZXJhIHlvdSBtdXN0IGFwcHJvdmUgdGhpcyByZXF1ZXN0Ljwvc3Bhbj5cbiAgICA8L2Rpdj5cbiAgYFxufVxuIiwiaW1wb3J0IGh0bWwgZnJvbSAnLi4vLi4vY29yZS9odG1sJ1xuXG5leHBvcnQgZGVmYXVsdCAocHJvcHMpID0+IHtcbiAgcmV0dXJuIGh0bWxgXG4gICAgPHN2ZyBjbGFzcz1cIlVwcHlJY29uIFVwcHlNb2RhbFRhYi1pY29uXCIgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjIxXCIgdmlld0JveD1cIjAgMCAxOCAyMVwiPlxuICAgICAgPGc+XG4gICAgICAgIDxwYXRoIGQ9XCJNMTQuOCAxNi45YzEuOS0xLjcgMy4yLTQuMSAzLjItNi45IDAtNS00LTktOS05cy05IDQtOSA5YzAgMi44IDEuMiA1LjIgMy4yIDYuOUMxLjkgMTcuOS41IDE5LjQgMCAyMWgzYzEtMS45IDExLTEuOSAxMiAwaDNjLS41LTEuNi0xLjktMy4xLTMuMi00LjF6TTkgNGMzLjMgMCA2IDIuNyA2IDZzLTIuNyA2LTYgNi02LTIuNy02LTYgMi43LTYgNi02elwiLz5cbiAgICAgICAgPHBhdGggZD1cIk05IDE0YzIuMiAwIDQtMS44IDQtNHMtMS44LTQtNC00LTQgMS44LTQgNCAxLjggNCA0IDR6TTggOGMuNiAwIDEgLjQgMSAxcy0uNCAxLTEgMS0xLS40LTEtMWMwLS41LjQtMSAxLTF6XCIvPlxuICAgICAgPC9nPlxuICAgIDwvc3ZnPlxuICBgXG59XG4iLCJpbXBvcnQgUGx1Z2luIGZyb20gJy4uL1BsdWdpbidcbmltcG9ydCBXZWJjYW1Qcm92aWRlciBmcm9tICcuLi8uLi91cHB5LWJhc2Uvc3JjL3BsdWdpbnMvV2ViY2FtJ1xuaW1wb3J0IHsgZXh0ZW5kIH0gZnJvbSAnLi4vLi4vY29yZS9VdGlscydcbmltcG9ydCBXZWJjYW1JY29uIGZyb20gJy4vV2ViY2FtSWNvbidcbmltcG9ydCBDYW1lcmFTY3JlZW4gZnJvbSAnLi9DYW1lcmFTY3JlZW4nXG5pbXBvcnQgUGVybWlzc2lvbnNTY3JlZW4gZnJvbSAnLi9QZXJtaXNzaW9uc1NjcmVlbidcblxuLyoqXG4gKiBXZWJjYW1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgV2ViY2FtIGV4dGVuZHMgUGx1Z2luIHtcbiAgY29uc3RydWN0b3IgKGNvcmUsIG9wdHMpIHtcbiAgICBzdXBlcihjb3JlLCBvcHRzKVxuICAgIHRoaXMudXNlck1lZGlhID0gdHJ1ZVxuICAgIHRoaXMucHJvdG9jb2wgPSBsb2NhdGlvbi5wcm90b2NvbC5tYXRjaCgvaHR0cHMvaSkgPyAnaHR0cHMnIDogJ2h0dHAnXG4gICAgdGhpcy50eXBlID0gJ2FjcXVpcmVyJ1xuICAgIHRoaXMuaWQgPSAnV2ViY2FtJ1xuICAgIHRoaXMudGl0bGUgPSAnV2ViY2FtJ1xuICAgIHRoaXMuaWNvbiA9IFdlYmNhbUljb24oKVxuXG4gICAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICAgIGNvbnN0IGRlZmF1bHRPcHRpb25zID0ge1xuICAgICAgZW5hYmxlRmxhc2g6IHRydWVcbiAgICB9XG5cbiAgICB0aGlzLnBhcmFtcyA9IHtcbiAgICAgIHN3ZlVSTDogJ3dlYmNhbS5zd2YnLFxuICAgICAgd2lkdGg6IDQwMCxcbiAgICAgIGhlaWdodDogMzAwLFxuICAgICAgZGVzdF93aWR0aDogODAwLCAgICAgICAgIC8vIHNpemUgb2YgY2FwdHVyZWQgaW1hZ2VcbiAgICAgIGRlc3RfaGVpZ2h0OiA2MDAsICAgICAgICAvLyB0aGVzZSBkZWZhdWx0IHRvIHdpZHRoL2hlaWdodFxuICAgICAgaW1hZ2VfZm9ybWF0OiAnanBlZycsICAvLyBpbWFnZSBmb3JtYXQgKG1heSBiZSBqcGVnIG9yIHBuZylcbiAgICAgIGpwZWdfcXVhbGl0eTogOTAsICAgICAgLy8ganBlZyBpbWFnZSBxdWFsaXR5IGZyb20gMCAod29yc3QpIHRvIDEwMCAoYmVzdClcbiAgICAgIGVuYWJsZV9mbGFzaDogdHJ1ZSwgICAgLy8gZW5hYmxlIGZsYXNoIGZhbGxiYWNrLFxuICAgICAgZm9yY2VfZmxhc2g6IGZhbHNlLCAgICAvLyBmb3JjZSBmbGFzaCBtb2RlLFxuICAgICAgZmxpcF9ob3JpejogZmFsc2UsICAgICAvLyBmbGlwIGltYWdlIGhvcml6IChtaXJyb3IgbW9kZSlcbiAgICAgIGZwczogMzAsICAgICAgICAgICAgICAgLy8gY2FtZXJhIGZyYW1lcyBwZXIgc2Vjb25kXG4gICAgICB1cGxvYWRfbmFtZTogJ3dlYmNhbScsIC8vIG5hbWUgb2YgZmlsZSBpbiB1cGxvYWQgcG9zdCBkYXRhXG4gICAgICBjb25zdHJhaW50czogbnVsbCwgICAgIC8vIGN1c3RvbSB1c2VyIG1lZGlhIGNvbnN0cmFpbnRzLFxuICAgICAgZmxhc2hOb3REZXRlY3RlZFRleHQ6ICdFUlJPUjogTm8gQWRvYmUgRmxhc2ggUGxheWVyIGRldGVjdGVkLiAgV2ViY2FtLmpzIHJlbGllcyBvbiBGbGFzaCBmb3IgYnJvd3NlcnMgdGhhdCBkbyBub3Qgc3VwcG9ydCBnZXRVc2VyTWVkaWEgKGxpa2UgeW91cnMpLicsXG4gICAgICBub0ludGVyZmFjZUZvdW5kVGV4dDogJ05vIHN1cHBvcnRlZCB3ZWJjYW0gaW50ZXJmYWNlIGZvdW5kLicsXG4gICAgICB1bmZyZWV6ZV9zbmFwOiB0cnVlICAgIC8vIFdoZXRoZXIgdG8gdW5mcmVlemUgdGhlIGNhbWVyYSBhZnRlciBzbmFwIChkZWZhdWx0cyB0byB0cnVlKVxuICAgIH1cblxuICAgIC8vIG1lcmdlIGRlZmF1bHQgb3B0aW9ucyB3aXRoIHRoZSBvbmVzIHNldCBieSB1c2VyXG4gICAgdGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdHMpXG5cbiAgICB0aGlzLmluc3RhbGwgPSB0aGlzLmluc3RhbGwuYmluZCh0aGlzKVxuICAgIHRoaXMudXBkYXRlU3RhdGUgPSB0aGlzLnVwZGF0ZVN0YXRlLmJpbmQodGhpcylcblxuICAgIHRoaXMucmVuZGVyID0gdGhpcy5yZW5kZXIuYmluZCh0aGlzKVxuXG4gICAgLy8gQ2FtZXJhIGNvbnRyb2xzXG4gICAgdGhpcy5zdGFydCA9IHRoaXMuc3RhcnQuYmluZCh0aGlzKVxuICAgIHRoaXMuc3RvcCA9IHRoaXMuc3RvcC5iaW5kKHRoaXMpXG4gICAgdGhpcy50YWtlU25hcHNob3QgPSB0aGlzLnRha2VTbmFwc2hvdC5iaW5kKHRoaXMpXG5cbiAgICB0aGlzLndlYmNhbSA9IG5ldyBXZWJjYW1Qcm92aWRlcih0aGlzLm9wdHMsIHRoaXMucGFyYW1zKVxuICAgIHRoaXMud2ViY2FtQWN0aXZlID0gZmFsc2VcbiAgfVxuXG4gIHN0YXJ0ICgpIHtcbiAgICB0aGlzLndlYmNhbUFjdGl2ZSA9IHRydWVcblxuICAgIHRoaXMud2ViY2FtLnN0YXJ0KClcbiAgICAgIC50aGVuKChzdHJlYW0pID0+IHtcbiAgICAgICAgdGhpcy5zdHJlYW0gPSBzdHJlYW1cbiAgICAgICAgdGhpcy51cGRhdGVTdGF0ZSh7XG4gICAgICAgICAgLy8gdmlkZW9TdHJlYW06IHN0cmVhbSxcbiAgICAgICAgICBjYW1lcmFSZWFkeTogdHJ1ZVxuICAgICAgICB9KVxuICAgICAgfSlcbiAgICAgIC5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgIHRoaXMudXBkYXRlU3RhdGUoe1xuICAgICAgICAgIGNhbWVyYUVycm9yOiBlcnJcbiAgICAgICAgfSlcbiAgICAgIH0pXG4gIH1cblxuICBzdG9wICgpIHtcbiAgICB0aGlzLnN0cmVhbS5nZXRWaWRlb1RyYWNrcygpWzBdLnN0b3AoKVxuICAgIHRoaXMud2ViY2FtQWN0aXZlID0gZmFsc2VcbiAgICB0aGlzLnN0cmVhbSA9IG51bGxcbiAgICB0aGlzLnN0cmVhbVNyYyA9IG51bGxcbiAgfVxuXG4gIHRha2VTbmFwc2hvdCAoKSB7XG4gICAgY29uc3Qgb3B0cyA9IHtcbiAgICAgIG5hbWU6IGB3ZWJjYW0tJHtEYXRlLm5vdygpfS5qcGdgLFxuICAgICAgbWltZVR5cGU6ICdpbWFnZS9qcGVnJ1xuICAgIH1cblxuICAgIGNvbnN0IHZpZGVvID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLlVwcHlXZWJjYW0tdmlkZW8nKVxuXG4gICAgY29uc3QgaW1hZ2UgPSB0aGlzLndlYmNhbS5nZXRJbWFnZSh2aWRlbywgb3B0cylcblxuICAgIGNvbnN0IHRhZ0ZpbGUgPSB7XG4gICAgICBzb3VyY2U6IHRoaXMuaWQsXG4gICAgICBuYW1lOiBvcHRzLm5hbWUsXG4gICAgICBkYXRhOiBpbWFnZS5kYXRhLFxuICAgICAgdHlwZTogb3B0cy5taW1lVHlwZVxuICAgIH1cblxuICAgIHRoaXMuY29yZS5lbWl0dGVyLmVtaXQoJ2NvcmU6ZmlsZS1hZGQnLCB0YWdGaWxlKVxuICB9XG5cbiAgcmVuZGVyIChzdGF0ZSkge1xuICAgIGlmICghdGhpcy53ZWJjYW1BY3RpdmUpIHtcbiAgICAgIHRoaXMuc3RhcnQoKVxuICAgIH1cblxuICAgIGlmICghc3RhdGUud2ViY2FtLmNhbWVyYVJlYWR5ICYmICFzdGF0ZS53ZWJjYW0udXNlVGhlRmxhc2gpIHtcbiAgICAgIHJldHVybiBQZXJtaXNzaW9uc1NjcmVlbihzdGF0ZS53ZWJjYW0pXG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnN0cmVhbVNyYykge1xuICAgICAgdGhpcy5zdHJlYW1TcmMgPSB0aGlzLnN0cmVhbSA/IFVSTC5jcmVhdGVPYmplY3RVUkwodGhpcy5zdHJlYW0pIDogbnVsbFxuICAgIH1cblxuICAgIHJldHVybiBDYW1lcmFTY3JlZW4oZXh0ZW5kKHN0YXRlLndlYmNhbSwge1xuICAgICAgb25TbmFwc2hvdDogdGhpcy50YWtlU25hcHNob3QsXG4gICAgICBvbkZvY3VzOiB0aGlzLmZvY3VzLFxuICAgICAgb25TdG9wOiB0aGlzLnN0b3AsXG4gICAgICBnZXRTV0ZIVE1MOiB0aGlzLndlYmNhbS5nZXRTV0ZIVE1MLFxuICAgICAgc3JjOiB0aGlzLnN0cmVhbVNyY1xuICAgIH0pKVxuICB9XG5cbiAgZm9jdXMgKCkge1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5jb3JlLmVtaXR0ZXIuZW1pdCgnaW5mb3JtZXInLCAnU21pbGUhJywgJ2luZm8nLCAyMDAwKVxuICAgIH0sIDEwMDApXG4gIH1cblxuICBpbnN0YWxsICgpIHtcbiAgICB0aGlzLndlYmNhbS5pbml0KClcbiAgICB0aGlzLmNvcmUuc2V0U3RhdGUoe1xuICAgICAgd2ViY2FtOiB7XG4gICAgICAgIGNhbWVyYVJlYWR5OiBmYWxzZVxuICAgICAgfVxuICAgIH0pXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLm9wdHMudGFyZ2V0XG4gICAgY29uc3QgcGx1Z2luID0gdGhpc1xuICAgIHRoaXMudGFyZ2V0ID0gdGhpcy5tb3VudCh0YXJnZXQsIHBsdWdpbilcbiAgfVxuXG4gIC8qKlxuICAgKiBMaXR0bGUgc2hvcnRoYW5kIHRvIHVwZGF0ZSB0aGUgc3RhdGUgd2l0aCBteSBuZXcgc3RhdGVcbiAgICovXG4gIHVwZGF0ZVN0YXRlIChuZXdTdGF0ZSkge1xuICAgIGNvbnN0IHtzdGF0ZX0gPSB0aGlzLmNvcmVcbiAgICBjb25zdCB3ZWJjYW0gPSBPYmplY3QuYXNzaWduKHt9LCBzdGF0ZS53ZWJjYW0sIG5ld1N0YXRlKVxuXG4gICAgdGhpcy5jb3JlLnNldFN0YXRlKHt3ZWJjYW19KVxuICB9XG59XG4iLCIndXNlIHN0cmljdCdcblxuY29uc3QgX2dldE5hbWUgPSAoaWQpID0+IHtcbiAgcmV0dXJuIGlkLnNwbGl0KCctJykubWFwKChzKSA9PiBzLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgcy5zbGljZSgxKSkuam9pbignICcpXG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFByb3ZpZGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdHMpIHtcbiAgICB0aGlzLm9wdHMgPSBvcHRzXG4gICAgdGhpcy5wcm92aWRlciA9IG9wdHMucHJvdmlkZXJcbiAgICB0aGlzLmlkID0gdGhpcy5wcm92aWRlclxuICAgIHRoaXMubmFtZSA9IHRoaXMub3B0cy5uYW1lIHx8IF9nZXROYW1lKHRoaXMuaWQpXG4gIH1cblxuICBhdXRoICgpIHtcbiAgICByZXR1cm4gZmV0Y2goYCR7dGhpcy5vcHRzLmhvc3R9LyR7dGhpcy5wcm92aWRlcn0vYXV0aG9yaXplYCwge1xuICAgICAgbWV0aG9kOiAnZ2V0JyxcbiAgICAgIGNyZWRlbnRpYWxzOiAnaW5jbHVkZScsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdBY2NlcHQnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24uanNvbidcbiAgICAgIH1cbiAgICB9KVxuICAgIC50aGVuKChyZXMpID0+IHtcbiAgICAgIHJldHVybiByZXMuanNvbigpXG4gICAgICAudGhlbigocGF5bG9hZCkgPT4ge1xuICAgICAgICByZXR1cm4gcGF5bG9hZC5pc0F1dGhlbnRpY2F0ZWRcbiAgICAgIH0pXG4gICAgfSlcbiAgfVxuXG4gIGxpc3QgKGRpcmVjdG9yeSA9ICdyb290Jykge1xuICAgIHJldHVybiBmZXRjaChgJHt0aGlzLm9wdHMuaG9zdH0vJHt0aGlzLnByb3ZpZGVyfS9saXN0LyR7ZGlyZWN0b3J5fWAsIHtcbiAgICAgIG1ldGhvZDogJ2dldCcsXG4gICAgICBjcmVkZW50aWFsczogJ2luY2x1ZGUnLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICB9XG4gICAgfSlcbiAgICAudGhlbigocmVzKSA9PiByZXMuanNvbigpKVxuICB9XG5cbiAgbG9nb3V0IChyZWRpcmVjdCA9IGxvY2F0aW9uLmhyZWYpIHtcbiAgICByZXR1cm4gZmV0Y2goYCR7dGhpcy5vcHRzLmhvc3R9LyR7dGhpcy5wcm92aWRlcn0vbG9nb3V0P3JlZGlyZWN0PSR7cmVkaXJlY3R9YCwge1xuICAgICAgbWV0aG9kOiAnZ2V0JyxcbiAgICAgIGNyZWRlbnRpYWxzOiAnaW5jbHVkZScsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdBY2NlcHQnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgIH1cbiAgICB9KVxuICB9XG59XG4iLCIndXNlIHN0cmljdCdcblxuaW1wb3J0IGRhdGFVUkl0b0ZpbGUgZnJvbSAnLi4vdXRpbHMvZGF0YVVSSXRvRmlsZSdcblxuLyoqXG4gKiBXZWJjYW0gUGx1Z2luXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFdlYmNhbSB7XG4gIGNvbnN0cnVjdG9yIChvcHRzID0ge30sIHBhcmFtcyA9IHt9KSB7XG4gICAgdGhpcy5fdXNlck1lZGlhXG4gICAgdGhpcy51c2VyTWVkaWEgPSB0cnVlXG4gICAgdGhpcy5wcm90b2NvbCA9IGxvY2F0aW9uLnByb3RvY29sLm1hdGNoKC9odHRwcy9pKSA/ICdodHRwcycgOiAnaHR0cCdcblxuICAgIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgIGVuYWJsZUZsYXNoOiB0cnVlXG4gICAgfVxuXG4gICAgY29uc3QgZGVmYXVsdFBhcmFtcyA9IHtcbiAgICAgIHN3ZlVSTDogJ3dlYmNhbS5zd2YnLFxuICAgICAgd2lkdGg6IDQwMCxcbiAgICAgIGhlaWdodDogMzAwLFxuICAgICAgZGVzdF93aWR0aDogODAwLCAgICAgICAgIC8vIHNpemUgb2YgY2FwdHVyZWQgaW1hZ2VcbiAgICAgIGRlc3RfaGVpZ2h0OiA2MDAsICAgICAgICAvLyB0aGVzZSBkZWZhdWx0IHRvIHdpZHRoL2hlaWdodFxuICAgICAgaW1hZ2VfZm9ybWF0OiAnanBlZycsICAvLyBpbWFnZSBmb3JtYXQgKG1heSBiZSBqcGVnIG9yIHBuZylcbiAgICAgIGpwZWdfcXVhbGl0eTogOTAsICAgICAgLy8ganBlZyBpbWFnZSBxdWFsaXR5IGZyb20gMCAod29yc3QpIHRvIDEwMCAoYmVzdClcbiAgICAgIGVuYWJsZV9mbGFzaDogdHJ1ZSwgICAgLy8gZW5hYmxlIGZsYXNoIGZhbGxiYWNrLFxuICAgICAgZm9yY2VfZmxhc2g6IGZhbHNlLCAgICAvLyBmb3JjZSBmbGFzaCBtb2RlLFxuICAgICAgZmxpcF9ob3JpejogZmFsc2UsICAgICAvLyBmbGlwIGltYWdlIGhvcml6IChtaXJyb3IgbW9kZSlcbiAgICAgIGZwczogMzAsICAgICAgICAgICAgICAgLy8gY2FtZXJhIGZyYW1lcyBwZXIgc2Vjb25kXG4gICAgICB1cGxvYWRfbmFtZTogJ3dlYmNhbScsIC8vIG5hbWUgb2YgZmlsZSBpbiB1cGxvYWQgcG9zdCBkYXRhXG4gICAgICBjb25zdHJhaW50czogbnVsbCwgICAgIC8vIGN1c3RvbSB1c2VyIG1lZGlhIGNvbnN0cmFpbnRzLFxuICAgICAgZmxhc2hOb3REZXRlY3RlZFRleHQ6ICdFUlJPUjogTm8gQWRvYmUgRmxhc2ggUGxheWVyIGRldGVjdGVkLiAgV2ViY2FtLmpzIHJlbGllcyBvbiBGbGFzaCBmb3IgYnJvd3NlcnMgdGhhdCBkbyBub3Qgc3VwcG9ydCBnZXRVc2VyTWVkaWEgKGxpa2UgeW91cnMpLicsXG4gICAgICBub0ludGVyZmFjZUZvdW5kVGV4dDogJ05vIHN1cHBvcnRlZCB3ZWJjYW0gaW50ZXJmYWNlIGZvdW5kLicsXG4gICAgICB1bmZyZWV6ZV9zbmFwOiB0cnVlICAgIC8vIFdoZXRoZXIgdG8gdW5mcmVlemUgdGhlIGNhbWVyYSBhZnRlciBzbmFwIChkZWZhdWx0cyB0byB0cnVlKVxuICAgIH1cblxuICAgIHRoaXMucGFyYW1zID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdFBhcmFtcywgcGFyYW1zKVxuXG4gICAgLy8gbWVyZ2UgZGVmYXVsdCBvcHRpb25zIHdpdGggdGhlIG9uZXMgc2V0IGJ5IHVzZXJcbiAgICB0aGlzLm9wdHMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0cylcblxuICAgIC8vIENhbWVyYSBjb250cm9sc1xuICAgIHRoaXMuc3RhcnQgPSB0aGlzLnN0YXJ0LmJpbmQodGhpcylcbiAgICB0aGlzLmluaXQgPSB0aGlzLmluaXQuYmluZCh0aGlzKVxuICAgIHRoaXMuc3RvcCA9IHRoaXMuc3RvcC5iaW5kKHRoaXMpXG4gICAgLy8gdGhpcy5zdGFydFJlY29yZGluZyA9IHRoaXMuc3RhcnRSZWNvcmRpbmcuYmluZCh0aGlzKVxuICAgIC8vIHRoaXMuc3RvcFJlY29yZGluZyA9IHRoaXMuc3RvcFJlY29yZGluZy5iaW5kKHRoaXMpXG4gICAgdGhpcy50YWtlU25hcHNob3QgPSB0aGlzLnRha2VTbmFwc2hvdC5iaW5kKHRoaXMpXG4gICAgdGhpcy5nZXRJbWFnZSA9IHRoaXMuZ2V0SW1hZ2UuYmluZCh0aGlzKVxuICAgIHRoaXMuZ2V0U1dGSFRNTCA9IHRoaXMuZ2V0U1dGSFRNTC5iaW5kKHRoaXMpXG4gICAgdGhpcy5kZXRlY3RGbGFzaCA9IHRoaXMuZGV0ZWN0Rmxhc2guYmluZCh0aGlzKVxuICAgIHRoaXMuZ2V0VXNlck1lZGlhID0gdGhpcy5nZXRVc2VyTWVkaWEuYmluZCh0aGlzKVxuICAgIHRoaXMuZ2V0TWVkaWFEZXZpY2VzID0gdGhpcy5nZXRNZWRpYURldmljZXMuYmluZCh0aGlzKVxuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBmb3IgZ2V0VXNlck1lZGlhIHN1cHBvcnRcbiAgICovXG4gIGluaXQgKCkge1xuICAgIC8vIGluaXRpYWxpemUsIGNoZWNrIGZvciBnZXRVc2VyTWVkaWEgc3VwcG9ydFxuICAgIHRoaXMubWVkaWFEZXZpY2VzID0gdGhpcy5nZXRNZWRpYURldmljZXMoKVxuXG4gICAgdGhpcy51c2VyTWVkaWEgPSB0aGlzLmdldFVzZXJNZWRpYSh0aGlzLm1lZGlhRGV2aWNlcylcblxuICAgIC8vIE1ha2Ugc3VyZSBtZWRpYSBzdHJlYW0gaXMgY2xvc2VkIHdoZW4gbmF2aWdhdGluZyBhd2F5IGZyb20gcGFnZVxuICAgIGlmICh0aGlzLnVzZXJNZWRpYSkge1xuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2JlZm9yZXVubG9hZCcsIChldmVudCkgPT4ge1xuICAgICAgICB0aGlzLnJlc2V0KClcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG1lZGlhRGV2aWNlczogdGhpcy5tZWRpYURldmljZXMsXG4gICAgICB1c2VyTWVkaWE6IHRoaXMudXNlck1lZGlhXG4gICAgfVxuICB9XG5cbiAgLy8gU2V0dXAgZ2V0VXNlck1lZGlhLCB3aXRoIHBvbHlmaWxsIGZvciBvbGRlciBicm93c2Vyc1xuICAvLyBBZGFwdGVkIGZyb206IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9NZWRpYURldmljZXMvZ2V0VXNlck1lZGlhXG4gIGdldE1lZGlhRGV2aWNlcyAoKSB7XG4gICAgcmV0dXJuIChuYXZpZ2F0b3IubWVkaWFEZXZpY2VzICYmIG5hdmlnYXRvci5tZWRpYURldmljZXMuZ2V0VXNlck1lZGlhKVxuICAgICAgPyBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzIDogKChuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEpID8ge1xuICAgICAgICBnZXRVc2VyTWVkaWE6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIChuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8XG4gICAgICAgICAgICBuYXZpZ2F0b3Iud2Via2l0R2V0VXNlck1lZGlhKS5jYWxsKG5hdmlnYXRvciwgb3B0cywgcmVzb2x2ZSwgcmVqZWN0KVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgIH0gOiBudWxsKVxuICB9XG5cbiAgZ2V0VXNlck1lZGlhIChtZWRpYURldmljZXMpIHtcbiAgICBjb25zdCB1c2VyTWVkaWEgPSB0cnVlXG4gICAgLy8gT2xkZXIgdmVyc2lvbnMgb2YgZmlyZWZveCAoPCAyMSkgYXBwYXJlbnRseSBjbGFpbSBzdXBwb3J0IGJ1dCB1c2VyIG1lZGlhIGRvZXMgbm90IGFjdHVhbGx5IHdvcmtcbiAgICBpZiAobmF2aWdhdG9yLnVzZXJBZ2VudC5tYXRjaCgvRmlyZWZveFxcRCsoXFxkKykvKSkge1xuICAgICAgaWYgKHBhcnNlSW50KFJlZ0V4cC4kMSwgMTApIDwgMjEpIHtcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgIH1cbiAgICB9XG5cbiAgICB3aW5kb3cuVVJMID0gd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMIHx8IHdpbmRvdy5tb3pVUkwgfHwgd2luZG93Lm1zVVJMXG4gICAgcmV0dXJuIHVzZXJNZWRpYSAmJiAhIW1lZGlhRGV2aWNlcyAmJiAhIXdpbmRvdy5VUkxcbiAgfVxuXG4gIHN0YXJ0ICgpIHtcbiAgICB0aGlzLnVzZXJNZWRpYSA9IHRoaXMuX3VzZXJNZWRpYSA9PT0gdW5kZWZpbmVkID8gdGhpcy51c2VyTWVkaWEgOiB0aGlzLl91c2VyTWVkaWFcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHRoaXMudXNlck1lZGlhKSB7XG4gICAgICAgIC8vIGFzayB1c2VyIGZvciBhY2Nlc3MgdG8gdGhlaXIgY2FtZXJhXG4gICAgICAgIHRoaXMubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSh7XG4gICAgICAgICAgYXVkaW86IGZhbHNlLFxuICAgICAgICAgIHZpZGVvOiB0cnVlXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKChzdHJlYW0pID0+IHtcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZShzdHJlYW0pXG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlcnIpXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXRlY3RzIGlmIGJyb3dzZXIgc3VwcG9ydHMgZmxhc2hcbiAgICogQ29kZSBzbmlwcGV0IGJvcnJvd2VkIGZyb206IGh0dHBzOi8vZ2l0aHViLmNvbS9zd2ZvYmplY3Qvc3dmb2JqZWN0XG4gICAqXG4gICAqIEByZXR1cm4ge2Jvb2x9IGZsYXNoIHN1cHBvcnRlZFxuICAgKi9cbiAgZGV0ZWN0Rmxhc2ggKCkge1xuICAgIGNvbnN0IFNIT0NLV0FWRV9GTEFTSCA9ICdTaG9ja3dhdmUgRmxhc2gnXG4gICAgY29uc3QgU0hPQ0tXQVZFX0ZMQVNIX0FYID0gJ1Nob2Nrd2F2ZUZsYXNoLlNob2Nrd2F2ZUZsYXNoJ1xuICAgIGNvbnN0IEZMQVNIX01JTUVfVFlQRSA9ICdhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaCdcbiAgICBjb25zdCB3aW4gPSB3aW5kb3dcbiAgICBjb25zdCBuYXYgPSBuYXZpZ2F0b3JcbiAgICBsZXQgaGFzRmxhc2ggPSBmYWxzZVxuXG4gICAgaWYgKHR5cGVvZiBuYXYucGx1Z2lucyAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG5hdi5wbHVnaW5zW1NIT0NLV0FWRV9GTEFTSF0gPT09ICdvYmplY3QnKSB7XG4gICAgICB2YXIgZGVzYyA9IG5hdi5wbHVnaW5zW1NIT0NLV0FWRV9GTEFTSF0uZGVzY3JpcHRpb25cbiAgICAgIGlmIChkZXNjICYmICh0eXBlb2YgbmF2Lm1pbWVUeXBlcyAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2Lm1pbWVUeXBlc1tGTEFTSF9NSU1FX1RZUEVdICYmIG5hdi5taW1lVHlwZXNbRkxBU0hfTUlNRV9UWVBFXS5lbmFibGVkUGx1Z2luKSkge1xuICAgICAgICBoYXNGbGFzaCA9IHRydWVcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB3aW4uQWN0aXZlWE9iamVjdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciBheCA9IG5ldyB3aW4uQWN0aXZlWE9iamVjdChTSE9DS1dBVkVfRkxBU0hfQVgpXG4gICAgICAgIGlmIChheCkge1xuICAgICAgICAgIHZhciB2ZXIgPSBheC5HZXRWYXJpYWJsZSgnJHZlcnNpb24nKVxuICAgICAgICAgIGlmICh2ZXIpIGhhc0ZsYXNoID0gdHJ1ZVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7fVxuICAgIH1cblxuICAgIHJldHVybiBoYXNGbGFzaFxuICB9XG5cbiAgcmVzZXQgKCkge1xuICAgIC8vIHNodXRkb3duIGNhbWVyYSwgcmVzZXQgdG8gcG90ZW50aWFsbHkgYXR0YWNoIGFnYWluXG4gICAgaWYgKHRoaXMucHJldmlld19hY3RpdmUpIHRoaXMudW5mcmVlemUoKVxuXG4gICAgaWYgKHRoaXMudXNlck1lZGlhKSB7XG4gICAgICBpZiAodGhpcy5zdHJlYW0pIHtcbiAgICAgICAgaWYgKHRoaXMuc3RyZWFtLmdldFZpZGVvVHJhY2tzKSB7XG4gICAgICAgICAgLy8gZ2V0IHZpZGVvIHRyYWNrIHRvIGNhbGwgc3RvcCBvbiBpdFxuICAgICAgICAgIHZhciB0cmFja3MgPSB0aGlzLnN0cmVhbS5nZXRWaWRlb1RyYWNrcygpXG4gICAgICAgICAgaWYgKHRyYWNrcyAmJiB0cmFja3NbMF0gJiYgdHJhY2tzWzBdLnN0b3ApIHRyYWNrc1swXS5zdG9wKClcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnN0cmVhbS5zdG9wKSB7XG4gICAgICAgICAgLy8gZGVwcmVjYXRlZCwgbWF5IGJlIHJlbW92ZWQgaW4gZnV0dXJlXG4gICAgICAgICAgdGhpcy5zdHJlYW0uc3RvcCgpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLnN0cmVhbVxuICAgICAgZGVsZXRlIHRoaXMudmlkZW9cbiAgICB9XG5cbiAgICBpZiAodGhpcy51c2VyTWVkaWEgIT09IHRydWUpIHtcbiAgICAgIC8vIGNhbGwgZm9yIHR1cm4gb2ZmIGNhbWVyYSBpbiBmbGFzaFxuICAgICAgdGhpcy5nZXRNb3ZpZSgpLl9yZWxlYXNlQ2FtZXJhKClcbiAgICB9XG4gIH1cblxuICBnZXRTV0ZIVE1MICgpIHtcbiAgICAvLyBSZXR1cm4gSFRNTCBmb3IgZW1iZWRkaW5nIGZsYXNoIGJhc2VkIHdlYmNhbSBjYXB0dXJlIG1vdmllXG4gICAgdmFyIHN3ZlVSTCA9IHRoaXMucGFyYW1zLnN3ZlVSTFxuXG4gICAgLy8gbWFrZSBzdXJlIHdlIGFyZW4ndCBydW5uaW5nIGxvY2FsbHkgKGZsYXNoIGRvZXNuJ3Qgd29yaylcbiAgICBpZiAobG9jYXRpb24ucHJvdG9jb2wubWF0Y2goL2ZpbGUvKSkge1xuICAgICAgcmV0dXJuICc8aDMgc3R5bGU9XCJjb2xvcjpyZWRcIj5FUlJPUjogdGhlIFdlYmNhbS5qcyBGbGFzaCBmYWxsYmFjayBkb2VzIG5vdCB3b3JrIGZyb20gbG9jYWwgZGlzay4gIFBsZWFzZSBydW4gaXQgZnJvbSBhIHdlYiBzZXJ2ZXIuPC9oMz4nXG4gICAgfVxuXG4gICAgLy8gbWFrZSBzdXJlIHdlIGhhdmUgZmxhc2hcbiAgICBpZiAoIXRoaXMuZGV0ZWN0Rmxhc2goKSkge1xuICAgICAgcmV0dXJuICc8aDMgc3R5bGU9XCJjb2xvcjpyZWRcIj5ObyBmbGFzaDwvaDM+J1xuICAgIH1cblxuICAgIC8vIHNldCBkZWZhdWx0IHN3ZlVSTCBpZiBub3QgZXhwbGljaXRseSBzZXRcbiAgICBpZiAoIXN3ZlVSTCkge1xuICAgICAgLy8gZmluZCBvdXIgc2NyaXB0IHRhZywgYW5kIHVzZSB0aGF0IGJhc2UgVVJMXG4gICAgICB2YXIgYmFzZV91cmwgPSAnJ1xuICAgICAgdmFyIHNjcHRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpXG4gICAgICBmb3IgKHZhciBpZHggPSAwLCBsZW4gPSBzY3B0cy5sZW5ndGg7IGlkeCA8IGxlbjsgaWR4KyspIHtcbiAgICAgICAgdmFyIHNyYyA9IHNjcHRzW2lkeF0uZ2V0QXR0cmlidXRlKCdzcmMnKVxuICAgICAgICBpZiAoc3JjICYmIHNyYy5tYXRjaCgvXFwvd2ViY2FtKFxcLm1pbik/XFwuanMvKSkge1xuICAgICAgICAgIGJhc2VfdXJsID0gc3JjLnJlcGxhY2UoL1xcL3dlYmNhbShcXC5taW4pP1xcLmpzLiokLywgJycpXG4gICAgICAgICAgaWR4ID0gbGVuXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChiYXNlX3VybCkgc3dmVVJMID0gYmFzZV91cmwgKyAnL3dlYmNhbS5zd2YnXG4gICAgICBlbHNlIHN3ZlVSTCA9ICd3ZWJjYW0uc3dmJ1xuICAgIH1cblxuICAgIC8vIC8vIGlmIHRoaXMgaXMgdGhlIHVzZXIncyBmaXJzdCB2aXNpdCwgc2V0IGZsYXNodmFyIHNvIGZsYXNoIHByaXZhY3kgc2V0dGluZ3MgcGFuZWwgaXMgc2hvd24gZmlyc3RcbiAgICAvLyBpZiAod2luZG93LmxvY2FsU3RvcmFnZSAmJiAhbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3Zpc2l0ZWQnKSkge1xuICAgIC8vICAgLy8gdGhpcy5wYXJhbXMubmV3X3VzZXIgPSAxXG4gICAgLy8gICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndmlzaXRlZCcsIDEpXG4gICAgLy8gfVxuICAgIC8vIHRoaXMucGFyYW1zLm5ld191c2VyID0gMVxuICAgIC8vIGNvbnN0cnVjdCBmbGFzaHZhcnMgc3RyaW5nXG4gICAgdmFyIGZsYXNodmFycyA9ICcnXG4gICAgZm9yICh2YXIga2V5IGluIHRoaXMucGFyYW1zKSB7XG4gICAgICBpZiAoZmxhc2h2YXJzKSBmbGFzaHZhcnMgKz0gJyYnXG4gICAgICBmbGFzaHZhcnMgKz0ga2V5ICsgJz0nICsgZXNjYXBlKHRoaXMucGFyYW1zW2tleV0pXG4gICAgfVxuXG4gICAgLy8gY29uc3RydWN0IG9iamVjdC9lbWJlZCB0YWdcblxuICAgIHJldHVybiBgPG9iamVjdCBjbGFzc2lkPVwiY2xzaWQ6ZDI3Y2RiNmUtYWU2ZC0xMWNmLTk2YjgtNDQ0NTUzNTQwMDAwXCIgdHlwZT1cImFwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoXCIgY29kZWJhc2U9XCIke3RoaXMucHJvdG9jb2x9Oi8vZG93bmxvYWQubWFjcm9tZWRpYS5jb20vcHViL3Nob2Nrd2F2ZS9jYWJzL2ZsYXNoL3N3Zmxhc2guY2FiI3ZlcnNpb249OSwwLDAsMFwiIHdpZHRoPVwiJHt0aGlzLnBhcmFtcy53aWR0aH1cIiBoZWlnaHQ9XCIke3RoaXMucGFyYW1zLmhlaWdodH1cIiBpZD1cIndlYmNhbV9tb3ZpZV9vYmpcIiBhbGlnbj1cIm1pZGRsZVwiPjxwYXJhbSBuYW1lPVwid21vZGVcIiB2YWx1ZT1cIm9wYXF1ZVwiIC8+PHBhcmFtIG5hbWU9XCJhbGxvd1NjcmlwdEFjY2Vzc1wiIHZhbHVlPVwiYWx3YXlzXCIgLz48cGFyYW0gbmFtZT1cImFsbG93RnVsbFNjcmVlblwiIHZhbHVlPVwiZmFsc2VcIiAvPjxwYXJhbSBuYW1lPVwibW92aWVcIiB2YWx1ZT1cIiR7c3dmVVJMfVwiIC8+PHBhcmFtIG5hbWU9XCJsb29wXCIgdmFsdWU9XCJmYWxzZVwiIC8+PHBhcmFtIG5hbWU9XCJtZW51XCIgdmFsdWU9XCJmYWxzZVwiIC8+PHBhcmFtIG5hbWU9XCJxdWFsaXR5XCIgdmFsdWU9XCJiZXN0XCIgLz48cGFyYW0gbmFtZT1cImJnY29sb3JcIiB2YWx1ZT1cIiNmZmZmZmZcIiAvPjxwYXJhbSBuYW1lPVwiZmxhc2h2YXJzXCIgdmFsdWU9XCIke2ZsYXNodmFyc31cIi8+PGVtYmVkIGlkPVwid2ViY2FtX21vdmllX2VtYmVkXCIgc3JjPVwiJHtzd2ZVUkx9XCIgd21vZGU9XCJvcGFxdWVcIiBsb29wPVwiZmFsc2VcIiBtZW51PVwiZmFsc2VcIiBxdWFsaXR5PVwiYmVzdFwiIGJnY29sb3I9XCIjZmZmZmZmXCIgd2lkdGg9XCIke3RoaXMucGFyYW1zLndpZHRofVwiIGhlaWdodD1cIiR7dGhpcy5wYXJhbXMuaGVpZ2h0fVwiIG5hbWU9XCJ3ZWJjYW1fbW92aWVfZW1iZWRcIiBhbGlnbj1cIm1pZGRsZVwiIGFsbG93U2NyaXB0QWNjZXNzPVwiYWx3YXlzXCIgYWxsb3dGdWxsU2NyZWVuPVwiZmFsc2VcIiB0eXBlPVwiYXBwbGljYXRpb24veC1zaG9ja3dhdmUtZmxhc2hcIiBwbHVnaW5zcGFnZT1cImh0dHA6Ly93d3cubWFjcm9tZWRpYS5jb20vZ28vZ2V0Zmxhc2hwbGF5ZXJcIiBmbGFzaHZhcnM9XCIke2ZsYXNodmFyc31cIj48L2VtYmVkPjwvb2JqZWN0PmBcbiAgfVxuXG4gIGdldE1vdmllICgpIHtcbiAgICAvLyBnZXQgcmVmZXJlbmNlIHRvIG1vdmllIG9iamVjdC9lbWJlZCBpbiBET01cbiAgICB2YXIgbW92aWUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2ViY2FtX21vdmllX29iaicpXG4gICAgaWYgKCFtb3ZpZSB8fCAhbW92aWUuX3NuYXApIG1vdmllID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3dlYmNhbV9tb3ZpZV9lbWJlZCcpXG4gICAgaWYgKCFtb3ZpZSkgY29uc29sZS5sb2coJ2dldE1vdmllIGVycm9yJylcbiAgICByZXR1cm4gbW92aWVcbiAgfVxuXG4gIC8qKlxuICAgKiBTdG9wcyB0aGUgd2ViY2FtIGNhcHR1cmUgYW5kIHZpZGVvIHBsYXliYWNrLlxuICAgKi9cbiAgc3RvcCAoKSB7XG4gICAgbGV0IHsgdmlkZW8sIHZpZGVvU3RyZWFtIH0gPSB0aGlzXG5cbiAgICB0aGlzLnVwZGF0ZVN0YXRlKHtcbiAgICAgIGNhbWVyYVJlYWR5OiBmYWxzZVxuICAgIH0pXG5cbiAgICBpZiAodmlkZW9TdHJlYW0pIHtcbiAgICAgIGlmICh2aWRlb1N0cmVhbS5zdG9wKSB7XG4gICAgICAgIHZpZGVvU3RyZWFtLnN0b3AoKVxuICAgICAgfSBlbHNlIGlmICh2aWRlb1N0cmVhbS5tc1N0b3ApIHtcbiAgICAgICAgdmlkZW9TdHJlYW0ubXNTdG9wKClcbiAgICAgIH1cblxuICAgICAgdmlkZW9TdHJlYW0ub25lbmRlZCA9IG51bGxcbiAgICAgIHZpZGVvU3RyZWFtID0gbnVsbFxuICAgIH1cblxuICAgIGlmICh2aWRlbykge1xuICAgICAgdmlkZW8ub25lcnJvciA9IG51bGxcbiAgICAgIHZpZGVvLnBhdXNlKClcblxuICAgICAgaWYgKHZpZGVvLm1velNyY09iamVjdCkge1xuICAgICAgICB2aWRlby5tb3pTcmNPYmplY3QgPSBudWxsXG4gICAgICB9XG5cbiAgICAgIHZpZGVvLnNyYyA9ICcnXG4gICAgfVxuXG4gICAgdGhpcy52aWRlbyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5VcHB5V2ViY2FtLXZpZGVvJylcbiAgICB0aGlzLmNhbnZhcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5VcHB5V2ViY2FtLWNhbnZhcycpXG4gIH1cblxuICBmbGFzaE5vdGlmeSAodHlwZSwgbXNnKSB7XG4gICAgLy8gcmVjZWl2ZSBub3RpZmljYXRpb24gZnJvbSBmbGFzaCBhYm91dCBldmVudFxuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgY2FzZSAnZmxhc2hMb2FkQ29tcGxldGUnOlxuICAgICAgICAvLyBtb3ZpZSBsb2FkZWQgc3VjY2Vzc2Z1bGx5XG4gICAgICAgIGJyZWFrXG5cbiAgICAgIGNhc2UgJ2NhbWVyYUxpdmUnOlxuICAgICAgICAvLyBjYW1lcmEgaXMgbGl2ZSBhbmQgcmVhZHkgdG8gc25hcFxuICAgICAgICB0aGlzLmxpdmUgPSB0cnVlXG4gICAgICAgIGJyZWFrXG5cbiAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgLy8gRmxhc2ggZXJyb3JcbiAgICAgICAgY29uc29sZS5sb2coJ1RoZXJlIHdhcyBhIGZsYXNoIGVycm9yJywgbXNnKVxuICAgICAgICBicmVha1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICAvLyBjYXRjaC1hbGwgZXZlbnQsIGp1c3QgaW4gY2FzZVxuICAgICAgICBjb25zb2xlLmxvZygnd2ViY2FtIGZsYXNoX25vdGlmeTogJyArIHR5cGUgKyAnOiAnICsgbXNnKVxuICAgICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIGNvbmZpZ3VyZSAocGFuZWwpIHtcbiAgICAvLyBvcGVuIGZsYXNoIGNvbmZpZ3VyYXRpb24gcGFuZWwgLS0gc3BlY2lmeSB0YWIgbmFtZTpcbiAgICAvLyAnY2FtZXJhJywgJ3ByaXZhY3knLCAnZGVmYXVsdCcsICdsb2NhbFN0b3JhZ2UnLCAnbWljcm9waG9uZScsICdzZXR0aW5nc01hbmFnZXInXG4gICAgaWYgKCFwYW5lbCkgcGFuZWwgPSAnY2FtZXJhJ1xuICAgIHRoaXMuZ2V0TW92aWUoKS5fY29uZmlndXJlKHBhbmVsKVxuICB9XG5cbiAgLyoqXG4gICAqIFRha2VzIGEgc25hcHNob3QgYW5kIGRpc3BsYXlzIGl0IGluIGEgY2FudmFzLlxuICAgKi9cbiAgZ2V0SW1hZ2UgKHZpZGVvLCBvcHRzKSB7XG4gICAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpXG4gICAgY2FudmFzLndpZHRoID0gdmlkZW8udmlkZW9XaWR0aFxuICAgIGNhbnZhcy5oZWlnaHQgPSB2aWRlby52aWRlb0hlaWdodFxuICAgIGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpLmRyYXdJbWFnZSh2aWRlbywgMCwgMClcblxuICAgIHZhciBkYXRhVXJsID0gY2FudmFzLnRvRGF0YVVSTChvcHRzLm1pbWVUeXBlKVxuXG4gICAgdmFyIGZpbGUgPSBkYXRhVVJJdG9GaWxlKGRhdGFVcmwsIHtcbiAgICAgIG5hbWU6IG9wdHMubmFtZVxuICAgIH0pXG5cbiAgICByZXR1cm4ge1xuICAgICAgZGF0YVVybDogZGF0YVVybCxcbiAgICAgIGRhdGE6IGZpbGUsXG4gICAgICB0eXBlOiBvcHRzLm1pbWVUeXBlXG4gICAgfVxuICB9XG5cbiAgdGFrZVNuYXBzaG90ICh2aWRlbywgY2FudmFzKSB7XG4gICAgY29uc3Qgb3B0cyA9IHtcbiAgICAgIG5hbWU6IGB3ZWJjYW0tJHtEYXRlLm5vdygpfS5qcGdgLFxuICAgICAgbWltZVR5cGU6ICdpbWFnZS9qcGVnJ1xuICAgIH1cblxuICAgIGNvbnN0IGltYWdlID0gdGhpcy5nZXRJbWFnZSh2aWRlbywgY2FudmFzLCBvcHRzKVxuXG4gICAgY29uc3QgdGFnRmlsZSA9IHtcbiAgICAgIHNvdXJjZTogdGhpcy5pZCxcbiAgICAgIG5hbWU6IG9wdHMubmFtZSxcbiAgICAgIGRhdGE6IGltYWdlLmRhdGEsXG4gICAgICB0eXBlOiBvcHRzLnR5cGVcbiAgICB9XG5cbiAgICByZXR1cm4gdGFnRmlsZVxuICB9XG59XG4iLCJmdW5jdGlvbiBkYXRhVVJJdG9CbG9iIChkYXRhVVJJLCBvcHRzLCB0b0ZpbGUpIHtcbiAgLy8gZ2V0IHRoZSBiYXNlNjQgZGF0YVxuICB2YXIgZGF0YSA9IGRhdGFVUkkuc3BsaXQoJywnKVsxXVxuXG4gIC8vIHVzZXIgbWF5IHByb3ZpZGUgbWltZSB0eXBlLCBpZiBub3QgZ2V0IGl0IGZyb20gZGF0YSBVUklcbiAgdmFyIG1pbWVUeXBlID0gb3B0cy5taW1lVHlwZSB8fCBkYXRhVVJJLnNwbGl0KCcsJylbMF0uc3BsaXQoJzonKVsxXS5zcGxpdCgnOycpWzBdXG5cbiAgLy8gZGVmYXVsdCB0byBwbGFpbi90ZXh0IGlmIGRhdGEgVVJJIGhhcyBubyBtaW1lVHlwZVxuICBpZiAobWltZVR5cGUgPT0gbnVsbCkge1xuICAgIG1pbWVUeXBlID0gJ3BsYWluL3RleHQnXG4gIH1cblxuICB2YXIgYmluYXJ5ID0gYXRvYihkYXRhKVxuICB2YXIgYXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGJpbmFyeS5sZW5ndGg7IGkrKykge1xuICAgIGFycmF5LnB1c2goYmluYXJ5LmNoYXJDb2RlQXQoaSkpXG4gIH1cblxuICAvLyBDb252ZXJ0IHRvIGEgRmlsZT9cbiAgaWYgKHRvRmlsZSkge1xuICAgIHJldHVybiBuZXcgRmlsZShbbmV3IFVpbnQ4QXJyYXkoYXJyYXkpXSwgb3B0cy5uYW1lIHx8ICcnLCB7dHlwZTogbWltZVR5cGV9KVxuICB9XG5cbiAgcmV0dXJuIG5ldyBCbG9iKFtuZXcgVWludDhBcnJheShhcnJheSldLCB7dHlwZTogbWltZVR5cGV9KVxufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoZGF0YVVSSSwgb3B0cykge1xuICByZXR1cm4gZGF0YVVSSXRvQmxvYihkYXRhVVJJLCBvcHRzLCB0cnVlKVxufVxuIiwiIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsImltcG9ydCBVcHB5IGZyb20gJy4uLy4uLy4uLy4uL3NyYy9jb3JlJ1xuaW1wb3J0IERhc2hib2FyZCBmcm9tICcuLi8uLi8uLi8uLi9zcmMvcGx1Z2lucy9EYXNoYm9hcmQnXG5pbXBvcnQgR29vZ2xlRHJpdmUgZnJvbSAnLi4vLi4vLi4vLi4vc3JjL3BsdWdpbnMvR29vZ2xlRHJpdmUnXG5pbXBvcnQgV2ViY2FtIGZyb20gJy4uLy4uLy4uLy4uL3NyYy9wbHVnaW5zL1dlYmNhbSdcbmltcG9ydCBUdXMxMCBmcm9tICcuLi8uLi8uLi8uLi9zcmMvcGx1Z2lucy9UdXMxMCdcbmltcG9ydCBNZXRhRGF0YSBmcm9tICcuLi8uLi8uLi8uLi9zcmMvcGx1Z2lucy9NZXRhRGF0YSdcbmltcG9ydCBJbmZvcm1lciBmcm9tICcuLi8uLi8uLi8uLi9zcmMvcGx1Z2lucy9JbmZvcm1lcidcblxuaW1wb3J0IHsgVVBQWV9TRVJWRVIgfSBmcm9tICcuLi9lbnYnXG5cbmNvbnN0IFBST1RPQ09MID0gbG9jYXRpb24ucHJvdG9jb2wgPT09ICdodHRwczonID8gJ2h0dHBzJyA6ICdodHRwJ1xuY29uc3QgVFVTX0VORFBPSU5UID0gUFJPVE9DT0wgKyAnOi8vbWFzdGVyLnR1cy5pby9maWxlcy8nXG5cbmZ1bmN0aW9uIHVwcHlJbml0ICgpIHtcbiAgY29uc3Qgb3B0cyA9IHdpbmRvdy51cHB5T3B0aW9uc1xuICBjb25zdCBkYXNoYm9hcmRFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5VcHB5RGFzaGJvYXJkJylcbiAgaWYgKGRhc2hib2FyZEVsKSB7XG4gICAgY29uc3QgZGFzaGJvYXJkRWxQYXJlbnQgPSBkYXNoYm9hcmRFbC5wYXJlbnROb2RlXG4gICAgZGFzaGJvYXJkRWxQYXJlbnQucmVtb3ZlQ2hpbGQoZGFzaGJvYXJkRWwpXG4gIH1cblxuICBjb25zdCB1cHB5ID0gVXBweSh7ZGVidWc6IHRydWUsIGF1dG9Qcm9jZWVkOiBvcHRzLmF1dG9Qcm9jZWVkfSlcbiAgdXBweS51c2UoRGFzaGJvYXJkLCB7XG4gICAgdHJpZ2dlcjogJy5VcHB5TW9kYWxPcGVuZXJCdG4nLFxuICAgIGlubGluZTogb3B0cy5EYXNoYm9hcmRJbmxpbmUsXG4gICAgdGFyZ2V0OiBvcHRzLkRhc2hib2FyZElubGluZSA/ICcuRGFzaGJvYXJkQ29udGFpbmVyJyA6ICdib2R5J1xuICB9KVxuXG4gIGlmIChvcHRzLkdvb2dsZURyaXZlKSB7XG4gICAgdXBweS51c2UoR29vZ2xlRHJpdmUsIHt0YXJnZXQ6IERhc2hib2FyZCwgaG9zdDogVVBQWV9TRVJWRVJ9KVxuICB9XG5cbiAgaWYgKG9wdHMuV2ViY2FtKSB7XG4gICAgdXBweS51c2UoV2ViY2FtLCB7dGFyZ2V0OiBEYXNoYm9hcmR9KVxuICB9XG5cbiAgdXBweS51c2UoVHVzMTAsIHtlbmRwb2ludDogVFVTX0VORFBPSU5ULCByZXN1bWU6IHRydWV9KVxuICB1cHB5LnVzZShJbmZvcm1lciwge3RhcmdldDogRGFzaGJvYXJkfSlcbiAgdXBweS51c2UoTWV0YURhdGEsIHtcbiAgICBmaWVsZHM6IFtcbiAgICAgIHsgaWQ6ICdyZXNpemVUbycsIG5hbWU6ICdSZXNpemUgdG8nLCB2YWx1ZTogMTIwMCwgcGxhY2Vob2xkZXI6ICdzcGVjaWZ5IGZ1dHVyZSBpbWFnZSBzaXplJyB9LFxuICAgICAgeyBpZDogJ2Rlc2NyaXB0aW9uJywgbmFtZTogJ0Rlc2NyaXB0aW9uJywgdmFsdWU6ICdub25lJywgcGxhY2Vob2xkZXI6ICdkZXNjcmliZSB3aGF0IHRoZSBmaWxlIGlzIGZvcicgfVxuICAgIF1cbiAgfSlcbiAgdXBweS5ydW4oKVxuXG4gIHVwcHkub24oJ2NvcmU6c3VjY2VzcycsIChmaWxlQ291bnQpID0+IHtcbiAgICBjb25zb2xlLmxvZygnWW8sIHVwbG9hZGVkOiAnICsgZmlsZUNvdW50KVxuICB9KVxufVxuXG51cHB5SW5pdCgpXG53aW5kb3cudXBweUluaXQgPSB1cHB5SW5pdFxuIiwibGV0IHVwcHlTZXJ2ZXJFbmRwb2ludCA9ICdodHRwOi8vbG9jYWxob3N0OjMwMjAnXG5cbmlmIChsb2NhdGlvbi5ob3N0bmFtZSA9PT0gJ3VwcHkuaW8nKSB7XG4gIHVwcHlTZXJ2ZXJFbmRwb2ludCA9ICcvL3NlcnZlci51cHB5LmlvJ1xufVxuXG4vLyB1cHB5U2VydmVyRW5kcG9pbnQgPSAnaHR0cDovL3NlcnZlci51cHB5LmlvOjMwMjAnXG5leHBvcnQgY29uc3QgVVBQWV9TRVJWRVIgPSB1cHB5U2VydmVyRW5kcG9pbnRcbiJdfQ==
