# hypercore-encrypted

Wrapper around [hypercore](https://github.com/mafintosh/hypercore) that simplifies encryption

**Warning: this is not yet stable, there certainly are bugs and everything is subject to change!**

As of version 0.1 the encryption functionality has to be passed to the constructor (as part of the options)!
The library is intended to be used with AES-CTR, but can as well be used with most other ciphers.

The encryption and decryption functions are passed the following parameters:

* data: Uint8Array - the plaintext/ciphertext to be processed
* offs: number - byte position in the append-only log
* callback: (result: Uint8Array) => void - callback function that MUST be called with the result

## Usage

Install it using npm:

``` cli
npm i hypercore-encrypted
```

``` js
const ram = require('random-access-memory')

var feed = hypercore(ram(), null, {
  encrypt: (data, offs, cb) => {let result = encryptSomehow(...); cb(result)},
  decrypt: (data, offs, cb) => {let result = decryptSomehow(...); cb(result)}
})

// then use it as if it was a normal hypercore...
```

## TODO

* [ ] write lock during the encryption to make sure the byte offset is correct (until then async use is dangerous)
* [ ] default encryption/decryption functions
* [ ] more tests
