const hyperdrive = require('hyperdrive')
const inherits = require('inherits')
var path = require('path')
var messages = require('hyperdrive/lib/messages')
var raf = require('random-access-file')
var sodium = require('sodium-universal')
const hypercore = require('../index')

module.exports = Drive

function Drive (storage, key, opts) {
  if (!(this instanceof Drive)) return new Drive(storage, key, opts)
  if (isObject(key)) {
    opts = key
    key = null
  }
  if (!opts) opts = {}

  this.metadataKeyBook = opts.metadataKeyBook || null
  this.contentKeyBook = opts.contentKeyBook || null

  this._storages = defaultStorage(this, storage, opts)
  this.metadata = opts.metadata || hypercore(this._storages.metadata, key, {
    secretKey: opts.secretKey,
    sparse: opts.sparseMetadata,
    createIfMissing: opts.createIfMissing,
    storageCacheSize: opts.metadataStorageCacheSize,
    encryptionKeyBook: this.metadataKeyBook
  })

  hyperdrive.call(this, storage, key, opts)
}

inherits(Drive, hyperdrive)

Drive.prototype._open = function (cb) {
  var self = this

  this.tree.ready(function (err) {
    if (err) return cb(err)
    self.metadata.ready(function (err) {
      if (err) return cb(err)
      if (self.content) return cb(null)

      self.key = self.metadata.key
      self.discoveryKey = self.metadata.discoveryKey

      if (!self.metadata.writable || self._checkout) onnotwriteable()
      else onwritable()
    })
  })

  function onnotwriteable () {
    if (self.metadata.has(0)) return self._loadIndex(cb)
    self._loadIndex(noop)
    cb()
  }

  function onwritable () {
    var wroteIndex = self.metadata.has(0)
    if (wroteIndex) return self._loadIndex(cb)

    if (!self.content) {
      var keyPair = contentKeyPair(self.metadata.secretKey)
      var opts = contentOptions(self, keyPair.secretKey)
      self.content = hypercore(self._storages.content, keyPair.publicKey, opts)
      self.content.on('error', function (err) {
        self.emit('error', err)
      })
    }

    self.content.ready(function () {
      if (self.metadata.has(0)) return cb(new Error('Index already written'))
      self.metadata.append(messages.Index.encode({type: 'hyperdrive', content: self.content.key}), cb)
    })
  }
}

Drive.prototype._loadIndex = function (cb) {
  var self = this

  if (this._checkout) this._checkout._loadIndex(done)
  else this.metadata.get(0, {valueEncoding: messages.Index}, done)

  function done (err, index) {
    if (err) return cb(err)
    if (self.content) return self.content.ready(cb)

    var keyPair = self.metadata.writable && contentKeyPair(self.metadata.secretKey)
    var opts = contentOptions(self, keyPair && keyPair.secretKey)
    opts.encryptionKeyBook = self.contentKeyBook

    self.content = self._checkout ? self._checkout.content : hypercore(self._storages.content, index.content, opts)
    self.content.on('error', function (err) {
      self.emit('error', err)
    })
    self.content.ready(function (err) {
      if (err) return cb(err)
      self._oncontent()
      cb()
    })
  }
}

function isObject (val) {
  return !!val && typeof val !== 'string' && !Buffer.isBuffer(val)
}

function defaultStorage (self, storage, opts) {
  var folder = ''

  if (typeof storage === 'object' && storage) return wrap(self, storage)

  if (typeof storage === 'string') {
    folder = storage
    storage = raf
  }

  return {
    metadata: function (name) {
      return storage(path.join(folder, 'metadata', name))
    },
    content: function (name) {
      return storage(path.join(folder, 'content', name))
    }
  }
}

function noop () {}

function contentKeyPair (secretKey) {
  var seed = new Buffer(sodium.crypto_sign_SEEDBYTES)
  var context = new Buffer('hyperdri') // 8 byte context
  var keyPair = {
    publicKey: new Buffer(sodium.crypto_sign_PUBLICKEYBYTES),
    secretKey: new Buffer(sodium.crypto_sign_SECRETKEYBYTES)
  }

  sodium.crypto_kdf_derive_from_key(seed, 1, context, secretKey)
  sodium.crypto_sign_seed_keypair(keyPair.publicKey, keyPair.secretKey, seed)
  if (seed.fill) seed.fill(0)

  return keyPair
}

function contentOptions (self, secretKey) {
  return {
    sparse: self.sparse || self.latest,
    maxRequests: self.maxRequests,
    secretKey: secretKey,
    storeSecretKey: false,
    indexing: self.metadata.writable && self.indexing,
    storageCacheSize: self.contentStorageCacheSize
  }
}

function wrap (self, storage) {
  return {
    metadata: function (name, opts) {
      return storage.metadata(name, opts, self)
    },
    content: function (name, opts) {
      return storage.content(name, opts, self)
    }
  }
}
