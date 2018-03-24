const CryptoKey = require('./CryptoKey')
const RangeMap = require('./RangeMap')

module.exports = CryptoBook

/**
 * Stores a number of encryption keys, sorted by feed offset / index
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
/**
 * Add a key to the book
 * @param {number} index offset
 * @param {CryptoKey} cryptoKey
 */
CryptoBook.prototype.add = function (index, cryptoKey) {
  if (typeof index !== 'number') {
    throw new Error('index must be a number')
  }
  if (!(cryptoKey instanceof CryptoKey)) {
    throw new Error('cryptoKey must be an instance of CryptoKey')
  }

  this.entries.insert(index, cryptoKey)
}

/**
 * Generates a new key and adds it to the book
 * @param {number} offset
 */
CryptoBook.prototype.generateNewKey = function (offset) {
  var cryptoKey = new CryptoKey()
  this.entries.insert(offset, cryptoKey)
}

/**
 * Get key for offset [index]
 * @param {number} index
 * @returns {{index, cryptoKey}}
 */
CryptoBook.prototype.get = function (index) {
  var next = this.entries.getNextLower(index)
  return {index: next.key, cryptoKey: next.value}
}

/**
 * @returns{[{key, {nonce, iv}}, ...]}
 */
CryptoBook.prototype.serialize = function () {
  return this.entries.serialize()
}

/**
 * @param {Buffer | Array} data
 * @param {number} offset
 * @return {Uint8Array}
 */
CryptoBook.prototype.encrypt = function (data, offset) {
  offset = (typeof offset === 'number') ? offset : 0
  var key = this.get(offset)
  return key.cryptoKey.encrypt(data, offset)
}

/**
 * @param {Buffer | Array} data
 * @param {number} offset
 * @return {Uint8Array}
 */
CryptoBook.prototype.decrypt = function (data, offset) {
  offset = (typeof offset === 'number') ? offset : 0
  var key = this.get(offset)
  // data = (data instanceof Uint8Array) ? data : new Uint8Array(data)
  return key.cryptoKey.decrypt(data, offset)
}
