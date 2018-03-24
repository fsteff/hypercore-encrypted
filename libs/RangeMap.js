
module.exports = RangeMap

/**
 * Sorted Map optimized for the use in CryptoBook
 * with the ability to search the next lower element for a value
 * @param {Array | RangeMap} init (optional)
 */
function RangeMap (init) {
  if (!(this instanceof RangeMap)) return new RangeMap(init)

  const self = this
  this._list = []

  if (init instanceof RangeMap) {
    init._list.array.forEach(element => {
      self.insert(element)
    })
  }

  if (Array.isArray(init)) {
    init.forEach(element => {
      self.insert(element)
    })
  }

  Object.defineProperty(this, 'length', {get: () => { return self._list.length }})
}

/**
 * Insert a new key-value pair
 * @param {RangeMap.MapElement | number | string} key
 * @param {*} value
 */
RangeMap.prototype.insert = function (key, value) {
  var element = null
  if (key instanceof RangeMap.MapElement ||
        (typeof key.compareTo === 'function' && typeof key.serialize === 'function')) {
    element = key
  } else {
    element = new RangeMap.MapElement(key, value)
  }

  // typical usecase is appending a larger value
  var i = this._list.length - 1
  if (i < 0) {
    this._list[0] = element
    return
  }

  while (i > 0 && this._list[i].compareTo(element) > 0) {
    i--
  }

  if (this._list[i].compareTo(element) === 0) {
    throw new Error('element with same key already stored in RangeMap')
  }

  if (i === this._list.length - 1) {
    this._list.push(element)
  } else {
    this._list.splice(i, 0, element)
  }
}

RangeMap.prototype.get = function (value) {
  var found = this._list.find((elem) => elem.compareTo(value) === 0)
  if (typeof found !== 'undefined') {
    return found
  } else {
    return null
  }
}

RangeMap.prototype.getNextLower = function (value) {
  if (this._list.length === 0) return null

  var zerodiff = this._list[0].compareTo(value)
  // first element is larger -> no element that is <= value
  if (zerodiff > 0) return null
  // often this is the case, so check this before starting the binary search
  if (zerodiff === 0) return this._list[0]

  // also often the case: last element
  zerodiff = this._list[this._list.length-1].compareTo(value)
  if(zerodiff <= 0) return this._list[this._list.length-1]


  var left = 0
  var right = this._list.length - 1
  var mid = Math.floor((right - left) / 2)

  // binary search
  while (right - left > 1) {
    var midelem = this._list[mid]
    var diff = midelem.compareTo(value)
    if (diff < 0) {
      left = mid
      mid = Math.floor((right - left) / 2) + mid
    } else {
      if (diff === 0) {
        return midelem
      }
      right = mid
      mid = Math.floor((right - left) / 2)
    }
  }

  return this._list[left]
}

RangeMap.prototype.serialize = function () {
  var list = new Array(this._list.length)
  for (var i = 0; i < this._list.length; i++) {
    list[i] = this._list[i].serialize()
  }
  return list
}

RangeMap.MapElement = function (key, value) {
  if (!(this instanceof RangeMap.MapElement)) return new RangeMap.MapElement(key, value)

  // deserialize
  if (typeof key === 'object' &&
  typeof key.key === 'number' &&
  typeof key.value !== 'undefined') {
    value = key.value
    key = key.key
  }

  this.value = value
  this.key = key
}

RangeMap.MapElement.prototype.compareTo = function (other) {
  if (other instanceof RangeMap.MapElement ||
    (typeof other === 'object' && typeof other.key === 'number')) {
    other = other.key
  }

  if (typeof this.key !== typeof other) {
    throw new Error('cannot compare objects of different type!')
  }

  switch (typeof this.key) {
    case 'number': return this.key - other
    case 'string': return this.key.localeCompare(other)
    default: throw new Error('unsupported MapElement value - consider implementing your own compareTo Method!')
  }
}

RangeMap.MapElement.prototype.serialize = function () {
  // if type not known create a deep copy
  var val = (typeof this.value.serialize === 'function') ? this.value.serialize() : JSON.parse(JSON.stringify(this.value))
  return {key: this.key, value: val}
}
