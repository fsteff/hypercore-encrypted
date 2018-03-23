const CryptoKey = require('./CryptoKey')
const RangeMap = require('./RangeMap')

module.exports = CryptoBook

/**
 *
 * @param {string | Array} init (optional)
 */
function CryptoBook (init) {
  if (!(this instanceof CryptoBook)) return new CryptoBook(init)

  this.entries = new RangeMap()

  if (typeof init === 'string') {
    try {
      init = JSON.parse(init)
      if (!Array.isArray(init)) throw new Error('expected an array')
    } catch (err) {
      throw new Error('CryptoBook deserialisation failed: ' + err)
    }
  }

  if (Array.isArray(init)) {
    try {
      for (var i = 0; i < init.length; i++) {
        var cryptoKey = new CryptoKey(init[i].value)
        this.entries.insert(init[i].key, cryptoKey)
      }
    } catch (err) {
      throw new Error('CryptoBook element deserialisation failed: ' + err)
    }
  }
}

CryptoBook.prototype.add = function (index, cryptoKey) {
  if (typeof index !== 'number') {
    throw new Error('index must be a number')
  }
  if (!(cryptoKey instanceof CryptoKey)) {
    throw new Error('cryptoKey must be an instance of CryptoKey')
  }

  this.entries.insert(index, cryptoKey)
}

CryptoBook.prototype.generateNewKey = function (offset) {
  var cryptoKey = new CryptoKey()
  this.entries.insert(offset, cryptoKey)
}

CryptoBook.prototype.get = function (index) {
  var next = this.entries.getNextLower(index)
  return {index: next.key, cryptoKey: next.value}
}

CryptoBook.prototype.serialize = function () {
  return this.entries.serialize()
}

CryptoBook.prototype.encrypt = function (data, offset) {
  offset = (typeof offset === 'number') ? offset : 0
  var key = this.get(offset)
  return key.cryptoKey.encrypt(data, offset)
}

CryptoBook.prototype.decrypt = function (data, offset) {
  offset = (typeof offset === 'number') ? offset : 0
  var key = this.get(offset)
  return key.cryptoKey.decrypt(data, offset)
}
