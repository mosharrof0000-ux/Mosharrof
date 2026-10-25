/* Guarded compatibility shim for older Android System WebView engines. */
if (typeof Array.prototype.at !== "function") {
  Object.defineProperty(Array.prototype, "at", {
    configurable: true,
    writable: true,
    value: function (index) {
      var length = this.length >>> 0;
      var relativeIndex = Number(index);
      if (relativeIndex !== relativeIndex) relativeIndex = 0;
      if (relativeIndex < 0) relativeIndex += length;
      if (relativeIndex < 0 || relativeIndex >= length) return undefined;
      return this[relativeIndex];
    }
  });
}
