const hypercore = require('../index')
const CryptoLib = require('../libs/CryptoLib')
const CryptoBook = require('../libs/CryptoBook')
const tape = require('tape')
const ram = require('random-access-memory')

function replicate (a, b, opts) {
  var stream = a.replicate(opts)
  return stream.pipe(b.replicate(opts)).pipe(stream)
}

const cryptoLib = CryptoLib.getInstance()

tape('basic', t => {
  t.plan(7)
  const core = hypercore(ram, null, {
    encryptionKeyBook: new CryptoBook(),
    valueEncoding: 'utf-8'
  })
  core.on('ready', () => {
    core.newEncryptionKey(append)
  })

  function append () {
    core.append('hello')
    core.append([' ', 'world'], read)
  }

  function read () {
    t.same(core.length, 3)
    core.get(0, (err, data) => {
      t.error(err)
      t.same(data, 'hello', data)
    })

    core.get(1, (err, data) => {
      t.error(err)
      t.same(data, ' ', data)
    })

    core.get(2, (err, data) => {
      t.error(err)
      t.same(data, 'world', data)
    })
  }
})
tape('two keys', t => {
  t.plan(7)
  const core = hypercore(ram, null, {
    encryptionKeyBook: new CryptoBook(),
    valueEncoding: 'utf-8'
  })
  core.on('ready', () => {
    core.newEncryptionKey(append)
  })

  function append () {
    core.append('hello', () => {
      core.newEncryptionKey(() => {
        core.append([' ', 'world'], read)
      })
    })
  }

  function read () {
    t.same(core.length, 3)
    core.get(0, (err, data) => {
      t.error(err)
      t.same(data, 'hello')
    })

    core.get(1, (err, data) => {
      t.error(err)
      t.same(data, ' ')
    })

    core.get(2, (err, data) => {
      t.error(err)
      t.same(data, 'world')
    })
  }
})
tape('CryptoLib & replicate', t => {
  t.plan(8)
  const core = hypercore(ram, null, {
    valueEncoding: 'utf-8'
  })
  core.on('ready', () => {
    t.ok(cryptoLib.getBook(core.key.toString('hex')) !== null)

    core.append('hello', () => {
      core.newEncryptionKey(() => {
        core.append([' ', 'world'], ready)
      })
    })
  })

  function ready () {
    const key = core.key
    const clone = hypercore(ram, key, {valueEncoding: 'utf-8'})
    clone.on('ready', () => {
      replicate(core, clone, {live: true, sparse: false})
      clone.createReadStream().on('data', (data) => {
        console.log(data)
      })
    })

    clone.get(0, (err, data) => {
      t.error(err)
      t.same(clone.length, 3)
      t.same(data, 'hello')
    })

    clone.get(1, (err, data) => {
      t.error(err)
      t.same(data, ' ')
    })

    clone.get(2, (err, data) => {
      t.error(err)
      t.same(data, 'world')
    })
  }
})

tape('noEncryption', t => {
  t.plan(7)
  const core = hypercore(ram, null, {
    noEncryption: true,
    valueEncoding: 'utf-8'
  })
  core.on('ready', () => {
    core.append('hello')
    core.append([' ', 'world'], read)
  })

  function read () {
    t.same(core.cryptoBook, null)
    t.same(core.length, 3)
    core.get(0, (err, data) => {
      t.error(err)
      t.same(data, 'hello')
    })

    core.get(1, (err, data) => {
      t.error(err)
      t.same(data, ' ')
    })

    core.get(2, (err, data) => {
      t.error(err)
      t.same(data, 'world')
    })
  }
})
