const hypercore = require('../index')
const tape = require('tape')
const ram = require('random-access-memory')

function replicate (a, b, opts) {
  var stream = a.replicate(true, opts)
  return stream.pipe(b.replicate(false, opts)).pipe(stream)
}

// pseudo-encryption for testing ;-)
function encrypt (data, offset, callback) {
  for (let i = 0; i < data.length; i++) {
    data[i] += (i + offset) % 100
  }
  callback(data)
}

function decrypt (data, offset, callback) {
  for (let i = 0; i < data.length; i++) {
    data[i] -= (i + offset) % 100
  }
  callback(data)
}

tape('basic', t => {
  t.plan(7)
  const core = hypercore(ram, null, {
    valueEncoding: 'utf-8',
    encrypt: encrypt,
    decrypt: decrypt
  })
  core.on('ready', append)

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

tape('replicate', t => {
  t.plan(7)
  const core = hypercore(ram, null, {
    valueEncoding: 'utf-8',
    encrypt: encrypt,
    decrypt: decrypt
  })
  core.on('ready', append)

  function append () {
    core.append('hello')
    core.append([' ', 'world'], copy)
  }
  function copy () {
    const key = core.key
    const clone = hypercore(ram, key, { valueEncoding: 'utf-8', encrypt: encrypt, decrypt: decrypt })
    clone.on('ready', () => {
      replicate(core, clone, { live: true, download: true })

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
    })
  }
})
